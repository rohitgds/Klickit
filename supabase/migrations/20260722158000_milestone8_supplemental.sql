-- Milestone 8 supplemental — continuity contract validation and extended print types

SET search_path = dentos_data, dentos_runtime, public;

CREATE OR REPLACE FUNCTION dentos_runtime.validate_continuity_task_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  clinic_organization_id uuid;
  clinic_timezone character varying;
  patient_organization_id uuid;
  expected_due_at timestamptz;
  source_patient_id uuid;
  source_clinic_id uuid;
  template_organization_id uuid;
  template_channel character varying;
  template_purpose character varying;
  template_status character varying;
  policy_organization_id uuid;
  policy_clinic_id uuid;
  offset_count integer;
  distinct_offset_count integer;
BEGIN
  SELECT c.organization_id, c.timezone
    INTO STRICT clinic_organization_id, clinic_timezone
  FROM dentos_data.clinics c
  WHERE c.id = NEW.clinic_id AND c.active = true;

  SELECT p.organization_id
    INTO STRICT patient_organization_id
  FROM dentos_data.patients p
  WHERE p.id = NEW.patient_id AND p.active = true;

  IF clinic_organization_id <> NEW.organization_id OR patient_organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'continuity organization, clinic, and patient mismatch' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM dentos_data.patient_clinics pc
  WHERE pc.patient_id = NEW.patient_id AND pc.clinic_id = NEW.clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'continuity patient is not linked to the clinic' USING ERRCODE = '23514';
  END IF;

  expected_due_at := (NEW.due_date + NEW.due_local_time) AT TIME ZONE clinic_timezone;
  IF NEW.due_at IS DISTINCT FROM expected_due_at THEN
    RAISE EXCEPTION 'continuity due_at does not match clinic-local due date and time' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT offset_value)
    INTO offset_count, distinct_offset_count
  FROM UNNEST(NEW.reminder_offsets_minutes) AS offset_value;
  IF offset_count <> distinct_offset_count THEN
    RAISE EXCEPTION 'continuity reminder offsets contain duplicates' USING ERRCODE = '23514';
  END IF;

  IF NEW.continuity_policy_id IS NOT NULL THEN
    SELECT cp.organization_id, cp.clinic_id
      INTO STRICT policy_organization_id, policy_clinic_id
    FROM dentos_data.continuity_policies cp
    WHERE cp.id = NEW.continuity_policy_id AND cp.active = true;
    IF policy_organization_id <> NEW.organization_id
       OR (policy_clinic_id IS NOT NULL AND policy_clinic_id <> NEW.clinic_id) THEN
      RAISE EXCEPTION 'continuity policy belongs to another organization or clinic' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.source_type = 'care_delivery' THEN
    SELECT cp.patient_id, v.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM dentos_data.care_deliveries cp
    JOIN dentos_data.care_encounters v ON v.id = cp.care_encounter_id
    WHERE cp.id = NEW.care_delivery_id;
  ELSIF NEW.source_type = 'care_plan_service' THEN
    SELECT tp.patient_id, NEW.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM dentos_data.care_plan_services tpi
    JOIN dentos_data.care_plan_stages tpp ON tpp.id = tpi.care_plan_stage_id
    JOIN dentos_data.care_plans tp ON tp.id = tpp.care_plan_id
    WHERE tpi.id = NEW.care_plan_service_id;
  ELSIF NEW.source_type = 'care_encounter' THEN
    SELECT v.patient_id, v.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM dentos_data.care_encounters v
    WHERE v.id = NEW.care_encounter_id;
  ELSIF NEW.source_type = 'care_booking' THEN
    SELECT a.patient_id, a.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM dentos_data.care_bookings a
    WHERE a.id = NEW.care_booking_id;
  ELSIF NEW.source_type = 'medication_order' THEN
    SELECT pr.patient_id, pr.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM dentos_data.medication_orders pr
    WHERE pr.id = NEW.medication_order_id;
  ELSE
    source_patient_id := NEW.patient_id;
    source_clinic_id := NEW.clinic_id;
  END IF;

  IF source_patient_id IS DISTINCT FROM NEW.patient_id OR source_clinic_id IS DISTINCT FROM NEW.clinic_id THEN
    RAISE EXCEPTION 'continuity source belongs to another patient or clinic' USING ERRCODE = '23514';
  END IF;

  IF NEW.send_sms THEN
    SELECT mt.organization_id, mt.channel, mt.purpose, mt.approval_status
      INTO STRICT template_organization_id, template_channel, template_purpose, template_status
    FROM dentos_data.message_templates mt WHERE mt.id = NEW.sms_template_id AND mt.active = true;
    IF template_organization_id <> NEW.organization_id OR template_channel <> 'sms' OR template_purpose <> NEW.message_purpose OR template_status <> 'approved' THEN
      RAISE EXCEPTION 'continuity SMS template is not an approved matching template' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.send_whatsapp THEN
    SELECT mt.organization_id, mt.channel, mt.purpose, mt.approval_status
      INTO STRICT template_organization_id, template_channel, template_purpose, template_status
    FROM dentos_data.message_templates mt WHERE mt.id = NEW.whatsapp_template_id AND mt.active = true;
    IF template_organization_id <> NEW.organization_id OR template_channel <> 'whatsapp' OR template_purpose <> NEW.message_purpose OR template_status <> 'approved' THEN
      RAISE EXCEPTION 'continuity WhatsApp template is not an approved matching template' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_continuity_tasks_contract_validate ON dentos_data.continuity_tasks;
CREATE TRIGGER trg_continuity_tasks_contract_validate
BEFORE INSERT OR UPDATE ON dentos_data.continuity_tasks
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_continuity_task_contract();

ALTER TABLE dentos_data.document_print_snapshots
  DROP CONSTRAINT IF EXISTS ck_document_print_snapshots_type;

ALTER TABLE dentos_data.document_print_snapshots
  ADD CONSTRAINT ck_document_print_snapshots_type CHECK (
    document_type IN (
      'care_plan',
      'medication_order',
      'consent',
      'fee_statement',
      'collection_receipt',
      'appointment_slip',
      'patient_label',
      'thermal_receipt',
      'cghs_form',
      'corporate_form'
    )
  );
