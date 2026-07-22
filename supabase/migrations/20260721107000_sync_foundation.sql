-- KlickIt sync foundation from Blueprint 10 amendment.
-- Application-level outbox/inbox, cursors, conflicts and approved devices.

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_runtime.clinic_gateways (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_code varchar NOT NULL,
  hostname varchar,
  software_version varchar,
  last_seen_at timestamptz,
  last_successful_cloud_sync_at timestamptz,
  offline_started_at timestamptz,
  read_only_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES dentos_data.users(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES dentos_data.users(id),
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_clinic_gateways_clinic_gateway_code UNIQUE (clinic_id, gateway_code)
);

CREATE TABLE dentos_runtime.approved_devices (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_id uuid REFERENCES dentos_runtime.clinic_gateways(id),
  device_label varchar NOT NULL,
  device_fingerprint_hash varchar NOT NULL,
  approved_by uuid NOT NULL REFERENCES dentos_data.users(id),
  approved_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES dentos_data.users(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES dentos_data.users(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES dentos_data.users(id),
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_approved_devices_fingerprint UNIQUE (clinic_id, device_fingerprint_hash)
);

CREATE TABLE dentos_runtime.sync_cursors (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_id uuid NOT NULL REFERENCES dentos_runtime.clinic_gateways(id),
  direction varchar NOT NULL CHECK (direction IN ('push', 'pull')),
  cursor_token varchar NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sync_cursors_scope UNIQUE (gateway_id, direction)
);

CREATE TABLE dentos_runtime.sync_outbox_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_id uuid NOT NULL REFERENCES dentos_runtime.clinic_gateways(id),
  device_id uuid REFERENCES dentos_runtime.approved_devices(id),
  aggregate_type varchar NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar NOT NULL,
  payload_json jsonb NOT NULL,
  payload_hash varchar NOT NULL,
  idempotency_key varchar NOT NULL,
  aggregate_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES dentos_data.users(id),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at timestamptz,
  cloud_status varchar CHECK (cloud_status IN ('accepted', 'already_applied', 'rejected', 'conflict')),
  last_error varchar,
  CONSTRAINT uq_sync_outbox_idempotency UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE dentos_runtime.sync_inbox_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_id uuid NOT NULL REFERENCES dentos_runtime.clinic_gateways(id),
  cloud_event_id uuid NOT NULL,
  aggregate_type varchar NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar NOT NULL,
  payload_json jsonb NOT NULL,
  payload_hash varchar NOT NULL,
  idempotency_key varchar NOT NULL,
  aggregate_version bigint NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  applied_at timestamptz,
  apply_status varchar CHECK (apply_status IN ('applied', 'already_applied', 'rejected', 'conflict')),
  last_error varchar,
  CONSTRAINT uq_sync_inbox_cloud_event UNIQUE (gateway_id, cloud_event_id)
);

CREATE TABLE dentos_runtime.sync_conflicts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES dentos_data.organizations(id),
  clinic_id uuid NOT NULL REFERENCES dentos_data.clinics(id),
  gateway_id uuid NOT NULL REFERENCES dentos_runtime.clinic_gateways(id),
  aggregate_type varchar NOT NULL,
  aggregate_id uuid NOT NULL,
  field_name varchar NOT NULL,
  local_value_json jsonb,
  cloud_value_json jsonb,
  base_version bigint,
  status varchar NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES dentos_data.users(id)
);

CREATE TABLE dentos_runtime.sync_conflict_resolutions (
  id uuid PRIMARY KEY,
  conflict_id uuid NOT NULL REFERENCES dentos_runtime.sync_conflicts(id),
  resolution_action varchar NOT NULL CHECK (resolution_action IN ('keep_local', 'keep_cloud', 'manual_merge')),
  resolved_value_json jsonb,
  resolved_by uuid NOT NULL REFERENCES dentos_data.users(id),
  resolved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason varchar NOT NULL
);

CREATE INDEX ix_sync_outbox_pending ON dentos_runtime.sync_outbox_events (gateway_id, sent_at, available_at);
CREATE INDEX ix_sync_inbox_pending ON dentos_runtime.sync_inbox_events (gateway_id, applied_at, received_at);
CREATE INDEX ix_sync_conflicts_open ON dentos_runtime.sync_conflicts (clinic_id, status, detected_at);
