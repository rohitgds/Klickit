-- Generated from Blueprint 01 — audit and row-version functions

SET search_path = dentos_data, dentos_runtime, public;

CREATE OR REPLACE FUNCTION dentos_runtime.touch_mutable_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.row_version := OLD.row_version + 1;
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := nullif(current_setting('dentos_runtime.user_id', true), '')::uuid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dentos_runtime.write_audit_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = dentos_data, dentos_runtime, public AS $$
DECLARE
  before_doc jsonb;
  after_doc jsonb;
  source_doc jsonb;
  actor uuid;
  organization_value uuid;
  clinic_value uuid;
  record_value uuid;
BEGIN
  before_doc := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  after_doc := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  before_doc := before_doc - ARRAY['password_hash','token_hash','temporary_password','mfa_secret'];
  after_doc := after_doc - ARRAY['password_hash','token_hash','temporary_password','mfa_secret'];
  source_doc := coalesce(after_doc, before_doc, '{}'::jsonb);
  actor := COALESCE(
    nullif(current_setting('dentos_runtime.user_id', true), '')::uuid,
    nullif(source_doc ->> 'updated_by', '')::uuid,
    nullif(source_doc ->> 'created_by', '')::uuid,
    nullif(source_doc ->> 'actor_user_id', '')::uuid
  );
  organization_value := COALESCE(
    nullif(source_doc ->> 'organization_id', '')::uuid,
    nullif(current_setting('dentos_runtime.organization_id', true), '')::uuid
  );
  clinic_value := COALESCE(
    nullif(source_doc ->> 'clinic_id', '')::uuid,
    nullif(current_setting('dentos_runtime.clinic_id', true), '')::uuid
  );
  record_value := COALESCE(
    nullif(source_doc ->> 'id', '')::uuid,
    nullif(source_doc ->> 'user_id', '')::uuid,
    nullif(source_doc ->> 'patient_id', '')::uuid,
    nullif(source_doc ->> 'staff_id', '')::uuid,
    nullif(source_doc ->> 'clinic_id', '')::uuid
  );
  INSERT INTO dentos_data.audit_events (id, organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, reason, request_id, occurred_at, created_at, created_by)
  VALUES (gen_random_uuid(), organization_value, clinic_value, actor, lower(TG_OP), TG_TABLE_NAME, record_value, before_doc, after_doc, nullif(current_setting('dentos_runtime.reason', true), ''), nullif(current_setting('dentos_runtime.request_id', true), '')::uuid, clock_timestamp(), clock_timestamp(), actor);
  RETURN coalesce(NEW, OLD);
END;
$$;

