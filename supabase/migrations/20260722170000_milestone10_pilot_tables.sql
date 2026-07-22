-- Milestone 10 — pilot release candidate, reconciliation, acceptance and unresolved issues

SET search_path = dentos_runtime, dentos_data, public;

CREATE TABLE dentos_runtime.pilot_release_candidates (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  release_code character varying NOT NULL,
  status character varying NOT NULL CHECK (status IN ('draft', 'candidate', 'approved', 'rolled_back')),
  checklist_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  production_approved boolean NOT NULL DEFAULT false,
  production_approved_at timestamptz,
  rollback_plan_reference character varying NOT NULL DEFAULT 'docs/runbooks/rohini-rollback.md',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES dentos_data.users(id),
  approved_by uuid REFERENCES dentos_data.users(id)
);

CREATE TABLE dentos_runtime.pilot_daily_reconciliations (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  reconciliation_date date NOT NULL,
  source_total_minor bigint NOT NULL,
  output_total_minor bigint NOT NULL,
  variance_minor bigint NOT NULL,
  status character varying NOT NULL CHECK (status IN ('balanced', 'variance')),
  notes character varying,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by uuid REFERENCES dentos_data.users(id),
  UNIQUE (clinic_id, reconciliation_date)
);

CREATE TABLE dentos_runtime.pilot_acceptance_records (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  acceptance_type character varying NOT NULL CHECK (acceptance_type IN ('pilot_report', 'handover', 'sale_readiness')),
  scenarios_passed integer NOT NULL,
  scenarios_total integer NOT NULL,
  unresolved_severity12 integer NOT NULL DEFAULT 0,
  accepted boolean NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by uuid REFERENCES dentos_data.users(id)
);

CREATE TABLE dentos_runtime.pilot_unresolved_issues (
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  severity smallint NOT NULL CHECK (severity BETWEEN 1 AND 5),
  title character varying NOT NULL,
  description character varying,
  status character varying NOT NULL CHECK (status IN ('open', 'resolved', 'accepted_risk')),
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  created_by uuid REFERENCES dentos_data.users(id)
);

CREATE INDEX ix_pilot_release_candidates_clinic ON dentos_runtime.pilot_release_candidates (clinic_id, created_at DESC);
CREATE INDEX ix_pilot_daily_reconciliations_clinic_date ON dentos_runtime.pilot_daily_reconciliations (clinic_id, reconciliation_date DESC);
CREATE INDEX ix_pilot_unresolved_issues_clinic_status ON dentos_runtime.pilot_unresolved_issues (clinic_id, status, severity);
