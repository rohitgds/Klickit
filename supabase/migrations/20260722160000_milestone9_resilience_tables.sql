-- Milestone 9 — backup, restore drill, gateway incident and readiness drill records

SET search_path = dentos_runtime, dentos_data, public;

CREATE TABLE dentos_runtime.backup_runs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_id uuid,
  backup_type character varying NOT NULL DEFAULT 'database',
  status character varying NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  checksum character varying,
  artifact_path character varying,
  retention_days smallint NOT NULL DEFAULT 30,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  created_by uuid REFERENCES dentos_data.users(id),
  notes character varying
);

CREATE TABLE dentos_runtime.restore_drills (
  id uuid PRIMARY KEY,
  backup_run_id uuid REFERENCES dentos_runtime.backup_runs(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  status character varying NOT NULL CHECK (status IN ('started', 'passed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  variance_notes character varying,
  created_by uuid REFERENCES dentos_data.users(id)
);

CREATE TABLE dentos_runtime.gateway_incidents (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  incident_type character varying NOT NULL CHECK (incident_type IN ('spare_activation', 'hardware_failure', 'recovery_drill')),
  status character varying NOT NULL CHECK (status IN ('open', 'closed')),
  spare_gateway_code character varying,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  runbook_reference character varying,
  created_by uuid REFERENCES dentos_data.users(id)
);

CREATE TABLE dentos_runtime.readiness_drill_runs (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  drill_code character varying NOT NULL,
  status character varying NOT NULL CHECK (status IN ('started', 'passed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES dentos_data.users(id)
);

CREATE INDEX ix_backup_runs_clinic_started ON dentos_runtime.backup_runs (clinic_id, started_at DESC);
CREATE INDEX ix_readiness_drill_runs_clinic_code ON dentos_runtime.readiness_drill_runs (clinic_id, drill_code, started_at DESC);
