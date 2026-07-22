-- Generated from Blueprint 01 — continuity and recall foundation (Milestone 8)

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.continuity_policies (
  id uuid NOT NULL CONSTRAINT pk_continuity_policies PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid,
  name character varying NOT NULL,
  trigger_event character varying NOT NULL CONSTRAINT ck_continuity_policies_trigger_event CHECK (trigger_event IN ('service_completed','encounter_checkout','medication_order_saved','care_booking_no_show','manual')),
  service_id uuid,
  service_domain_id uuid,
  interval_value integer NOT NULL CONSTRAINT ck_continuity_policies_interval_value CHECK (interval_value BETWEEN 1 AND 3650),
  interval_unit character varying NOT NULL CONSTRAINT ck_continuity_policies_interval_unit CHECK (interval_unit IN ('day','week','month','year')),
  due_local_time time NOT NULL DEFAULT '09:00:00',
  adjust_to_working_day boolean NOT NULL DEFAULT false,
  allow_custom_date boolean NOT NULL DEFAULT true,
  recurring boolean NOT NULL DEFAULT false,
  recurrence_anchor character varying NOT NULL DEFAULT 'source_completion' CONSTRAINT ck_continuity_policies_recurrence_anchor CHECK (recurrence_anchor IN ('source_completion','completed_continuity','prior_due_date')),
  send_sms boolean NOT NULL DEFAULT false,
  sms_template_id uuid,
  send_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_template_id uuid,
  reminder_offsets_minutes integer[] NOT NULL DEFAULT ARRAY[10080,1440],
  message_purpose character varying NOT NULL DEFAULT 'care' CONSTRAINT ck_continuity_policies_message_purpose CHECK (message_purpose IN ('care','transactional')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_continuity_policies_service_scope CHECK (NOT (service_id IS NOT NULL AND service_domain_id IS NOT NULL)),
  CONSTRAINT ck_continuity_policies_sms_template CHECK ((send_sms = false) OR sms_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_policies_whatsapp_template CHECK ((send_whatsapp = false) OR whatsapp_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_policies_offsets CHECK (cardinality(reminder_offsets_minutes) BETWEEN 1 AND 10 AND array_position(reminder_offsets_minutes, NULL) IS NULL AND 0 <= ALL(reminder_offsets_minutes))
);

CREATE TABLE dentos_data.continuity_recall_records (
  id uuid NOT NULL CONSTRAINT pk_continuity_recall_records PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  source_care_encounter_id uuid,
  rule_id uuid NOT NULL,
  due_date date,
  status character varying,
  assigned_to uuid,
  completed_care_encounter_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.continuity_tasks (
  id uuid NOT NULL CONSTRAINT pk_continuity_tasks PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  care_booking_id uuid,
  care_delivery_id uuid,
  care_plan_service_id uuid,
  medication_order_id uuid,
  orthodontic_program_enrollment_id uuid,
  continuity_policy_id uuid,
  source_type character varying NOT NULL CONSTRAINT ck_continuity_tasks_source_type CHECK (source_type IN ('care_delivery','care_plan_service','care_encounter','care_booking','medication_order','orthodontic_program','manual')),
  source_id uuid NOT NULL,
  date_mode character varying NOT NULL CONSTRAINT ck_continuity_tasks_date_mode CHECK (date_mode IN ('rule','custom_date')),
  due_date date NOT NULL,
  due_local_time time NOT NULL,
  due_at timestamptz NOT NULL,
  interval_value_snapshot integer CONSTRAINT ck_continuity_tasks_interval_value CHECK (interval_value_snapshot IS NULL OR interval_value_snapshot BETWEEN 1 AND 3650),
  interval_unit_snapshot character varying CONSTRAINT ck_continuity_tasks_interval_unit CHECK (interval_unit_snapshot IS NULL OR interval_unit_snapshot IN ('day','week','month','year')),
  custom_date_selected_by uuid,
  custom_date_selected_at timestamptz,
  task_type character varying NOT NULL,
  reason_code character varying NOT NULL,
  notes character varying,
  status dentos_data.continuity_task_state NOT NULL DEFAULT 'scheduled',
  owner_clinician_id uuid,
  assigned_to uuid,
  reserved_care_booking_id uuid,
  snoozed_until timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason character varying,
  send_sms boolean NOT NULL DEFAULT false,
  sms_template_id uuid,
  send_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_template_id uuid,
  reminder_offsets_minutes integer[] NOT NULL DEFAULT ARRAY[10080,1440],
  message_purpose character varying NOT NULL DEFAULT 'care' CONSTRAINT ck_continuity_tasks_message_purpose CHECK (message_purpose IN ('care','transactional')),
  reminder_generation_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_continuity_tasks_source_due UNIQUE(clinic_id, source_type, source_id, task_type, due_date),
  CONSTRAINT ck_continuity_tasks_source_shape CHECK (
    (source_type = 'care_delivery' AND care_delivery_id IS NOT NULL AND care_delivery_id = source_id)
    OR (source_type = 'care_plan_service' AND care_plan_service_id IS NOT NULL AND care_plan_service_id = source_id)
    OR (source_type = 'care_encounter' AND care_encounter_id IS NOT NULL AND care_encounter_id = source_id)
    OR (source_type = 'care_booking' AND care_booking_id IS NOT NULL AND care_booking_id = source_id)
    OR (source_type = 'medication_order' AND medication_order_id IS NOT NULL AND medication_order_id = source_id)
    OR (source_type = 'orthodontic_program' AND orthodontic_program_enrollment_id IS NOT NULL AND orthodontic_program_enrollment_id = source_id)
    OR (source_type = 'manual')
  ),
  CONSTRAINT ck_continuity_tasks_custom_date_actor CHECK (
    (date_mode = 'custom_date' AND custom_date_selected_by IS NOT NULL AND custom_date_selected_at IS NOT NULL)
    OR
    (date_mode = 'rule' AND custom_date_selected_by IS NULL AND custom_date_selected_at IS NULL)
  ),
  CONSTRAINT ck_continuity_tasks_rule_shape CHECK (
    (date_mode = 'rule' AND continuity_policy_id IS NOT NULL AND interval_value_snapshot IS NOT NULL AND interval_unit_snapshot IS NOT NULL)
    OR
    (date_mode = 'custom_date')
  ),
  CONSTRAINT ck_continuity_tasks_sms_template CHECK ((send_sms = false) OR sms_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_tasks_whatsapp_template CHECK ((send_whatsapp = false) OR whatsapp_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_tasks_offsets CHECK (cardinality(reminder_offsets_minutes) BETWEEN 1 AND 10 AND array_position(reminder_offsets_minutes, NULL) IS NULL AND 0 <= ALL(reminder_offsets_minutes)),
  CONSTRAINT ck_continuity_tasks_terminal_state CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND completed_by IS NOT NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
    OR
    (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND NULLIF(BTRIM(cancellation_reason), '') IS NOT NULL AND completed_at IS NULL AND completed_by IS NULL)
    OR
    (status NOT IN ('completed','cancelled') AND completed_at IS NULL AND completed_by IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
  )
);

