-- Milestone 3 Phase 23 — synthetic DrKlick demographic import staging (no live DrKlick connection).
-- Reference-only migration staging; production import requires owner approval.

SET search_path = dentos_runtime, dentos_data, public;

CREATE TABLE dentos_runtime.drklick_import_batches (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  source_label varchar NOT NULL DEFAULT 'synthetic-dry-run',
  source_reference varchar,
  status varchar NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'accepted', 'rejected', 'applied')),
  row_count integer NOT NULL DEFAULT 0,
  valid_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES dentos_data.users(id),
  validated_at timestamptz,
  validated_by uuid REFERENCES dentos_data.users(id),
  applied_at timestamptz,
  applied_by uuid REFERENCES dentos_data.users(id),
  notes varchar
);

CREATE TABLE dentos_runtime.drklick_import_rows (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES dentos_runtime.drklick_import_batches(id),
  source_row_number integer NOT NULL,
  source_patient_key varchar,
  payload_json jsonb NOT NULL,
  normalized_json jsonb,
  validation_status varchar NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid')),
  validation_errors jsonb,
  mapped_patient_id uuid REFERENCES dentos_data.patients(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_drklick_import_rows_batch_row UNIQUE (batch_id, source_row_number)
);

CREATE TABLE dentos_runtime.offline_auth_snapshots (
  device_fingerprint_hash varchar PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  user_id uuid NOT NULL REFERENCES dentos_data.users(id),
  authz_version bigint NOT NULL,
  permission_codes jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX ix_drklick_import_rows_batch_status ON dentos_runtime.drklick_import_rows (batch_id, validation_status, source_row_number);
CREATE INDEX ix_offline_auth_snapshots_clinic ON dentos_runtime.offline_auth_snapshots (clinic_id, expires_at);
