-- Generated from Blueprint 01 — patient registry foundation (Milestone 3)

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.patient_initials (
  id uuid NOT NULL CONSTRAINT pk_patient_initials PRIMARY KEY,
  organization_id uuid NOT NULL,
  label character varying,
  display_order integer,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_categories (
  id uuid NOT NULL CONSTRAINT pk_patient_categories PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_flags (
  id uuid NOT NULL CONSTRAINT pk_patient_flags PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  color_hex char(7),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_patient_flags_organization_code UNIQUE(organization_id, code)
);

CREATE TABLE dentos_data.occupations (
  id uuid NOT NULL CONSTRAINT pk_occupations PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.referral_sources (
  id uuid NOT NULL CONSTRAINT pk_referral_sources PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.fee_schedules (
  id uuid NOT NULL CONSTRAINT pk_fee_schedules PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.document_series (
  id uuid NOT NULL CONSTRAINT pk_document_series PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  document_type character varying,
  series_code character varying NOT NULL,
  prefix character varying NOT NULL DEFAULT '',
  suffix character varying NOT NULL DEFAULT '',
  separator character varying NOT NULL DEFAULT '',
  number_width smallint NOT NULL DEFAULT 5,
  code_generation_type character varying CONSTRAINT ck_document_series_code_generation_type CHECK (code_generation_type IN ('manual','year_based','year_month_based')),
  start_from bigint NOT NULL DEFAULT 1,
  next_number bigint NOT NULL,
  period_key character varying NOT NULL,
  active boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_document_series_clinic_id_document_type_series UNIQUE(clinic_id, document_type, series_code, period_key)
);

CREATE TABLE dentos_data.document_number_reservations (
  id uuid NOT NULL CONSTRAINT pk_document_number_reservations PRIMARY KEY,
  series_id uuid NOT NULL,
  allocated_number bigint NOT NULL,
  rendered_number character varying NOT NULL,
  entity_type character varying NOT NULL,
  entity_id uuid NOT NULL,
  allocated_at timestamptz NOT NULL,
  allocated_by uuid NOT NULL,
  status character varying CONSTRAINT ck_document_number_reservations_status CHECK (status IN ('reserved','used','void')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_document_number_reservations_series_id_allocated_number UNIQUE(series_id, allocated_number),
  CONSTRAINT uq_document_number_reservations_series_id_rendered_number UNIQUE(series_id, rendered_number)
);

CREATE TABLE dentos_data.patients (
  id uuid NOT NULL CONSTRAINT pk_patients PRIMARY KEY,
  organization_id uuid NOT NULL,
  home_clinic_id uuid NOT NULL,
  patient_no character varying NOT NULL,
  initials_id uuid NOT NULL,
  first_name character varying NOT NULL,
  middle_name character varying,
  last_name character varying,
  display_name character varying,
  address_line character varying,
  area character varying,
  city character varying,
  pin_code character varying,
  alternate_code character varying,
  cell_phone character varying,
  res_phone character varying,
  email citext,
  birth_date date,
  approximate_birth_year smallint,
  stated_age smallint,
  sex character varying CONSTRAINT ck_patients_sex CHECK (sex IN ('M','F','O','U')),
  notes character varying,
  fee_schedule_id uuid NOT NULL,
  card_no character varying,
  government_id_ciphertext bytea,
  government_id_last4 char(4),
  category_id uuid NOT NULL,
  referral_source_id uuid NOT NULL,
  referring_patient_id uuid,
  intent_tier dentos_data.intent_tier NOT NULL,
  intent_tier_reason_code character varying NOT NULL,
  intent_tier_note character varying,
  intent_tier_assessed_at timestamptz NOT NULL,
  intent_tier_assessed_by uuid NOT NULL,
  active boolean,
  merged_into_patient_id uuid,
  last_encounter_date date,
  next_continuity_date date,
  receivable_cached numeric(14,2) NOT NULL DEFAULT 0,
  unapplied_credit_cached numeric(14,2) NOT NULL DEFAULT 0,
  net_balance_cached numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_patients_organization_id_patient_no UNIQUE(organization_id, patient_no),
  CONSTRAINT ck_patients_intent_tier_reason CHECK (
    (intent_tier = 'one_star_do_not_treat' AND intent_tier_reason_code IN ('blacklisted','difficult_profile','safety_boundary'))
    OR (intent_tier = 'two_star_budget_friction' AND intent_tier_reason_code IN ('financial_hesitation','value_hesitation','timing_hesitation'))
    OR (intent_tier = 'three_star_high_intent_friction' AND intent_tier_reason_code IN ('external_cbct_pending','external_blood_report_pending','chair_capacity_delay','clinician_availability_delay','short_logistical_delay'))
  ),
  CONSTRAINT ck_patients_intent_tier_note CHECK (intent_tier_note IS NULL OR char_length(btrim(intent_tier_note)) BETWEEN 1 AND 1000)
);

CREATE TABLE dentos_data.patient_clinics (
  patient_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT pk_patient_clinics PRIMARY KEY(PATIENT_ID, CLINIC_ID)
);

CREATE TABLE dentos_data.patient_contacts (
  id uuid NOT NULL CONSTRAINT pk_patient_contacts PRIMARY KEY,
  patient_id uuid NOT NULL,
  type character varying,
  value character varying,
  normalized_value character varying,
  is_primary boolean,
  consent_status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_addresses (
  id uuid NOT NULL CONSTRAINT pk_patient_addresses PRIMARY KEY,
  patient_id uuid NOT NULL,
  type character varying,
  address_json jsonb,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_family_links (
  id uuid NOT NULL CONSTRAINT pk_patient_family_links PRIMARY KEY,
  patient_id uuid NOT NULL,
  related_patient_id uuid NOT NULL,
  relationship character varying,
  financial_head boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.custom_field_definitions (
  id uuid NOT NULL CONSTRAINT pk_custom_field_definitions PRIMARY KEY,
  organization_id uuid NOT NULL,
  entity_type character varying,
  label character varying,
  field_type character varying,
  options_json jsonb,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_custom_field_values (
  id uuid NOT NULL CONSTRAINT pk_patient_custom_field_values PRIMARY KEY,
  patient_id uuid NOT NULL,
  definition_id uuid NOT NULL,
  value_text character varying,
  value_number numeric(14,3),
  value_date date,
  value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_patient_custom_field_values_patient_id_definition_id UNIQUE(patient_id, definition_id)
);

CREATE TABLE dentos_data.medical_question_definitions (
  id uuid NOT NULL CONSTRAINT pk_medical_question_definitions PRIMARY KEY,
  organization_id uuid NOT NULL,
  question character varying,
  response_type character varying,
  risk_flag character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_medical_responses (
  id uuid NOT NULL CONSTRAINT pk_patient_medical_responses PRIMARY KEY,
  patient_id uuid NOT NULL,
  definition_id uuid NOT NULL,
  response_json jsonb,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.allergy_catalog (
  id uuid NOT NULL CONSTRAINT pk_allergy_catalog PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_allergies (
  id uuid NOT NULL CONSTRAINT pk_patient_allergies PRIMARY KEY,
  patient_id uuid NOT NULL,
  allergy_id uuid NOT NULL,
  severity character varying,
  reaction character varying,
  notes character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_consents (
  id uuid NOT NULL CONSTRAINT pk_patient_consents PRIMARY KEY,
  patient_id uuid NOT NULL,
  consent_type character varying,
  version character varying,
  granted boolean,
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  captured_by uuid NOT NULL,
  evidence_file_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.patient_merge_events (
  id uuid NOT NULL CONSTRAINT pk_patient_merge_events PRIMARY KEY,
  survivor_patient_id uuid NOT NULL,
  duplicate_patient_id uuid NOT NULL,
  merge_map_json jsonb,
  merged_by uuid NOT NULL,
  merged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

