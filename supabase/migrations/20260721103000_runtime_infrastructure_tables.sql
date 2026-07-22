-- Generated from Blueprint 01 — audit, outbox, jobs and idempotency

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.audit_events (
  id uuid NOT NULL CONSTRAINT pk_audit_events PRIMARY KEY,
  organization_id uuid,
  clinic_id uuid,
  actor_user_id uuid,
  action character varying,
  entity_type character varying,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  reason character varying,
  ip_hash character varying,
  created_at timestamptz,
  created_by uuid,
  request_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE dentos_data.outbox_events (
  id uuid NOT NULL CONSTRAINT pk_outbox_events PRIMARY KEY,
  organization_id uuid NOT NULL,
  topic character varying,
  aggregate_type character varying,
  aggregate_id uuid,
  payload_json jsonb,
  created_at timestamptz,
  published_at timestamptz,
  attempts integer,
  last_error character varying,
  created_by uuid,
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz
);

CREATE TABLE dentos_data.job_runs (
  id uuid NOT NULL CONSTRAINT pk_job_runs PRIMARY KEY,
  job_type character varying,
  scope_json jsonb,
  scheduled_for timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  status character varying,
  result_json jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

CREATE TABLE dentos_data.idempotency_keys (
  id uuid NOT NULL CONSTRAINT pk_idempotency_keys PRIMARY KEY,
  organization_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  operation character varying,
  key character varying,
  request_hash character varying,
  response_json jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_idempotency_keys_organization_id_operation_key UNIQUE(organization_id, operation, key)
);

