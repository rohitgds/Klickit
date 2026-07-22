-- Milestone 6 supplemental — acceptance, signing PIN, prescription revisions and print snapshots

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.care_plan_acceptance_records (
  id uuid NOT NULL CONSTRAINT pk_care_plan_acceptance_records PRIMARY KEY,
  care_plan_id uuid NOT NULL,
  acceptance_method character varying NOT NULL CONSTRAINT ck_care_plan_acceptance_records_method CHECK (acceptance_method IN ('staff_confirmed','otp','signature_upload')),
  accepted_total numeric(14,2) NOT NULL,
  confirmation_code character varying,
  signature_file_id uuid,
  signature_hash character varying,
  accepted_by uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  notes character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT ck_care_plan_acceptance_records_total CHECK (accepted_total >= 0)
);

ALTER TABLE dentos_data.care_plan_acceptance_records
  ADD CONSTRAINT fk_care_plan_acceptance_records_care_plan_id
  FOREIGN KEY (care_plan_id) REFERENCES dentos_data.care_plans(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.care_plan_acceptance_records
  ADD CONSTRAINT fk_care_plan_acceptance_records_signature_file_id
  FOREIGN KEY (signature_file_id) REFERENCES dentos_data.files(id)
  ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.care_plan_acceptance_records
  ADD CONSTRAINT fk_care_plan_acceptance_records_accepted_by
  FOREIGN KEY (accepted_by) REFERENCES dentos_data.users(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE dentos_data.staff_signing_pins (
  staff_id uuid NOT NULL CONSTRAINT pk_staff_signing_pins PRIMARY KEY,
  pin_hash character varying NOT NULL,
  pin_algorithm character varying NOT NULL DEFAULT 'sha256',
  failed_attempts smallint NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  CONSTRAINT ck_staff_signing_pins_hash CHECK (NULLIF(BTRIM(pin_hash), '') IS NOT NULL)
);

ALTER TABLE dentos_data.staff_signing_pins
  ADD CONSTRAINT fk_staff_signing_pins_staff_id
  FOREIGN KEY (staff_id) REFERENCES dentos_data.staff(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE dentos_data.medication_order_revisions (
  id uuid NOT NULL CONSTRAINT pk_medication_order_revisions PRIMARY KEY,
  replaced_order_id uuid NOT NULL,
  replacement_order_id uuid NOT NULL,
  revision_no smallint NOT NULL CONSTRAINT ck_medication_order_revisions_revision_no CHECK (revision_no >= 1),
  reason character varying NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL,
  CONSTRAINT uq_medication_order_revisions_replaced UNIQUE(replaced_order_id),
  CONSTRAINT uq_medication_order_revisions_replacement UNIQUE(replacement_order_id),
  CONSTRAINT ck_medication_order_revisions_reason CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL)
);

ALTER TABLE dentos_data.medication_order_revisions
  ADD CONSTRAINT fk_medication_order_revisions_replaced_order_id
  FOREIGN KEY (replaced_order_id) REFERENCES dentos_data.medication_orders(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.medication_order_revisions
  ADD CONSTRAINT fk_medication_order_revisions_replacement_order_id
  FOREIGN KEY (replacement_order_id) REFERENCES dentos_data.medication_orders(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.medication_order_revisions
  ADD CONSTRAINT fk_medication_order_revisions_created_by
  FOREIGN KEY (created_by) REFERENCES dentos_data.users(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE dentos_data.document_print_snapshots (
  id uuid NOT NULL CONSTRAINT pk_document_print_snapshots PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  document_type character varying NOT NULL CONSTRAINT ck_document_print_snapshots_type CHECK (document_type IN ('care_plan','medication_order','consent')),
  source_entity_type character varying NOT NULL,
  source_entity_id uuid NOT NULL,
  template_group_code character varying NOT NULL,
  template_key character varying NOT NULL,
  template_version integer NOT NULL,
  layout_json jsonb NOT NULL,
  payload_json jsonb NOT NULL,
  reprint_no smallint NOT NULL DEFAULT 1 CONSTRAINT ck_document_print_snapshots_reprint_no CHECK (reprint_no >= 1),
  rendered_file_id uuid,
  printed_by uuid NOT NULL,
  printed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

ALTER TABLE dentos_data.document_print_snapshots
  ADD CONSTRAINT fk_document_print_snapshots_organization_id
  FOREIGN KEY (organization_id) REFERENCES dentos_data.organizations(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.document_print_snapshots
  ADD CONSTRAINT fk_document_print_snapshots_clinic_id
  FOREIGN KEY (clinic_id) REFERENCES dentos_data.clinics(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.document_print_snapshots
  ADD CONSTRAINT fk_document_print_snapshots_rendered_file_id
  FOREIGN KEY (rendered_file_id) REFERENCES dentos_data.files(id)
  ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.document_print_snapshots
  ADD CONSTRAINT fk_document_print_snapshots_printed_by
  FOREIGN KEY (printed_by) REFERENCES dentos_data.users(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX ix_document_print_snapshots_source ON dentos_data.document_print_snapshots (source_entity_type, source_entity_id, reprint_no);

ALTER TABLE dentos_data.care_deliveries
  ADD CONSTRAINT fk_care_deliveries_care_plan_service_id
  FOREIGN KEY (care_plan_service_id) REFERENCES dentos_data.care_plan_services(id)
  ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
