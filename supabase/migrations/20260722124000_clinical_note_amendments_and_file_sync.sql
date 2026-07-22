-- Milestone 5 amendment — signed clinical note correction history

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.clinical_note_amendments (
  id uuid NOT NULL CONSTRAINT pk_clinical_note_amendments PRIMARY KEY,
  clinical_note_id uuid NOT NULL,
  sequence_no bigint NOT NULL CONSTRAINT ck_clinical_note_amendments_sequence_no CHECK (sequence_no >= 1),
  prior_body character varying NOT NULL,
  amended_body character varying NOT NULL,
  reason character varying NOT NULL,
  amended_by uuid NOT NULL,
  amended_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_clinical_note_amendments_note_sequence UNIQUE(clinical_note_id, sequence_no),
  CONSTRAINT ck_clinical_note_amendments_reason CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL)
);

ALTER TABLE dentos_data.clinical_note_amendments
  ADD CONSTRAINT fk_clinical_note_amendments_clinical_note_id
  FOREIGN KEY (clinical_note_id) REFERENCES dentos_data.clinical_notes(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.clinical_note_amendments
  ADD CONSTRAINT fk_clinical_note_amendments_amended_by
  FOREIGN KEY (amended_by) REFERENCES dentos_data.users(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.clinical_note_amendments
  ADD CONSTRAINT fk_clinical_note_amendments_created_by
  FOREIGN KEY (created_by) REFERENCES dentos_data.users(id)
  ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE dentos_runtime.file_sync_jobs (
  id uuid NOT NULL CONSTRAINT pk_file_sync_jobs PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  file_id uuid NOT NULL,
  direction character varying NOT NULL CONSTRAINT ck_file_sync_jobs_direction CHECK (direction IN ('upload','download')),
  status character varying NOT NULL DEFAULT 'pending' CONSTRAINT ck_file_sync_jobs_status CHECK (status IN ('pending','in_progress','completed','failed')),
  bytes_transferred bigint NOT NULL DEFAULT 0,
  total_bytes bigint,
  sha256_expected char(64),
  last_error character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX ix_file_sync_jobs_file_status ON dentos_runtime.file_sync_jobs (file_id, status, created_at);
