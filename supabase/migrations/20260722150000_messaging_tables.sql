-- Generated from Blueprint 01 — messaging foundation (Milestone 8)

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.communication_preferences (
  id uuid NOT NULL CONSTRAINT pk_communication_preferences PRIMARY KEY,
  patient_id uuid NOT NULL,
  channel character varying NOT NULL CONSTRAINT ck_communication_preferences_channel CHECK (channel IN ('sms','whatsapp','email')),
  purpose character varying NOT NULL CONSTRAINT ck_communication_preferences_purpose CHECK (purpose IN ('care','transactional','marketing','otp')),
  status character varying NOT NULL CONSTRAINT ck_communication_preferences_status CHECK (status IN ('opted_in','opted_out','unknown')),
  source character varying NOT NULL,
  changed_at timestamptz NOT NULL,
  changed_by uuid NOT NULL,
  optout_keyword character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_communication_preferences_patient_channel_purpose UNIQUE(patient_id, channel, purpose)
);

CREATE TABLE dentos_data.message_templates (
  id uuid NOT NULL CONSTRAINT pk_message_templates PRIMARY KEY,
  organization_id uuid NOT NULL,
  channel character varying NOT NULL CONSTRAINT ck_message_templates_channel CHECK (channel IN ('sms','whatsapp','email')),
  purpose character varying NOT NULL CONSTRAINT ck_message_templates_purpose CHECK (purpose IN ('care','transactional','marketing','otp')),
  route_type character varying NOT NULL,
  name character varying NOT NULL,
  template_version integer NOT NULL DEFAULT 1,
  provider_template_id character varying,
  body character varying NOT NULL,
  variables_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_status character varying NOT NULL DEFAULT 'draft' CONSTRAINT ck_message_templates_approval_status CHECK (approval_status IN ('draft','pending','approved','rejected','retired')),
  approved_at timestamptz,
  approved_by uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_message_templates_org_channel_name_version UNIQUE(organization_id, channel, name, template_version),
  CONSTRAINT ck_message_templates_approval_metadata CHECK (
    (approval_status = 'approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL)
    OR
    (approval_status <> 'approved' AND approved_at IS NULL AND approved_by IS NULL)
  )
);

CREATE TABLE dentos_data.message_batches (
  id uuid NOT NULL CONSTRAINT pk_message_batches PRIMARY KEY,
  clinic_id uuid NOT NULL,
  batch_type character varying,
  route_type character varying,
  filter_snapshot_json jsonb,
  template_id uuid NOT NULL,
  status character varying,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.outbound_messages (
  id uuid NOT NULL CONSTRAINT pk_outbound_messages PRIMARY KEY,
  clinic_id uuid NOT NULL,
  batch_id uuid,
  continuity_task_id uuid,
  patient_id uuid,
  channel character varying NOT NULL CONSTRAINT ck_outbound_messages_channel CHECK (channel IN ('sms','whatsapp','email')),
  purpose character varying NOT NULL CONSTRAINT ck_outbound_messages_purpose CHECK (purpose IN ('care','transactional','marketing','otp')),
  route_type character varying NOT NULL,
  recipient_ciphertext bytea,
  recipient_hash char(64),
  template_id uuid,
  rendered_body character varying,
  status character varying NOT NULL DEFAULT 'draft' CONSTRAINT ck_outbound_messages_status CHECK (status IN ('draft','queued','submitted','sent','delivered','retry','failed','suppressed','cancelled')),
  suppression_reason character varying,
  provider_message_id character varying CONSTRAINT uq_outbound_messages_provider_message_id UNIQUE,
  provider_status_rank smallint NOT NULL DEFAULT 0,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  source_type character varying NOT NULL,
  source_id uuid NOT NULL,
  deduplication_key character varying NOT NULL CONSTRAINT uq_outbound_messages_deduplication_key UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_outbound_messages_suppression CHECK (
    (status = 'suppressed' AND NULLIF(BTRIM(suppression_reason), '') IS NOT NULL)
    OR
    (status <> 'suppressed' AND suppression_reason IS NULL)
  )
);

CREATE TABLE dentos_data.message_status_events (
  id uuid NOT NULL CONSTRAINT pk_message_status_events PRIMARY KEY,
  outbound_message_id uuid NOT NULL,
  provider_status character varying NOT NULL CONSTRAINT ck_message_status_events_provider_status CHECK (provider_status IN ('submitted','sent','delivered','failed')),
  provider_event_id character varying NOT NULL,
  payload_json jsonb NOT NULL,
  payload_sha256 char(64) NOT NULL,
  signature_valid boolean NOT NULL,
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_message_status_events_provider_event_id UNIQUE(provider_event_id)
);

CREATE TABLE dentos_data.inbound_messages (
  id uuid NOT NULL CONSTRAINT pk_inbound_messages PRIMARY KEY,
  patient_id uuid,
  channel character varying NOT NULL CONSTRAINT ck_inbound_messages_channel CHECK (channel IN ('sms','whatsapp')),
  provider_message_id character varying CONSTRAINT uq_inbound_messages_provider_message_id UNIQUE,
  received_at timestamptz NOT NULL,
  body character varying NOT NULL,
  optout_detected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

