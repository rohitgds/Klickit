-- Sync dead-letter queue for rejected or failed cloud push events.

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_runtime.sync_dead_letters (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_id uuid NOT NULL REFERENCES dentos_runtime.clinic_gateways(id),
  outbox_event_id uuid REFERENCES dentos_runtime.sync_outbox_events(id),
  idempotency_key varchar NOT NULL,
  aggregate_type varchar NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar NOT NULL,
  payload_json jsonb NOT NULL,
  failure_reason varchar NOT NULL,
  failure_code varchar,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sync_dead_letters_idempotency UNIQUE (gateway_id, idempotency_key)
);

CREATE INDEX ix_sync_dead_letters_clinic ON dentos_runtime.sync_dead_letters (clinic_id, recorded_at DESC);
