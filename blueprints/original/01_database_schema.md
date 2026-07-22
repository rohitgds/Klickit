# 01 Executable PostgreSQL Database Schema

## Project DentOS Ownership Boundary

This document is the authoritative Project DentOS data contract. It specifies an independently designed dental operations model, its public invariants, and its executable PostgreSQL structures. Product behavior is derived exclusively from the requirements in this suite; no external product terminology, foreign identifiers, routes, controllers, layouts, or hidden implementation assumptions are part of the contract.

## Type and Integrity Rules

- PostgreSQL 16 or later; timestamps are stored as `timestamptz` in UTC and converted with the clinic IANA timezone.
- Internal identifiers are `uuid`; posted document numbers are allocated by clinic-scoped serial transactions.
- Money is `numeric(14,2)`, quantities are `numeric(14,3)`, and rates are `numeric(9,4)`.
- Posted clinical and financial rows are reversed, voided, archived, or superseded; they are not hard-deleted.
- `organization_id` and `clinic_id` are taken from the authenticated server context, never accepted as unrestricted browser authority.

## Extensions and Schemas

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA IF NOT EXISTS dentos_data;
CREATE SCHEMA IF NOT EXISTS dentos_runtime;
CREATE SCHEMA IF NOT EXISTS dentos_analytics;

CREATE TYPE dentos_data.care_booking_state AS ENUM ('scheduled','confirmed','arrived','cancelled','no_show','completed');
CREATE TYPE dentos_data.encounter_flow_state AS ENUM ('waiting','checked_in','engaged','checked_out','cancelled');
CREATE TYPE dentos_data.care_delivery_state AS ENUM ('planned','in_progress','completed','cancelled');
CREATE TYPE dentos_data.continuity_task_state AS ENUM ('scheduled','due','contacted','booked','completed','snoozed','cancelled');
CREATE TYPE dentos_data.medication_protocol_state AS ENUM ('draft','active','retired');
CREATE TYPE dentos_data.medication_order_state AS ENUM ('draft','saved','void','signed');
CREATE TYPE dentos_data.fee_statement_state AS ENUM ('draft','issued','part_paid','paid','void');
CREATE TYPE dentos_data.collection_receipt_state AS ENUM ('active','void','part_refunded','refunded');
CREATE TYPE dentos_data.fee_allocation_state AS ENUM ('active','reversed');
CREATE TYPE dentos_data.intent_tier AS ENUM ('one_star_do_not_treat','two_star_budget_friction','three_star_high_intent_friction');
CREATE TYPE dentos_data.case_execution_state AS ENUM ('not_started','minor_issue_treated_same_day','no_treatment_needed','treatment_started');
CREATE TYPE dentos_data.treatment_bundle_tier AS ENUM ('primary','secondary','tertiary');
CREATE TYPE dentos_data.treatment_bundle_state AS ENUM ('advised','accepted','scheduled','in_progress','completed','declined','cancelled');

SET search_path = dentos_data, public;
```

## Complete Table DDL

Every column and table constraint is written below. Foreign keys follow the table declarations so creation order and identity cycles are deterministic.

```sql
-- [Phase 1]
CREATE TABLE organizations (
  id uuid NOT NULL CONSTRAINT pk_organizations PRIMARY KEY,
  name character varying NOT NULL,
  legal_name character varying,
  timezone character varying NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'IN',
  medication_catalog_revision bigint NOT NULL DEFAULT 1,
  active boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_organizations_medication_catalog_revision CHECK (medication_catalog_revision > 0)
);

-- [Phase 1]
CREATE TABLE clinics (
  id uuid NOT NULL CONSTRAINT pk_clinics PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_code character varying NOT NULL,
  name character varying NOT NULL,
  gstin character varying,
  address_json jsonb,
  phone character varying,
  email character varying,
  timezone character varying NOT NULL,
  active boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_clinics_organization_id_clinic_code UNIQUE(organization_id, clinic_code)
);

-- [Phase 1]
CREATE TABLE users (
  id uuid NOT NULL CONSTRAINT pk_users PRIMARY KEY,
  organization_id uuid NOT NULL,
  login_name citext NOT NULL,
  display_name character varying NOT NULL,
  primary_email citext,
  primary_mobile character varying,
  status character varying NOT NULL CONSTRAINT ck_users_status CHECK (status IN ('invited','active','locked','disabled')),
  must_change_password boolean NOT NULL DEFAULT true,
  authz_version bigint NOT NULL DEFAULT 1,
  last_login_at timestamptz,
  disabled_at timestamptz,
  disabled_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_users_organization_id_login_name UNIQUE(organization_id, login_name),
  CONSTRAINT ck_users_disabled_pair CHECK (
    (disabled_at IS NULL AND disabled_by IS NULL)
    OR (disabled_at IS NOT NULL AND disabled_by IS NOT NULL)
  )
);

-- [Phase 1]
CREATE TABLE user_credentials (
  user_id uuid NOT NULL CONSTRAINT pk_user_credentials PRIMARY KEY,
  password_hash character varying NOT NULL,
  password_algorithm character varying NOT NULL DEFAULT 'argon2id',
  password_changed_at timestamptz NOT NULL,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  mfa_required boolean NOT NULL DEFAULT false,
  credential_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE password_reset_tokens (
  id uuid NOT NULL CONSTRAINT pk_password_reset_tokens PRIMARY KEY,
  user_id uuid NOT NULL,
  token_hash character varying NOT NULL CONSTRAINT uq_password_reset_tokens_token_hash UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  created_by uuid
);

-- [Phase 1]
CREATE TABLE user_sessions (
  id uuid NOT NULL CONSTRAINT pk_user_sessions PRIMARY KEY,
  user_id uuid NOT NULL,
  token_hash character varying NOT NULL CONSTRAINT uq_user_sessions_token_hash UNIQUE,
  authz_version bigint NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason character varying,
  ip_hash character varying,
  user_agent_hash character varying,
  created_by uuid
);

-- [Phase 1]
CREATE TABLE staff (
  id uuid NOT NULL CONSTRAINT pk_staff PRIMARY KEY,
  organization_id uuid NOT NULL,
  display_name character varying NOT NULL,
  staff_type character varying CONSTRAINT ck_staff_staff_type CHECK (staff_type IN ('clinician','reception','assistant','cashier','admin','other')),
  registration_no character varying,
  specialization character varying,
  color_hex char(7),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE staff_clinics (
  staff_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  display_order integer,
  default_fee_share_percent numeric(7,4),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT pk_staff_clinics PRIMARY KEY(STAFF_ID, CLINIC_ID)
);

-- A link row is born linked, so linked_at/linked_by are mandatory; unlink metadata is absent until an unlink event occurs.
-- [Phase 1]
CREATE TABLE staff_user_links (
  id uuid NOT NULL CONSTRAINT pk_staff_user_links PRIMARY KEY,
  organization_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  user_id uuid NOT NULL,
  linked_at timestamptz NOT NULL,
  linked_by uuid NOT NULL,
  unlinked_at timestamptz,
  unlinked_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE clinic_memberships (
  id uuid NOT NULL CONSTRAINT pk_clinic_memberships PRIMARY KEY,
  clinic_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_default boolean NOT NULL,
  active boolean NOT NULL,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_clinic_memberships_clinic_id_user_id UNIQUE(clinic_id, user_id)
);

-- [Phase 1]
CREATE TABLE roles (
  id uuid NOT NULL CONSTRAINT pk_roles PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  name character varying NOT NULL,
  description character varying,
  system_role boolean NOT NULL DEFAULT false,
  active boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_roles_organization_id_code UNIQUE(organization_id, code)
);

-- [Phase 1]
CREATE TABLE permissions (
  id uuid NOT NULL CONSTRAINT pk_permissions PRIMARY KEY,
  code character varying NOT NULL CONSTRAINT uq_permissions_code UNIQUE,
  module character varying NOT NULL,
  resource character varying NOT NULL,
  action character varying NOT NULL,
  description character varying NOT NULL,
  sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- Event-founded row: a permission assignment exists only after an attributed grant, so granted_at/granted_by are mandatory.
-- [Phase 1]
CREATE TABLE role_permissions (
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT pk_role_permissions PRIMARY KEY(ROLE_ID, PERMISSION_ID)
);

-- Event-founded row: a membership-role assignment exists only after an attributed assignment, so assigned_at/assigned_by are mandatory.
-- [Phase 1]
CREATE TABLE membership_roles (
  membership_id uuid NOT NULL,
  role_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT pk_membership_roles PRIMARY KEY(MEMBERSHIP_ID, ROLE_ID)
);

-- Event-founded row: an override exists only after an attributed grant or denial, so granted_at/granted_by are mandatory.
-- [Phase 1]
CREATE TABLE membership_permission_overrides (
  membership_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  effect character varying NOT NULL CONSTRAINT ck_membership_permission_overrides_effect CHECK (effect IN ('allow','deny')),
  scope_json jsonb NOT NULL DEFAULT '{}',
  reason character varying NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT pk_membership_permission_overrides PRIMARY KEY(MEMBERSHIP_ID, PERMISSION_ID)
);

-- [Phase 1]
CREATE TABLE clinic_settings (
  id uuid NOT NULL CONSTRAINT pk_clinic_settings PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid,
  group_code character varying NOT NULL,
  key character varying NOT NULL,
  value_json jsonb NOT NULL,
  value_schema_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_clinic_settings_organization_id_clinic_id_grou UNIQUE(organization_id, clinic_id, group_code, key)
);

-- [Phase 1]
CREATE TABLE chairs (
  id uuid NOT NULL CONSTRAINT pk_chairs PRIMARY KEY,
  clinic_id uuid NOT NULL,
  code character varying,
  name character varying,
  display_order integer NOT NULL,
  active boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_chairs_clinic_id_code UNIQUE(clinic_id, code),
  CONSTRAINT uq_chairs_clinic_id_name UNIQUE(clinic_id, name)
);

-- [Phase 1]
CREATE TABLE patient_initials (
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

-- [Phase 1]
CREATE TABLE patient_categories (
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

-- [Phase 1]
CREATE TABLE patient_flags (
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

-- [Phase 1]
CREATE TABLE occupations (
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

-- [Phase 3]
CREATE TABLE clinical_materials (
  id uuid NOT NULL CONSTRAINT pk_clinical_materials PRIMARY KEY,
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

-- [Phase 3]
CREATE TABLE bridge_types (
  id uuid NOT NULL CONSTRAINT pk_bridge_types PRIMARY KEY,
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

-- [Phase 1]
CREATE TABLE care_booking_reasons (
  id uuid NOT NULL CONSTRAINT pk_care_booking_reasons PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  default_minutes integer,
  color_hex char(7),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE expense_heads (
  id uuid NOT NULL CONSTRAINT pk_expense_heads PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  parent_id uuid,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 2]
CREATE TABLE collection_methods (
  id uuid NOT NULL CONSTRAINT pk_collection_methods PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  requires_reference boolean,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_collection_methods_organization_id_code UNIQUE(organization_id, code)
);

-- [Phase 1]
CREATE TABLE service_domains (
  id uuid NOT NULL CONSTRAINT pk_service_domains PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  name character varying NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  high_value boolean NOT NULL DEFAULT false,
  high_value_floor numeric(14,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_service_domains_organization_id_code UNIQUE(organization_id, code),
  CONSTRAINT ck_service_domains_code CHECK (btrim(code) <> ''),
  CONSTRAINT ck_service_domains_name CHECK (btrim(name) <> ''),
  CONSTRAINT ck_service_domains_display_order CHECK (display_order >= 0),
  CONSTRAINT ck_service_domains_high_value_floor CHECK ((high_value = false AND high_value_floor IS NULL) OR (high_value = true AND high_value_floor IS NOT NULL AND high_value_floor > 0))
);

-- [Phase 3]
CREATE TABLE risk_factors (
  id uuid NOT NULL CONSTRAINT pk_risk_factors PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  severity character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_staff_user_links_unlinked_pair CHECK (
    (unlinked_at IS NULL AND unlinked_by IS NULL)
    OR (unlinked_at IS NOT NULL AND unlinked_by IS NOT NULL)
  )
);

-- [Phase 3]
CREATE TABLE diagnosis_catalog (
  id uuid NOT NULL CONSTRAINT pk_diagnosis_catalog PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  name character varying NOT NULL,
  icd10_code character varying,
  description character varying,
  default_clinical_note character varying,
  keywords character varying[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_diagnosis_catalog_organization_id_code UNIQUE(organization_id, code),
  CONSTRAINT ck_diagnosis_catalog_code CHECK (btrim(code) <> ''),
  CONSTRAINT ck_diagnosis_catalog_name CHECK (btrim(name) <> ''),
  CONSTRAINT ck_diagnosis_catalog_display_order CHECK (display_order >= 0)
);

-- [Phase 3]
CREATE TABLE treatment_priorities (
  id uuid NOT NULL CONSTRAINT pk_treatment_priorities PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  display_order integer,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE document_tags (
  id uuid NOT NULL CONSTRAINT pk_document_tags PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE medication_domains (
  id uuid NOT NULL CONSTRAINT pk_medication_domains PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  name character varying NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_domains_organization_id_code UNIQUE(organization_id, code),
  CONSTRAINT ck_medication_domains_code CHECK (btrim(code) <> ''),
  CONSTRAINT ck_medication_domains_name CHECK (btrim(name) <> ''),
  CONSTRAINT ck_medication_domains_display_order CHECK (display_order >= 0)
);

-- [Phase 1]
CREATE TABLE fee_statement_categories (
  id uuid NOT NULL CONSTRAINT pk_fee_statement_categories PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE stock_categories (
  id uuid NOT NULL CONSTRAINT pk_stock_categories PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE lab_work_steps (
  id uuid NOT NULL CONSTRAINT pk_lab_work_steps PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  display_order integer,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE lab_quality_options (
  id uuid NOT NULL CONSTRAINT pk_lab_quality_options PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE note_templates (
  id uuid NOT NULL CONSTRAINT pk_note_templates PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  body_json jsonb,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE custom_forms (
  id uuid NOT NULL CONSTRAINT pk_custom_forms PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  form_schema_json jsonb,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 2]
CREATE TABLE document_series (
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

-- Event-only row: a serial reservation records a completed allocation, so allocated_at/allocated_by are mandatory.
-- [Phase 2]
CREATE TABLE document_number_reservations (
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

-- Registration invariant: every patient receives an attributed intent-tier assessment at creation, so its actor and timestamp are mandatory.
-- [Phase 1]
CREATE TABLE patients (
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

-- [Phase 1]
CREATE TABLE patient_clinics (
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

-- [Phase 1]
CREATE TABLE patient_contacts (
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

-- [Phase 1]
CREATE TABLE patient_addresses (
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

-- [Phase 1]
CREATE TABLE patient_family_links (
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

-- [Phase 1]
CREATE TABLE referral_sources (
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

-- [Phase 1]
CREATE TABLE patient_flag_assignments (
  id uuid NOT NULL CONSTRAINT pk_patient_flag_assignments PRIMARY KEY,
  patient_id uuid NOT NULL,
  flag_id uuid NOT NULL,
  clinic_id uuid,
  tracking_program character varying NOT NULL DEFAULT 'clinical_flag' CONSTRAINT ck_patient_flag_assignments_tracking_program CHECK (tracking_program IN ('clinical_flag','orthodontic_monthly')),
  program_status character varying NOT NULL DEFAULT 'active' CONSTRAINT ck_patient_flag_assignments_program_status CHECK (program_status IN ('active','paused','completed','cancelled')),
  enrolled_on date,
  enrolled_by uuid,
  treating_clinician_id uuid,
  source_care_plan_id uuid,
  source_care_plan_service_id uuid,
  expected_encounter_interval_months smallint,
  preferred_day_of_month smallint,
  next_adjustment_due_date date,
  appliance_type character varying,
  orthodontic_stage character varying,
  current_wire character varying,
  default_adjustment_service_id uuid,
  last_adjustment_care_encounter_id uuid,
  ended_on date,
  ended_by uuid,
  end_reason character varying,
  notes character varying,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_patient_flag_assignments_preferred_day CHECK (preferred_day_of_month IS NULL OR preferred_day_of_month BETWEEN 1 AND 28),
  CONSTRAINT ck_patient_flag_assignments_ortho_interval CHECK (expected_encounter_interval_months IS NULL OR expected_encounter_interval_months BETWEEN 1 AND 24),
  CONSTRAINT ck_patient_flag_assignments_program_dates CHECK (ended_on IS NULL OR enrolled_on IS NULL OR ended_on >= enrolled_on),
  CONSTRAINT ck_patient_flag_assignments_program_shape CHECK (
    (tracking_program = 'clinical_flag'
      AND program_status = 'active'
      AND clinic_id IS NULL
      AND enrolled_on IS NULL
      AND enrolled_by IS NULL
      AND treating_clinician_id IS NULL
      AND source_care_plan_id IS NULL
      AND source_care_plan_service_id IS NULL
      AND expected_encounter_interval_months IS NULL
      AND preferred_day_of_month IS NULL
      AND next_adjustment_due_date IS NULL
      AND appliance_type IS NULL
      AND orthodontic_stage IS NULL
      AND current_wire IS NULL
      AND default_adjustment_service_id IS NULL
      AND last_adjustment_care_encounter_id IS NULL)
    OR
    (tracking_program = 'orthodontic_monthly'
      AND clinic_id IS NOT NULL
      AND enrolled_on IS NOT NULL
      AND enrolled_by IS NOT NULL
      AND treating_clinician_id IS NOT NULL
      AND expected_encounter_interval_months IS NOT NULL
      AND next_adjustment_due_date IS NOT NULL
      AND default_adjustment_service_id IS NOT NULL)
  ),
  CONSTRAINT ck_patient_flag_assignments_program_closure CHECK (
    (program_status IN ('active','paused') AND ended_on IS NULL AND ended_by IS NULL AND end_reason IS NULL)
    OR
    (program_status IN ('completed','cancelled') AND ended_on IS NOT NULL AND ended_by IS NOT NULL AND NULLIF(BTRIM(end_reason), '') IS NOT NULL)
  )
);

-- [Phase 1]
CREATE TABLE custom_field_definitions (
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

-- [Phase 1]
CREATE TABLE patient_custom_field_values (
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

-- [Phase 1]
CREATE TABLE medical_question_definitions (
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

-- Event-only row: a medical response does not exist until a user records it, so recorded_at/recorded_by are mandatory.
-- [Phase 1]
CREATE TABLE patient_medical_responses (
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

-- [Phase 1]
CREATE TABLE allergy_catalog (
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

-- [Phase 1]
CREATE TABLE patient_allergies (
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

-- Event-only row: a consent record is created only when the patient decision is captured, so captured_at/captured_by are mandatory.
-- [Phase 1]
CREATE TABLE patient_consents (
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

-- Event-only row: each row proves a completed merge, so merged_at/merged_by are mandatory.
-- [Phase 3]
CREATE TABLE patient_merge_events (
  id uuid NOT NULL CONSTRAINT pk_patient_merge_events PRIMARY KEY,
  survivor_patient_id uuid NOT NULL,
  duplicate_patient_id uuid NOT NULL,
  merge_map_json jsonb,
  merged_by uuid NOT NULL,
  merged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

-- [Phase 1]
CREATE TABLE staff_working_hours (
  id uuid NOT NULL CONSTRAINT pk_staff_working_hours PRIMARY KEY,
  clinic_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  weekday smallint,
  starts_local time,
  ends_local time,
  effective_from date,
  effective_to date,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE chair_working_hours (
  id uuid NOT NULL CONSTRAINT pk_chair_working_hours PRIMARY KEY,
  chair_id uuid NOT NULL,
  weekday smallint,
  starts_local time,
  ends_local time,
  effective_from date,
  effective_to date,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE resource_blackouts (
  id uuid NOT NULL CONSTRAINT pk_resource_blackouts PRIMARY KEY,
  clinic_id uuid NOT NULL,
  clinician_id uuid,
  chair_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason character varying,
  status character varying CONSTRAINT ck_resource_blackouts_status CHECK (status IN ('active','cancelled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE care_bookings (
  id uuid NOT NULL CONSTRAINT pk_care_bookings PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  care_booking_no character varying,
  patient_id uuid,
  patient_kind character varying CONSTRAINT ck_care_bookings_patient_kind CHECK (patient_kind IN ('new','established')),
  first_name_snapshot character varying,
  last_name_snapshot character varying,
  cell_phone_snapshot character varying,
  email_snapshot character varying,
  age_snapshot smallint,
  sex_snapshot character varying,
  starts_at timestamptz,
  ends_at timestamptz,
  lead_clinician_id uuid NOT NULL,
  chair_id uuid NOT NULL,
  reason_id uuid NOT NULL,
  orthodontic_program_enrollment_id uuid,
  comments character varying,
  notify_patient_sms boolean,
  notify_patient_whatsapp boolean,
  notify_clinician boolean,
  status dentos_data.care_booking_state NOT NULL DEFAULT 'scheduled',
  source character varying,
  cancellation_reason character varying,
  cancelled_at timestamptz,
  cancelled_by uuid,
  no_show_reason character varying,
  no_show_marked_at timestamptz,
  no_show_marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE care_booking_requests (
  id uuid NOT NULL CONSTRAINT pk_care_booking_requests PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid,
  patient_kind character varying NOT NULL CONSTRAINT ck_care_booking_requests_patient_kind CHECK (patient_kind IN ('new','established')),
  first_name_snapshot character varying,
  last_name_snapshot character varying,
  cell_phone_snapshot character varying,
  email_snapshot citext,
  requested_date date NOT NULL,
  preferred_start_time time,
  preferred_end_time time,
  lead_clinician_id uuid,
  chair_id uuid,
  reason_id uuid,
  request_source character varying NOT NULL,
  request_notes character varying,
  status character varying NOT NULL CONSTRAINT ck_care_booking_requests_status CHECK (status IN ('new','contacted','accepted','declined','expired')),
  processed_care_booking_id uuid,
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_care_bookings_time_order CHECK (ends_at > starts_at),
  CONSTRAINT ck_care_bookings_terminal_metadata CHECK (
    (status = 'cancelled'
      AND cancelled_at IS NOT NULL
      AND cancelled_by IS NOT NULL
      AND NULLIF(BTRIM(cancellation_reason), '') IS NOT NULL
      AND no_show_reason IS NULL
      AND no_show_marked_at IS NULL
      AND no_show_marked_by IS NULL)
    OR
    (status = 'no_show'
      AND no_show_marked_at IS NOT NULL
      AND no_show_marked_by IS NOT NULL
      AND NULLIF(BTRIM(no_show_reason), '') IS NOT NULL
      AND cancellation_reason IS NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL)
    OR
    (status NOT IN ('cancelled','no_show')
      AND cancellation_reason IS NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND no_show_reason IS NULL
      AND no_show_marked_at IS NULL
      AND no_show_marked_by IS NULL)
  )
);

-- Event-only row: every booking-state history row records a completed transition, so changed_at/changed_by are mandatory.
-- [Phase 1]
CREATE TABLE care_booking_state_events (
  id uuid NOT NULL CONSTRAINT pk_care_booking_state_events PRIMARY KEY,
  care_booking_id uuid NOT NULL,
  sequence_no bigint NOT NULL CONSTRAINT ck_care_booking_state_events_sequence_no CHECK (sequence_no >= 1),
  from_status dentos_data.care_booking_state,
  to_status dentos_data.care_booking_state NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid NOT NULL,
  reason character varying NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT ck_care_booking_state_events_reason CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  CONSTRAINT uq_care_booking_state_events_care_booking_sequence UNIQUE(care_booking_id, sequence_no)
);

-- [Phase 1]
CREATE TABLE care_encounters (
  id uuid NOT NULL CONSTRAINT pk_care_encounters PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  encounter_no character varying,
  encounter_date date NOT NULL,
  queue_sequence integer NOT NULL,
  patient_id uuid NOT NULL,
  care_booking_id uuid,
  encounter_type character varying CONSTRAINT ck_care_encounters_encounter_type CHECK (encounter_type IN ('care_booking','unscheduled','direct_patient')),
  lead_clinician_id uuid NOT NULL,
  chair_id uuid,
  reason_id uuid NOT NULL,
  scheduled_time time,
  arrival_at timestamptz,
  checked_in_at timestamptz,
  engaged_at timestamptz,
  checked_out_at timestamptz,
  status dentos_data.encounter_flow_state,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_care_encounters_clinic_id_encounter_date_queue_seq UNIQUE(clinic_id, encounter_date, queue_sequence),
  CONSTRAINT uq_care_encounters_care_booking_id UNIQUE(care_booking_id)
);

-- Event-only row: every encounter-state history row records a completed transition, so changed_at/changed_by are mandatory.
-- [Phase 1]
CREATE TABLE encounter_state_events (
  id uuid NOT NULL CONSTRAINT pk_encounter_state_events PRIMARY KEY,
  care_encounter_id uuid NOT NULL,
  from_status character varying,
  to_status character varying,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid NOT NULL,
  reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

-- [Phase 1]
CREATE TABLE service_catalog (
  id uuid NOT NULL CONSTRAINT pk_service_catalog PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  description character varying NOT NULL,
  service_code_type character varying,
  service_domain_id uuid NOT NULL,
  standard_fee numeric(14,2),
  service_cost numeric(14,2),
  tax_rate numeric(7,4),
  care_area character varying,
  material_options_json jsonb,
  show_in_plan_options_json jsonb,
  chargeable boolean NOT NULL DEFAULT true,
  priority_pinned boolean NOT NULL DEFAULT false,
  default_minutes integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_service_catalog_organization_id_code UNIQUE(organization_id, code),
  CONSTRAINT ck_service_catalog_code CHECK (btrim(code) <> ''),
  CONSTRAINT ck_service_catalog_description CHECK (btrim(description) <> ''),
  CONSTRAINT ck_service_catalog_default_minutes CHECK (default_minutes > 0)
);

-- Event-only row: a finding row is inserted only when a clinician records it, so recorded_at/recorded_by are mandatory.
-- [Phase 3]
CREATE TABLE odontogram_findings (
  id uuid NOT NULL CONSTRAINT pk_odontogram_findings PRIMARY KEY,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  tooth_code character varying NOT NULL,
  surface_codes character varying[] NOT NULL DEFAULT '{}',
  finding_code character varying NOT NULL,
  notes character varying,
  status character varying,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  supersedes_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE care_plans (
  id uuid NOT NULL CONSTRAINT pk_care_plans PRIMARY KEY,
  patient_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  plan_no character varying,
  plan_date date,
  proposed_by uuid,
  proposed_at timestamptz,
  status character varying CONSTRAINT ck_care_plans_status CHECK (status IN ('draft','proposed','accepted','partially_accepted','declined','completed','cancelled')),
  displayed_amount numeric(14,2),
  estimated_total numeric(14,2),
  accepted_total numeric(14,2),
  notes character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_care_plans_proposed_pair CHECK (
    (proposed_at IS NULL AND proposed_by IS NULL)
    OR (proposed_at IS NOT NULL AND proposed_by IS NOT NULL)
  )
);

-- [Phase 3]
CREATE TABLE care_plan_stages (
  id uuid NOT NULL CONSTRAINT pk_care_plan_stages PRIMARY KEY,
  care_plan_id uuid NOT NULL,
  phase_no smallint,
  name character varying,
  status character varying,
  planned_start date,
  planned_end date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_care_plan_stages_care_plan_id_phase_no UNIQUE(care_plan_id, phase_no)
);

-- [Phase 3]
CREATE TABLE care_plan_services (
  id uuid NOT NULL CONSTRAINT pk_care_plan_services PRIMARY KEY,
  care_plan_stage_id uuid NOT NULL,
  service_id uuid NOT NULL,
  tooth_code character varying,
  surface_codes character varying[],
  material_id uuid,
  bridge_type_id uuid,
  quantity numeric(14,3),
  proposed_fee numeric(14,2),
  discount numeric(14,2),
  accepted boolean,
  status character varying CONSTRAINT ck_care_plan_services_status CHECK (status IN ('proposed','accepted','scheduled','in_progress','completed','cancelled')),
  completed_care_encounter_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE care_deliveries (
  id uuid NOT NULL CONSTRAINT pk_care_deliveries PRIMARY KEY,
  patient_id uuid NOT NULL,
  care_encounter_id uuid NOT NULL,
  care_plan_service_id uuid,
  service_id uuid NOT NULL,
  lead_clinician_id uuid NOT NULL,
  orthodontic_program_enrollment_id uuid,
  tooth_code character varying,
  surface_codes character varying[],
  quantity numeric(14,3),
  fee numeric(14,2),
  discount numeric(14,2),
  status dentos_data.care_delivery_state NOT NULL DEFAULT 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  completion_continuity_mode character varying NOT NULL DEFAULT 'none' CONSTRAINT ck_care_deliveries_continuity_mode CHECK (completion_continuity_mode IN ('none','rule','custom_date')),
  completion_continuity_date date,
  completion_continuity_local_time time,
  completion_continuity_notes character varying,
  fee_statement_line_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_care_deliveries_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND completed_by IS NOT NULL)
    OR
    (status <> 'completed' AND completed_at IS NULL AND completed_by IS NULL)
  ),
  CONSTRAINT ck_care_deliveries_continuity_date CHECK (
    (status = 'completed' AND completion_continuity_mode = 'custom_date' AND completion_continuity_date IS NOT NULL AND completion_continuity_local_time IS NOT NULL)
    OR
    (status = 'completed' AND completion_continuity_mode IN ('none','rule') AND completion_continuity_date IS NULL AND completion_continuity_local_time IS NULL)
    OR
    (status <> 'completed' AND completion_continuity_mode = 'none' AND completion_continuity_date IS NULL AND completion_continuity_local_time IS NULL AND completion_continuity_notes IS NULL)
  )
);

-- Event-only row: each intent-tier history row records an attributed decision, so changed_at/changed_by are mandatory.
-- [Phase 3]
CREATE TABLE patient_intent_tier_events (
  id uuid NOT NULL CONSTRAINT pk_patient_intent_tier_events PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  clinical_case_id uuid,
  from_tier dentos_data.intent_tier,
  to_tier dentos_data.intent_tier NOT NULL,
  reason_code character varying NOT NULL,
  note character varying,
  change_source character varying NOT NULL CONSTRAINT ck_patient_intent_tier_events_source CHECK (change_source IN ('registration','patient_details','consultation_close','authorized_correction')),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT ck_patient_intent_tier_events_reason CHECK (
    (to_tier = 'one_star_do_not_treat' AND reason_code IN ('blacklisted','difficult_profile','safety_boundary'))
    OR (to_tier = 'two_star_budget_friction' AND reason_code IN ('financial_hesitation','value_hesitation','timing_hesitation'))
    OR (to_tier = 'three_star_high_intent_friction' AND reason_code IN ('external_cbct_pending','external_blood_report_pending','chair_capacity_delay','clinician_availability_delay','short_logistical_delay'))
  ),
  CONSTRAINT ck_patient_intent_tier_events_note CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 1000)
);

-- state_changed_by is nullable only for the two enumerated automated sources; every human-originated transition requires an actor.
-- [Phase 3]
CREATE TABLE clinical_cases (
  id uuid NOT NULL CONSTRAINT pk_clinical_cases PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  case_no character varying NOT NULL,
  patient_id uuid NOT NULL,
  initial_consultation_id uuid NOT NULL,
  intent_tier_snapshot dentos_data.intent_tier NOT NULL,
  execution_state dentos_data.case_execution_state NOT NULL DEFAULT 'not_started',
  state_changed_at timestamptz NOT NULL,
  state_changed_by uuid,
  state_change_source character varying NOT NULL CONSTRAINT ck_clinical_cases_state_change_source CHECK (state_change_source IN ('consultation_close','manual_clinical_decision','care_delivery_start','applied_payment_future_encounter','eod_reconciliation','authorized_correction')),
  state_reason_code character varying,
  state_note character varying,
  treatment_started_at timestamptz,
  treatment_started_by uuid,
  triggering_fee_allocation_id uuid,
  triggering_future_encounter_id uuid,
  minor_issue_care_delivery_id uuid,
  no_treatment_reason_code character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_clinical_cases_organization_case_no UNIQUE(organization_id, case_no),
  CONSTRAINT uq_clinical_cases_initial_consultation UNIQUE(initial_consultation_id),
  CONSTRAINT ck_clinical_cases_case_no CHECK (btrim(case_no) <> ''),
  CONSTRAINT ck_clinical_cases_state_note CHECK (state_note IS NULL OR char_length(btrim(state_note)) BETWEEN 1 AND 2000),
  CONSTRAINT ck_clinical_cases_state_shape CHECK (
    (execution_state = 'not_started' AND treatment_started_at IS NULL AND treatment_started_by IS NULL AND triggering_fee_allocation_id IS NULL AND triggering_future_encounter_id IS NULL AND minor_issue_care_delivery_id IS NULL AND no_treatment_reason_code IS NULL)
    OR (execution_state = 'minor_issue_treated_same_day' AND treatment_started_at IS NULL AND treatment_started_by IS NULL AND triggering_fee_allocation_id IS NULL AND triggering_future_encounter_id IS NULL AND minor_issue_care_delivery_id IS NOT NULL AND no_treatment_reason_code IS NULL)
    OR (execution_state = 'no_treatment_needed' AND treatment_started_at IS NULL AND treatment_started_by IS NULL AND triggering_fee_allocation_id IS NULL AND triggering_future_encounter_id IS NULL AND minor_issue_care_delivery_id IS NULL AND no_treatment_reason_code IS NOT NULL AND btrim(no_treatment_reason_code) <> '')
    OR (execution_state = 'treatment_started' AND treatment_started_at IS NOT NULL AND minor_issue_care_delivery_id IS NULL AND no_treatment_reason_code IS NULL)
  ),
  CONSTRAINT ck_clinical_cases_automated_start_shape CHECK (
    state_change_source NOT IN ('applied_payment_future_encounter','eod_reconciliation')
    OR (execution_state = 'treatment_started' AND triggering_fee_allocation_id IS NOT NULL AND triggering_future_encounter_id IS NOT NULL)
  ),
  CONSTRAINT ck_clinical_cases_state_actor CHECK (
    state_change_source IN ('applied_payment_future_encounter','eod_reconciliation')
    OR state_changed_by IS NOT NULL
  )
);

-- [Phase 3]
CREATE TABLE case_consultations (
  id uuid NOT NULL CONSTRAINT pk_case_consultations PRIMARY KEY,
  clinical_case_id uuid NOT NULL,
  care_encounter_id uuid NOT NULL,
  consultation_kind character varying NOT NULL CONSTRAINT ck_case_consultations_kind CHECK (consultation_kind IN ('initial','review','follow_up')),
  consulted_at timestamptz NOT NULL,
  primary_consult_clinician_id uuid NOT NULL,
  secondary_review_clinician_id uuid NOT NULL,
  consultation_objective character varying NOT NULL,
  chief_complaint character varying,
  clinical_summary character varying,
  presentation_summary character varying,
  review_outcome character varying,
  status character varying NOT NULL DEFAULT 'draft' CONSTRAINT ck_case_consultations_status CHECK (status IN ('draft','finalized','void')),
  finalized_at timestamptz,
  finalized_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_case_consultations_case_encounter_kind UNIQUE(clinical_case_id, care_encounter_id, consultation_kind),
  CONSTRAINT ck_case_consultations_distinct_clinicians CHECK (primary_consult_clinician_id <> secondary_review_clinician_id),
  CONSTRAINT ck_case_consultations_objective CHECK (btrim(consultation_objective) <> ''),
  CONSTRAINT ck_case_consultations_finalized_shape CHECK ((status = 'draft' AND finalized_at IS NULL AND finalized_by IS NULL AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR (status = 'finalized' AND finalized_at IS NOT NULL AND finalized_by IS NOT NULL AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR (status = 'void' AND voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND btrim(void_reason) <> ''))
);

-- Event-founded row: a treatment bundle is created only when advice is recorded, so advised_at/advised_by are mandatory.
-- [Phase 3]
CREATE TABLE treatment_bundles (
  id uuid NOT NULL CONSTRAINT pk_treatment_bundles PRIMARY KEY,
  clinical_case_id uuid NOT NULL,
  care_plan_id uuid NOT NULL,
  bundle_tier dentos_data.treatment_bundle_tier NOT NULL,
  sequence_no smallint NOT NULL,
  title character varying NOT NULL,
  clinical_rationale character varying NOT NULL,
  target_start_date date,
  status dentos_data.treatment_bundle_state NOT NULL DEFAULT 'advised',
  estimated_value numeric(14,2) NOT NULL DEFAULT 0,
  accepted_value numeric(14,2) NOT NULL DEFAULT 0,
  advised_at timestamptz NOT NULL,
  advised_by uuid NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_treatment_bundles_case_tier_sequence UNIQUE(clinical_case_id, bundle_tier, sequence_no),
  CONSTRAINT ck_treatment_bundles_sequence CHECK (sequence_no > 0),
  CONSTRAINT ck_treatment_bundles_title CHECK (btrim(title) <> ''),
  CONSTRAINT ck_treatment_bundles_rationale CHECK (btrim(clinical_rationale) <> ''),
  CONSTRAINT ck_treatment_bundles_values CHECK (estimated_value >= 0 AND accepted_value >= 0 AND accepted_value <= estimated_value),
  CONSTRAINT ck_treatment_bundles_acceptance_shape CHECK ((status IN ('advised','declined','cancelled') AND accepted_at IS NULL AND accepted_by IS NULL) OR (status IN ('accepted','scheduled','in_progress','completed') AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL)),
  CONSTRAINT ck_treatment_bundles_completion_shape CHECK ((status = 'completed' AND completed_at IS NOT NULL AND completed_by IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL AND completed_by IS NULL))
);

-- Event-founded row: a bundle-service row is created only when advice is recorded, so advised_at/advised_by are mandatory.
-- [Phase 3]
CREATE TABLE treatment_bundle_services (
  id uuid NOT NULL CONSTRAINT pk_treatment_bundle_services PRIMARY KEY,
  treatment_bundle_id uuid NOT NULL,
  care_plan_service_id uuid NOT NULL,
  service_id uuid NOT NULL,
  service_domain_id_snapshot uuid NOT NULL,
  service_code_snapshot character varying NOT NULL,
  service_name_snapshot character varying NOT NULL,
  tooth_code_snapshot character varying,
  surface_codes_snapshot character varying[] NOT NULL DEFAULT '{}',
  sequence_no smallint NOT NULL,
  proposed_amount_snapshot numeric(14,2) NOT NULL,
  line_state character varying NOT NULL DEFAULT 'pending' CONSTRAINT ck_treatment_bundle_services_line_state CHECK (line_state IN ('pending','scheduled','in_progress','completed','declined','cancelled')),
  advised_at timestamptz NOT NULL,
  advised_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_treatment_bundle_services_plan_service UNIQUE(care_plan_service_id),
  CONSTRAINT uq_treatment_bundle_services_bundle_sequence UNIQUE(treatment_bundle_id, sequence_no),
  CONSTRAINT ck_treatment_bundle_services_sequence CHECK (sequence_no > 0),
  CONSTRAINT ck_treatment_bundle_services_code_snapshot CHECK (btrim(service_code_snapshot) <> ''),
  CONSTRAINT ck_treatment_bundle_services_name_snapshot CHECK (btrim(service_name_snapshot) <> ''),
  CONSTRAINT ck_treatment_bundle_services_amount CHECK (proposed_amount_snapshot >= 0)
);

-- changed_by is nullable only for the two enumerated automated sources; every human-originated history row requires an actor.
-- [Phase 3]
CREATE TABLE clinical_case_state_events (
  id uuid NOT NULL CONSTRAINT pk_clinical_case_state_events PRIMARY KEY,
  clinical_case_id uuid NOT NULL,
  sequence_no bigint NOT NULL,
  from_state dentos_data.case_execution_state,
  to_state dentos_data.case_execution_state NOT NULL,
  change_source character varying NOT NULL,
  reason_code character varying,
  note character varying,
  triggering_fee_allocation_id uuid,
  triggering_future_encounter_id uuid,
  changed_at timestamptz NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_clinical_case_state_events_case_sequence UNIQUE(clinical_case_id, sequence_no),
  CONSTRAINT ck_clinical_case_state_events_sequence CHECK (sequence_no > 0),
  CONSTRAINT ck_clinical_case_state_events_automated_shape CHECK (change_source NOT IN ('applied_payment_future_encounter','eod_reconciliation') OR (to_state = 'treatment_started' AND triggering_fee_allocation_id IS NOT NULL AND triggering_future_encounter_id IS NOT NULL)),
  CONSTRAINT ck_clinical_case_state_events_actor CHECK (change_source IN ('applied_payment_future_encounter','eod_reconciliation') OR changed_by IS NOT NULL)
);

-- [Phase 3]
CREATE TABLE clinical_notes (
  id uuid NOT NULL CONSTRAINT pk_clinical_notes PRIMARY KEY,
  patient_id uuid NOT NULL,
  care_encounter_id uuid NOT NULL,
  clinician_id uuid NOT NULL,
  note_type character varying,
  body character varying,
  signed_at timestamptz,
  status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE files (
  id uuid NOT NULL CONSTRAINT pk_files PRIMARY KEY,
  organization_id uuid NOT NULL,
  storage_key character varying,
  mime_type character varying,
  byte_size bigint,
  sha256 char(64),
  encrypted boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE patient_files (
  id uuid NOT NULL CONSTRAINT pk_patient_files PRIMARY KEY,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  file_id uuid NOT NULL,
  category character varying,
  caption character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE continuity_policies (
  id uuid NOT NULL CONSTRAINT pk_continuity_policies PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid,
  name character varying NOT NULL,
  trigger_event character varying NOT NULL CONSTRAINT ck_continuity_policies_trigger_event CHECK (trigger_event IN ('service_completed','encounter_checkout','medication_order_saved','care_booking_no_show','manual')),
  service_id uuid,
  service_domain_id uuid,
  interval_value integer NOT NULL CONSTRAINT ck_continuity_policies_interval_value CHECK (interval_value BETWEEN 1 AND 3650),
  interval_unit character varying NOT NULL CONSTRAINT ck_continuity_policies_interval_unit CHECK (interval_unit IN ('day','week','month','year')),
  due_local_time time NOT NULL DEFAULT '09:00:00',
  adjust_to_working_day boolean NOT NULL DEFAULT false,
  allow_custom_date boolean NOT NULL DEFAULT true,
  recurring boolean NOT NULL DEFAULT false,
  recurrence_anchor character varying NOT NULL DEFAULT 'source_completion' CONSTRAINT ck_continuity_policies_recurrence_anchor CHECK (recurrence_anchor IN ('source_completion','completed_continuity','prior_due_date')),
  send_sms boolean NOT NULL DEFAULT false,
  sms_template_id uuid,
  send_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_template_id uuid,
  reminder_offsets_minutes integer[] NOT NULL DEFAULT ARRAY[10080,1440],
  message_purpose character varying NOT NULL DEFAULT 'care' CONSTRAINT ck_continuity_policies_message_purpose CHECK (message_purpose IN ('care','transactional')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_continuity_policies_service_scope CHECK (NOT (service_id IS NOT NULL AND service_domain_id IS NOT NULL)),
  CONSTRAINT ck_continuity_policies_sms_template CHECK ((send_sms = false) OR sms_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_policies_whatsapp_template CHECK ((send_whatsapp = false) OR whatsapp_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_policies_offsets CHECK (cardinality(reminder_offsets_minutes) BETWEEN 1 AND 10 AND array_position(reminder_offsets_minutes, NULL) IS NULL AND 0 <= ALL(reminder_offsets_minutes))
);

-- [Phase 3]
CREATE TABLE continuity_recall_records (
  id uuid NOT NULL CONSTRAINT pk_continuity_recall_records PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  source_care_encounter_id uuid,
  rule_id uuid NOT NULL,
  due_date date,
  status character varying,
  assigned_to uuid,
  completed_care_encounter_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE continuity_tasks (
  id uuid NOT NULL CONSTRAINT pk_continuity_tasks PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  care_booking_id uuid,
  care_delivery_id uuid,
  care_plan_service_id uuid,
  medication_order_id uuid,
  orthodontic_program_enrollment_id uuid,
  continuity_policy_id uuid,
  source_type character varying NOT NULL CONSTRAINT ck_continuity_tasks_source_type CHECK (source_type IN ('care_delivery','care_plan_service','care_encounter','care_booking','medication_order','orthodontic_program','manual')),
  source_id uuid NOT NULL,
  date_mode character varying NOT NULL CONSTRAINT ck_continuity_tasks_date_mode CHECK (date_mode IN ('rule','custom_date')),
  due_date date NOT NULL,
  due_local_time time NOT NULL,
  due_at timestamptz NOT NULL,
  interval_value_snapshot integer CONSTRAINT ck_continuity_tasks_interval_value CHECK (interval_value_snapshot IS NULL OR interval_value_snapshot BETWEEN 1 AND 3650),
  interval_unit_snapshot character varying CONSTRAINT ck_continuity_tasks_interval_unit CHECK (interval_unit_snapshot IS NULL OR interval_unit_snapshot IN ('day','week','month','year')),
  custom_date_selected_by uuid,
  custom_date_selected_at timestamptz,
  task_type character varying NOT NULL,
  reason_code character varying NOT NULL,
  notes character varying,
  status dentos_data.continuity_task_state NOT NULL DEFAULT 'scheduled',
  owner_clinician_id uuid,
  assigned_to uuid,
  reserved_care_booking_id uuid,
  snoozed_until timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason character varying,
  send_sms boolean NOT NULL DEFAULT false,
  sms_template_id uuid,
  send_whatsapp boolean NOT NULL DEFAULT false,
  whatsapp_template_id uuid,
  reminder_offsets_minutes integer[] NOT NULL DEFAULT ARRAY[10080,1440],
  message_purpose character varying NOT NULL DEFAULT 'care' CONSTRAINT ck_continuity_tasks_message_purpose CHECK (message_purpose IN ('care','transactional')),
  reminder_generation_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_continuity_tasks_source_due UNIQUE(clinic_id, source_type, source_id, task_type, due_date),
  CONSTRAINT ck_continuity_tasks_source_shape CHECK (
    (source_type = 'care_delivery' AND care_delivery_id IS NOT NULL AND care_delivery_id = source_id)
    OR (source_type = 'care_plan_service' AND care_plan_service_id IS NOT NULL AND care_plan_service_id = source_id)
    OR (source_type = 'care_encounter' AND care_encounter_id IS NOT NULL AND care_encounter_id = source_id)
    OR (source_type = 'care_booking' AND care_booking_id IS NOT NULL AND care_booking_id = source_id)
    OR (source_type = 'medication_order' AND medication_order_id IS NOT NULL AND medication_order_id = source_id)
    OR (source_type = 'orthodontic_program' AND orthodontic_program_enrollment_id IS NOT NULL AND orthodontic_program_enrollment_id = source_id)
    OR (source_type = 'manual')
  ),
  CONSTRAINT ck_continuity_tasks_custom_date_actor CHECK (
    (date_mode = 'custom_date' AND custom_date_selected_by IS NOT NULL AND custom_date_selected_at IS NOT NULL)
    OR
    (date_mode = 'rule' AND custom_date_selected_by IS NULL AND custom_date_selected_at IS NULL)
  ),
  CONSTRAINT ck_continuity_tasks_rule_shape CHECK (
    (date_mode = 'rule' AND continuity_policy_id IS NOT NULL AND interval_value_snapshot IS NOT NULL AND interval_unit_snapshot IS NOT NULL)
    OR
    (date_mode = 'custom_date')
  ),
  CONSTRAINT ck_continuity_tasks_sms_template CHECK ((send_sms = false) OR sms_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_tasks_whatsapp_template CHECK ((send_whatsapp = false) OR whatsapp_template_id IS NOT NULL),
  CONSTRAINT ck_continuity_tasks_offsets CHECK (cardinality(reminder_offsets_minutes) BETWEEN 1 AND 10 AND array_position(reminder_offsets_minutes, NULL) IS NULL AND 0 <= ALL(reminder_offsets_minutes)),
  CONSTRAINT ck_continuity_tasks_terminal_state CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND completed_by IS NOT NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
    OR
    (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND NULLIF(BTRIM(cancellation_reason), '') IS NOT NULL AND completed_at IS NULL AND completed_by IS NULL)
    OR
    (status NOT IN ('completed','cancelled') AND completed_at IS NULL AND completed_by IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancellation_reason IS NULL)
  )
);

-- [Phase 3]
CREATE TABLE dental_labs (
  id uuid NOT NULL CONSTRAINT pk_dental_labs PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  phone character varying,
  address_json jsonb,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE lab_work_types (
  id uuid NOT NULL CONSTRAINT pk_lab_work_types PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE lab_jobs (
  id uuid NOT NULL CONSTRAINT pk_lab_jobs PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  ref_no character varying,
  lab_id uuid NOT NULL,
  work_type_id uuid NOT NULL,
  teeth_text character varying,
  shade_and_notes character varying,
  request_date date,
  requested_by uuid NOT NULL,
  expected_date date,
  status character varying,
  work_step_id uuid NOT NULL,
  received_date date,
  received_by uuid,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- Event-only row: every laboratory-status history row records a completed transition, so changed_at/changed_by are mandatory.
-- [Phase 3]
CREATE TABLE lab_job_status_history (
  id uuid NOT NULL CONSTRAINT pk_lab_job_status_history PRIMARY KEY,
  lab_job_id uuid NOT NULL,
  from_status character varying,
  to_status character varying,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

-- [Phase 3]
CREATE TABLE active_ingredient_catalog (
  id uuid NOT NULL CONSTRAINT pk_active_ingredient_catalog PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  name character varying NOT NULL,
  contraindications_default character varying,
  keywords character varying[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_active_ingredient_catalog_organization_id_code UNIQUE(organization_id, code),
  CONSTRAINT ck_active_ingredient_catalog_code CHECK (btrim(code) <> ''),
  CONSTRAINT ck_active_ingredient_catalog_name CHECK (btrim(name) <> '')
);

-- [Phase 3]
CREATE TABLE medication_catalog (
  id uuid NOT NULL CONSTRAINT pk_medication_catalog PRIMARY KEY,
  organization_id uuid NOT NULL,
  primary_domain_id uuid NOT NULL,
  active_ingredient_id uuid NOT NULL,
  brand_name character varying NOT NULL,
  strength character varying,
  dosage_form character varying NOT NULL,
  contraindications character varying,
  priority_pinned boolean NOT NULL DEFAULT false,
  default_administration_pattern_id uuid,
  keywords character varying[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_medication_catalog_brand_name CHECK (btrim(brand_name) <> ''),
  CONSTRAINT ck_medication_catalog_dosage_form CHECK (btrim(dosage_form) <> '')
);

-- [Phase 3]
CREATE TABLE administration_patterns (
  id uuid NOT NULL CONSTRAINT pk_administration_patterns PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  label character varying NOT NULL,
  take_text character varying NOT NULL,
  frequency character varying NOT NULL,
  route character varying,
  duration_value numeric(14,3),
  duration_period character varying,
  instructions character varying NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_administration_patterns_organization_id_code UNIQUE(organization_id, code),
  CONSTRAINT ck_administration_patterns_code CHECK (btrim(code) <> ''),
  CONSTRAINT ck_administration_patterns_label CHECK (btrim(label) <> ''),
  CONSTRAINT ck_administration_patterns_take_text CHECK (btrim(take_text) <> ''),
  CONSTRAINT ck_administration_patterns_frequency CHECK (btrim(frequency) <> ''),
  CONSTRAINT ck_administration_patterns_duration CHECK ((duration_value IS NULL AND duration_period IS NULL) OR (duration_value > 0 AND duration_period IN ('days','weeks','months'))),
  CONSTRAINT ck_administration_patterns_display_order CHECK (display_order >= 0)
);

-- [Phase 3]
CREATE TABLE medication_domain_links (
  id uuid NOT NULL CONSTRAINT pk_medication_domain_links PRIMARY KEY,
  medication_id uuid NOT NULL,
  domain_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sequence_no smallint NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_domain_links_medication_id_domain_id UNIQUE(medication_id, domain_id),
  CONSTRAINT ck_medication_domain_links_sequence_no CHECK (sequence_no > 0)
);

-- [Phase 3]
CREATE TABLE medication_ingredient_links (
  id uuid NOT NULL CONSTRAINT pk_medication_ingredient_links PRIMARY KEY,
  medication_id uuid NOT NULL,
  active_ingredient_id uuid NOT NULL,
  quantity numeric(14,3),
  quantity_unit character varying,
  sequence_no smallint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_ingredient_links_medication_id_active_ingredient_id UNIQUE(medication_id, active_ingredient_id),
  CONSTRAINT ck_medication_ingredient_links_quantity CHECK ((quantity IS NULL AND quantity_unit IS NULL) OR (quantity > 0 AND btrim(quantity_unit) <> '')),
  CONSTRAINT ck_medication_ingredient_links_sequence_no CHECK (sequence_no > 0)
);

-- [Phase 3]
CREATE TABLE allergy_ingredient_rules (
  id uuid NOT NULL CONSTRAINT pk_allergy_ingredient_rules PRIMARY KEY,
  allergy_id uuid NOT NULL,
  active_ingredient_id uuid NOT NULL,
  interaction_level character varying NOT NULL CONSTRAINT ck_allergy_ingredient_rules_level CHECK (interaction_level IN ('block','warn','information')),
  warning_text character varying NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_allergy_ingredient_rules_allergy_generic UNIQUE(allergy_id, active_ingredient_id),
  CONSTRAINT ck_allergy_ingredient_rules_warning_text CHECK (btrim(warning_text) <> '')
);

-- [Phase 3]
CREATE TABLE medication_strength_options (
  id uuid NOT NULL CONSTRAINT pk_medication_strength_options PRIMARY KEY,
  medication_id uuid NOT NULL,
  strength_option_text character varying NOT NULL,
  sequence_no smallint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_strength_options_medication_id_strength_option UNIQUE(medication_id, strength_option_text),
  CONSTRAINT ck_medication_strength_options_strength_option CHECK (btrim(strength_option_text) <> ''),
  CONSTRAINT ck_medication_strength_options_sequence_no CHECK (sequence_no > 0)
);

-- [Phase 3]
CREATE TABLE medication_administration_defaults (
  id uuid NOT NULL CONSTRAINT pk_medication_administration_defaults PRIMARY KEY,
  medication_id uuid NOT NULL,
  administration_pattern_id uuid NOT NULL,
  minimum_age_months integer,
  maximum_age_months integer,
  minimum_weight_kg numeric(7,3),
  maximum_weight_kg numeric(7,3),
  priority_rank smallint NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_medication_administration_defaults_age CHECK (minimum_age_months IS NULL OR maximum_age_months IS NULL OR minimum_age_months <= maximum_age_months),
  CONSTRAINT ck_medication_administration_defaults_weight CHECK (minimum_weight_kg IS NULL OR maximum_weight_kg IS NULL OR minimum_weight_kg <= maximum_weight_kg),
  CONSTRAINT ck_medication_administration_defaults_minimum_age CHECK (minimum_age_months IS NULL OR minimum_age_months >= 0),
  CONSTRAINT ck_medication_administration_defaults_maximum_age CHECK (maximum_age_months IS NULL OR maximum_age_months >= 0),
  CONSTRAINT ck_medication_administration_defaults_minimum_weight CHECK (minimum_weight_kg IS NULL OR minimum_weight_kg > 0),
  CONSTRAINT ck_medication_administration_defaults_maximum_weight CHECK (maximum_weight_kg IS NULL OR maximum_weight_kg > 0),
  CONSTRAINT ck_medication_administration_defaults_priority_rank CHECK (priority_rank > 0)
);

-- [Phase 3]
CREATE TABLE medication_protocols (
  id uuid NOT NULL CONSTRAINT pk_medication_protocols PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying NOT NULL,
  name character varying NOT NULL,
  comments character varying,
  default_medication_order_note character varying,
  version integer NOT NULL DEFAULT 1,
  status dentos_data.medication_protocol_state NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_protocols_organization_id_code_version UNIQUE(organization_id, code, version),
  CONSTRAINT ck_medication_protocols_code CHECK (btrim(code) <> ''),
  CONSTRAINT ck_medication_protocols_name CHECK (btrim(name) <> ''),
  CONSTRAINT ck_medication_protocols_version CHECK (version > 0),
  CONSTRAINT ck_medication_protocols_active_shape CHECK ((status = 'active' AND active = true) OR (status IN ('draft','retired') AND active = false))
);

-- [Phase 3]
CREATE TABLE medication_protocol_lines (
  id uuid NOT NULL CONSTRAINT pk_medication_protocol_lines PRIMARY KEY,
  medication_protocol_id uuid NOT NULL,
  medication_id uuid NOT NULL,
  administration_pattern_id uuid NOT NULL,
  strength_option_text character varying,
  take_text_override character varying,
  frequency_override character varying,
  duration_value_override numeric(14,3),
  duration_period_override character varying,
  instructions_override character varying,
  sequence_no smallint NOT NULL,
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_protocol_lines_protocol_medication_sequence UNIQUE(medication_protocol_id, medication_id, sequence_no),
  CONSTRAINT ck_medication_protocol_lines_sequence_no CHECK (sequence_no > 0),
  CONSTRAINT ck_medication_protocol_lines_duration CHECK ((duration_value_override IS NULL AND duration_period_override IS NULL) OR (duration_value_override > 0 AND duration_period_override IN ('days','weeks','months')))
);

-- [Phase 3]
CREATE TABLE medication_protocol_diagnosis_links (
  id uuid NOT NULL CONSTRAINT pk_medication_protocol_diagnosis_links PRIMARY KEY,
  medication_protocol_id uuid NOT NULL,
  diagnosis_id uuid NOT NULL,
  match_weight numeric(7,4) NOT NULL DEFAULT 1.0000,
  autoload boolean NOT NULL DEFAULT true,
  sequence_no smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_protocol_diagnosis_links_protocol_diagnosis UNIQUE(medication_protocol_id, diagnosis_id),
  CONSTRAINT ck_medication_protocol_diagnosis_links_match_weight CHECK (match_weight > 0),
  CONSTRAINT ck_medication_protocol_diagnosis_links_sequence_no CHECK (sequence_no > 0)
);

-- [Phase 3]
CREATE TABLE medication_protocol_service_links (
  id uuid NOT NULL CONSTRAINT pk_medication_protocol_service_links PRIMARY KEY,
  medication_protocol_id uuid NOT NULL,
  service_id uuid NOT NULL,
  match_weight numeric(7,4) NOT NULL DEFAULT 1.0000,
  autoload boolean NOT NULL DEFAULT true,
  sequence_no smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_protocol_service_links_protocol_service UNIQUE(medication_protocol_id, service_id),
  CONSTRAINT ck_medication_protocol_service_links_match_weight CHECK (match_weight > 0),
  CONSTRAINT ck_medication_protocol_service_links_sequence_no CHECK (sequence_no > 0)
);

-- Event-founded row: an encounter diagnosis exists only after a clinician records it, so diagnosed_at/diagnosed_by are mandatory.
-- [Phase 3]
CREATE TABLE encounter_diagnoses (
  id uuid NOT NULL CONSTRAINT pk_encounter_diagnoses PRIMARY KEY,
  care_encounter_id uuid NOT NULL,
  diagnosis_id uuid NOT NULL,
  diagnosis_code_snapshot character varying NOT NULL,
  diagnosis_name_snapshot character varying NOT NULL,
  tooth_code character varying,
  surface_codes character varying[] NOT NULL DEFAULT '{}',
  clinical_note character varying,
  status character varying NOT NULL DEFAULT 'confirmed' CONSTRAINT ck_encounter_diagnoses_status CHECK (status IN ('suspected','confirmed','resolved','ruled_out')),
  diagnosed_by uuid NOT NULL,
  diagnosed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_encounter_diagnoses_code_snapshot CHECK (btrim(diagnosis_code_snapshot) <> ''),
  CONSTRAINT ck_encounter_diagnoses_name_snapshot CHECK (btrim(diagnosis_name_snapshot) <> '')
);

-- Event-founded row: a service recommendation exists only after a clinician records it, so suggested_at/suggested_by are mandatory.
-- [Phase 3]
CREATE TABLE encounter_service_recommendations (
  id uuid NOT NULL CONSTRAINT pk_encounter_service_recommendations PRIMARY KEY,
  care_encounter_id uuid NOT NULL,
  encounter_diagnosis_id uuid,
  service_id uuid NOT NULL,
  service_code_snapshot character varying NOT NULL,
  service_name_snapshot character varying NOT NULL,
  service_domain_snapshot character varying NOT NULL,
  tooth_code character varying,
  surface_codes character varying[] NOT NULL DEFAULT '{}',
  clinical_note character varying,
  status character varying NOT NULL DEFAULT 'proposed' CONSTRAINT ck_encounter_service_recommendations_status CHECK (status IN ('proposed','accepted','declined','completed','cancelled')),
  suggested_by uuid NOT NULL,
  suggested_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_encounter_service_recommendations_code_snapshot CHECK (btrim(service_code_snapshot) <> ''),
  CONSTRAINT ck_encounter_service_recommendations_name_snapshot CHECK (btrim(service_name_snapshot) <> ''),
  CONSTRAINT ck_encounter_service_recommendations_domain_snapshot CHECK (btrim(service_domain_snapshot) <> '')
);

-- [Phase 3]
CREATE TABLE feedback_templates (
  id uuid NOT NULL CONSTRAINT pk_feedback_templates PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  body character varying,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE medication_orders (
  id uuid NOT NULL CONSTRAINT pk_medication_orders PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid NOT NULL,
  clinician_id uuid NOT NULL,
  source_protocol_id uuid,
  source_protocol_version integer,
  medication_order_no character varying,
  medication_order_date date NOT NULL,
  notes character varying,
  status dentos_data.medication_order_state NOT NULL DEFAULT 'draft',
  saved_at timestamptz,
  saved_by uuid,
  signed_at timestamptz,
  signed_by uuid,
  signature_hash character varying,
  signature_algorithm character varying,
  voided_at timestamptz,
  voided_by uuid,
  void_reason character varying,
  rendered_file_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_medication_orders_protocol_snapshot CHECK ((source_protocol_id IS NULL AND source_protocol_version IS NULL) OR (source_protocol_id IS NOT NULL AND source_protocol_version > 0)),
  CONSTRAINT ck_medication_orders_saved_shape CHECK ((status = 'draft' AND saved_at IS NULL AND saved_by IS NULL) OR (status IN ('saved','signed','void') AND saved_at IS NOT NULL AND saved_by IS NOT NULL)),
  CONSTRAINT ck_medication_orders_signed_shape CHECK ((status = 'signed' AND signed_at IS NOT NULL AND signed_by IS NOT NULL AND signature_hash IS NOT NULL AND btrim(signature_hash) <> '' AND signature_algorithm IS NOT NULL AND btrim(signature_algorithm) <> '') OR (status IN ('draft','saved') AND signed_at IS NULL AND signed_by IS NULL AND signature_hash IS NULL AND signature_algorithm IS NULL) OR (status = 'void' AND ((signed_at IS NULL AND signed_by IS NULL AND signature_hash IS NULL AND signature_algorithm IS NULL) OR (signed_at IS NOT NULL AND signed_by IS NOT NULL AND signature_hash IS NOT NULL AND btrim(signature_hash) <> '' AND signature_algorithm IS NOT NULL AND btrim(signature_algorithm) <> '')))),
  CONSTRAINT ck_medication_orders_void_shape CHECK ((status = 'void' AND voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND btrim(void_reason) <> '') OR (status <> 'void' AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL))
);

-- [Phase 3]
CREATE TABLE medication_order_diagnoses (
  id uuid NOT NULL CONSTRAINT pk_medication_order_diagnoses PRIMARY KEY,
  medication_order_id uuid NOT NULL,
  encounter_diagnosis_id uuid,
  diagnosis_id uuid NOT NULL,
  diagnosis_code_snapshot character varying NOT NULL,
  diagnosis_name_snapshot character varying NOT NULL,
  tooth_code_snapshot character varying,
  sequence_no smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_order_diagnoses_medication_order_diagnosis_sequence UNIQUE(medication_order_id, diagnosis_id, sequence_no),
  CONSTRAINT ck_medication_order_diagnoses_code_snapshot CHECK (btrim(diagnosis_code_snapshot) <> ''),
  CONSTRAINT ck_medication_order_diagnoses_name_snapshot CHECK (btrim(diagnosis_name_snapshot) <> ''),
  CONSTRAINT ck_medication_order_diagnoses_sequence_no CHECK (sequence_no > 0)
);

-- [Phase 3]
CREATE TABLE medication_order_service_links (
  id uuid NOT NULL CONSTRAINT pk_medication_order_service_links PRIMARY KEY,
  medication_order_id uuid NOT NULL,
  encounter_service_recommendation_id uuid,
  service_id uuid NOT NULL,
  service_code_snapshot character varying NOT NULL,
  service_name_snapshot character varying NOT NULL,
  service_domain_snapshot character varying NOT NULL,
  tooth_code_snapshot character varying,
  sequence_no smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_medication_order_service_links_medication_order_service_sequence UNIQUE(medication_order_id, service_id, sequence_no),
  CONSTRAINT ck_medication_order_service_links_code_snapshot CHECK (btrim(service_code_snapshot) <> ''),
  CONSTRAINT ck_medication_order_service_links_name_snapshot CHECK (btrim(service_name_snapshot) <> ''),
  CONSTRAINT ck_medication_order_service_links_domain_snapshot CHECK (btrim(service_domain_snapshot) <> ''),
  CONSTRAINT ck_medication_order_service_links_sequence_no CHECK (sequence_no > 0)
);

-- [Phase 3]
CREATE TABLE medication_order_lines (
  id uuid NOT NULL CONSTRAINT pk_medication_order_lines PRIMARY KEY,
  medication_order_id uuid NOT NULL,
  medication_id uuid,
  administration_pattern_id uuid,
  source_protocol_line_id uuid,
  medication_name_snapshot character varying NOT NULL,
  active_ingredient_snapshot character varying,
  strength_snapshot character varying,
  dosage_form_snapshot character varying,
  take_text character varying NOT NULL,
  frequency character varying NOT NULL,
  duration_value numeric(14,3) NOT NULL,
  duration_period character varying NOT NULL,
  instructions character varying NOT NULL DEFAULT '',
  manual_entry_reason character varying,
  sequence_no smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_medication_order_lines_identity CHECK ((medication_id IS NOT NULL AND manual_entry_reason IS NULL) OR (medication_id IS NULL AND manual_entry_reason IS NOT NULL AND btrim(manual_entry_reason) <> '')),
  CONSTRAINT ck_medication_order_lines_medication_name_snapshot CHECK (btrim(medication_name_snapshot) <> ''),
  CONSTRAINT ck_medication_order_lines_take_text CHECK (btrim(take_text) <> ''),
  CONSTRAINT ck_medication_order_lines_frequency CHECK (btrim(frequency) <> ''),
  CONSTRAINT ck_medication_order_lines_duration CHECK (duration_value > 0 AND duration_period IN ('days','weeks','months')),
  CONSTRAINT ck_medication_order_lines_sequence_no CHECK (sequence_no > 0)
);

-- [Phase 1]
CREATE TABLE fee_schedules (
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

-- [Phase 1]
CREATE TABLE fee_schedule_items (
  id uuid NOT NULL CONSTRAINT pk_fee_schedule_items PRIMARY KEY,
  fee_schedule_id uuid NOT NULL,
  service_id uuid NOT NULL,
  fee numeric(14,2),
  tax_code_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_fee_schedule_items_fee_schedule_id_service_id UNIQUE(fee_schedule_id, service_id)
);

-- [Phase 1]
CREATE TABLE tax_codes (
  id uuid NOT NULL CONSTRAINT pk_tax_codes PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  cgst_rate numeric(7,4),
  sgst_rate numeric(7,4),
  igst_rate numeric(7,4),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE fee_statements (
  id uuid NOT NULL CONSTRAINT pk_fee_statements PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  statement_reference character varying NOT NULL,
  statement_date date NOT NULL,
  due_date date,
  fee_schedule_id uuid NOT NULL,
  patient_category_id_snapshot uuid,
  status dentos_data.fee_statement_state,
  issued_at timestamptz,
  void_date date,
  voided_at timestamptz,
  subtotal numeric(14,2),
  discount_total numeric(14,2),
  taxable_total numeric(14,2),
  tax_total numeric(14,2),
  round_off numeric(14,2),
  grand_total numeric(14,2),
  applied_total numeric(14,2),
  credit_total numeric(14,2),
  writeoff_total numeric(14,2),
  outstanding_total numeric(14,2),
  void_reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_fee_statements_clinic_id_statement_reference UNIQUE(clinic_id, statement_reference)
);

-- [Phase 1]
CREATE TABLE fee_statement_lines (
  id uuid NOT NULL CONSTRAINT pk_fee_statement_lines PRIMARY KEY,
  fee_statement_id uuid NOT NULL,
  care_delivery_id uuid,
  care_plan_service_id uuid,
  service_id uuid,
  lead_clinician_id uuid NOT NULL,
  description character varying,
  tooth_code character varying,
  quantity numeric(14,3),
  unit_fee numeric(14,2),
  comments character varying,
  gross_amount numeric(14,2),
  discount_amount numeric(14,2),
  taxable_amount numeric(14,2),
  cgst_amount numeric(14,2),
  sgst_amount numeric(14,2),
  igst_amount numeric(14,2),
  line_total numeric(14,2),
  sequence_no smallint,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 2]
CREATE TABLE collection_receipts (
  id uuid NOT NULL CONSTRAINT pk_collection_receipts PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  care_encounter_id uuid,
  patient_category_id_snapshot uuid,
  lead_clinician_id_snapshot uuid,
  collection_reference character varying NOT NULL,
  collection_date date NOT NULL,
  status dentos_data.collection_receipt_state,
  gross_collected numeric(14,2),
  refunded_total numeric(14,2),
  available_total numeric(14,2),
  applied_total numeric(14,2),
  unapplied_total numeric(14,2),
  collection_operator_id uuid NOT NULL,
  notes character varying,
  void_reason character varying,
  last_modified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_collection_receipts_clinic_id_collection_reference UNIQUE(clinic_id, collection_reference)
);

-- [Phase 2]
CREATE TABLE collection_tenders (
  id uuid NOT NULL CONSTRAINT pk_collection_tenders PRIMARY KEY,
  collection_receipt_id uuid NOT NULL,
  collection_method_id uuid NOT NULL,
  amount numeric(14,2),
  reference_no character varying,
  bank_name character varying,
  instrument_date date,
  settlement_status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_collection_tenders_collection_receipt_id_id UNIQUE(collection_receipt_id, id)
);

-- [Phase 2]
CREATE TABLE fee_allocations (
  id uuid NOT NULL CONSTRAINT pk_fee_allocations PRIMARY KEY,
  clinic_id uuid NOT NULL,
  collection_receipt_id uuid NOT NULL,
  fee_statement_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  allocation_date date NOT NULL,
  amount numeric(14,2),
  status dentos_data.fee_allocation_state,
  applied_by uuid NOT NULL,
  reversed_by uuid,
  reversal_date date,
  reversed_at timestamptz,
  reversal_reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 2]
CREATE TABLE allocation_tender_splits (
  id uuid NOT NULL CONSTRAINT pk_allocation_tender_splits PRIMARY KEY,
  fee_allocation_id uuid NOT NULL,
  collection_tender_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_allocation_tender_splits_fee_allocation_id_collection_tender_ UNIQUE(fee_allocation_id, collection_tender_id)
);

-- [Phase 2]
CREATE TABLE allocation_fee_line_splits (
  id uuid NOT NULL CONSTRAINT pk_allocation_fee_line_splits PRIMARY KEY,
  fee_allocation_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_allocation_fee_line_splits_fee_allocation_id_fee_statement_line_id UNIQUE(fee_allocation_id, fee_statement_line_id)
);

-- [Phase 2]
CREATE TABLE clinician_value_allocations (
  id uuid NOT NULL CONSTRAINT pk_clinician_value_allocations PRIMARY KEY,
  fee_allocation_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  collection_tender_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_clinician_value_allocations_fee_allocation_id_fee_statement_line_id UNIQUE(fee_allocation_id, fee_statement_line_id, collection_tender_id)
);

-- [Phase 2]
CREATE TABLE fee_credits (
  id uuid NOT NULL CONSTRAINT pk_fee_credits PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  fee_statement_id uuid NOT NULL,
  credit_note_no character varying,
  credit_date date,
  amount numeric(14,2),
  status character varying CONSTRAINT ck_fee_credits_status CHECK (status IN ('active','reversed')),
  reversal_date date,
  reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 2]
CREATE TABLE fee_credit_allocations (
  id uuid NOT NULL CONSTRAINT pk_fee_credit_allocations PRIMARY KEY,
  fee_credit_id uuid NOT NULL,
  fee_statement_id uuid NOT NULL,
  allocation_date date,
  amount numeric(14,2),
  status character varying CONSTRAINT ck_fee_credit_allocations_status CHECK (status IN ('active','reversed')),
  reversal_date date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

-- Event-only financial row: approval is complete before a relief row exists, so approved_by remains mandatory.
-- [Phase 2]
CREATE TABLE fee_reliefs (
  id uuid NOT NULL CONSTRAINT pk_fee_reliefs PRIMARY KEY,
  fee_statement_id uuid NOT NULL,
  writeoff_date date,
  amount numeric(14,2),
  reason character varying,
  approved_by uuid NOT NULL,
  status character varying CONSTRAINT ck_fee_reliefs_status CHECK (status IN ('active','reversed')),
  reversal_date date,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 2]
CREATE TABLE fee_credit_line_splits (
  id uuid NOT NULL CONSTRAINT pk_fee_credit_line_splits PRIMARY KEY,
  credit_note_fee_allocation_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_fee_credit_line_splits_credit_note_fee_allocation_id_inv UNIQUE(credit_note_fee_allocation_id, fee_statement_line_id)
);

-- [Phase 2]
CREATE TABLE fee_relief_line_splits (
  id uuid NOT NULL CONSTRAINT pk_fee_relief_line_splits PRIMARY KEY,
  fee_relief_id uuid NOT NULL,
  fee_statement_line_id uuid NOT NULL,
  amount numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_fee_relief_line_splits_fee_relief_id_fee_statement_line_id UNIQUE(fee_relief_id, fee_statement_line_id)
);

-- Event-only financial row: processing and approval are complete before a posted refund row exists, so both actors remain mandatory.
-- [Phase 2]
CREATE TABLE collection_refunds (
  id uuid NOT NULL CONSTRAINT pk_collection_refunds PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  collection_receipt_id uuid NOT NULL,
  refund_no character varying,
  refund_date date,
  amount numeric(14,2),
  status character varying CONSTRAINT ck_collection_refunds_status CHECK (status IN ('posted','reversed')),
  processed_by uuid NOT NULL,
  approved_by uuid NOT NULL,
  reversal_date date,
  reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 2]
CREATE TABLE collection_refund_tenders (
  id uuid NOT NULL CONSTRAINT pk_collection_refund_tenders PRIMARY KEY,
  collection_refund_id uuid NOT NULL,
  original_tender_id uuid,
  collection_method_id uuid NOT NULL,
  amount numeric(14,2),
  reference_no character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

-- [Phase 2]
CREATE TABLE legacy_balance_documents (
  id uuid NOT NULL CONSTRAINT pk_legacy_balance_documents PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  balance_date date,
  receivable_amount numeric(14,2),
  advance_amount numeric(14,2),
  status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE ledger_accounts (
  id uuid NOT NULL CONSTRAINT pk_ledger_accounts PRIMARY KEY,
  organization_id uuid NOT NULL,
  code character varying,
  name character varying,
  account_type character varying,
  parent_id uuid,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE journal_entries (
  id uuid NOT NULL CONSTRAINT pk_journal_entries PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  entry_date date,
  source_type character varying,
  source_id uuid,
  status character varying CONSTRAINT ck_journal_entries_status CHECK (status IN ('posted','reversed')),
  reversal_of_id uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT uq_journal_entries_source_type_source_id_status UNIQUE(source_type, source_id, status)
);

-- [Phase 1]
CREATE TABLE journal_lines (
  id uuid NOT NULL CONSTRAINT pk_journal_lines PRIMARY KEY,
  journal_entry_id uuid NOT NULL,
  account_id uuid NOT NULL,
  patient_id uuid,
  clinician_id uuid,
  debit numeric(14,2) DEFAULT 0,
  credit numeric(14,2) DEFAULT 0,
  memo character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT ck_journal_lines_1 CHECK((debit=0) <> (credit=0))
);

-- [Phase 3]
CREATE TABLE clinician_share_contracts (
  id uuid NOT NULL CONSTRAINT pk_clinician_share_contracts PRIMARY KEY,
  clinic_id uuid NOT NULL,
  clinician_id uuid NOT NULL,
  basis character varying CONSTRAINT ck_clinician_share_contracts_basis CHECK (basis IN ('production','allocated_collection','service')),
  percentage numeric(7,4),
  effective_from date,
  effective_to date,
  rules_json jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE clinician_share_accruals (
  id uuid NOT NULL CONSTRAINT pk_clinician_share_accruals PRIMARY KEY,
  clinician_id uuid NOT NULL,
  fee_statement_line_id uuid,
  fee_allocation_id uuid,
  basis_amount numeric(14,2),
  share_amount numeric(14,2),
  contract_id uuid NOT NULL,
  status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE clinician_share_adjustments (
  id uuid NOT NULL CONSTRAINT pk_clinician_share_adjustments PRIMARY KEY,
  clinician_id uuid NOT NULL,
  adjustment_date date,
  amount numeric(14,2),
  type character varying,
  reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE clinician_share_payouts (
  id uuid NOT NULL CONSTRAINT pk_clinician_share_payouts PRIMARY KEY,
  clinician_id uuid NOT NULL,
  payout_date date,
  amount numeric(14,2),
  collection_method_id uuid NOT NULL,
  reference_no character varying,
  status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE suppliers (
  id uuid NOT NULL CONSTRAINT pk_suppliers PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  phone character varying,
  gstin character varying,
  address_json jsonb,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE expenses (
  id uuid NOT NULL CONSTRAINT pk_expenses PRIMARY KEY,
  clinic_id uuid NOT NULL,
  voucher_no character varying,
  expense_date date,
  expense_head_id uuid NOT NULL,
  supplier_id uuid,
  gross_amount numeric(14,2),
  tax_amount numeric(14,2),
  total_amount numeric(14,2),
  collection_method_id uuid NOT NULL,
  reference_no character varying,
  status character varying,
  notes character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE lab_disbursements (
  id uuid NOT NULL CONSTRAINT pk_lab_disbursements PRIMARY KEY,
  clinic_id uuid NOT NULL,
  lab_id uuid NOT NULL,
  collection_date date,
  amount numeric(14,2),
  collection_method_id uuid NOT NULL,
  reference_no character varying,
  status character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE inventory_items (
  id uuid NOT NULL CONSTRAINT pk_inventory_items PRIMARY KEY,
  organization_id uuid NOT NULL,
  stock_category_id uuid NOT NULL,
  code character varying,
  name character varying,
  unit character varying,
  reorder_level numeric(14,3),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE stock_documents (
  id uuid NOT NULL CONSTRAINT pk_stock_documents PRIMARY KEY,
  clinic_id uuid NOT NULL,
  document_type character varying CONSTRAINT ck_stock_documents_document_type CHECK (document_type IN ('inward','outward','adjustment')),
  document_no character varying,
  document_date date,
  supplier_id uuid,
  status character varying,
  notes character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE stock_document_lines (
  id uuid NOT NULL CONSTRAINT pk_stock_document_lines PRIMARY KEY,
  document_id uuid NOT NULL,
  item_id uuid NOT NULL,
  batch_no character varying,
  expiry_date date,
  quantity numeric(14,3),
  unit_cost numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 3]
CREATE TABLE stock_movements (
  id uuid NOT NULL CONSTRAINT pk_stock_movements PRIMARY KEY,
  clinic_id uuid NOT NULL,
  item_id uuid NOT NULL,
  batch_no character varying,
  movement_at timestamptz,
  quantity_delta numeric(14,3),
  unit_cost numeric(14,2),
  source_line_id uuid NOT NULL,
  reversal_of_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

-- [Phase 3]
CREATE TABLE stock_balances (
  clinic_id uuid NOT NULL,
  item_id uuid NOT NULL,
  batch_no character varying,
  on_hand numeric(14,3),
  average_cost numeric(14,2),
  row_version bigint,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  CONSTRAINT pk_stock_balances PRIMARY KEY(CLINIC_ID, ITEM_ID, BATCH_NO)
);

-- State-attribution invariant: the initial preference and every replacement state require changed_at/changed_by.
-- [Phase 3]
CREATE TABLE communication_preferences (
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

-- [Phase 3]
CREATE TABLE message_templates (
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

-- [Phase 3]
CREATE TABLE message_batches (
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

-- [Phase 3]
CREATE TABLE outbound_messages (
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

-- [Phase 3]
CREATE TABLE message_status_events (
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

-- [Phase 3]
CREATE TABLE inbound_messages (
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

-- [Phase 3]
CREATE TABLE education_videos (
  id uuid NOT NULL CONSTRAINT pk_education_videos PRIMARY KEY,
  organization_id uuid NOT NULL,
  title character varying,
  youtube_url character varying,
  category character varying,
  display_order integer,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

-- [Phase 1]
CREATE TABLE audit_events (
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

-- [Phase 1]
CREATE TABLE outbox_events (
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

-- [Phase 1]
CREATE TABLE job_runs (
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

-- [Phase 1]
CREATE TABLE idempotency_keys (
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

-- [Phase 2]
CREATE TABLE report_exports (
  id uuid NOT NULL CONSTRAINT pk_report_exports PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid,
  report_key character varying,
  filters_json jsonb,
  row_count integer,
  file_id uuid,
  requested_by uuid NOT NULL,
  created_at timestamptz,
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

```

## Explicit Foreign-Key Constraints

```sql
ALTER TABLE organizations ADD CONSTRAINT fk_organizations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE organizations ADD CONSTRAINT fk_organizations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinics ADD CONSTRAINT fk_clinics_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinics ADD CONSTRAINT fk_clinics_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinics ADD CONSTRAINT fk_clinics_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE users ADD CONSTRAINT fk_users_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE users ADD CONSTRAINT fk_users_disabled_by FOREIGN KEY (disabled_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE users ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE user_credentials ADD CONSTRAINT fk_user_credentials_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE user_credentials ADD CONSTRAINT fk_user_credentials_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE user_credentials ADD CONSTRAINT fk_user_credentials_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_tokens_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE user_sessions ADD CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE user_sessions ADD CONSTRAINT fk_user_sessions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff ADD CONSTRAINT fk_staff_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff ADD CONSTRAINT fk_staff_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff ADD CONSTRAINT fk_staff_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_clinics ADD CONSTRAINT fk_staff_clinics_staff_id FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_clinics ADD CONSTRAINT fk_staff_clinics_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_clinics ADD CONSTRAINT fk_staff_clinics_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_clinics ADD CONSTRAINT fk_staff_clinics_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_user_links ADD CONSTRAINT fk_staff_user_links_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_user_links ADD CONSTRAINT fk_staff_user_links_staff_id FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_user_links ADD CONSTRAINT fk_staff_user_links_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_user_links ADD CONSTRAINT fk_staff_user_links_linked_by FOREIGN KEY (linked_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_user_links ADD CONSTRAINT fk_staff_user_links_unlinked_by FOREIGN KEY (unlinked_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_user_links ADD CONSTRAINT fk_staff_user_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_user_links ADD CONSTRAINT fk_staff_user_links_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_memberships ADD CONSTRAINT fk_clinic_memberships_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_memberships ADD CONSTRAINT fk_clinic_memberships_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_memberships ADD CONSTRAINT fk_clinic_memberships_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_memberships ADD CONSTRAINT fk_clinic_memberships_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE roles ADD CONSTRAINT fk_roles_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE roles ADD CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE roles ADD CONSTRAINT fk_roles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE permissions ADD CONSTRAINT fk_permissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE permissions ADD CONSTRAINT fk_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_role_id FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_permission_id FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_roles ADD CONSTRAINT fk_membership_roles_membership_id FOREIGN KEY (membership_id) REFERENCES clinic_memberships(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_roles ADD CONSTRAINT fk_membership_roles_role_id FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_roles ADD CONSTRAINT fk_membership_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_roles ADD CONSTRAINT fk_membership_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_roles ADD CONSTRAINT fk_membership_roles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_permission_overrides ADD CONSTRAINT fk_membership_permission_overrides_membership_id FOREIGN KEY (membership_id) REFERENCES clinic_memberships(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_permission_overrides ADD CONSTRAINT fk_membership_permission_overrides_permission_id FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_permission_overrides ADD CONSTRAINT fk_membership_permission_overrides_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_permission_overrides ADD CONSTRAINT fk_membership_permission_overrides_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE membership_permission_overrides ADD CONSTRAINT fk_membership_permission_overrides_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_settings ADD CONSTRAINT fk_clinic_settings_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_settings ADD CONSTRAINT fk_clinic_settings_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_settings ADD CONSTRAINT fk_clinic_settings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinic_settings ADD CONSTRAINT fk_clinic_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE chairs ADD CONSTRAINT fk_chairs_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE chairs ADD CONSTRAINT fk_chairs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE chairs ADD CONSTRAINT fk_chairs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_initials ADD CONSTRAINT fk_patient_initials_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_initials ADD CONSTRAINT fk_patient_initials_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_initials ADD CONSTRAINT fk_patient_initials_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_categories ADD CONSTRAINT fk_patient_categories_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_categories ADD CONSTRAINT fk_patient_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_categories ADD CONSTRAINT fk_patient_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flags ADD CONSTRAINT fk_patient_flags_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flags ADD CONSTRAINT fk_patient_flags_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flags ADD CONSTRAINT fk_patient_flags_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE occupations ADD CONSTRAINT fk_occupations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE occupations ADD CONSTRAINT fk_occupations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE occupations ADD CONSTRAINT fk_occupations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_materials ADD CONSTRAINT fk_clinical_materials_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_materials ADD CONSTRAINT fk_clinical_materials_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_materials ADD CONSTRAINT fk_clinical_materials_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE bridge_types ADD CONSTRAINT fk_bridge_types_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE bridge_types ADD CONSTRAINT fk_bridge_types_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE bridge_types ADD CONSTRAINT fk_bridge_types_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_reasons ADD CONSTRAINT fk_care_booking_reasons_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_reasons ADD CONSTRAINT fk_care_booking_reasons_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_reasons ADD CONSTRAINT fk_care_booking_reasons_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expense_heads ADD CONSTRAINT fk_expense_heads_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expense_heads ADD CONSTRAINT fk_expense_heads_parent_id FOREIGN KEY (parent_id) REFERENCES expense_heads(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expense_heads ADD CONSTRAINT fk_expense_heads_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expense_heads ADD CONSTRAINT fk_expense_heads_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_methods ADD CONSTRAINT fk_collection_methods_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_methods ADD CONSTRAINT fk_collection_methods_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_methods ADD CONSTRAINT fk_collection_methods_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_domains ADD CONSTRAINT fk_service_domains_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_domains ADD CONSTRAINT fk_service_domains_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_domains ADD CONSTRAINT fk_service_domains_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE risk_factors ADD CONSTRAINT fk_risk_factors_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE risk_factors ADD CONSTRAINT fk_risk_factors_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE risk_factors ADD CONSTRAINT fk_risk_factors_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE diagnosis_catalog ADD CONSTRAINT fk_diagnosis_catalog_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE diagnosis_catalog ADD CONSTRAINT fk_diagnosis_catalog_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE diagnosis_catalog ADD CONSTRAINT fk_diagnosis_catalog_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_priorities ADD CONSTRAINT fk_treatment_priorities_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_priorities ADD CONSTRAINT fk_treatment_priorities_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_priorities ADD CONSTRAINT fk_treatment_priorities_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_tags ADD CONSTRAINT fk_document_tags_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_tags ADD CONSTRAINT fk_document_tags_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_tags ADD CONSTRAINT fk_document_tags_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_domains ADD CONSTRAINT fk_medication_domains_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_domains ADD CONSTRAINT fk_medication_domains_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_domains ADD CONSTRAINT fk_medication_domains_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_categories ADD CONSTRAINT fk_fee_statement_categories_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_categories ADD CONSTRAINT fk_fee_statement_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_categories ADD CONSTRAINT fk_fee_statement_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_categories ADD CONSTRAINT fk_stock_categories_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_categories ADD CONSTRAINT fk_stock_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_categories ADD CONSTRAINT fk_stock_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_work_steps ADD CONSTRAINT fk_lab_work_steps_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_work_steps ADD CONSTRAINT fk_lab_work_steps_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_work_steps ADD CONSTRAINT fk_lab_work_steps_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_quality_options ADD CONSTRAINT fk_lab_quality_options_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_quality_options ADD CONSTRAINT fk_lab_quality_options_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_quality_options ADD CONSTRAINT fk_lab_quality_options_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE note_templates ADD CONSTRAINT fk_note_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE note_templates ADD CONSTRAINT fk_note_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE note_templates ADD CONSTRAINT fk_note_templates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE custom_forms ADD CONSTRAINT fk_custom_forms_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE custom_forms ADD CONSTRAINT fk_custom_forms_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE custom_forms ADD CONSTRAINT fk_custom_forms_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_series ADD CONSTRAINT fk_document_series_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_series ADD CONSTRAINT fk_document_series_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_series ADD CONSTRAINT fk_document_series_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_series ADD CONSTRAINT fk_document_series_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_number_reservations ADD CONSTRAINT fk_document_number_reservations_series_id FOREIGN KEY (series_id) REFERENCES document_series(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_number_reservations ADD CONSTRAINT fk_document_number_reservations_allocated_by FOREIGN KEY (allocated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_number_reservations ADD CONSTRAINT fk_document_number_reservations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE document_number_reservations ADD CONSTRAINT fk_document_number_reservations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_home_clinic_id FOREIGN KEY (home_clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_initials_id FOREIGN KEY (initials_id) REFERENCES patient_initials(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_fee_schedule_id FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_category_id FOREIGN KEY (category_id) REFERENCES patient_categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_referral_source_id FOREIGN KEY (referral_source_id) REFERENCES referral_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_referring_patient_id FOREIGN KEY (referring_patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_merged_into_patient_id FOREIGN KEY (merged_into_patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_intent_tier_assessed_by FOREIGN KEY (intent_tier_assessed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patients ADD CONSTRAINT fk_patients_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_clinics ADD CONSTRAINT fk_patient_clinics_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_clinics ADD CONSTRAINT fk_patient_clinics_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_clinics ADD CONSTRAINT fk_patient_clinics_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_clinics ADD CONSTRAINT fk_patient_clinics_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_contacts ADD CONSTRAINT fk_patient_contacts_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_contacts ADD CONSTRAINT fk_patient_contacts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_contacts ADD CONSTRAINT fk_patient_contacts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_addresses ADD CONSTRAINT fk_patient_addresses_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_addresses ADD CONSTRAINT fk_patient_addresses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_addresses ADD CONSTRAINT fk_patient_addresses_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_family_links ADD CONSTRAINT fk_patient_family_links_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_family_links ADD CONSTRAINT fk_patient_family_links_related_patient_id FOREIGN KEY (related_patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_family_links ADD CONSTRAINT fk_patient_family_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_family_links ADD CONSTRAINT fk_patient_family_links_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE referral_sources ADD CONSTRAINT fk_referral_sources_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE referral_sources ADD CONSTRAINT fk_referral_sources_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE referral_sources ADD CONSTRAINT fk_referral_sources_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_flag_id FOREIGN KEY (flag_id) REFERENCES patient_flags(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_enrolled_by FOREIGN KEY (enrolled_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_treating_clinician_id FOREIGN KEY (treating_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_source_care_plan_id FOREIGN KEY (source_care_plan_id) REFERENCES care_plans(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_source_care_plan_service_id FOREIGN KEY (source_care_plan_service_id) REFERENCES care_plan_services(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_default_adjustment_service_id FOREIGN KEY (default_adjustment_service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_last_adjustment_care_encounter_id FOREIGN KEY (last_adjustment_care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_ended_by FOREIGN KEY (ended_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_flag_assignments ADD CONSTRAINT fk_patient_flag_assignments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE custom_field_definitions ADD CONSTRAINT fk_custom_field_definitions_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE custom_field_definitions ADD CONSTRAINT fk_custom_field_definitions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE custom_field_definitions ADD CONSTRAINT fk_custom_field_definitions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_custom_field_values ADD CONSTRAINT fk_patient_custom_field_values_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_custom_field_values ADD CONSTRAINT fk_patient_custom_field_values_definition_id FOREIGN KEY (definition_id) REFERENCES custom_field_definitions(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_custom_field_values ADD CONSTRAINT fk_patient_custom_field_values_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_custom_field_values ADD CONSTRAINT fk_patient_custom_field_values_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medical_question_definitions ADD CONSTRAINT fk_medical_question_definitions_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medical_question_definitions ADD CONSTRAINT fk_medical_question_definitions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medical_question_definitions ADD CONSTRAINT fk_medical_question_definitions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_medical_responses ADD CONSTRAINT fk_patient_medical_responses_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_medical_responses ADD CONSTRAINT fk_patient_medical_responses_definition_id FOREIGN KEY (definition_id) REFERENCES medical_question_definitions(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_medical_responses ADD CONSTRAINT fk_patient_medical_responses_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_medical_responses ADD CONSTRAINT fk_patient_medical_responses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_medical_responses ADD CONSTRAINT fk_patient_medical_responses_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allergy_catalog ADD CONSTRAINT fk_allergy_catalog_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allergy_catalog ADD CONSTRAINT fk_allergy_catalog_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allergy_catalog ADD CONSTRAINT fk_allergy_catalog_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_allergies ADD CONSTRAINT fk_patient_allergies_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_allergies ADD CONSTRAINT fk_patient_allergies_allergy_id FOREIGN KEY (allergy_id) REFERENCES allergy_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_allergies ADD CONSTRAINT fk_patient_allergies_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_allergies ADD CONSTRAINT fk_patient_allergies_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_consents ADD CONSTRAINT fk_patient_consents_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_consents ADD CONSTRAINT fk_patient_consents_captured_by FOREIGN KEY (captured_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_consents ADD CONSTRAINT fk_patient_consents_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_consents ADD CONSTRAINT fk_patient_consents_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_merge_events ADD CONSTRAINT fk_patient_merge_events_survivor_patient_id FOREIGN KEY (survivor_patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_merge_events ADD CONSTRAINT fk_patient_merge_events_duplicate_patient_id FOREIGN KEY (duplicate_patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_merge_events ADD CONSTRAINT fk_patient_merge_events_merged_by FOREIGN KEY (merged_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_merge_events ADD CONSTRAINT fk_patient_merge_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_working_hours ADD CONSTRAINT fk_staff_working_hours_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_working_hours ADD CONSTRAINT fk_staff_working_hours_staff_id FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_working_hours ADD CONSTRAINT fk_staff_working_hours_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE staff_working_hours ADD CONSTRAINT fk_staff_working_hours_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE chair_working_hours ADD CONSTRAINT fk_chair_working_hours_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE chair_working_hours ADD CONSTRAINT fk_chair_working_hours_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE chair_working_hours ADD CONSTRAINT fk_chair_working_hours_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE resource_blackouts ADD CONSTRAINT fk_resource_blackouts_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE resource_blackouts ADD CONSTRAINT fk_resource_blackouts_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE resource_blackouts ADD CONSTRAINT fk_resource_blackouts_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE resource_blackouts ADD CONSTRAINT fk_resource_blackouts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE resource_blackouts ADD CONSTRAINT fk_resource_blackouts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_lead_clinician_id FOREIGN KEY (lead_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_reason_id FOREIGN KEY (reason_id) REFERENCES care_booking_reasons(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_orthodontic_program_enrollment_id FOREIGN KEY (orthodontic_program_enrollment_id) REFERENCES patient_flag_assignments(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_no_show_marked_by FOREIGN KEY (no_show_marked_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_bookings ADD CONSTRAINT fk_care_bookings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_lead_clinician_id FOREIGN KEY (lead_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_reason_id FOREIGN KEY (reason_id) REFERENCES care_booking_reasons(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_processed_care_booking_id FOREIGN KEY (processed_care_booking_id) REFERENCES care_bookings(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_processed_by FOREIGN KEY (processed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_requests ADD CONSTRAINT fk_care_booking_requests_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_state_events ADD CONSTRAINT fk_care_booking_state_events_care_booking_id FOREIGN KEY (care_booking_id) REFERENCES care_bookings(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_state_events ADD CONSTRAINT fk_care_booking_state_events_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_booking_state_events ADD CONSTRAINT fk_care_booking_state_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_care_booking_id FOREIGN KEY (care_booking_id) REFERENCES care_bookings(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_lead_clinician_id FOREIGN KEY (lead_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_reason_id FOREIGN KEY (reason_id) REFERENCES care_booking_reasons(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_encounters ADD CONSTRAINT fk_care_encounters_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_state_events ADD CONSTRAINT fk_encounter_state_events_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_state_events ADD CONSTRAINT fk_encounter_state_events_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_state_events ADD CONSTRAINT fk_encounter_state_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_catalog ADD CONSTRAINT fk_service_catalog_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_catalog ADD CONSTRAINT fk_service_catalog_service_domain_id FOREIGN KEY (service_domain_id) REFERENCES service_domains(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_catalog ADD CONSTRAINT fk_service_catalog_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_catalog ADD CONSTRAINT fk_service_catalog_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE odontogram_findings ADD CONSTRAINT fk_odontogram_findings_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE odontogram_findings ADD CONSTRAINT fk_odontogram_findings_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE odontogram_findings ADD CONSTRAINT fk_odontogram_findings_recorded_by FOREIGN KEY (recorded_by) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE odontogram_findings ADD CONSTRAINT fk_odontogram_findings_supersedes_id FOREIGN KEY (supersedes_id) REFERENCES odontogram_findings(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE odontogram_findings ADD CONSTRAINT fk_odontogram_findings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE odontogram_findings ADD CONSTRAINT fk_odontogram_findings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plans ADD CONSTRAINT fk_care_plans_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plans ADD CONSTRAINT fk_care_plans_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plans ADD CONSTRAINT fk_care_plans_proposed_by FOREIGN KEY (proposed_by) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plans ADD CONSTRAINT fk_care_plans_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plans ADD CONSTRAINT fk_care_plans_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_stages ADD CONSTRAINT fk_care_plan_stages_care_plan_id FOREIGN KEY (care_plan_id) REFERENCES care_plans(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_stages ADD CONSTRAINT fk_care_plan_stages_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_stages ADD CONSTRAINT fk_care_plan_stages_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_services ADD CONSTRAINT fk_care_plan_services_care_plan_stage_id FOREIGN KEY (care_plan_stage_id) REFERENCES care_plan_stages(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_services ADD CONSTRAINT fk_care_plan_services_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_services ADD CONSTRAINT fk_care_plan_services_material_id FOREIGN KEY (material_id) REFERENCES clinical_materials(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_services ADD CONSTRAINT fk_care_plan_services_bridge_type_id FOREIGN KEY (bridge_type_id) REFERENCES bridge_types(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_services ADD CONSTRAINT fk_care_plan_services_completed_care_encounter_id FOREIGN KEY (completed_care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_services ADD CONSTRAINT fk_care_plan_services_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_plan_services ADD CONSTRAINT fk_care_plan_services_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_intent_tier_events ADD CONSTRAINT fk_patient_intent_tier_events_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_intent_tier_events ADD CONSTRAINT fk_patient_intent_tier_events_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_intent_tier_events ADD CONSTRAINT fk_patient_intent_tier_events_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_intent_tier_events ADD CONSTRAINT fk_patient_intent_tier_events_clinical_case_id FOREIGN KEY (clinical_case_id) REFERENCES clinical_cases(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_intent_tier_events ADD CONSTRAINT fk_patient_intent_tier_events_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_intent_tier_events ADD CONSTRAINT fk_patient_intent_tier_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_initial_consultation_id FOREIGN KEY (initial_consultation_id) REFERENCES case_consultations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_state_changed_by FOREIGN KEY (state_changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_treatment_started_by FOREIGN KEY (treatment_started_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_triggering_fee_allocation_id FOREIGN KEY (triggering_fee_allocation_id) REFERENCES fee_allocations(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_triggering_future_encounter_id FOREIGN KEY (triggering_future_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_minor_issue_care_delivery_id FOREIGN KEY (minor_issue_care_delivery_id) REFERENCES care_deliveries(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_cases ADD CONSTRAINT fk_clinical_cases_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_clinical_case_id FOREIGN KEY (clinical_case_id) REFERENCES clinical_cases(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_primary_consult_clinician_id FOREIGN KEY (primary_consult_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_secondary_review_clinician_id FOREIGN KEY (secondary_review_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_finalized_by FOREIGN KEY (finalized_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_voided_by FOREIGN KEY (voided_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE case_consultations ADD CONSTRAINT fk_case_consultations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundles ADD CONSTRAINT fk_treatment_bundles_clinical_case_id FOREIGN KEY (clinical_case_id) REFERENCES clinical_cases(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundles ADD CONSTRAINT fk_treatment_bundles_care_plan_id FOREIGN KEY (care_plan_id) REFERENCES care_plans(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundles ADD CONSTRAINT fk_treatment_bundles_advised_by FOREIGN KEY (advised_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundles ADD CONSTRAINT fk_treatment_bundles_accepted_by FOREIGN KEY (accepted_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundles ADD CONSTRAINT fk_treatment_bundles_completed_by FOREIGN KEY (completed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundles ADD CONSTRAINT fk_treatment_bundles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundles ADD CONSTRAINT fk_treatment_bundles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundle_services ADD CONSTRAINT fk_treatment_bundle_services_treatment_bundle_id FOREIGN KEY (treatment_bundle_id) REFERENCES treatment_bundles(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundle_services ADD CONSTRAINT fk_treatment_bundle_services_care_plan_service_id FOREIGN KEY (care_plan_service_id) REFERENCES care_plan_services(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundle_services ADD CONSTRAINT fk_treatment_bundle_services_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundle_services ADD CONSTRAINT fk_treatment_bundle_services_service_domain_id_snapshot FOREIGN KEY (service_domain_id_snapshot) REFERENCES service_domains(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundle_services ADD CONSTRAINT fk_treatment_bundle_services_advised_by FOREIGN KEY (advised_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundle_services ADD CONSTRAINT fk_treatment_bundle_services_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE treatment_bundle_services ADD CONSTRAINT fk_treatment_bundle_services_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_case_state_events ADD CONSTRAINT fk_clinical_case_state_events_clinical_case_id FOREIGN KEY (clinical_case_id) REFERENCES clinical_cases(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_case_state_events ADD CONSTRAINT fk_clinical_case_state_events_triggering_fee_allocation_id FOREIGN KEY (triggering_fee_allocation_id) REFERENCES fee_allocations(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_case_state_events ADD CONSTRAINT fk_clinical_case_state_events_triggering_future_encounter_id FOREIGN KEY (triggering_future_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_case_state_events ADD CONSTRAINT fk_clinical_case_state_events_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_case_state_events ADD CONSTRAINT fk_clinical_case_state_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_care_plan_service_id FOREIGN KEY (care_plan_service_id) REFERENCES care_plan_services(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_lead_clinician_id FOREIGN KEY (lead_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_orthodontic_program_enrollment_id FOREIGN KEY (orthodontic_program_enrollment_id) REFERENCES patient_flag_assignments(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_completed_by FOREIGN KEY (completed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE care_deliveries ADD CONSTRAINT fk_care_deliveries_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_notes ADD CONSTRAINT fk_clinical_notes_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_notes ADD CONSTRAINT fk_clinical_notes_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_notes ADD CONSTRAINT fk_clinical_notes_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_notes ADD CONSTRAINT fk_clinical_notes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinical_notes ADD CONSTRAINT fk_clinical_notes_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE files ADD CONSTRAINT fk_files_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE files ADD CONSTRAINT fk_files_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE files ADD CONSTRAINT fk_files_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_files ADD CONSTRAINT fk_patient_files_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_files ADD CONSTRAINT fk_patient_files_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_files ADD CONSTRAINT fk_patient_files_file_id FOREIGN KEY (file_id) REFERENCES files(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_files ADD CONSTRAINT fk_patient_files_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE patient_files ADD CONSTRAINT fk_patient_files_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_service_domain_id FOREIGN KEY (service_domain_id) REFERENCES service_domains(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_sms_template_id FOREIGN KEY (sms_template_id) REFERENCES message_templates(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_whatsapp_template_id FOREIGN KEY (whatsapp_template_id) REFERENCES message_templates(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_policies ADD CONSTRAINT fk_continuity_policies_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_source_care_encounter_id FOREIGN KEY (source_care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_rule_id FOREIGN KEY (rule_id) REFERENCES continuity_policies(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_completed_care_encounter_id FOREIGN KEY (completed_care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_recall_records ADD CONSTRAINT fk_continuity_recall_records_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_care_booking_id FOREIGN KEY (care_booking_id) REFERENCES care_bookings(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_care_delivery_id FOREIGN KEY (care_delivery_id) REFERENCES care_deliveries(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_care_plan_service_id FOREIGN KEY (care_plan_service_id) REFERENCES care_plan_services(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_medication_order_id FOREIGN KEY (medication_order_id) REFERENCES medication_orders(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_orthodontic_program_enrollment_id FOREIGN KEY (orthodontic_program_enrollment_id) REFERENCES patient_flag_assignments(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_continuity_policy_id FOREIGN KEY (continuity_policy_id) REFERENCES continuity_policies(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_custom_date_selected_by FOREIGN KEY (custom_date_selected_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_owner_clinician_id FOREIGN KEY (owner_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_reserved_care_booking_id FOREIGN KEY (reserved_care_booking_id) REFERENCES care_bookings(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_completed_by FOREIGN KEY (completed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_sms_template_id FOREIGN KEY (sms_template_id) REFERENCES message_templates(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_whatsapp_template_id FOREIGN KEY (whatsapp_template_id) REFERENCES message_templates(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE continuity_tasks ADD CONSTRAINT fk_continuity_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dental_labs ADD CONSTRAINT fk_dental_labs_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dental_labs ADD CONSTRAINT fk_dental_labs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dental_labs ADD CONSTRAINT fk_dental_labs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_work_types ADD CONSTRAINT fk_lab_work_types_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_work_types ADD CONSTRAINT fk_lab_work_types_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_work_types ADD CONSTRAINT fk_lab_work_types_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_lab_id FOREIGN KEY (lab_id) REFERENCES dental_labs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_work_type_id FOREIGN KEY (work_type_id) REFERENCES lab_work_types(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_requested_by FOREIGN KEY (requested_by) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_work_step_id FOREIGN KEY (work_step_id) REFERENCES lab_work_steps(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_received_by FOREIGN KEY (received_by) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_jobs ADD CONSTRAINT fk_lab_jobs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_job_status_history ADD CONSTRAINT fk_lab_job_status_history_lab_job_id FOREIGN KEY (lab_job_id) REFERENCES lab_jobs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_job_status_history ADD CONSTRAINT fk_lab_job_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_job_status_history ADD CONSTRAINT fk_lab_job_status_history_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE active_ingredient_catalog ADD CONSTRAINT fk_active_ingredient_catalog_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE active_ingredient_catalog ADD CONSTRAINT fk_active_ingredient_catalog_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE active_ingredient_catalog ADD CONSTRAINT fk_active_ingredient_catalog_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_catalog ADD CONSTRAINT fk_medication_catalog_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_catalog ADD CONSTRAINT fk_medication_catalog_primary_domain_id FOREIGN KEY (primary_domain_id) REFERENCES medication_domains(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_catalog ADD CONSTRAINT fk_medication_catalog_active_ingredient_id FOREIGN KEY (active_ingredient_id) REFERENCES active_ingredient_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_catalog ADD CONSTRAINT fk_medication_catalog_default_administration_pattern_id FOREIGN KEY (default_administration_pattern_id) REFERENCES administration_patterns(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_catalog ADD CONSTRAINT fk_medication_catalog_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_catalog ADD CONSTRAINT fk_medication_catalog_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE administration_patterns ADD CONSTRAINT fk_administration_patterns_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE administration_patterns ADD CONSTRAINT fk_administration_patterns_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE administration_patterns ADD CONSTRAINT fk_administration_patterns_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_domain_links ADD CONSTRAINT fk_medication_domain_links_medication_id FOREIGN KEY (medication_id) REFERENCES medication_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_domain_links ADD CONSTRAINT fk_medication_domain_links_domain_id FOREIGN KEY (domain_id) REFERENCES medication_domains(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_domain_links ADD CONSTRAINT fk_medication_domain_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_domain_links ADD CONSTRAINT fk_medication_domain_links_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_ingredient_links ADD CONSTRAINT fk_medication_ingredient_links_medication_id FOREIGN KEY (medication_id) REFERENCES medication_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_ingredient_links ADD CONSTRAINT fk_medication_ingredient_links_active_ingredient_id FOREIGN KEY (active_ingredient_id) REFERENCES active_ingredient_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_ingredient_links ADD CONSTRAINT fk_medication_ingredient_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_ingredient_links ADD CONSTRAINT fk_medication_ingredient_links_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allergy_ingredient_rules ADD CONSTRAINT fk_allergy_ingredient_rules_allergy_id FOREIGN KEY (allergy_id) REFERENCES allergy_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allergy_ingredient_rules ADD CONSTRAINT fk_allergy_ingredient_rules_active_ingredient_id FOREIGN KEY (active_ingredient_id) REFERENCES active_ingredient_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allergy_ingredient_rules ADD CONSTRAINT fk_allergy_ingredient_rules_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allergy_ingredient_rules ADD CONSTRAINT fk_allergy_ingredient_rules_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_strength_options ADD CONSTRAINT fk_medication_strength_options_medication_id FOREIGN KEY (medication_id) REFERENCES medication_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_strength_options ADD CONSTRAINT fk_medication_strength_options_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_strength_options ADD CONSTRAINT fk_medication_strength_options_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_administration_defaults ADD CONSTRAINT fk_medication_administration_defaults_medication_id FOREIGN KEY (medication_id) REFERENCES medication_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_administration_defaults ADD CONSTRAINT fk_medication_administration_defaults_administration_pattern_id FOREIGN KEY (administration_pattern_id) REFERENCES administration_patterns(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_administration_defaults ADD CONSTRAINT fk_medication_administration_defaults_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_administration_defaults ADD CONSTRAINT fk_medication_administration_defaults_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocols ADD CONSTRAINT fk_medication_protocols_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocols ADD CONSTRAINT fk_medication_protocols_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocols ADD CONSTRAINT fk_medication_protocols_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_lines ADD CONSTRAINT fk_medication_protocol_lines_medication_protocol_id FOREIGN KEY (medication_protocol_id) REFERENCES medication_protocols(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_lines ADD CONSTRAINT fk_medication_protocol_lines_medication_id FOREIGN KEY (medication_id) REFERENCES medication_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_lines ADD CONSTRAINT fk_medication_protocol_lines_administration_pattern_id FOREIGN KEY (administration_pattern_id) REFERENCES administration_patterns(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_lines ADD CONSTRAINT fk_medication_protocol_lines_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_lines ADD CONSTRAINT fk_medication_protocol_lines_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_diagnosis_links ADD CONSTRAINT fk_medication_protocol_diagnosis_links_medication_protocol_id FOREIGN KEY (medication_protocol_id) REFERENCES medication_protocols(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_diagnosis_links ADD CONSTRAINT fk_medication_protocol_diagnosis_links_diagnosis_id FOREIGN KEY (diagnosis_id) REFERENCES diagnosis_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_diagnosis_links ADD CONSTRAINT fk_medication_protocol_diagnosis_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_diagnosis_links ADD CONSTRAINT fk_medication_protocol_diagnosis_links_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_service_links ADD CONSTRAINT fk_medication_protocol_service_links_medication_protocol_id FOREIGN KEY (medication_protocol_id) REFERENCES medication_protocols(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_service_links ADD CONSTRAINT fk_medication_protocol_service_links_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_service_links ADD CONSTRAINT fk_medication_protocol_service_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_protocol_service_links ADD CONSTRAINT fk_medication_protocol_service_links_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_diagnoses ADD CONSTRAINT fk_encounter_diagnoses_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_diagnoses ADD CONSTRAINT fk_encounter_diagnoses_diagnosis_id FOREIGN KEY (diagnosis_id) REFERENCES diagnosis_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_diagnoses ADD CONSTRAINT fk_encounter_diagnoses_diagnosed_by FOREIGN KEY (diagnosed_by) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_diagnoses ADD CONSTRAINT fk_encounter_diagnoses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_diagnoses ADD CONSTRAINT fk_encounter_diagnoses_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_service_recommendations ADD CONSTRAINT fk_encounter_service_recommendations_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_service_recommendations ADD CONSTRAINT fk_encounter_service_recommendations_encounter_diagnosis_id FOREIGN KEY (encounter_diagnosis_id) REFERENCES encounter_diagnoses(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_service_recommendations ADD CONSTRAINT fk_encounter_service_recommendations_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_service_recommendations ADD CONSTRAINT fk_encounter_service_recommendations_suggested_by FOREIGN KEY (suggested_by) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_service_recommendations ADD CONSTRAINT fk_encounter_service_recommendations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE encounter_service_recommendations ADD CONSTRAINT fk_encounter_service_recommendations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE feedback_templates ADD CONSTRAINT fk_feedback_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE feedback_templates ADD CONSTRAINT fk_feedback_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE feedback_templates ADD CONSTRAINT fk_feedback_templates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_source_protocol_id FOREIGN KEY (source_protocol_id) REFERENCES medication_protocols(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_saved_by FOREIGN KEY (saved_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_signed_by FOREIGN KEY (signed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_voided_by FOREIGN KEY (voided_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_rendered_file_id FOREIGN KEY (rendered_file_id) REFERENCES files(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_orders ADD CONSTRAINT fk_medication_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_diagnoses ADD CONSTRAINT fk_medication_order_diagnoses_medication_order_id FOREIGN KEY (medication_order_id) REFERENCES medication_orders(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_diagnoses ADD CONSTRAINT fk_medication_order_diagnoses_encounter_diagnosis_id FOREIGN KEY (encounter_diagnosis_id) REFERENCES encounter_diagnoses(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_diagnoses ADD CONSTRAINT fk_medication_order_diagnoses_diagnosis_id FOREIGN KEY (diagnosis_id) REFERENCES diagnosis_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_diagnoses ADD CONSTRAINT fk_medication_order_diagnoses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_diagnoses ADD CONSTRAINT fk_medication_order_diagnoses_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_service_links ADD CONSTRAINT fk_medication_order_service_links_medication_order_id FOREIGN KEY (medication_order_id) REFERENCES medication_orders(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_service_links ADD CONSTRAINT fk_medication_order_service_links_encounter_service_recommendation_id FOREIGN KEY (encounter_service_recommendation_id) REFERENCES encounter_service_recommendations(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_service_links ADD CONSTRAINT fk_medication_order_service_links_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_service_links ADD CONSTRAINT fk_medication_order_service_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_service_links ADD CONSTRAINT fk_medication_order_service_links_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_lines ADD CONSTRAINT fk_medication_order_lines_medication_order_id FOREIGN KEY (medication_order_id) REFERENCES medication_orders(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_lines ADD CONSTRAINT fk_medication_order_lines_medication_id FOREIGN KEY (medication_id) REFERENCES medication_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_lines ADD CONSTRAINT fk_medication_order_lines_administration_pattern_id FOREIGN KEY (administration_pattern_id) REFERENCES administration_patterns(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_lines ADD CONSTRAINT fk_medication_order_lines_source_protocol_line_id FOREIGN KEY (source_protocol_line_id) REFERENCES medication_protocol_lines(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_lines ADD CONSTRAINT fk_medication_order_lines_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE medication_order_lines ADD CONSTRAINT fk_medication_order_lines_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_schedules ADD CONSTRAINT fk_fee_schedules_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_schedules ADD CONSTRAINT fk_fee_schedules_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_schedules ADD CONSTRAINT fk_fee_schedules_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_schedule_items ADD CONSTRAINT fk_fee_schedule_items_fee_schedule_id FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_schedule_items ADD CONSTRAINT fk_fee_schedule_items_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_schedule_items ADD CONSTRAINT fk_fee_schedule_items_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_schedule_items ADD CONSTRAINT fk_fee_schedule_items_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE tax_codes ADD CONSTRAINT fk_tax_codes_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE tax_codes ADD CONSTRAINT fk_tax_codes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE tax_codes ADD CONSTRAINT fk_tax_codes_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_fee_schedule_id FOREIGN KEY (fee_schedule_id) REFERENCES fee_schedules(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_patient_category_id_snapshot FOREIGN KEY (patient_category_id_snapshot) REFERENCES patient_categories(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statements ADD CONSTRAINT fk_fee_statements_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_lines ADD CONSTRAINT fk_fee_statement_lines_fee_statement_id FOREIGN KEY (fee_statement_id) REFERENCES fee_statements(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_lines ADD CONSTRAINT fk_fee_statement_lines_care_delivery_id FOREIGN KEY (care_delivery_id) REFERENCES care_deliveries(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_lines ADD CONSTRAINT fk_fee_statement_lines_care_plan_service_id FOREIGN KEY (care_plan_service_id) REFERENCES care_plan_services(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_lines ADD CONSTRAINT fk_fee_statement_lines_service_id FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_lines ADD CONSTRAINT fk_fee_statement_lines_lead_clinician_id FOREIGN KEY (lead_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_lines ADD CONSTRAINT fk_fee_statement_lines_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_statement_lines ADD CONSTRAINT fk_fee_statement_lines_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_patient_category_id_snapshot FOREIGN KEY (patient_category_id_snapshot) REFERENCES patient_categories(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_lead_clinician_id_snapshot FOREIGN KEY (lead_clinician_id_snapshot) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_collection_operator_id FOREIGN KEY (collection_operator_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_receipts ADD CONSTRAINT fk_collection_receipts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_tenders ADD CONSTRAINT fk_collection_tenders_collection_receipt_id FOREIGN KEY (collection_receipt_id) REFERENCES collection_receipts(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_tenders ADD CONSTRAINT fk_collection_tenders_collection_method_id FOREIGN KEY (collection_method_id) REFERENCES collection_methods(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_tenders ADD CONSTRAINT fk_collection_tenders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_tenders ADD CONSTRAINT fk_collection_tenders_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_collection_receipt_id FOREIGN KEY (collection_receipt_id) REFERENCES collection_receipts(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_fee_statement_id FOREIGN KEY (fee_statement_id) REFERENCES fee_statements(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_applied_by FOREIGN KEY (applied_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_reversed_by FOREIGN KEY (reversed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_allocations ADD CONSTRAINT fk_fee_allocations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allocation_tender_splits ADD CONSTRAINT fk_allocation_tender_splits_fee_allocation_id FOREIGN KEY (fee_allocation_id) REFERENCES fee_allocations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allocation_tender_splits ADD CONSTRAINT fk_allocation_tender_splits_collection_tender_id FOREIGN KEY (collection_tender_id) REFERENCES collection_tenders(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allocation_tender_splits ADD CONSTRAINT fk_allocation_tender_splits_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allocation_fee_line_splits ADD CONSTRAINT fk_allocation_fee_line_splits_fee_allocation_id FOREIGN KEY (fee_allocation_id) REFERENCES fee_allocations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allocation_fee_line_splits ADD CONSTRAINT fk_allocation_fee_line_splits_fee_statement_line_id FOREIGN KEY (fee_statement_line_id) REFERENCES fee_statement_lines(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE allocation_fee_line_splits ADD CONSTRAINT fk_allocation_fee_line_splits_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_value_allocations ADD CONSTRAINT fk_clinician_value_allocations_fee_allocation_id FOREIGN KEY (fee_allocation_id) REFERENCES fee_allocations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_value_allocations ADD CONSTRAINT fk_clinician_value_allocations_fee_statement_line_id FOREIGN KEY (fee_statement_line_id) REFERENCES fee_statement_lines(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_value_allocations ADD CONSTRAINT fk_clinician_value_allocations_collection_tender_id FOREIGN KEY (collection_tender_id) REFERENCES collection_tenders(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_value_allocations ADD CONSTRAINT fk_clinician_value_allocations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credits ADD CONSTRAINT fk_fee_credits_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credits ADD CONSTRAINT fk_fee_credits_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credits ADD CONSTRAINT fk_fee_credits_fee_statement_id FOREIGN KEY (fee_statement_id) REFERENCES fee_statements(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credits ADD CONSTRAINT fk_fee_credits_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credits ADD CONSTRAINT fk_fee_credits_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credit_allocations ADD CONSTRAINT fk_fee_credit_allocations_fee_credit_id FOREIGN KEY (fee_credit_id) REFERENCES fee_credits(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credit_allocations ADD CONSTRAINT fk_fee_credit_allocations_fee_statement_id FOREIGN KEY (fee_statement_id) REFERENCES fee_statements(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credit_allocations ADD CONSTRAINT fk_fee_credit_allocations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_reliefs ADD CONSTRAINT fk_fee_reliefs_fee_statement_id FOREIGN KEY (fee_statement_id) REFERENCES fee_statements(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_reliefs ADD CONSTRAINT fk_fee_reliefs_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_reliefs ADD CONSTRAINT fk_fee_reliefs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_reliefs ADD CONSTRAINT fk_fee_reliefs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credit_line_splits ADD CONSTRAINT fk_fee_credit_line_splits_credit_note_fee_allocation_id FOREIGN KEY (credit_note_fee_allocation_id) REFERENCES fee_credit_allocations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credit_line_splits ADD CONSTRAINT fk_fee_credit_line_splits_fee_statement_line_id FOREIGN KEY (fee_statement_line_id) REFERENCES fee_statement_lines(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_credit_line_splits ADD CONSTRAINT fk_fee_credit_line_splits_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_relief_line_splits ADD CONSTRAINT fk_fee_relief_line_splits_fee_relief_id FOREIGN KEY (fee_relief_id) REFERENCES fee_reliefs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_relief_line_splits ADD CONSTRAINT fk_fee_relief_line_splits_fee_statement_line_id FOREIGN KEY (fee_statement_line_id) REFERENCES fee_statement_lines(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE fee_relief_line_splits ADD CONSTRAINT fk_fee_relief_line_splits_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refunds ADD CONSTRAINT fk_collection_refunds_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refunds ADD CONSTRAINT fk_collection_refunds_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refunds ADD CONSTRAINT fk_collection_refunds_collection_receipt_id FOREIGN KEY (collection_receipt_id) REFERENCES collection_receipts(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refunds ADD CONSTRAINT fk_collection_refunds_processed_by FOREIGN KEY (processed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refunds ADD CONSTRAINT fk_collection_refunds_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refunds ADD CONSTRAINT fk_collection_refunds_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refunds ADD CONSTRAINT fk_collection_refunds_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refund_tenders ADD CONSTRAINT fk_collection_refund_tenders_collection_refund_id FOREIGN KEY (collection_refund_id) REFERENCES collection_refunds(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refund_tenders ADD CONSTRAINT fk_collection_refund_tenders_original_tender_id FOREIGN KEY (original_tender_id) REFERENCES collection_tenders(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refund_tenders ADD CONSTRAINT fk_collection_refund_tenders_collection_method_id FOREIGN KEY (collection_method_id) REFERENCES collection_methods(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE collection_refund_tenders ADD CONSTRAINT fk_collection_refund_tenders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE legacy_balance_documents ADD CONSTRAINT fk_legacy_balance_documents_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE legacy_balance_documents ADD CONSTRAINT fk_legacy_balance_documents_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE legacy_balance_documents ADD CONSTRAINT fk_legacy_balance_documents_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE legacy_balance_documents ADD CONSTRAINT fk_legacy_balance_documents_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE ledger_accounts ADD CONSTRAINT fk_ledger_accounts_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE ledger_accounts ADD CONSTRAINT fk_ledger_accounts_parent_id FOREIGN KEY (parent_id) REFERENCES ledger_accounts(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE ledger_accounts ADD CONSTRAINT fk_ledger_accounts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE ledger_accounts ADD CONSTRAINT fk_ledger_accounts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_entries ADD CONSTRAINT fk_journal_entries_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_entries ADD CONSTRAINT fk_journal_entries_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_entries ADD CONSTRAINT fk_journal_entries_reversal_of_id FOREIGN KEY (reversal_of_id) REFERENCES journal_entries(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_entries ADD CONSTRAINT fk_journal_entries_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_lines_journal_entry_id FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_lines_account_id FOREIGN KEY (account_id) REFERENCES ledger_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_lines_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_lines_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE journal_lines ADD CONSTRAINT fk_journal_lines_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_contracts ADD CONSTRAINT fk_clinician_share_contracts_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_contracts ADD CONSTRAINT fk_clinician_share_contracts_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_contracts ADD CONSTRAINT fk_clinician_share_contracts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_contracts ADD CONSTRAINT fk_clinician_share_contracts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_accruals ADD CONSTRAINT fk_clinician_share_accruals_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_accruals ADD CONSTRAINT fk_clinician_share_accruals_fee_statement_line_id FOREIGN KEY (fee_statement_line_id) REFERENCES fee_statement_lines(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_accruals ADD CONSTRAINT fk_clinician_share_accruals_fee_allocation_id FOREIGN KEY (fee_allocation_id) REFERENCES fee_allocations(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_accruals ADD CONSTRAINT fk_clinician_share_accruals_contract_id FOREIGN KEY (contract_id) REFERENCES clinician_share_contracts(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_accruals ADD CONSTRAINT fk_clinician_share_accruals_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_accruals ADD CONSTRAINT fk_clinician_share_accruals_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_adjustments ADD CONSTRAINT fk_clinician_share_adjustments_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_adjustments ADD CONSTRAINT fk_clinician_share_adjustments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_adjustments ADD CONSTRAINT fk_clinician_share_adjustments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_payouts ADD CONSTRAINT fk_clinician_share_payouts_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_payouts ADD CONSTRAINT fk_clinician_share_payouts_collection_method_id FOREIGN KEY (collection_method_id) REFERENCES collection_methods(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_payouts ADD CONSTRAINT fk_clinician_share_payouts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE clinician_share_payouts ADD CONSTRAINT fk_clinician_share_payouts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE suppliers ADD CONSTRAINT fk_suppliers_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_expense_head_id FOREIGN KEY (expense_head_id) REFERENCES expense_heads(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_collection_method_id FOREIGN KEY (collection_method_id) REFERENCES collection_methods(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_disbursements ADD CONSTRAINT fk_lab_disbursements_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_disbursements ADD CONSTRAINT fk_lab_disbursements_lab_id FOREIGN KEY (lab_id) REFERENCES dental_labs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_disbursements ADD CONSTRAINT fk_lab_disbursements_collection_method_id FOREIGN KEY (collection_method_id) REFERENCES collection_methods(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_disbursements ADD CONSTRAINT fk_lab_disbursements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE lab_disbursements ADD CONSTRAINT fk_lab_disbursements_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_items_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_items_stock_category_id FOREIGN KEY (stock_category_id) REFERENCES stock_categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_items_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_items_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_documents ADD CONSTRAINT fk_stock_documents_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_documents ADD CONSTRAINT fk_stock_documents_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_documents ADD CONSTRAINT fk_stock_documents_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_documents ADD CONSTRAINT fk_stock_documents_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_document_lines ADD CONSTRAINT fk_stock_document_lines_document_id FOREIGN KEY (document_id) REFERENCES stock_documents(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_document_lines ADD CONSTRAINT fk_stock_document_lines_item_id FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_document_lines ADD CONSTRAINT fk_stock_document_lines_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_document_lines ADD CONSTRAINT fk_stock_document_lines_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_item_id FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_source_line_id FOREIGN KEY (source_line_id) REFERENCES stock_document_lines(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_reversal_of_id FOREIGN KEY (reversal_of_id) REFERENCES stock_movements(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_balances ADD CONSTRAINT fk_stock_balances_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_balances ADD CONSTRAINT fk_stock_balances_item_id FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_balances ADD CONSTRAINT fk_stock_balances_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE stock_balances ADD CONSTRAINT fk_stock_balances_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE communication_preferences ADD CONSTRAINT fk_communication_preferences_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE communication_preferences ADD CONSTRAINT fk_communication_preferences_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE communication_preferences ADD CONSTRAINT fk_communication_preferences_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE communication_preferences ADD CONSTRAINT fk_communication_preferences_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_templates ADD CONSTRAINT fk_message_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_templates ADD CONSTRAINT fk_message_templates_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_templates ADD CONSTRAINT fk_message_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_templates ADD CONSTRAINT fk_message_templates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_batches ADD CONSTRAINT fk_message_batches_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_batches ADD CONSTRAINT fk_message_batches_template_id FOREIGN KEY (template_id) REFERENCES message_templates(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_batches ADD CONSTRAINT fk_message_batches_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_batches ADD CONSTRAINT fk_message_batches_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbound_messages ADD CONSTRAINT fk_outbound_messages_batch_id FOREIGN KEY (batch_id) REFERENCES message_batches(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbound_messages ADD CONSTRAINT fk_outbound_messages_continuity_task_id FOREIGN KEY (continuity_task_id) REFERENCES continuity_tasks(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbound_messages ADD CONSTRAINT fk_outbound_messages_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbound_messages ADD CONSTRAINT fk_outbound_messages_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbound_messages ADD CONSTRAINT fk_outbound_messages_template_id FOREIGN KEY (template_id) REFERENCES message_templates(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbound_messages ADD CONSTRAINT fk_outbound_messages_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbound_messages ADD CONSTRAINT fk_outbound_messages_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_status_events ADD CONSTRAINT fk_message_status_events_outbound_message_id FOREIGN KEY (outbound_message_id) REFERENCES outbound_messages(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE message_status_events ADD CONSTRAINT fk_message_status_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE inbound_messages ADD CONSTRAINT fk_inbound_messages_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE inbound_messages ADD CONSTRAINT fk_inbound_messages_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE inbound_messages ADD CONSTRAINT fk_inbound_messages_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE education_videos ADD CONSTRAINT fk_education_videos_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE education_videos ADD CONSTRAINT fk_education_videos_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE education_videos ADD CONSTRAINT fk_education_videos_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbox_events ADD CONSTRAINT fk_outbox_events_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE outbox_events ADD CONSTRAINT fk_outbox_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE job_runs ADD CONSTRAINT fk_job_runs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE idempotency_keys ADD CONSTRAINT fk_idempotency_keys_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE idempotency_keys ADD CONSTRAINT fk_idempotency_keys_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE idempotency_keys ADD CONSTRAINT fk_idempotency_keys_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE report_exports ADD CONSTRAINT fk_report_exports_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE report_exports ADD CONSTRAINT fk_report_exports_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE report_exports ADD CONSTRAINT fk_report_exports_file_id FOREIGN KEY (file_id) REFERENCES files(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE report_exports ADD CONSTRAINT fk_report_exports_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE report_exports ADD CONSTRAINT fk_report_exports_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE report_exports ADD CONSTRAINT fk_report_exports_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
```

## Composite and Operational Indexes

The following statements are explicit deployment DDL. Their column order follows tenant scope, clinic scope, business date/status, and lookup key.

```sql
CREATE INDEX ix_organizations_scope_lookup ON organizations (created_at, id);
CREATE INDEX ix_clinics_scope_lookup ON clinics (organization_id, created_at, id);
CREATE INDEX ix_users_scope_lookup ON users (organization_id, status, created_at, id);
CREATE INDEX ix_password_reset_tokens_scope_lookup ON password_reset_tokens (created_at, id);
CREATE INDEX ix_user_sessions_scope_lookup ON user_sessions (created_at, id);
CREATE INDEX ix_staff_scope_lookup ON staff (organization_id, created_at, id);
CREATE INDEX ix_staff_clinics_scope_lookup ON staff_clinics (clinic_id, created_at);
CREATE INDEX ix_staff_user_links_scope_lookup ON staff_user_links (organization_id, created_at, id);
CREATE INDEX ix_clinic_memberships_scope_lookup ON clinic_memberships (clinic_id, created_at, id);
CREATE INDEX ix_roles_scope_lookup ON roles (organization_id, created_at, id);
CREATE INDEX ix_permissions_scope_lookup ON permissions (created_at, id);
CREATE INDEX ix_clinic_settings_scope_lookup ON clinic_settings (organization_id, clinic_id, created_at, id);
CREATE INDEX ix_chairs_scope_lookup ON chairs (clinic_id, created_at, id);
CREATE INDEX ix_patient_initials_scope_lookup ON patient_initials (organization_id, created_at, id);
CREATE INDEX ix_patient_categories_scope_lookup ON patient_categories (organization_id, created_at, id);
CREATE INDEX ix_patient_flags_scope_lookup ON patient_flags (organization_id, created_at, id);
CREATE INDEX ix_occupations_scope_lookup ON occupations (organization_id, created_at, id);
CREATE INDEX ix_clinical_materials_scope_lookup ON clinical_materials (organization_id, created_at, id);
CREATE INDEX ix_bridge_types_scope_lookup ON bridge_types (organization_id, created_at, id);
CREATE INDEX ix_care_booking_reasons_scope_lookup ON care_booking_reasons (organization_id, created_at, id);
CREATE INDEX ix_expense_heads_scope_lookup ON expense_heads (organization_id, created_at, id);
CREATE INDEX ix_collection_methods_scope_lookup ON collection_methods (organization_id, created_at, id);
CREATE INDEX ix_service_domains_scope_lookup ON service_domains (organization_id, created_at, id);
CREATE INDEX ix_risk_factors_scope_lookup ON risk_factors (organization_id, created_at, id);
CREATE INDEX ix_diagnosis_catalog_scope_lookup ON diagnosis_catalog (organization_id, active, display_order, id);
CREATE INDEX ix_treatment_priorities_scope_lookup ON treatment_priorities (organization_id, created_at, id);
CREATE INDEX ix_document_tags_scope_lookup ON document_tags (organization_id, created_at, id);
CREATE INDEX ix_medication_domains_scope_lookup ON medication_domains (organization_id, created_at, id);
CREATE INDEX ix_fee_statement_categories_scope_lookup ON fee_statement_categories (organization_id, created_at, id);
CREATE INDEX ix_stock_categories_scope_lookup ON stock_categories (organization_id, created_at, id);
CREATE INDEX ix_lab_work_steps_scope_lookup ON lab_work_steps (organization_id, created_at, id);
CREATE INDEX ix_lab_quality_options_scope_lookup ON lab_quality_options (organization_id, created_at, id);
CREATE INDEX ix_note_templates_scope_lookup ON note_templates (organization_id, created_at, id);
CREATE INDEX ix_custom_forms_scope_lookup ON custom_forms (organization_id, created_at, id);
CREATE INDEX ix_document_series_scope_lookup ON document_series (organization_id, clinic_id, created_at, id);
CREATE INDEX ix_document_number_reservations_scope_lookup ON document_number_reservations (status, created_at, id);
CREATE INDEX ix_patients_scope_lookup ON patients (organization_id, created_at, id);
CREATE INDEX ix_patient_clinics_scope_lookup ON patient_clinics (clinic_id, patient_id, created_at);
CREATE INDEX ix_patient_contacts_scope_lookup ON patient_contacts (patient_id, created_at, id);
CREATE INDEX ix_patient_addresses_scope_lookup ON patient_addresses (patient_id, created_at, id);
CREATE INDEX ix_patient_family_links_scope_lookup ON patient_family_links (patient_id, created_at, id);
CREATE INDEX ix_referral_sources_scope_lookup ON referral_sources (organization_id, created_at, id);
CREATE INDEX ix_patient_flag_assignments_scope_lookup ON patient_flag_assignments (patient_id, created_at, id);
CREATE INDEX ix_custom_field_definitions_scope_lookup ON custom_field_definitions (organization_id, created_at, id);
CREATE INDEX ix_patient_custom_field_values_scope_lookup ON patient_custom_field_values (patient_id, created_at, id);
CREATE INDEX ix_medical_question_definitions_scope_lookup ON medical_question_definitions (organization_id, created_at, id);
CREATE INDEX ix_patient_medical_responses_scope_lookup ON patient_medical_responses (patient_id, created_at, id);
CREATE INDEX ix_allergy_catalog_scope_lookup ON allergy_catalog (organization_id, created_at, id);
CREATE INDEX ix_patient_allergies_scope_lookup ON patient_allergies (patient_id, created_at, id);
CREATE INDEX ix_patient_consents_scope_lookup ON patient_consents (patient_id, created_at, id);
CREATE INDEX ix_patient_merge_events_scope_lookup ON patient_merge_events (created_at, id);
CREATE INDEX ix_staff_working_hours_scope_lookup ON staff_working_hours (clinic_id, created_at, id);
CREATE INDEX ix_chair_working_hours_scope_lookup ON chair_working_hours (created_at, id);
CREATE INDEX ix_resource_blackouts_scope_lookup ON resource_blackouts (clinic_id, status, created_at, id);
CREATE INDEX ix_care_bookings_scope_lookup ON care_bookings (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_care_booking_state_events_scope_lookup ON care_booking_state_events (created_at, id);
CREATE INDEX ix_care_encounters_scope_lookup ON care_encounters (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_encounter_state_events_scope_lookup ON encounter_state_events (created_at, id);
CREATE INDEX ix_service_catalog_scope_lookup ON service_catalog (organization_id, created_at, id);
CREATE INDEX ix_odontogram_findings_scope_lookup ON odontogram_findings (patient_id, status, created_at, id);
CREATE INDEX ix_care_plans_scope_lookup ON care_plans (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_care_plan_stages_scope_lookup ON care_plan_stages (status, created_at, id);
CREATE INDEX ix_care_plan_services_scope_lookup ON care_plan_services (status, created_at, id);
CREATE INDEX ix_care_deliveries_scope_lookup ON care_deliveries (patient_id, status, created_at, id);
CREATE INDEX ix_clinical_notes_scope_lookup ON clinical_notes (patient_id, status, created_at, id);
CREATE INDEX ix_files_scope_lookup ON files (organization_id, created_at, id);
CREATE INDEX ix_patient_files_scope_lookup ON patient_files (patient_id, created_at, id);
CREATE INDEX ix_continuity_policies_scope_lookup ON continuity_policies (organization_id, created_at, id);
CREATE INDEX ix_continuity_recall_records_scope_lookup ON continuity_recall_records (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_continuity_tasks_scope_lookup ON continuity_tasks (patient_id, status, created_at, id);
CREATE INDEX ix_dental_labs_scope_lookup ON dental_labs (organization_id, created_at, id);
CREATE INDEX ix_lab_work_types_scope_lookup ON lab_work_types (organization_id, created_at, id);
CREATE INDEX ix_lab_jobs_scope_lookup ON lab_jobs (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_lab_job_status_history_scope_lookup ON lab_job_status_history (created_at, id);
CREATE INDEX ix_active_ingredient_catalog_scope_lookup ON active_ingredient_catalog (organization_id, created_at, id);
CREATE INDEX ix_medication_catalog_scope_lookup ON medication_catalog (organization_id, created_at, id);
CREATE INDEX ix_administration_patterns_scope_lookup ON administration_patterns (organization_id, created_at, id);
CREATE INDEX ix_medication_domain_links_scope_lookup ON medication_domain_links (medication_id, active, sequence_no, id);
CREATE INDEX ix_medication_ingredient_links_scope_lookup ON medication_ingredient_links (medication_id, active, sequence_no, id);
CREATE INDEX ix_allergy_ingredient_rules_scope_lookup ON allergy_ingredient_rules (allergy_id, active, interaction_level, active_ingredient_id);
CREATE INDEX ix_medication_strength_options_scope_lookup ON medication_strength_options (medication_id, active, sequence_no, id);
CREATE INDEX ix_medication_administration_defaults_scope_lookup ON medication_administration_defaults (medication_id, active, priority_rank, id);
CREATE INDEX ix_medication_protocols_scope_lookup ON medication_protocols (organization_id, created_at, id);
CREATE INDEX ix_medication_protocol_lines_scope_lookup ON medication_protocol_lines (medication_protocol_id, active, sequence_no, id);
CREATE INDEX ix_medication_protocol_diagnosis_links_scope_lookup ON medication_protocol_diagnosis_links (diagnosis_id, medication_protocol_id, autoload, sequence_no);
CREATE INDEX ix_medication_protocol_service_links_scope_lookup ON medication_protocol_service_links (service_id, medication_protocol_id, autoload, sequence_no);
CREATE INDEX ix_encounter_diagnoses_scope_lookup ON encounter_diagnoses (care_encounter_id, status, diagnosed_at, id);
CREATE INDEX ix_encounter_service_recommendations_scope_lookup ON encounter_service_recommendations (care_encounter_id, status, suggested_at, id);
CREATE INDEX ix_feedback_templates_scope_lookup ON feedback_templates (organization_id, created_at, id);
CREATE INDEX ix_medication_orders_scope_lookup ON medication_orders (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_medication_order_diagnoses_scope_lookup ON medication_order_diagnoses (medication_order_id, sequence_no, id);
CREATE INDEX ix_medication_order_service_links_scope_lookup ON medication_order_service_links (medication_order_id, sequence_no, id);
CREATE INDEX ix_medication_order_lines_scope_lookup ON medication_order_lines (created_at, id);
CREATE INDEX ix_fee_schedules_scope_lookup ON fee_schedules (organization_id, created_at, id);
CREATE INDEX ix_fee_schedule_items_scope_lookup ON fee_schedule_items (created_at, id);
CREATE INDEX ix_tax_codes_scope_lookup ON tax_codes (organization_id, created_at, id);
CREATE INDEX ix_fee_statements_scope_lookup ON fee_statements (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_fee_statement_lines_scope_lookup ON fee_statement_lines (created_at, id);
CREATE INDEX ix_collection_receipts_scope_lookup ON collection_receipts (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_collection_tenders_scope_lookup ON collection_tenders (created_at, id);
CREATE INDEX ix_fee_allocations_scope_lookup ON fee_allocations (patient_id, status, allocation_date, created_at);
CREATE INDEX ix_allocation_tender_splits_scope_lookup ON allocation_tender_splits (created_at, id);
CREATE INDEX ix_allocation_fee_line_splits_scope_lookup ON allocation_fee_line_splits (created_at, id);
CREATE INDEX ix_clinician_value_allocations_scope_lookup ON clinician_value_allocations (created_at, id);
CREATE INDEX ix_fee_credits_scope_lookup ON fee_credits (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_fee_credit_allocations_scope_lookup ON fee_credit_allocations (status, allocation_date, created_at, id);
CREATE INDEX ix_fee_reliefs_scope_lookup ON fee_reliefs (status, created_at, id);
CREATE INDEX ix_fee_credit_line_splits_scope_lookup ON fee_credit_line_splits (created_at, id);
CREATE INDEX ix_fee_relief_line_splits_scope_lookup ON fee_relief_line_splits (created_at, id);
CREATE INDEX ix_collection_refunds_scope_lookup ON collection_refunds (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_collection_refund_tenders_scope_lookup ON collection_refund_tenders (created_at, id);
CREATE INDEX ix_legacy_balance_documents_scope_lookup ON legacy_balance_documents (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_ledger_accounts_scope_lookup ON ledger_accounts (organization_id, created_at, id);
CREATE INDEX ix_journal_entries_scope_lookup ON journal_entries (organization_id, clinic_id, status, created_at);
CREATE INDEX ix_journal_lines_scope_lookup ON journal_lines (patient_id, created_at, id);
CREATE INDEX ix_clinician_share_contracts_scope_lookup ON clinician_share_contracts (clinic_id, created_at, id);
CREATE INDEX ix_clinician_share_accruals_scope_lookup ON clinician_share_accruals (status, created_at, id);
CREATE INDEX ix_clinician_share_adjustments_scope_lookup ON clinician_share_adjustments (created_at, id);
CREATE INDEX ix_clinician_share_payouts_scope_lookup ON clinician_share_payouts (status, created_at, id);
CREATE INDEX ix_suppliers_scope_lookup ON suppliers (organization_id, created_at, id);
CREATE INDEX ix_expenses_scope_lookup ON expenses (clinic_id, status, expense_date, created_at);
CREATE INDEX ix_lab_disbursements_scope_lookup ON lab_disbursements (clinic_id, status, created_at, id);
CREATE INDEX ix_inventory_items_scope_lookup ON inventory_items (organization_id, created_at, id);
CREATE INDEX ix_stock_documents_scope_lookup ON stock_documents (clinic_id, status, document_date, created_at);
CREATE INDEX ix_stock_document_lines_scope_lookup ON stock_document_lines (created_at, id);
CREATE INDEX ix_stock_movements_scope_lookup ON stock_movements (clinic_id, created_at, id);
CREATE INDEX ix_stock_balances_scope_lookup ON stock_balances (clinic_id, created_at);
CREATE INDEX ix_communication_preferences_scope_lookup ON communication_preferences (patient_id, status, created_at, id);
CREATE INDEX ix_message_templates_scope_lookup ON message_templates (organization_id, created_at, id);
CREATE INDEX ix_message_batches_scope_lookup ON message_batches (clinic_id, status, created_at, id);
CREATE INDEX ix_outbound_messages_scope_lookup ON outbound_messages (patient_id, status, created_at, id);
CREATE INDEX ix_message_status_events_scope_lookup ON message_status_events (created_at, id);
CREATE INDEX ix_inbound_messages_scope_lookup ON inbound_messages (patient_id, created_at, id);
CREATE INDEX ix_education_videos_scope_lookup ON education_videos (organization_id, created_at, id);
CREATE INDEX ix_audit_events_scope_lookup ON audit_events (organization_id, clinic_id, created_at, id);
CREATE INDEX ix_outbox_events_scope_lookup ON outbox_events (organization_id, created_at, id);
CREATE INDEX ix_job_runs_scope_lookup ON job_runs (status, created_at, id);
CREATE INDEX ix_idempotency_keys_scope_lookup ON idempotency_keys (organization_id, created_at, id);
CREATE INDEX ix_report_exports_scope_lookup ON report_exports (organization_id, clinic_id, created_at, id);
CREATE UNIQUE INDEX uq_users_org_login_ci ON users (organization_id, lower(login_name::text));
CREATE UNIQUE INDEX uq_users_org_email_ci ON users (organization_id, lower(primary_email::text)) WHERE primary_email IS NOT NULL;
CREATE UNIQUE INDEX uq_staff_user_links_active_staff ON staff_user_links (staff_id) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX uq_staff_user_links_active_user ON staff_user_links (user_id) WHERE unlinked_at IS NULL;
CREATE INDEX ix_care_bookings_clinic_start_clinician ON care_bookings (clinic_id, starts_at, lead_clinician_id, status);
CREATE INDEX ix_care_bookings_clinic_start_chair ON care_bookings (clinic_id, starts_at, chair_id, status);
CREATE INDEX ix_care_bookings_ortho_tracking_start ON care_bookings (orthodontic_program_enrollment_id, starts_at, status, id) WHERE orthodontic_program_enrollment_id IS NOT NULL;
CREATE INDEX ix_care_bookings_terminal_month_clinician ON care_bookings (clinic_id, starts_at, lead_clinician_id, status, id) INCLUDE (cancelled_at, cancelled_by, no_show_marked_at, no_show_marked_by) WHERE status IN ('cancelled','no_show');
CREATE INDEX ix_care_booking_state_events_latest ON care_booking_state_events (care_booking_id, sequence_no DESC) INCLUDE (from_status, to_status, changed_at, changed_by, reason);
CREATE INDEX ix_care_booking_state_events_terminal_changed ON care_booking_state_events (to_status, changed_at, care_booking_id, changed_by) INCLUDE (from_status, reason) WHERE to_status IN ('cancelled','no_show');
CREATE INDEX ix_care_booking_requests_queue ON care_booking_requests (clinic_id, status, requested_date, created_at);
CREATE UNIQUE INDEX uq_patient_flag_assignments_active_ortho_program ON patient_flag_assignments (patient_id, clinic_id, tracking_program) WHERE tracking_program = 'orthodontic_monthly' AND program_status IN ('active','paused') AND active = true;
CREATE INDEX ix_patient_flag_assignments_ortho_due ON patient_flag_assignments (clinic_id, program_status, next_adjustment_due_date, treating_clinician_id, patient_id) WHERE tracking_program = 'orthodontic_monthly' AND active = true;
CREATE INDEX ix_visits_clinical_queue ON care_encounters (clinic_id, encounter_date, status, queue_sequence);
CREATE INDEX ix_care_encounters_patient_clinic_date ON care_encounters (patient_id, clinic_id, encounter_date, status, id) INCLUDE (checked_in_at, lead_clinician_id);
CREATE INDEX ix_care_deliveries_ortho_tracking_visit ON care_deliveries (orthodontic_program_enrollment_id, care_encounter_id, status, completed_at) WHERE orthodontic_program_enrollment_id IS NOT NULL;
CREATE INDEX ix_patients_intent_tier_pipeline ON patients (home_clinic_id, intent_tier, active, id);
CREATE INDEX ix_patient_intent_tier_events_patient_changed ON patient_intent_tier_events (patient_id, changed_at DESC, id);
CREATE INDEX ix_clinical_cases_pipeline ON clinical_cases (clinic_id, execution_state, intent_tier_snapshot, created_at, id);
CREATE INDEX ix_clinical_cases_patient_state ON clinical_cases (patient_id, execution_state, state_changed_at DESC, id);
CREATE INDEX ix_case_consultations_month_primary ON case_consultations (consulted_at, primary_consult_clinician_id, status, clinical_case_id) WHERE consultation_kind = 'initial' AND status = 'finalized';
CREATE INDEX ix_case_consultations_month_secondary ON case_consultations (consulted_at, secondary_review_clinician_id, status, clinical_case_id) WHERE consultation_kind = 'initial' AND status = 'finalized';
CREATE UNIQUE INDEX uq_case_consultations_active_initial_case ON case_consultations (clinical_case_id) WHERE consultation_kind = 'initial' AND status <> 'void';
CREATE INDEX ix_treatment_bundles_pending_month ON treatment_bundles (target_start_date, bundle_tier, status, clinical_case_id) WHERE bundle_tier IN ('primary','secondary') AND status IN ('advised','accepted','scheduled','in_progress');
CREATE INDEX ix_treatment_bundle_services_domain_case ON treatment_bundle_services (service_domain_id_snapshot, treatment_bundle_id, line_state, care_plan_service_id);
CREATE INDEX ix_clinical_case_state_events_case_sequence ON clinical_case_state_events (clinical_case_id, sequence_no DESC, changed_at DESC);
CREATE INDEX ix_service_domains_high_value ON service_domains (organization_id, high_value, active, id) WHERE high_value = true AND active = true;
CREATE INDEX ix_fee_statement_lines_plan_service ON fee_statement_lines (care_plan_service_id, fee_statement_id, id) WHERE care_plan_service_id IS NOT NULL;
CREATE INDEX ix_continuity_tasks_due_dispatch ON continuity_tasks (clinic_id, status, due_at, id) WHERE status IN ('scheduled','due','snoozed');
CREATE INDEX ix_continuity_tasks_source_service ON continuity_tasks (care_delivery_id, status, id) WHERE care_delivery_id IS NOT NULL;
CREATE UNIQUE INDEX uq_diagnosis_catalog_org_name_ci ON diagnosis_catalog (organization_id, lower(name));
CREATE INDEX ix_diagnosis_catalog_typeahead_trgm ON diagnosis_catalog USING gin ((lower(code || ' ' || name || ' ' || array_to_string(keywords, ' '))) gin_trgm_ops) WHERE active = true;
CREATE UNIQUE INDEX uq_service_domains_org_name_ci ON service_domains (organization_id, lower(name));
CREATE INDEX ix_service_catalog_typeahead_trgm ON service_catalog USING gin ((lower(code || ' ' || description)) gin_trgm_ops) WHERE active = true;
CREATE UNIQUE INDEX uq_medication_domains_org_name_ci ON medication_domains (organization_id, lower(name));
CREATE UNIQUE INDEX uq_active_ingredient_catalog_org_name_ci ON active_ingredient_catalog (organization_id, lower(name));
CREATE INDEX ix_medication_catalog_typeahead_trgm ON medication_catalog USING gin ((lower(brand_name || ' ' || COALESCE(strength, '') || ' ' || dosage_form || ' ' || array_to_string(keywords, ' '))) gin_trgm_ops) WHERE active = true;
CREATE INDEX ix_medication_ingredient_links_generic_medication ON medication_ingredient_links (active_ingredient_id, medication_id, sequence_no) WHERE active = true;
CREATE INDEX ix_allergy_ingredient_rules_generic_allergy ON allergy_ingredient_rules (active_ingredient_id, allergy_id, interaction_level) WHERE active = true;
CREATE UNIQUE INDEX uq_medication_domain_links_primary ON medication_domain_links (medication_id) WHERE is_primary = true AND active = true;
CREATE UNIQUE INDEX uq_medication_administration_defaults_context ON medication_administration_defaults (medication_id, administration_pattern_id, minimum_age_months, maximum_age_months, minimum_weight_kg, maximum_weight_kg) NULLS NOT DISTINCT;
CREATE INDEX ix_medication_protocols_typeahead_trgm ON medication_protocols USING gin ((lower(code || ' ' || name || ' ' || COALESCE(comments, ''))) gin_trgm_ops) WHERE status = 'active' AND active = true;
CREATE INDEX ix_medication_protocol_diagnosis_links_recommend ON medication_protocol_diagnosis_links (diagnosis_id, autoload, match_weight DESC, medication_protocol_id);
CREATE INDEX ix_medication_protocol_service_links_recommend ON medication_protocol_service_links (service_id, autoload, match_weight DESC, medication_protocol_id);
CREATE INDEX ix_medication_orders_encounter_date ON medication_orders (care_encounter_id, medication_order_date DESC, created_at DESC, id);
CREATE INDEX ix_medication_order_lines_medication_order_sequence ON medication_order_lines (medication_order_id, sequence_no, id);
CREATE INDEX ix_fee_statement_pending_age ON fee_statements (clinic_id, statement_date, due_date, patient_id) WHERE status IN ('issued','part_paid','paid');
CREATE INDEX ix_fee_statement_lines_clinician_fee_statement ON fee_statement_lines (lead_clinician_id, fee_statement_id, id);
CREATE INDEX ix_collection_receipts_collection ON collection_receipts (clinic_id, collection_date, collection_operator_id, patient_id) WHERE status IN ('active','part_refunded','refunded');
CREATE INDEX ix_collection_tenders_mode_receipt ON collection_tenders (collection_method_id, collection_receipt_id, id);
CREATE INDEX ix_fee_allocations_date_fee_statement ON fee_allocations (clinic_id, allocation_date, fee_statement_id, status);
CREATE INDEX ix_clinician_value_allocations_line_tender ON clinician_value_allocations (fee_statement_line_id, collection_tender_id, fee_allocation_id);
CREATE INDEX ix_collection_refunds_date_receipt ON collection_refunds (clinic_id, refund_date, collection_receipt_id, status);
CREATE INDEX ix_stock_movements_item_date ON stock_movements (clinic_id, item_id, movement_at, source_line_id);
CREATE INDEX ix_outbound_messages_queue ON outbound_messages (clinic_id, status, scheduled_at, id);
CREATE INDEX ix_outbound_messages_continuity_schedule ON outbound_messages (continuity_task_id, channel, scheduled_at, status, id) WHERE continuity_task_id IS NOT NULL;
CREATE INDEX ix_outbox_claim ON outbox_events (processed_at, available_at, created_at) WHERE processed_at IS NULL;
```

## Care Booking Conflict Constraints

```sql
ALTER TABLE care_bookings ADD CONSTRAINT ex_care_bookings_active_chair_time EXCLUDE USING gist (clinic_id WITH =, chair_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (chair_id IS NOT NULL AND status IN ('scheduled','confirmed','arrived')); 
ALTER TABLE care_bookings ADD CONSTRAINT ex_care_bookings_active_clinician_time EXCLUDE USING gist (clinic_id WITH =, lead_clinician_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (lead_clinician_id IS NOT NULL AND status IN ('scheduled','confirmed','arrived')); 
```

## Care Booking Terminal-State Integrity

Every care booking state change and its history row commit in one database transaction. The command updates `care_bookings` first and inserts `care_booking_state_events` second, using one captured `clock_timestamp()` value for both the denormalized terminal timestamp and `care_booking_state_events.changed_at`.

```sql
CREATE OR REPLACE FUNCTION dentos_runtime.validate_care_booking_state_events_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  prior_status character varying;
  prior_sequence_no bigint;
  care_booking_row care_bookings%ROWTYPE;
BEGIN
  SELECT h.to_status, h.sequence_no
    INTO prior_status, prior_sequence_no
  FROM care_booking_state_events h
  WHERE h.care_booking_id = NEW.care_booking_id
  ORDER BY h.sequence_no DESC
  LIMIT 1;

  IF FOUND THEN
    IF NEW.from_status IS DISTINCT FROM prior_status THEN
      RAISE EXCEPTION 'care booking history from_status does not match the preceding status'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.sequence_no <> prior_sequence_no + 1 THEN
      RAISE EXCEPTION 'care booking history sequence is not contiguous'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT FOUND THEN
    IF NEW.from_status IS NOT NULL OR NEW.sequence_no <> 1 THEN
      RAISE EXCEPTION 'the first care booking history row must have null from_status and sequence 1'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT (
    (NEW.from_status IS NULL AND NEW.to_status = 'scheduled')
    OR (NEW.from_status = 'scheduled' AND NEW.to_status IN ('confirmed','arrived','cancelled','no_show'))
    OR (NEW.from_status = 'confirmed' AND NEW.to_status IN ('scheduled','arrived','cancelled','no_show'))
    OR (NEW.from_status = 'arrived' AND NEW.to_status = 'completed')
    OR (NEW.from_status IN ('cancelled','no_show') AND NEW.to_status = 'scheduled')
  ) THEN
    RAISE EXCEPTION 'care booking state transition is not allowed'
      USING ERRCODE = '23514';
  END IF;

  SELECT a.*
    INTO STRICT care_booking_row
  FROM care_bookings a
  WHERE a.id = NEW.care_booking_id
  FOR UPDATE;

  IF NEW.to_status IS DISTINCT FROM care_booking_row.status THEN
    RAISE EXCEPTION 'care booking history to_status does not match care_bookings.status'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.to_status = 'cancelled'
     AND (NEW.changed_by IS DISTINCT FROM care_booking_row.cancelled_by
          OR NEW.changed_at IS DISTINCT FROM care_booking_row.cancelled_at
          OR NEW.reason IS DISTINCT FROM care_booking_row.cancellation_reason) THEN
    RAISE EXCEPTION 'cancelled history metadata does not match care booking terminal metadata'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.to_status = 'no_show'
     AND (NEW.changed_by IS DISTINCT FROM care_booking_row.no_show_marked_by
          OR NEW.changed_at IS DISTINCT FROM care_booking_row.no_show_marked_at
          OR NEW.reason IS DISTINCT FROM care_booking_row.no_show_reason) THEN
    RAISE EXCEPTION 'no-show history metadata does not match care booking terminal metadata'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_care_booking_state_events_validate
BEFORE INSERT ON care_booking_state_events
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_care_booking_state_events_insert();

CREATE OR REPLACE FUNCTION dentos_runtime.reject_care_booking_state_events_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'care booking state history is append-only'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER trg_care_booking_state_events_immutable
BEFORE UPDATE OR DELETE ON care_booking_state_events
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.reject_care_booking_state_events_mutation();

CREATE OR REPLACE FUNCTION dentos_runtime.assert_care_booking_latest_status_history()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  latest_to_status character varying;
  latest_changed_at timestamptz;
  latest_changed_by uuid;
BEGIN
  SELECT h.to_status, h.changed_at, h.changed_by
    INTO latest_to_status, latest_changed_at, latest_changed_by
  FROM care_booking_state_events h
  WHERE h.care_booking_id = NEW.id
  ORDER BY h.sequence_no DESC
  LIMIT 1;

  IF latest_to_status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'care_bookings.status has no matching latest history row'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'cancelled'
     AND (latest_changed_at IS DISTINCT FROM NEW.cancelled_at
          OR latest_changed_by IS DISTINCT FROM NEW.cancelled_by) THEN
    RAISE EXCEPTION 'cancelled care booking actor or timestamp differs from latest history'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'no_show'
     AND (latest_changed_at IS DISTINCT FROM NEW.no_show_marked_at
          OR latest_changed_by IS DISTINCT FROM NEW.no_show_marked_by) THEN
    RAISE EXCEPTION 'no-show care booking actor or timestamp differs from latest history'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER trg_care_bookings_status_history_sync
AFTER INSERT OR UPDATE OF status, cancelled_at, cancelled_by, no_show_marked_at, no_show_marked_by ON care_bookings
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.assert_care_booking_latest_status_history();
```

The first history row has `sequence_no = 1`, `from_status = NULL`, `to_status = 'scheduled'`, and reason `CARE_BOOKING_CREATED`. Each later row increments `sequence_no` by exactly one while the care booking row lock serializes transitions. A cancellation history row has the exact same actor, timestamp, and reason as `care_bookings.cancelled_by`, `care_bookings.cancelled_at`, and `care_bookings.cancellation_reason`. A no-show row has the exact same actor, timestamp, and reason as `care_bookings.no_show_marked_by`, `care_bookings.no_show_marked_at`, and `care_bookings.no_show_reason`.

## Orthodontic Tracking and Service Follow-Up Integrity

Every organization provisions one active `patient_flags` row with code `ORTHODONTIC_ACTIVE`. An orthodontic tracking enrollment is a `patient_flag_assignments` row whose `tracking_program = 'orthodontic_monthly'` and whose flag code is exactly `ORTHODONTIC_ACTIVE`; display-name changes cannot alter report membership.

```sql
CREATE OR REPLACE FUNCTION dentos_runtime.validate_orthodontic_program_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  flag_code character varying;
  flag_organization_id uuid;
  patient_organization_id uuid;
  clinic_organization_id uuid;
  clinician_organization_id uuid;
  service_organization_id uuid;
  plan_patient_id uuid;
  plan_item_patient_id uuid;
  last_encounter_patient_id uuid;
  last_encounter_clinic_id uuid;
BEGIN
  IF NEW.tracking_program <> 'orthodontic_monthly' THEN
    RETURN NEW;
  END IF;

  SELECT pf.code, pf.organization_id
    INTO STRICT flag_code, flag_organization_id
  FROM patient_flags pf
  WHERE pf.id = NEW.flag_id AND pf.active = true;

  SELECT p.organization_id
    INTO STRICT patient_organization_id
  FROM patients p
  WHERE p.id = NEW.patient_id;

  SELECT c.organization_id
    INTO STRICT clinic_organization_id
  FROM clinics c
  WHERE c.id = NEW.clinic_id AND c.active = true;

  SELECT s.organization_id
    INTO STRICT clinician_organization_id
  FROM staff s
  JOIN staff_clinics sc ON sc.staff_id = s.id AND sc.clinic_id = NEW.clinic_id
  WHERE s.id = NEW.treating_clinician_id
    AND s.staff_type = 'clinician'
    AND s.active = true
    AND sc.active = true;

  SELECT pr.organization_id
    INTO STRICT service_organization_id
  FROM service_catalog pr
  WHERE pr.id = NEW.default_adjustment_service_id
    AND pr.active = true;

  IF flag_code <> 'ORTHODONTIC_ACTIVE'
     OR flag_organization_id <> patient_organization_id
     OR clinic_organization_id <> patient_organization_id
     OR clinician_organization_id <> patient_organization_id
     OR service_organization_id <> patient_organization_id THEN
    RAISE EXCEPTION 'orthodontic tracking organization, clinic, clinician, service, patient, or flag mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.source_care_plan_id IS NOT NULL THEN
    SELECT tp.patient_id INTO STRICT plan_patient_id
    FROM care_plans tp WHERE tp.id = NEW.source_care_plan_id;
    IF plan_patient_id <> NEW.patient_id THEN
      RAISE EXCEPTION 'orthodontic source plan belongs to another patient' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.source_care_plan_service_id IS NOT NULL THEN
    SELECT tp.patient_id INTO STRICT plan_item_patient_id
    FROM care_plan_services tpi
    JOIN care_plan_stages tpp ON tpp.id = tpi.care_plan_stage_id
    JOIN care_plans tp ON tp.id = tpp.care_plan_id
    WHERE tpi.id = NEW.source_care_plan_service_id;
    IF plan_item_patient_id <> NEW.patient_id THEN
      RAISE EXCEPTION 'orthodontic source plan item belongs to another patient' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.last_adjustment_care_encounter_id IS NOT NULL THEN
    SELECT v.patient_id, v.clinic_id
      INTO STRICT last_encounter_patient_id, last_encounter_clinic_id
    FROM care_encounters v
    WHERE v.id = NEW.last_adjustment_care_encounter_id;
    IF last_encounter_patient_id <> NEW.patient_id OR last_encounter_clinic_id <> NEW.clinic_id THEN
      RAISE EXCEPTION 'last orthodontic adjustment encounter belongs to another patient or clinic' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_patient_flag_assignments_ortho_validate
BEFORE INSERT OR UPDATE ON patient_flag_assignments
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_orthodontic_program_assignment();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_orthodontic_care_booking_link()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  assignment_patient_id uuid;
  assignment_clinic_id uuid;
  assignment_program character varying;
BEGIN
  IF NEW.orthodontic_program_enrollment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pfa.patient_id, pfa.clinic_id, pfa.tracking_program
    INTO STRICT assignment_patient_id, assignment_clinic_id, assignment_program
  FROM patient_flag_assignments pfa
  WHERE pfa.id = NEW.orthodontic_program_enrollment_id
    AND pfa.active = true
    AND pfa.program_status IN ('active','paused');

  IF assignment_program <> 'orthodontic_monthly'
     OR NEW.patient_id IS NULL
     OR assignment_patient_id <> NEW.patient_id
     OR assignment_clinic_id <> NEW.clinic_id THEN
    RAISE EXCEPTION 'orthodontic care booking link does not match patient and clinic' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_care_bookings_ortho_link_validate
BEFORE INSERT OR UPDATE OF orthodontic_program_enrollment_id, patient_id, clinic_id ON care_bookings
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_orthodontic_care_booking_link();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_care_delivery_tracking_and_continuity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  encounter_clinic_id uuid;
  clinic_timezone character varying;
  assignment_patient_id uuid;
  assignment_clinic_id uuid;
BEGIN
  SELECT v.clinic_id, c.timezone
    INTO STRICT encounter_clinic_id, clinic_timezone
  FROM care_encounters v
  JOIN clinics c ON c.id = v.clinic_id
  WHERE v.id = NEW.care_encounter_id AND v.patient_id = NEW.patient_id;

  IF NEW.orthodontic_program_enrollment_id IS NOT NULL THEN
    SELECT pfa.patient_id, pfa.clinic_id
      INTO STRICT assignment_patient_id, assignment_clinic_id
    FROM patient_flag_assignments pfa
    WHERE pfa.id = NEW.orthodontic_program_enrollment_id
      AND pfa.tracking_program = 'orthodontic_monthly'
      AND pfa.active = true;

    IF assignment_patient_id <> NEW.patient_id OR assignment_clinic_id <> encounter_clinic_id THEN
      RAISE EXCEPTION 'orthodontic clinical service link does not match encounter patient and clinic' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status = 'completed' AND NEW.completion_continuity_mode = 'custom_date' THEN
    IF NEW.completion_continuity_date <= (NEW.completed_at AT TIME ZONE clinic_timezone)::date
       OR NEW.completion_continuity_date > (NEW.completed_at AT TIME ZONE clinic_timezone)::date + 3650 THEN
      RAISE EXCEPTION 'custom continuity date must be after the completion date and no more than ten years later' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_care_deliveries_tracking_continuity_validate
BEFORE INSERT OR UPDATE ON care_deliveries
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_care_delivery_tracking_and_continuity();

CREATE OR REPLACE FUNCTION dentos_runtime.assert_completed_service_continuity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  task_due_date date;
BEGIN
  IF NEW.status <> 'completed' OR NEW.completion_continuity_mode = 'none' THEN
    RETURN NULL;
  END IF;

  SELECT ft.due_date
    INTO task_due_date
  FROM continuity_tasks ft
  WHERE ft.care_delivery_id = NEW.id
    AND ft.source_type = 'care_delivery'
    AND ft.source_id = NEW.id
    AND ft.status <> 'cancelled'
  ORDER BY ft.created_at, ft.id
  LIMIT 1;

  IF task_due_date IS NULL THEN
    RAISE EXCEPTION 'completed clinical service requires its continuity task in the same transaction' USING ERRCODE = '23514';
  END IF;

  IF NEW.completion_continuity_mode = 'custom_date'
     AND task_due_date <> NEW.completion_continuity_date THEN
    RAISE EXCEPTION 'custom service continuity date differs from continuity task due date' USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER trg_care_deliveries_continuity_sync
AFTER INSERT OR UPDATE OF status, completion_continuity_mode, completion_continuity_date ON care_deliveries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.assert_completed_service_continuity();
```

Tenant bootstrap creates the stable orthodontic flag explicitly:

```sql
INSERT INTO patient_flags (
  id, organization_id, code, name, color_hex, active, created_at
)
SELECT
  gen_random_uuid(), o.id, 'ORTHODONTIC_ACTIVE', 'Orthodontic Patient', '#2563EB', true, clock_timestamp()
FROM organizations o
ON CONFLICT (organization_id, code)
DO UPDATE SET
  name = EXCLUDED.name,
  active = true,
  updated_at = clock_timestamp();
```

The continuity row validates its clinic-local due instant, source ownership, rule scope, and channel templates before commit:

```sql
CREATE OR REPLACE FUNCTION dentos_runtime.validate_continuity_task_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  clinic_organization_id uuid;
  clinic_timezone character varying;
  patient_organization_id uuid;
  expected_due_at timestamptz;
  source_patient_id uuid;
  source_clinic_id uuid;
  template_organization_id uuid;
  template_channel character varying;
  template_purpose character varying;
  template_status character varying;
  policy_organization_id uuid;
  policy_clinic_id uuid;
  offset_count integer;
  distinct_offset_count integer;
BEGIN
  SELECT c.organization_id, c.timezone
    INTO STRICT clinic_organization_id, clinic_timezone
  FROM clinics c
  WHERE c.id = NEW.clinic_id AND c.active = true;

  SELECT p.organization_id
    INTO STRICT patient_organization_id
  FROM patients p
  WHERE p.id = NEW.patient_id AND p.active = true;

  IF clinic_organization_id <> NEW.organization_id OR patient_organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'continuity organization, clinic, and patient mismatch' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM patient_clinics pc
  WHERE pc.patient_id = NEW.patient_id AND pc.clinic_id = NEW.clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'continuity patient is not linked to the clinic' USING ERRCODE = '23514';
  END IF;

  expected_due_at := (NEW.due_date + NEW.due_local_time) AT TIME ZONE clinic_timezone;
  IF NEW.due_at IS DISTINCT FROM expected_due_at THEN
    RAISE EXCEPTION 'continuity due_at does not match clinic-local due date and time' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT offset_value)
    INTO offset_count, distinct_offset_count
  FROM UNNEST(NEW.reminder_offsets_minutes) AS offset_value;
  IF offset_count <> distinct_offset_count THEN
    RAISE EXCEPTION 'continuity reminder offsets contain duplicates' USING ERRCODE = '23514';
  END IF;

  IF NEW.continuity_policy_id IS NOT NULL THEN
    SELECT cp.organization_id, cp.clinic_id
      INTO STRICT policy_organization_id, policy_clinic_id
    FROM continuity_policies cp
    WHERE cp.id = NEW.continuity_policy_id AND cp.active = true;
    IF policy_organization_id <> NEW.organization_id
       OR (policy_clinic_id IS NOT NULL AND policy_clinic_id <> NEW.clinic_id) THEN
      RAISE EXCEPTION 'continuity policy belongs to another organization or clinic' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.source_type = 'care_delivery' THEN
    SELECT cp.patient_id, v.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM care_deliveries cp
    JOIN care_encounters v ON v.id = cp.care_encounter_id
    WHERE cp.id = NEW.care_delivery_id;
  ELSIF NEW.source_type = 'care_plan_service' THEN
    SELECT tp.patient_id, NEW.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM care_plan_services tpi
    JOIN care_plan_stages tpp ON tpp.id = tpi.care_plan_stage_id
    JOIN care_plans tp ON tp.id = tpp.care_plan_id
    WHERE tpi.id = NEW.care_plan_service_id;
  ELSIF NEW.source_type = 'care_encounter' THEN
    SELECT v.patient_id, v.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM care_encounters v
    WHERE v.id = NEW.care_encounter_id;
  ELSIF NEW.source_type = 'care_booking' THEN
    SELECT a.patient_id, a.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM care_bookings a
    WHERE a.id = NEW.care_booking_id;
  ELSIF NEW.source_type = 'medication_order' THEN
    SELECT pr.patient_id, pr.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM medication_orders pr
    WHERE pr.id = NEW.medication_order_id;
  ELSIF NEW.source_type = 'orthodontic_program' THEN
    SELECT pfa.patient_id, pfa.clinic_id
      INTO STRICT source_patient_id, source_clinic_id
    FROM patient_flag_assignments pfa
    WHERE pfa.id = NEW.orthodontic_program_enrollment_id
      AND pfa.tracking_program = 'orthodontic_monthly';
  ELSE
    source_patient_id := NEW.patient_id;
    source_clinic_id := NEW.clinic_id;
  END IF;

  IF source_patient_id IS DISTINCT FROM NEW.patient_id OR source_clinic_id IS DISTINCT FROM NEW.clinic_id THEN
    RAISE EXCEPTION 'continuity source belongs to another patient or clinic' USING ERRCODE = '23514';
  END IF;

  IF NEW.send_sms THEN
    SELECT mt.organization_id, mt.channel, mt.purpose, mt.approval_status
      INTO STRICT template_organization_id, template_channel, template_purpose, template_status
    FROM message_templates mt WHERE mt.id = NEW.sms_template_id AND mt.active = true;
    IF template_organization_id <> NEW.organization_id OR template_channel <> 'sms' OR template_purpose <> NEW.message_purpose OR template_status <> 'approved' THEN
      RAISE EXCEPTION 'continuity SMS template is not an approved matching template' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.send_whatsapp THEN
    SELECT mt.organization_id, mt.channel, mt.purpose, mt.approval_status
      INTO STRICT template_organization_id, template_channel, template_purpose, template_status
    FROM message_templates mt WHERE mt.id = NEW.whatsapp_template_id AND mt.active = true;
    IF template_organization_id <> NEW.organization_id OR template_channel <> 'whatsapp' OR template_purpose <> NEW.message_purpose OR template_status <> 'approved' THEN
      RAISE EXCEPTION 'continuity WhatsApp template is not an approved matching template' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_continuity_tasks_contract_validate
BEFORE INSERT OR UPDATE ON continuity_tasks
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_continuity_task_contract();
```

## Medication Order Master and Clinical-Record Integrity

The Medication Studio contract separates Medication Domains, Active Ingredients, Catalog Medications, Administration Patterns, and Medication Protocols. The normalized model below preserves that separation, supports multiple domains, ingredients, strengths, and administration contexts per medication, and makes diagnosis/service recommendation links queryable without interpreting JSON.

```sql
CREATE OR REPLACE FUNCTION dentos_runtime.validate_medication_catalog_mapping()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  parent_organization_id uuid;
  related_organization_id uuid;
  second_related_organization_id uuid;
  template_status character varying;
BEGIN
  IF TG_TABLE_NAME = 'service_catalog' THEN
    SELECT pc.organization_id INTO STRICT related_organization_id FROM service_domains pc WHERE pc.id = NEW.service_domain_id;
    IF NEW.organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'service domain crosses organizations' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_catalog' THEN
    SELECT dc.organization_id INTO STRICT related_organization_id FROM medication_domains dc WHERE dc.id = NEW.primary_domain_id;
    SELECT dg.organization_id INTO STRICT second_related_organization_id FROM active_ingredient_catalog dg WHERE dg.id = NEW.active_ingredient_id;
    IF NEW.organization_id <> related_organization_id OR NEW.organization_id <> second_related_organization_id THEN
      RAISE EXCEPTION 'medication primary domain or active ingredient crosses organizations' USING ERRCODE = '23514';
    END IF;
    IF NEW.default_administration_pattern_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM administration_patterns dt WHERE dt.id = NEW.default_administration_pattern_id AND dt.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'medication administration default crosses organizations' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_domain_links' THEN
    SELECT d.organization_id INTO STRICT parent_organization_id FROM medication_catalog d WHERE d.id = NEW.medication_id;
    SELECT dc.organization_id INTO STRICT related_organization_id FROM medication_domains dc WHERE dc.id = NEW.domain_id;
    IF parent_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'medication domain link crosses organizations' USING ERRCODE = '23514';
    END IF;
    IF NEW.is_primary AND NOT EXISTS (
      SELECT 1 FROM medication_catalog d WHERE d.id = NEW.medication_id AND d.primary_domain_id = NEW.domain_id
    ) THEN
      RAISE EXCEPTION 'primary domain link must equal medication_catalog.primary_domain_id' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_ingredient_links' THEN
    SELECT d.organization_id INTO STRICT parent_organization_id FROM medication_catalog d WHERE d.id = NEW.medication_id;
    SELECT dg.organization_id INTO STRICT related_organization_id FROM active_ingredient_catalog dg WHERE dg.id = NEW.active_ingredient_id;
    IF parent_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'medication ingredient crosses organizations' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'allergy_ingredient_rules' THEN
    SELECT ac.organization_id INTO STRICT parent_organization_id FROM allergy_catalog ac WHERE ac.id = NEW.allergy_id;
    SELECT dg.organization_id INTO STRICT related_organization_id FROM active_ingredient_catalog dg WHERE dg.id = NEW.active_ingredient_id;
    IF parent_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'allergy and active-ingredient rule crosses organizations' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_administration_defaults' THEN
    SELECT d.organization_id INTO STRICT parent_organization_id FROM medication_catalog d WHERE d.id = NEW.medication_id;
    SELECT dt.organization_id INTO STRICT related_organization_id FROM administration_patterns dt WHERE dt.id = NEW.administration_pattern_id;
    IF parent_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'medication administration default crosses organizations' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_protocol_lines' THEN
    SELECT pt.organization_id, pt.status INTO STRICT parent_organization_id, template_status
    FROM medication_protocols pt WHERE pt.id = NEW.medication_protocol_id;
    SELECT d.organization_id INTO STRICT related_organization_id FROM medication_catalog d WHERE d.id = NEW.medication_id;
    SELECT dt.organization_id INTO STRICT second_related_organization_id FROM administration_patterns dt WHERE dt.id = NEW.administration_pattern_id;
    IF template_status <> 'draft' THEN
      RAISE EXCEPTION 'only a draft medication protocol version can change items' USING ERRCODE = '23514';
    END IF;
    IF parent_organization_id <> related_organization_id OR parent_organization_id <> second_related_organization_id THEN
      RAISE EXCEPTION 'protocol line crosses organizations' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_protocol_diagnosis_links' THEN
    SELECT pt.organization_id, pt.status INTO STRICT parent_organization_id, template_status
    FROM medication_protocols pt WHERE pt.id = NEW.medication_protocol_id;
    SELECT pd.organization_id INTO STRICT related_organization_id FROM diagnosis_catalog pd WHERE pd.id = NEW.diagnosis_id;
    IF template_status <> 'draft' THEN
      RAISE EXCEPTION 'only a draft medication protocol version can change diagnosis mappings' USING ERRCODE = '23514';
    END IF;
    IF parent_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'protocol diagnosis link crosses organizations' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_protocol_service_links' THEN
    SELECT pt.organization_id, pt.status INTO STRICT parent_organization_id, template_status
    FROM medication_protocols pt WHERE pt.id = NEW.medication_protocol_id;
    SELECT pc.organization_id INTO STRICT related_organization_id FROM service_catalog pc WHERE pc.id = NEW.service_id;
    IF template_status <> 'draft' THEN
      RAISE EXCEPTION 'only a draft medication protocol version can change service mappings' USING ERRCODE = '23514';
    END IF;
    IF parent_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'protocol service link crosses organizations' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_service_catalog_medication_catalog_validate
BEFORE INSERT OR UPDATE OF organization_id, service_domain_id ON service_catalog
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_medication_catalog_medication_catalog_validate
BEFORE INSERT OR UPDATE OF organization_id, primary_domain_id, active_ingredient_id, default_administration_pattern_id ON medication_catalog
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_medication_domain_links_validate
BEFORE INSERT OR UPDATE ON medication_domain_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_medication_ingredient_links_validate
BEFORE INSERT OR UPDATE ON medication_ingredient_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_allergy_ingredient_rules_validate
BEFORE INSERT OR UPDATE ON allergy_ingredient_rules
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_medication_administration_defaults_validate
BEFORE INSERT OR UPDATE ON medication_administration_defaults
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_medication_protocol_lines_validate
BEFORE INSERT OR UPDATE ON medication_protocol_lines
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_medication_protocol_diagnosis_links_validate
BEFORE INSERT OR UPDATE ON medication_protocol_diagnosis_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE TRIGGER trg_medication_protocol_service_links_validate
BEFORE INSERT OR UPDATE ON medication_protocol_service_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_catalog_mapping();

CREATE OR REPLACE FUNCTION dentos_runtime.assert_medication_catalog_graph()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  target_medication_id uuid;
  primary_domain_id uuid;
  primary_active_ingredient_id uuid;
  matching_primary_domains integer;
  matching_primary_ingredients integer;
BEGIN
  IF TG_TABLE_NAME = 'medication_catalog' THEN
    target_medication_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    target_medication_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.medication_id ELSE NEW.medication_id END;
  END IF;

  SELECT d.primary_domain_id, d.active_ingredient_id
    INTO primary_domain_id, primary_active_ingredient_id
  FROM medication_catalog d
  WHERE d.id = target_medication_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*)
    INTO matching_primary_domains
  FROM medication_domain_links dca
  WHERE dca.medication_id = target_medication_id
    AND dca.active = true
    AND dca.is_primary = true
    AND dca.domain_id = primary_domain_id;

  IF matching_primary_domains <> 1 THEN
    RAISE EXCEPTION 'medication catalog graph requires exactly one active primary domain matching medication_catalog.primary_domain_id' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
    INTO matching_primary_ingredients
  FROM medication_ingredient_links di
  WHERE di.medication_id = target_medication_id
    AND di.active = true
    AND di.active_ingredient_id = primary_active_ingredient_id;

  IF matching_primary_ingredients <> 1 THEN
    RAISE EXCEPTION 'medication catalog graph requires exactly one active primary ingredient matching medication_catalog.active_ingredient_id' USING ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE CONSTRAINT TRIGGER trg_medication_catalog_master_graph_complete
AFTER INSERT OR UPDATE ON medication_catalog
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.assert_medication_catalog_graph();

CREATE CONSTRAINT TRIGGER trg_medication_domain_links_graph_complete
AFTER INSERT OR UPDATE OR DELETE ON medication_domain_links
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.assert_medication_catalog_graph();

CREATE CONSTRAINT TRIGGER trg_medication_ingredient_links_graph_complete
AFTER INSERT OR UPDATE OR DELETE ON medication_ingredient_links
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.assert_medication_catalog_graph();

CREATE OR REPLACE FUNCTION dentos_runtime.guard_medication_protocol_child_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  template_status character varying;
BEGIN
  SELECT pt.status INTO STRICT template_status
  FROM medication_protocols pt WHERE pt.id = OLD.medication_protocol_id;
  IF template_status <> 'draft' THEN
    RAISE EXCEPTION 'medication protocol mappings can be deleted only from a draft version' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_medication_protocol_lines_delete_guard
BEFORE DELETE ON medication_protocol_lines
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_protocol_child_delete();

CREATE TRIGGER trg_medication_protocol_diagnosis_links_delete_guard
BEFORE DELETE ON medication_protocol_diagnosis_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_protocol_child_delete();

CREATE TRIGGER trg_medication_protocol_service_links_delete_guard
BEFORE DELETE ON medication_protocol_service_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_protocol_child_delete();

CREATE OR REPLACE FUNCTION dentos_runtime.guard_medication_protocol_version()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status = 'active' AND (
    NEW.status <> 'retired'
    OR (to_jsonb(NEW) - ARRAY['status','active','updated_at','updated_by','row_version'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','active','updated_at','updated_by','row_version'])
  ) THEN
    RAISE EXCEPTION 'active medication protocol versions are immutable; create a new version' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION 'retired medication protocol versions are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'draft' AND NEW.status = 'active' AND NOT EXISTS (
    SELECT 1
    FROM medication_protocol_lines pti
    WHERE pti.medication_protocol_id = OLD.id AND pti.active = true
  ) THEN
    RAISE EXCEPTION 'a medication protocol requires at least one active medication line' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_medication_protocols_version_guard
BEFORE UPDATE ON medication_protocols
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_protocol_version();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_encounter_medication_order_context()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  encounter_organization_id uuid;
  encounter_clinic_id uuid;
  encounter_patient_id uuid;
  related_organization_id uuid;
  related_care_encounter_id uuid;
  master_code character varying;
  master_name character varying;
  master_domain character varying;
  protocol_version integer;
BEGIN
  IF TG_TABLE_NAME = 'encounter_diagnoses' THEN
    SELECT pv.organization_id, pv.clinic_id, pv.patient_id
      INTO STRICT encounter_organization_id, encounter_clinic_id, encounter_patient_id
    FROM care_encounters pv WHERE pv.id = NEW.care_encounter_id;
    SELECT pd.organization_id, pd.code, pd.name
      INTO STRICT related_organization_id, master_code, master_name
    FROM diagnosis_catalog pd WHERE pd.id = NEW.diagnosis_id AND pd.active = true;
    IF encounter_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'encounter diagnosis crosses organizations' USING ERRCODE = '23514';
    END IF;
    IF NEW.diagnosis_code_snapshot IS DISTINCT FROM master_code OR NEW.diagnosis_name_snapshot IS DISTINCT FROM master_name THEN
      RAISE EXCEPTION 'encounter diagnosis snapshots do not match selected master' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM staff s JOIN staff_clinics sc ON sc.staff_id = s.id
      WHERE s.id = NEW.diagnosed_by AND s.organization_id = encounter_organization_id
        AND s.staff_type = 'clinician' AND s.active = true AND sc.clinic_id = encounter_clinic_id AND sc.active = true
    ) THEN
      RAISE EXCEPTION 'diagnosing clinician is not an active clinician at the encounter clinic' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'encounter_service_recommendations' THEN
    SELECT pv.organization_id, pv.clinic_id, pv.patient_id
      INTO STRICT encounter_organization_id, encounter_clinic_id, encounter_patient_id
    FROM care_encounters pv WHERE pv.id = NEW.care_encounter_id;
    SELECT pc.organization_id, pc.code, pc.description, pcat.name
      INTO STRICT related_organization_id, master_code, master_name, master_domain
    FROM service_catalog pc
    JOIN service_domains pcat ON pcat.id = pc.service_domain_id
    WHERE pc.id = NEW.service_id AND pc.active = true;
    IF encounter_organization_id <> related_organization_id THEN
      RAISE EXCEPTION 'suggested service crosses organizations' USING ERRCODE = '23514';
    END IF;
    IF NEW.service_code_snapshot IS DISTINCT FROM master_code OR NEW.service_name_snapshot IS DISTINCT FROM master_name OR NEW.service_domain_snapshot IS DISTINCT FROM master_domain THEN
      RAISE EXCEPTION 'suggested service snapshots do not match the selected service and domain' USING ERRCODE = '23514';
    END IF;
    IF NEW.encounter_diagnosis_id IS NOT NULL THEN
      SELECT vd.care_encounter_id INTO STRICT related_care_encounter_id FROM encounter_diagnoses vd WHERE vd.id = NEW.encounter_diagnosis_id;
      IF related_care_encounter_id <> NEW.care_encounter_id THEN
        RAISE EXCEPTION 'suggested service diagnosis belongs to another encounter' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM staff s JOIN staff_clinics sc ON sc.staff_id = s.id
      WHERE s.id = NEW.suggested_by AND s.organization_id = encounter_organization_id
        AND s.staff_type = 'clinician' AND s.active = true AND sc.clinic_id = encounter_clinic_id AND sc.active = true
    ) THEN
      RAISE EXCEPTION 'suggesting clinician is not an active clinician at the encounter clinic' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_orders' THEN
    SELECT pv.organization_id, pv.clinic_id, pv.patient_id
      INTO STRICT encounter_organization_id, encounter_clinic_id, encounter_patient_id
    FROM care_encounters pv WHERE pv.id = NEW.care_encounter_id;
    IF NEW.clinic_id <> encounter_clinic_id OR NEW.patient_id <> encounter_patient_id THEN
      RAISE EXCEPTION 'medication order patient or clinic differs from its clinical encounter' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM staff s JOIN staff_clinics sc ON sc.staff_id = s.id
      WHERE s.id = NEW.clinician_id AND s.organization_id = encounter_organization_id
        AND s.staff_type = 'clinician' AND s.active = true AND sc.clinic_id = encounter_clinic_id AND sc.active = true
    ) THEN
      RAISE EXCEPTION 'prescribing clinician is not an active clinician at the encounter clinic' USING ERRCODE = '23514';
    END IF;
    IF NEW.source_protocol_id IS NOT NULL THEN
      SELECT pt.organization_id, pt.version INTO STRICT related_organization_id, protocol_version
      FROM medication_protocols pt
      WHERE pt.id = NEW.source_protocol_id AND pt.status IN ('active','retired');
      IF related_organization_id <> encounter_organization_id OR protocol_version <> NEW.source_protocol_version THEN
        RAISE EXCEPTION 'medication protocol snapshot does not match the encounter organization or protocol version' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.status = 'signed' AND NOT EXISTS (
      SELECT 1 FROM staff_user_links sul
      WHERE sul.staff_id = NEW.clinician_id AND sul.user_id = NEW.signed_by AND sul.unlinked_at IS NULL
    ) THEN
      RAISE EXCEPTION 'signed_by user is not actively linked to the prescribing clinician' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_encounter_diagnoses_context_validate
BEFORE INSERT OR UPDATE OF care_encounter_id, diagnosis_id, diagnosis_code_snapshot, diagnosis_name_snapshot, diagnosed_by ON encounter_diagnoses
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_encounter_medication_order_context();

CREATE TRIGGER trg_encounter_service_recommendations_context_validate
BEFORE INSERT OR UPDATE OF care_encounter_id, encounter_diagnosis_id, service_id, service_code_snapshot, service_name_snapshot, service_domain_snapshot, suggested_by ON encounter_service_recommendations
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_encounter_medication_order_context();

CREATE TRIGGER trg_medication_orders_context_validate
BEFORE INSERT OR UPDATE OF clinic_id, patient_id, care_encounter_id, clinician_id, source_protocol_id, source_protocol_version, status, signed_by ON medication_orders
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_encounter_medication_order_context();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_medication_order_child_context()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  parent_care_encounter_id uuid;
  parent_protocol_id uuid;
  parent_organization_id uuid;
  parent_status character varying;
  related_organization_id uuid;
  related_care_encounter_id uuid;
  related_parent_id uuid;
  related_medication_id uuid;
  related_administration_pattern_id uuid;
  master_code character varying;
  master_name character varying;
  master_domain character varying;
  master_dosage_form character varying;
BEGIN
  SELECT p.care_encounter_id, p.source_protocol_id, c.organization_id, p.status
    INTO STRICT parent_care_encounter_id, parent_protocol_id, parent_organization_id, parent_status
  FROM medication_orders p
  JOIN clinics c ON c.id = p.clinic_id
  WHERE p.id = NEW.medication_order_id;

  IF parent_status <> 'draft' THEN
    RAISE EXCEPTION 'medication order child rows can change only while the medication order is draft' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'medication_order_diagnoses' THEN
    SELECT pd.organization_id, pd.code, pd.name
      INTO STRICT related_organization_id, master_code, master_name
    FROM diagnosis_catalog pd WHERE pd.id = NEW.diagnosis_id;
    IF related_organization_id <> parent_organization_id OR NEW.diagnosis_code_snapshot IS DISTINCT FROM master_code OR NEW.diagnosis_name_snapshot IS DISTINCT FROM master_name THEN
      RAISE EXCEPTION 'medication order diagnosis does not match the selected diagnosis master' USING ERRCODE = '23514';
    END IF;
    IF NEW.encounter_diagnosis_id IS NOT NULL THEN
      SELECT vd.care_encounter_id, vd.diagnosis_id INTO STRICT related_care_encounter_id, related_parent_id
      FROM encounter_diagnoses vd WHERE vd.id = NEW.encounter_diagnosis_id;
      IF related_care_encounter_id <> parent_care_encounter_id OR related_parent_id <> NEW.diagnosis_id THEN
        RAISE EXCEPTION 'medication order diagnosis source differs from the medication order encounter or diagnosis' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_order_service_links' THEN
    SELECT pc.organization_id, pc.code, pc.description, pcat.name
      INTO STRICT related_organization_id, master_code, master_name, master_domain
    FROM service_catalog pc JOIN service_domains pcat ON pcat.id = pc.service_domain_id
    WHERE pc.id = NEW.service_id;
    IF related_organization_id <> parent_organization_id OR NEW.service_code_snapshot IS DISTINCT FROM master_code OR NEW.service_name_snapshot IS DISTINCT FROM master_name OR NEW.service_domain_snapshot IS DISTINCT FROM master_domain THEN
      RAISE EXCEPTION 'medication order service does not match the selected service and domain masters' USING ERRCODE = '23514';
    END IF;
    IF NEW.encounter_service_recommendation_id IS NOT NULL THEN
      SELECT vts.care_encounter_id, vts.service_id INTO STRICT related_care_encounter_id, related_parent_id
      FROM encounter_service_recommendations vts WHERE vts.id = NEW.encounter_service_recommendation_id;
      IF related_care_encounter_id <> parent_care_encounter_id OR related_parent_id <> NEW.service_id THEN
        RAISE EXCEPTION 'medication order service source differs from the medication order encounter or service' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_order_lines' THEN
    IF NEW.medication_id IS NOT NULL THEN
      SELECT d.organization_id, d.brand_name, d.dosage_form
        INTO STRICT related_organization_id, master_name, master_dosage_form
      FROM medication_catalog d WHERE d.id = NEW.medication_id;
      IF related_organization_id <> parent_organization_id OR NEW.medication_name_snapshot IS DISTINCT FROM master_name OR NEW.dosage_form_snapshot IS DISTINCT FROM master_dosage_form THEN
        RAISE EXCEPTION 'medication order line snapshot does not match the selected medication catalog record' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.administration_pattern_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM administration_patterns dt WHERE dt.id = NEW.administration_pattern_id AND dt.organization_id = parent_organization_id
    ) THEN
      RAISE EXCEPTION 'medication order administration pattern belongs to another organization' USING ERRCODE = '23514';
    END IF;
    IF NEW.source_protocol_line_id IS NOT NULL THEN
      SELECT pti.medication_protocol_id, pti.medication_id, pti.administration_pattern_id
        INTO STRICT related_parent_id, related_medication_id, related_administration_pattern_id
      FROM medication_protocol_lines pti WHERE pti.id = NEW.source_protocol_line_id;
      IF related_parent_id IS DISTINCT FROM parent_protocol_id OR related_medication_id IS DISTINCT FROM NEW.medication_id OR related_administration_pattern_id IS DISTINCT FROM NEW.administration_pattern_id THEN
        RAISE EXCEPTION 'medication order line source does not match the loaded protocol, medication, or administration pattern' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_medication_order_diagnoses_context_validate
BEFORE INSERT OR UPDATE ON medication_order_diagnoses
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_order_child_context();

CREATE TRIGGER trg_medication_order_service_links_context_validate
BEFORE INSERT OR UPDATE ON medication_order_service_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_order_child_context();

CREATE TRIGGER trg_medication_order_lines_context_validate
BEFORE INSERT OR UPDATE ON medication_order_lines
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_medication_order_child_context();

CREATE OR REPLACE FUNCTION dentos_runtime.guard_medication_order_state()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  old_core jsonb;
  new_core jsonb;
BEGIN
  IF OLD.status = 'draft' AND NEW.status IN ('saved','signed') THEN
    IF NOT EXISTS (SELECT 1 FROM medication_order_diagnoses pd WHERE pd.medication_order_id = OLD.id) THEN
      RAISE EXCEPTION 'medication order requires at least one diagnosis before save or sign' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM medication_order_service_links pt WHERE pt.medication_order_id = OLD.id) THEN
      RAISE EXCEPTION 'medication order requires at least one suggested service before save or sign' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM medication_order_lines pi WHERE pi.medication_order_id = OLD.id) THEN
      RAISE EXCEPTION 'medication order requires at least one medication line before save or sign' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft','saved','signed') THEN
    RAISE EXCEPTION 'draft medication order can remain draft, be saved, or be saved and signed' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'void medication_orders are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.status IN ('saved','signed') THEN
    old_core := to_jsonb(OLD) - ARRAY['status','signed_at','signed_by','signature_hash','signature_algorithm','voided_at','voided_by','void_reason','rendered_file_id','updated_at','updated_by','row_version'];
    new_core := to_jsonb(NEW) - ARRAY['status','signed_at','signed_by','signature_hash','signature_algorithm','voided_at','voided_by','void_reason','rendered_file_id','updated_at','updated_by','row_version'];
    IF old_core IS DISTINCT FROM new_core THEN
      RAISE EXCEPTION 'saved or signed medication order clinical content is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF OLD.status = 'saved' AND NEW.status NOT IN ('saved','signed','void') THEN
    RAISE EXCEPTION 'saved medication order can remain saved, be signed, or be voided' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'signed' AND NEW.status NOT IN ('signed','void') THEN
    RAISE EXCEPTION 'signed medication order can remain signed or be voided' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'signed' AND (
    NEW.signed_at IS DISTINCT FROM OLD.signed_at
    OR NEW.signed_by IS DISTINCT FROM OLD.signed_by
    OR NEW.signature_hash IS DISTINCT FROM OLD.signature_hash
    OR NEW.signature_algorithm IS DISTINCT FROM OLD.signature_algorithm
  ) THEN
    RAISE EXCEPTION 'medication order signature metadata is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_medication_orders_state_guard
BEFORE UPDATE ON medication_orders
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_order_state();

CREATE OR REPLACE FUNCTION dentos_runtime.guard_medication_order_child_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  parent_status character varying;
BEGIN
  SELECT p.status INTO STRICT parent_status FROM medication_orders p WHERE p.id = OLD.medication_order_id;
  IF parent_status <> 'draft' THEN
    RAISE EXCEPTION 'medication order child rows can be deleted only while the medication order is draft' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_medication_order_diagnoses_delete_guard
BEFORE DELETE ON medication_order_diagnoses
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_order_child_delete();

CREATE TRIGGER trg_medication_order_service_links_delete_guard
BEFORE DELETE ON medication_order_service_links
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_order_child_delete();

CREATE TRIGGER trg_medication_order_lines_delete_guard
BEFORE DELETE ON medication_order_lines
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_medication_order_child_delete();
```

## Intent Tier, Case Attribution, Bundle, and Conversion Enforcement

The conversion subsystem is evidence-driven. A collection receipt alone cannot progress a case. Progression requires a positive active fee allocation, a positive fee-line split, an exact care-plan-service link preserved by a treatment bundle, and a later clinical encounter belonging to the same patient and clinic.

```sql
CREATE OR REPLACE FUNCTION dentos_runtime.track_patient_intent_tier()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  source_value character varying;
  case_value uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.intent_tier IS NOT DISTINCT FROM OLD.intent_tier
     AND NEW.intent_tier_reason_code IS NOT DISTINCT FROM OLD.intent_tier_reason_code
     AND NEW.intent_tier_note IS NOT DISTINCT FROM OLD.intent_tier_note THEN
    RETURN NEW;
  END IF;

  source_value := COALESCE(NULLIF(current_setting('dentos_runtime.intent_change_source', true), ''), CASE WHEN TG_OP = 'INSERT' THEN 'registration' ELSE 'patient_details' END);
  IF source_value NOT IN ('registration','patient_details','consultation_close','authorized_correction') THEN
    RAISE EXCEPTION 'invalid intent tier change source' USING ERRCODE = '23514';
  END IF;
  case_value := NULLIF(current_setting('dentos_runtime.clinical_case_id', true), '')::uuid;

  INSERT INTO patient_intent_tier_events (
    id, organization_id, clinic_id, patient_id, clinical_case_id,
    from_tier, to_tier, reason_code, note, change_source,
    changed_at, changed_by, created_at, created_by
  ) VALUES (
    gen_random_uuid(), NEW.organization_id, NEW.home_clinic_id, NEW.id, case_value,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.intent_tier ELSE NULL END,
    NEW.intent_tier, NEW.intent_tier_reason_code, NEW.intent_tier_note, source_value,
    NEW.intent_tier_assessed_at, NEW.intent_tier_assessed_by, clock_timestamp(), NEW.intent_tier_assessed_by
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_patients_intent_tier_history
AFTER INSERT OR UPDATE OF intent_tier, intent_tier_reason_code, intent_tier_note, intent_tier_assessed_at, intent_tier_assessed_by ON patients
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.track_patient_intent_tier();

CREATE OR REPLACE FUNCTION dentos_runtime.reject_append_only_case_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER trg_patient_intent_tier_events_immutable
BEFORE UPDATE OR DELETE ON patient_intent_tier_events
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.reject_append_only_case_history_mutation();

CREATE TRIGGER trg_clinical_case_state_events_immutable
BEFORE UPDATE OR DELETE ON clinical_case_state_events
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.reject_append_only_case_history_mutation();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_clinical_case_context()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  patient_organization_id uuid;
  patient_clinic_id uuid;
  patient_tier dentos_data.intent_tier;
BEGIN
  SELECT p.organization_id, p.home_clinic_id, p.intent_tier
    INTO STRICT patient_organization_id, patient_clinic_id, patient_tier
  FROM patients p
  WHERE p.id = NEW.patient_id AND p.active = true;

  IF NEW.organization_id <> patient_organization_id THEN
    RAISE EXCEPTION 'clinical case organization differs from patient organization' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM patient_clinics pc WHERE pc.patient_id = NEW.patient_id AND pc.clinic_id = NEW.clinic_id) THEN
    RAISE EXCEPTION 'clinical case clinic is not linked to patient' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.intent_tier_snapshot <> patient_tier THEN
    RAISE EXCEPTION 'clinical case intent snapshot must equal current patient intent tier at case creation' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.intent_tier_snapshot IS DISTINCT FROM OLD.intent_tier_snapshot THEN
    RAISE EXCEPTION 'clinical case intent tier snapshot is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_clinical_cases_context_validate
BEFORE INSERT OR UPDATE OF organization_id, clinic_id, patient_id, intent_tier_snapshot ON clinical_cases
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_clinical_case_context();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_case_consultation_context()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  case_organization_id uuid;
  case_clinic_id uuid;
  case_patient_id uuid;
  case_initial_consultation_id uuid;
  encounter_organization_id uuid;
  encounter_clinic_id uuid;
  encounter_patient_id uuid;
BEGIN
  SELECT cc.organization_id, cc.clinic_id, cc.patient_id, cc.initial_consultation_id
    INTO STRICT case_organization_id, case_clinic_id, case_patient_id, case_initial_consultation_id
  FROM clinical_cases cc WHERE cc.id = NEW.clinical_case_id;

  SELECT ce.organization_id, ce.clinic_id, ce.patient_id
    INTO STRICT encounter_organization_id, encounter_clinic_id, encounter_patient_id
  FROM care_encounters ce WHERE ce.id = NEW.care_encounter_id;

  IF (case_organization_id, case_clinic_id, case_patient_id) IS DISTINCT FROM (encounter_organization_id, encounter_clinic_id, encounter_patient_id) THEN
    RAISE EXCEPTION 'case consultation encounter differs from case organization, clinic, or patient' USING ERRCODE = '23514';
  END IF;
  IF NEW.consultation_kind = 'initial' AND NEW.id <> case_initial_consultation_id THEN
    RAISE EXCEPTION 'initial consultation does not match clinical_cases.initial_consultation_id' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM staff s JOIN staff_clinics sc ON sc.staff_id = s.id
    WHERE s.id = NEW.primary_consult_clinician_id AND s.organization_id = case_organization_id
      AND s.staff_type = 'clinician' AND s.active = true AND sc.clinic_id = case_clinic_id AND sc.active = true
  ) THEN
    RAISE EXCEPTION 'primary consult clinician is not active at the case clinic' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM staff s JOIN staff_clinics sc ON sc.staff_id = s.id
    WHERE s.id = NEW.secondary_review_clinician_id AND s.organization_id = case_organization_id
      AND s.staff_type = 'clinician' AND s.active = true AND sc.clinic_id = case_clinic_id AND sc.active = true
  ) THEN
    RAISE EXCEPTION 'secondary review clinician is not active at the case clinic' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_case_consultations_context_validate
BEFORE INSERT OR UPDATE OF clinical_case_id, care_encounter_id, consultation_kind, primary_consult_clinician_id, secondary_review_clinician_id ON case_consultations
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_case_consultation_context();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_treatment_bundle_service_context()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  case_patient_id uuid;
  case_clinic_id uuid;
  bundle_plan_id uuid;
  plan_patient_id uuid;
  plan_clinic_id uuid;
  plan_service_id uuid;
  plan_tooth_code character varying;
  plan_surface_codes character varying[];
  plan_amount numeric(14,2);
  master_domain_id uuid;
  master_code character varying;
  master_name character varying;
BEGIN
  SELECT cc.patient_id, cc.clinic_id, tb.care_plan_id
    INTO STRICT case_patient_id, case_clinic_id, bundle_plan_id
  FROM treatment_bundles tb
  JOIN clinical_cases cc ON cc.id = tb.clinical_case_id
  WHERE tb.id = NEW.treatment_bundle_id;

  SELECT cp.patient_id, cp.clinic_id, cps.service_id, cps.tooth_code, cps.surface_codes,
         GREATEST(0, COALESCE(cps.proposed_fee, 0) - COALESCE(cps.discount, 0))
    INTO STRICT plan_patient_id, plan_clinic_id, plan_service_id, plan_tooth_code, plan_surface_codes, plan_amount
  FROM care_plan_services cps
  JOIN care_plan_stages cstage ON cstage.id = cps.care_plan_stage_id
  JOIN care_plans cp ON cp.id = cstage.care_plan_id
  WHERE cps.id = NEW.care_plan_service_id AND cp.id = bundle_plan_id;

  IF (case_patient_id, case_clinic_id) IS DISTINCT FROM (plan_patient_id, plan_clinic_id) THEN
    RAISE EXCEPTION 'treatment bundle and care plan differ by patient or clinic' USING ERRCODE = '23514';
  END IF;

  SELECT sc.service_domain_id, sc.code, sc.description
    INTO STRICT master_domain_id, master_code, master_name
  FROM service_catalog sc WHERE sc.id = plan_service_id;

  IF NEW.service_id <> plan_service_id
     OR NEW.service_domain_id_snapshot <> master_domain_id
     OR NEW.service_code_snapshot IS DISTINCT FROM master_code
     OR NEW.service_name_snapshot IS DISTINCT FROM master_name
     OR NEW.tooth_code_snapshot IS DISTINCT FROM plan_tooth_code
     OR NEW.surface_codes_snapshot IS DISTINCT FROM COALESCE(plan_surface_codes, '{}')
     OR NEW.proposed_amount_snapshot IS DISTINCT FROM plan_amount THEN
    RAISE EXCEPTION 'treatment bundle service snapshot differs from its advised care-plan service' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_treatment_bundle_services_context_validate
BEFORE INSERT OR UPDATE OF treatment_bundle_id, care_plan_service_id, service_id, service_domain_id_snapshot, service_code_snapshot, service_name_snapshot, tooth_code_snapshot, surface_codes_snapshot, proposed_amount_snapshot ON treatment_bundle_services
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_treatment_bundle_service_context();

CREATE OR REPLACE FUNCTION dentos_runtime.guard_treatment_bundle_service_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.treatment_bundle_id IS DISTINCT FROM OLD.treatment_bundle_id
     OR NEW.care_plan_service_id IS DISTINCT FROM OLD.care_plan_service_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.service_domain_id_snapshot IS DISTINCT FROM OLD.service_domain_id_snapshot
     OR NEW.service_code_snapshot IS DISTINCT FROM OLD.service_code_snapshot
     OR NEW.service_name_snapshot IS DISTINCT FROM OLD.service_name_snapshot
     OR NEW.tooth_code_snapshot IS DISTINCT FROM OLD.tooth_code_snapshot
     OR NEW.surface_codes_snapshot IS DISTINCT FROM OLD.surface_codes_snapshot
     OR NEW.proposed_amount_snapshot IS DISTINCT FROM OLD.proposed_amount_snapshot
     OR NEW.advised_at IS DISTINCT FROM OLD.advised_at
     OR NEW.advised_by IS DISTINCT FROM OLD.advised_by THEN
    RAISE EXCEPTION 'advised treatment bundle identity and snapshots are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_treatment_bundle_services_identity_guard
BEFORE UPDATE ON treatment_bundle_services
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_treatment_bundle_service_identity();

CREATE OR REPLACE FUNCTION dentos_runtime.validate_fee_statement_line_plan_link()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_plan_service_id uuid;
  plan_service_id uuid;
  plan_patient_id uuid;
  plan_clinic_id uuid;
  statement_patient_id uuid;
  statement_clinic_id uuid;
BEGIN
  IF NEW.care_delivery_id IS NOT NULL THEN
    SELECT cd.care_plan_service_id INTO STRICT delivery_plan_service_id
    FROM care_deliveries cd WHERE cd.id = NEW.care_delivery_id;
    IF NEW.care_plan_service_id IS NULL THEN
      NEW.care_plan_service_id := delivery_plan_service_id;
    ELSIF delivery_plan_service_id IS NOT NULL AND NEW.care_plan_service_id <> delivery_plan_service_id THEN
      RAISE EXCEPTION 'fee statement line care-plan service differs from its care delivery' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.care_plan_service_id IS NOT NULL THEN
    SELECT cps.service_id, cp.patient_id, cp.clinic_id
      INTO STRICT plan_service_id, plan_patient_id, plan_clinic_id
    FROM care_plan_services cps
    JOIN care_plan_stages cstage ON cstage.id = cps.care_plan_stage_id
    JOIN care_plans cp ON cp.id = cstage.care_plan_id
    WHERE cps.id = NEW.care_plan_service_id;
    SELECT fs.patient_id, fs.clinic_id INTO STRICT statement_patient_id, statement_clinic_id
    FROM fee_statements fs WHERE fs.id = NEW.fee_statement_id;
    IF (plan_patient_id, plan_clinic_id) IS DISTINCT FROM (statement_patient_id, statement_clinic_id) THEN
      RAISE EXCEPTION 'fee statement line care-plan service differs from statement patient or clinic' USING ERRCODE = '23514';
    END IF;
    IF NEW.service_id IS NOT NULL AND NEW.service_id <> plan_service_id THEN
      RAISE EXCEPTION 'fee statement line service differs from care-plan service' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_fee_statement_lines_plan_link_validate
BEFORE INSERT OR UPDATE OF fee_statement_id, care_delivery_id, care_plan_service_id, service_id ON fee_statement_lines
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.validate_fee_statement_line_plan_link();

CREATE OR REPLACE FUNCTION dentos_runtime.guard_clinical_case_state_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  correction_allowed boolean;
  evidence_exists boolean;
BEGIN
  IF NEW.execution_state IS NOT DISTINCT FROM OLD.execution_state THEN
    RETURN NEW;
  END IF;

  correction_allowed := COALESCE(NULLIF(current_setting('dentos_runtime.allow_case_state_correction', true), '')::boolean, false);
  IF OLD.execution_state <> 'not_started' AND NOT (correction_allowed AND NEW.state_change_source = 'authorized_correction') THEN
    RAISE EXCEPTION 'case execution state is terminal without an authorized correction' USING ERRCODE = '55000';
  END IF;

  IF NEW.execution_state = 'minor_issue_treated_same_day' THEN
    SELECT EXISTS (
      SELECT 1
      FROM care_deliveries cd
      JOIN care_encounters delivery_encounter ON delivery_encounter.id = cd.care_encounter_id
      JOIN case_consultations ci ON ci.id = OLD.initial_consultation_id
      JOIN care_encounters consult_encounter ON consult_encounter.id = ci.care_encounter_id
      WHERE cd.id = NEW.minor_issue_care_delivery_id
        AND cd.patient_id = OLD.patient_id
        AND cd.status = 'completed'
        AND delivery_encounter.encounter_date = consult_encounter.encounter_date
    ) INTO evidence_exists;
    IF NOT evidence_exists THEN
      RAISE EXCEPTION 'minor issue same-day state requires a completed same-day care delivery' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.execution_state = 'treatment_started' AND NEW.state_change_source = 'care_delivery_start' THEN
    SELECT EXISTS (
      SELECT 1
      FROM care_deliveries cd
      JOIN treatment_bundle_services tbs ON tbs.care_plan_service_id = cd.care_plan_service_id
      JOIN treatment_bundles tb ON tb.id = tbs.treatment_bundle_id
      WHERE tb.clinical_case_id = OLD.id
        AND cd.patient_id = OLD.patient_id
        AND cd.status IN ('in_progress','completed')
        AND cd.started_at IS NOT NULL
    ) INTO evidence_exists;
    IF NOT evidence_exists THEN
      RAISE EXCEPTION 'treatment-started state requires an in-progress or completed bundled care delivery' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.execution_state = 'treatment_started' AND NEW.state_change_source IN ('applied_payment_future_encounter','eod_reconciliation') THEN
    SELECT EXISTS (
      SELECT 1
      FROM fee_allocations fa
      JOIN allocation_fee_line_splits afls ON afls.fee_allocation_id = fa.id AND afls.amount > 0
      JOIN fee_statement_lines fsl ON fsl.id = afls.fee_statement_line_id
      JOIN fee_statements fs ON fs.id = fsl.fee_statement_id
      JOIN care_encounters future_encounter ON future_encounter.id = fs.care_encounter_id
      JOIN case_consultations ci ON ci.id = OLD.initial_consultation_id
      JOIN care_encounters initial_encounter ON initial_encounter.id = ci.care_encounter_id
      LEFT JOIN care_deliveries cd ON cd.id = fsl.care_delivery_id
      JOIN treatment_bundle_services tbs ON tbs.care_plan_service_id = COALESCE(fsl.care_plan_service_id, cd.care_plan_service_id)
      JOIN treatment_bundles tb ON tb.id = tbs.treatment_bundle_id
      WHERE fa.id = NEW.triggering_fee_allocation_id
        AND fa.status = 'active'
        AND fa.amount > 0
        AND fs.status IN ('issued','part_paid','paid')
        AND tb.clinical_case_id = OLD.id
        AND tb.status NOT IN ('declined','cancelled')
        AND fs.patient_id = OLD.patient_id
        AND future_encounter.id = NEW.triggering_future_encounter_id
        AND future_encounter.patient_id = OLD.patient_id
        AND future_encounter.clinic_id = OLD.clinic_id
        AND future_encounter.id <> initial_encounter.id
        AND COALESCE(future_encounter.engaged_at, future_encounter.checked_in_at, future_encounter.arrival_at, future_encounter.encounter_date::timestamp AT TIME ZONE (SELECT c.timezone FROM clinics c WHERE c.id = future_encounter.clinic_id)) > ci.consulted_at
    ) INTO evidence_exists;
    IF NOT evidence_exists THEN
      RAISE EXCEPTION 'applied-payment progression lacks a later encounter and exact advised-plan allocation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_clinical_cases_state_guard
BEFORE UPDATE OF execution_state, state_change_source, triggering_fee_allocation_id, triggering_future_encounter_id, minor_issue_care_delivery_id, no_treatment_reason_code ON clinical_cases
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.guard_clinical_case_state_transition();

CREATE OR REPLACE FUNCTION dentos_runtime.append_clinical_case_state_event()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_sequence bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.execution_state IS NOT DISTINCT FROM OLD.execution_state THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(cse.sequence_no), 0) + 1 INTO next_sequence
  FROM clinical_case_state_events cse WHERE cse.clinical_case_id = NEW.id;

  INSERT INTO clinical_case_state_events (
    id, clinical_case_id, sequence_no, from_state, to_state, change_source,
    reason_code, note, triggering_fee_allocation_id, triggering_future_encounter_id,
    changed_at, changed_by, created_at, created_by
  ) VALUES (
    gen_random_uuid(), NEW.id, next_sequence,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.execution_state ELSE NULL END,
    NEW.execution_state, NEW.state_change_source, NEW.state_reason_code, NEW.state_note,
    NEW.triggering_fee_allocation_id, NEW.triggering_future_encounter_id,
    NEW.state_changed_at, NEW.state_changed_by, clock_timestamp(), NEW.state_changed_by
  );

  INSERT INTO outbox_events (id, organization_id, topic, aggregate_type, aggregate_id, payload_json, created_at, created_by, available_at, attempts)
  VALUES (
    gen_random_uuid(), NEW.organization_id, 'clinical_case.execution_state_changed', 'clinical_case', NEW.id,
    jsonb_build_object('clinical_case_id', NEW.id, 'patient_id', NEW.patient_id, 'clinic_id', NEW.clinic_id, 'execution_state', NEW.execution_state, 'change_source', NEW.state_change_source, 'fee_allocation_id', NEW.triggering_fee_allocation_id, 'future_encounter_id', NEW.triggering_future_encounter_id, 'row_version', NEW.row_version),
    clock_timestamp(), NEW.state_changed_by, clock_timestamp(), 0
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_clinical_cases_state_history
AFTER INSERT OR UPDATE OF execution_state ON clinical_cases
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.append_clinical_case_state_event();

CREATE OR REPLACE FUNCTION dentos_runtime.progress_case_from_care_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status NOT IN ('in_progress','completed') OR NEW.started_at IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE clinical_cases cc
  SET execution_state = 'treatment_started',
      state_changed_at = NEW.started_at,
      state_changed_by = NEW.updated_by,
      state_change_source = 'care_delivery_start',
      state_reason_code = 'bundled_care_delivery_started',
      state_note = 'Progressed from an advised bundle when its linked care delivery entered in-progress or completed state.',
      treatment_started_at = NEW.started_at,
      treatment_started_by = NEW.updated_by,
      triggering_fee_allocation_id = NULL,
      triggering_future_encounter_id = NEW.care_encounter_id,
      updated_by = NEW.updated_by
  FROM treatment_bundle_services tbs
  JOIN treatment_bundles tb ON tb.id = tbs.treatment_bundle_id
  WHERE tbs.care_plan_service_id = NEW.care_plan_service_id
    AND cc.id = tb.clinical_case_id
    AND cc.execution_state = 'not_started';
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_care_deliveries_case_progress
AFTER INSERT OR UPDATE OF status, started_at ON care_deliveries
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.progress_case_from_care_delivery();

CREATE OR REPLACE FUNCTION dentos_runtime.progress_case_from_applied_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  WITH evidence AS (
    SELECT DISTINCT cc.id AS clinical_case_id, fa.id AS fee_allocation_id,
           fs.care_encounter_id AS future_encounter_id, fa.applied_by, fa.created_at
    FROM fee_allocations fa
    JOIN allocation_fee_line_splits afls ON afls.fee_allocation_id = fa.id AND afls.amount > 0
    JOIN fee_statement_lines fsl ON fsl.id = afls.fee_statement_line_id
    JOIN fee_statements fs ON fs.id = fsl.fee_statement_id
    JOIN care_encounters future_encounter ON future_encounter.id = fs.care_encounter_id
    LEFT JOIN care_deliveries cd ON cd.id = fsl.care_delivery_id
    JOIN treatment_bundle_services tbs ON tbs.care_plan_service_id = COALESCE(fsl.care_plan_service_id, cd.care_plan_service_id)
    JOIN treatment_bundles tb ON tb.id = tbs.treatment_bundle_id AND tb.status NOT IN ('declined','cancelled')
    JOIN clinical_cases cc ON cc.id = tb.clinical_case_id AND cc.execution_state = 'not_started'
    JOIN case_consultations ci ON ci.id = cc.initial_consultation_id
    JOIN care_encounters initial_encounter ON initial_encounter.id = ci.care_encounter_id
    JOIN clinics cl ON cl.id = future_encounter.clinic_id
    WHERE afls.id = NEW.id
      AND fa.status = 'active'
      AND fa.amount > 0
      AND fs.status IN ('issued','part_paid','paid')
      AND fs.patient_id = cc.patient_id
      AND future_encounter.patient_id = cc.patient_id
      AND future_encounter.clinic_id = cc.clinic_id
      AND future_encounter.id <> initial_encounter.id
      AND COALESCE(future_encounter.engaged_at, future_encounter.checked_in_at, future_encounter.arrival_at, future_encounter.encounter_date::timestamp AT TIME ZONE cl.timezone) > ci.consulted_at
  )
  UPDATE clinical_cases cc
  SET execution_state = 'treatment_started',
      state_changed_at = evidence.created_at,
      state_changed_by = evidence.applied_by,
      state_change_source = 'applied_payment_future_encounter',
      state_reason_code = 'future_encounter_plan_allocation',
      state_note = 'Progressed after a positive applied payment at a later encounter matched an originally advised care-plan service.',
      treatment_started_at = evidence.created_at,
      treatment_started_by = evidence.applied_by,
      triggering_fee_allocation_id = evidence.fee_allocation_id,
      triggering_future_encounter_id = evidence.future_encounter_id,
      updated_by = evidence.applied_by
  FROM evidence
  WHERE cc.id = evidence.clinical_case_id AND cc.execution_state = 'not_started';
  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER trg_allocation_fee_line_splits_case_progress
AFTER INSERT ON allocation_fee_line_splits
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION dentos_runtime.progress_case_from_applied_payment();

CREATE OR REPLACE FUNCTION dentos_runtime.reconcile_case_progression(p_clinic_id uuid, p_business_date date)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  updated_count integer;
BEGIN
  WITH ranked_evidence AS (
    SELECT DISTINCT ON (cc.id)
      cc.id AS clinical_case_id,
      fa.id AS fee_allocation_id,
      fs.care_encounter_id AS future_encounter_id,
      fa.applied_by,
      fa.created_at
    FROM clinical_cases cc
    JOIN case_consultations ci ON ci.id = cc.initial_consultation_id
    JOIN treatment_bundles tb ON tb.clinical_case_id = cc.id AND tb.status NOT IN ('declined','cancelled')
    JOIN treatment_bundle_services tbs ON tbs.treatment_bundle_id = tb.id
    JOIN fee_statement_lines fsl ON fsl.care_plan_service_id = tbs.care_plan_service_id
    JOIN fee_statements fs ON fs.id = fsl.fee_statement_id AND fs.care_encounter_id IS NOT NULL
    JOIN care_encounters future_encounter ON future_encounter.id = fs.care_encounter_id
    JOIN care_encounters initial_encounter ON initial_encounter.id = ci.care_encounter_id
    JOIN clinics cl ON cl.id = future_encounter.clinic_id
    JOIN allocation_fee_line_splits afls ON afls.fee_statement_line_id = fsl.id AND afls.amount > 0
    JOIN fee_allocations fa ON fa.id = afls.fee_allocation_id AND fa.status = 'active' AND fa.amount > 0
    WHERE cc.clinic_id = p_clinic_id
      AND cc.execution_state = 'not_started'
      AND fs.status IN ('issued','part_paid','paid')
      AND future_encounter.patient_id = cc.patient_id
      AND future_encounter.clinic_id = cc.clinic_id
      AND future_encounter.id <> initial_encounter.id
      AND future_encounter.encounter_date <= p_business_date
      AND COALESCE(future_encounter.engaged_at, future_encounter.checked_in_at, future_encounter.arrival_at, future_encounter.encounter_date::timestamp AT TIME ZONE cl.timezone) > ci.consulted_at
    ORDER BY cc.id, fa.created_at, fa.id
  )
  UPDATE clinical_cases cc
  SET execution_state = 'treatment_started',
      state_changed_at = ranked_evidence.created_at,
      state_changed_by = ranked_evidence.applied_by,
      state_change_source = 'eod_reconciliation',
      state_reason_code = 'reconciled_future_encounter_plan_allocation',
      state_note = 'End-of-day reconciliation found qualifying applied-payment evidence that had not progressed the case.',
      treatment_started_at = ranked_evidence.created_at,
      treatment_started_by = ranked_evidence.applied_by,
      triggering_fee_allocation_id = ranked_evidence.fee_allocation_id,
      triggering_future_encounter_id = ranked_evidence.future_encounter_id,
      updated_by = ranked_evidence.applied_by
  FROM ranked_evidence
  WHERE cc.id = ranked_evidence.clinical_case_id AND cc.execution_state = 'not_started';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;
```

## Audit and Row-Version Functions

```sql
CREATE OR REPLACE FUNCTION dentos_runtime.touch_mutable_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.row_version := OLD.row_version + 1;
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := nullif(current_setting('dentos_runtime.user_id', true), '')::uuid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dentos_runtime.write_audit_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = dentos_data, dentos_runtime, public AS $$
DECLARE
  before_doc jsonb;
  after_doc jsonb;
  source_doc jsonb;
  actor uuid;
  organization_value uuid;
  clinic_value uuid;
  record_value uuid;
BEGIN
  before_doc := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  after_doc := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  before_doc := before_doc - ARRAY['password_hash','token_hash','temporary_password','mfa_secret'];
  after_doc := after_doc - ARRAY['password_hash','token_hash','temporary_password','mfa_secret'];
  source_doc := coalesce(after_doc, before_doc, '{}'::jsonb);
  actor := COALESCE(
    nullif(current_setting('dentos_runtime.user_id', true), '')::uuid,
    nullif(source_doc ->> 'updated_by', '')::uuid,
    nullif(source_doc ->> 'created_by', '')::uuid,
    nullif(source_doc ->> 'actor_user_id', '')::uuid
  );
  organization_value := COALESCE(
    nullif(source_doc ->> 'organization_id', '')::uuid,
    nullif(current_setting('dentos_runtime.organization_id', true), '')::uuid
  );
  clinic_value := COALESCE(
    nullif(source_doc ->> 'clinic_id', '')::uuid,
    nullif(current_setting('dentos_runtime.clinic_id', true), '')::uuid
  );
  record_value := COALESCE(
    nullif(source_doc ->> 'id', '')::uuid,
    nullif(source_doc ->> 'user_id', '')::uuid,
    nullif(source_doc ->> 'patient_id', '')::uuid,
    nullif(source_doc ->> 'staff_id', '')::uuid,
    nullif(source_doc ->> 'clinic_id', '')::uuid
  );
  INSERT INTO audit_events (id, organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, reason, request_id, occurred_at, created_at, created_by)
  VALUES (gen_random_uuid(), organization_value, clinic_value, actor, lower(TG_OP), TG_TABLE_NAME, record_value, before_doc, after_doc, nullif(current_setting('dentos_runtime.reason', true), ''), nullif(current_setting('dentos_runtime.request_id', true), ''), clock_timestamp(), clock_timestamp(), actor);
  RETURN coalesce(NEW, OLD);
END;
$$;
```

## Explicit Table-Level Audit Triggers

Each mutable table has a row-version trigger and an audit trigger. Append-only tables have an insert audit trigger. `audit_events` is excluded to prevent recursive auditing.

```sql
CREATE TRIGGER trg_organizations_touch BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_organizations_audit AFTER INSERT OR UPDATE OR DELETE ON organizations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinics_touch BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinics_audit AFTER INSERT OR UPDATE OR DELETE ON clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_users_audit AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_user_credentials_touch BEFORE UPDATE ON user_credentials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_user_credentials_audit AFTER INSERT OR UPDATE OR DELETE ON user_credentials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_password_reset_tokens_audit AFTER INSERT ON password_reset_tokens FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_user_sessions_audit AFTER INSERT ON user_sessions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_touch BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_audit AFTER INSERT OR UPDATE OR DELETE ON staff FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_clinics_touch BEFORE UPDATE ON staff_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_clinics_audit AFTER INSERT OR UPDATE OR DELETE ON staff_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_user_links_touch BEFORE UPDATE ON staff_user_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_user_links_audit AFTER INSERT OR UPDATE OR DELETE ON staff_user_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinic_memberships_touch BEFORE UPDATE ON clinic_memberships FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinic_memberships_audit AFTER INSERT OR UPDATE OR DELETE ON clinic_memberships FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_roles_touch BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_roles_audit AFTER INSERT OR UPDATE OR DELETE ON roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_permissions_touch BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_permissions_audit AFTER INSERT OR UPDATE OR DELETE ON permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_role_permissions_touch BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_role_permissions_audit AFTER INSERT OR UPDATE OR DELETE ON role_permissions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_membership_roles_touch BEFORE UPDATE ON membership_roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_membership_roles_audit AFTER INSERT OR UPDATE OR DELETE ON membership_roles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_membership_permission_overrides_touch BEFORE UPDATE ON membership_permission_overrides FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_membership_permission_overrides_audit AFTER INSERT OR UPDATE OR DELETE ON membership_permission_overrides FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinic_settings_touch BEFORE UPDATE ON clinic_settings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinic_settings_audit AFTER INSERT OR UPDATE OR DELETE ON clinic_settings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_chairs_touch BEFORE UPDATE ON chairs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_chairs_audit AFTER INSERT OR UPDATE OR DELETE ON chairs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_initials_touch BEFORE UPDATE ON patient_initials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_initials_audit AFTER INSERT OR UPDATE OR DELETE ON patient_initials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_categories_touch BEFORE UPDATE ON patient_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_categories_audit AFTER INSERT OR UPDATE OR DELETE ON patient_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_flags_touch BEFORE UPDATE ON patient_flags FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_flags_audit AFTER INSERT OR UPDATE OR DELETE ON patient_flags FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_occupations_touch BEFORE UPDATE ON occupations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_occupations_audit AFTER INSERT OR UPDATE OR DELETE ON occupations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinical_materials_touch BEFORE UPDATE ON clinical_materials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinical_materials_audit AFTER INSERT OR UPDATE OR DELETE ON clinical_materials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_bridge_types_touch BEFORE UPDATE ON bridge_types FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_bridge_types_audit AFTER INSERT OR UPDATE OR DELETE ON bridge_types FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_booking_reasons_touch BEFORE UPDATE ON care_booking_reasons FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_booking_reasons_audit AFTER INSERT OR UPDATE OR DELETE ON care_booking_reasons FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_expense_heads_touch BEFORE UPDATE ON expense_heads FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_expense_heads_audit AFTER INSERT OR UPDATE OR DELETE ON expense_heads FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_methods_touch BEFORE UPDATE ON collection_methods FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_methods_audit AFTER INSERT OR UPDATE OR DELETE ON collection_methods FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_service_domains_touch BEFORE UPDATE ON service_domains FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_service_domains_audit AFTER INSERT OR UPDATE OR DELETE ON service_domains FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_risk_factors_touch BEFORE UPDATE ON risk_factors FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_risk_factors_audit AFTER INSERT OR UPDATE OR DELETE ON risk_factors FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_diagnosis_catalog_touch BEFORE UPDATE ON diagnosis_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_diagnosis_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON diagnosis_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_treatment_priorities_touch BEFORE UPDATE ON treatment_priorities FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_treatment_priorities_audit AFTER INSERT OR UPDATE OR DELETE ON treatment_priorities FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_document_tags_touch BEFORE UPDATE ON document_tags FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_document_tags_audit AFTER INSERT OR UPDATE OR DELETE ON document_tags FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_domains_touch BEFORE UPDATE ON medication_domains FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_domains_audit AFTER INSERT OR UPDATE OR DELETE ON medication_domains FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_statement_categories_touch BEFORE UPDATE ON fee_statement_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_statement_categories_audit AFTER INSERT OR UPDATE OR DELETE ON fee_statement_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_stock_categories_touch BEFORE UPDATE ON stock_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_stock_categories_audit AFTER INSERT OR UPDATE OR DELETE ON stock_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_lab_work_steps_touch BEFORE UPDATE ON lab_work_steps FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_lab_work_steps_audit AFTER INSERT OR UPDATE OR DELETE ON lab_work_steps FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_lab_quality_options_touch BEFORE UPDATE ON lab_quality_options FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_lab_quality_options_audit AFTER INSERT OR UPDATE OR DELETE ON lab_quality_options FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_note_templates_touch BEFORE UPDATE ON note_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_note_templates_audit AFTER INSERT OR UPDATE OR DELETE ON note_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_custom_forms_touch BEFORE UPDATE ON custom_forms FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_custom_forms_audit AFTER INSERT OR UPDATE OR DELETE ON custom_forms FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_document_series_touch BEFORE UPDATE ON document_series FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_document_series_audit AFTER INSERT OR UPDATE OR DELETE ON document_series FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_document_number_reservations_touch BEFORE UPDATE ON document_number_reservations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_document_number_reservations_audit AFTER INSERT OR UPDATE OR DELETE ON document_number_reservations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patients_touch BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patients_audit AFTER INSERT OR UPDATE OR DELETE ON patients FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_clinics_touch BEFORE UPDATE ON patient_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_clinics_audit AFTER INSERT OR UPDATE OR DELETE ON patient_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_contacts_touch BEFORE UPDATE ON patient_contacts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_contacts_audit AFTER INSERT OR UPDATE OR DELETE ON patient_contacts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_addresses_touch BEFORE UPDATE ON patient_addresses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_addresses_audit AFTER INSERT OR UPDATE OR DELETE ON patient_addresses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_family_links_touch BEFORE UPDATE ON patient_family_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_family_links_audit AFTER INSERT OR UPDATE OR DELETE ON patient_family_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_referral_sources_touch BEFORE UPDATE ON referral_sources FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_referral_sources_audit AFTER INSERT OR UPDATE OR DELETE ON referral_sources FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_flag_assignments_touch BEFORE UPDATE ON patient_flag_assignments FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_flag_assignments_audit AFTER INSERT OR UPDATE OR DELETE ON patient_flag_assignments FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_custom_field_definitions_touch BEFORE UPDATE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_custom_field_definitions_audit AFTER INSERT OR UPDATE OR DELETE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_custom_field_values_touch BEFORE UPDATE ON patient_custom_field_values FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_custom_field_values_audit AFTER INSERT OR UPDATE OR DELETE ON patient_custom_field_values FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medical_question_definitions_touch BEFORE UPDATE ON medical_question_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medical_question_definitions_audit AFTER INSERT OR UPDATE OR DELETE ON medical_question_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_medical_responses_touch BEFORE UPDATE ON patient_medical_responses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_medical_responses_audit AFTER INSERT OR UPDATE OR DELETE ON patient_medical_responses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_allergy_catalog_touch BEFORE UPDATE ON allergy_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_allergy_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON allergy_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_allergies_touch BEFORE UPDATE ON patient_allergies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_allergies_audit AFTER INSERT OR UPDATE OR DELETE ON patient_allergies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_consents_touch BEFORE UPDATE ON patient_consents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_consents_audit AFTER INSERT OR UPDATE OR DELETE ON patient_consents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_merge_events_audit AFTER INSERT ON patient_merge_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_working_hours_touch BEFORE UPDATE ON staff_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_working_hours_audit AFTER INSERT OR UPDATE OR DELETE ON staff_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_chair_working_hours_touch BEFORE UPDATE ON chair_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_chair_working_hours_audit AFTER INSERT OR UPDATE OR DELETE ON chair_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_resource_blackouts_touch BEFORE UPDATE ON resource_blackouts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_resource_blackouts_audit AFTER INSERT OR UPDATE OR DELETE ON resource_blackouts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_bookings_touch BEFORE UPDATE ON care_bookings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_bookings_audit AFTER INSERT OR UPDATE OR DELETE ON care_bookings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_booking_requests_touch BEFORE UPDATE ON care_booking_requests FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_booking_requests_audit AFTER INSERT OR UPDATE OR DELETE ON care_booking_requests FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_booking_state_events_audit AFTER INSERT ON care_booking_state_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_encounters_touch BEFORE UPDATE ON care_encounters FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_encounters_audit AFTER INSERT OR UPDATE OR DELETE ON care_encounters FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_encounter_state_events_audit AFTER INSERT ON encounter_state_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_service_catalog_touch BEFORE UPDATE ON service_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_service_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON service_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_odontogram_findings_touch BEFORE UPDATE ON odontogram_findings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_odontogram_findings_audit AFTER INSERT OR UPDATE OR DELETE ON odontogram_findings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_plans_touch BEFORE UPDATE ON care_plans FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_plans_audit AFTER INSERT OR UPDATE OR DELETE ON care_plans FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_plan_stages_touch BEFORE UPDATE ON care_plan_stages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_plan_stages_audit AFTER INSERT OR UPDATE OR DELETE ON care_plan_stages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_plan_services_touch BEFORE UPDATE ON care_plan_services FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_plan_services_audit AFTER INSERT OR UPDATE OR DELETE ON care_plan_services FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_deliveries_touch BEFORE UPDATE ON care_deliveries FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_deliveries_audit AFTER INSERT OR UPDATE OR DELETE ON care_deliveries FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_intent_tier_events_audit AFTER INSERT ON patient_intent_tier_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinical_cases_touch BEFORE UPDATE ON clinical_cases FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinical_cases_audit AFTER INSERT OR UPDATE OR DELETE ON clinical_cases FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_case_consultations_touch BEFORE UPDATE ON case_consultations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_case_consultations_audit AFTER INSERT OR UPDATE OR DELETE ON case_consultations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_treatment_bundles_touch BEFORE UPDATE ON treatment_bundles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_treatment_bundles_audit AFTER INSERT OR UPDATE OR DELETE ON treatment_bundles FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_treatment_bundle_services_touch BEFORE UPDATE ON treatment_bundle_services FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_treatment_bundle_services_audit AFTER INSERT OR UPDATE OR DELETE ON treatment_bundle_services FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinical_case_state_events_audit AFTER INSERT ON clinical_case_state_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinical_notes_touch BEFORE UPDATE ON clinical_notes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinical_notes_audit AFTER INSERT OR UPDATE OR DELETE ON clinical_notes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_files_touch BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_files_audit AFTER INSERT OR UPDATE OR DELETE ON files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_files_touch BEFORE UPDATE ON patient_files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_files_audit AFTER INSERT OR UPDATE OR DELETE ON patient_files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_continuity_policies_touch BEFORE UPDATE ON continuity_policies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_continuity_policies_audit AFTER INSERT OR UPDATE OR DELETE ON continuity_policies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_continuity_recall_records_touch BEFORE UPDATE ON continuity_recall_records FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_continuity_recall_records_audit AFTER INSERT OR UPDATE OR DELETE ON continuity_recall_records FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_continuity_tasks_touch BEFORE UPDATE ON continuity_tasks FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_continuity_tasks_audit AFTER INSERT OR UPDATE OR DELETE ON continuity_tasks FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_dental_labs_touch BEFORE UPDATE ON dental_labs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_dental_labs_audit AFTER INSERT OR UPDATE OR DELETE ON dental_labs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_lab_work_types_touch BEFORE UPDATE ON lab_work_types FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_lab_work_types_audit AFTER INSERT OR UPDATE OR DELETE ON lab_work_types FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_lab_jobs_touch BEFORE UPDATE ON lab_jobs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_lab_jobs_audit AFTER INSERT OR UPDATE OR DELETE ON lab_jobs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_lab_job_status_history_audit AFTER INSERT ON lab_job_status_history FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_active_ingredient_catalog_touch BEFORE UPDATE ON active_ingredient_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_active_ingredient_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON active_ingredient_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_catalog_touch BEFORE UPDATE ON medication_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON medication_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_administration_patterns_touch BEFORE UPDATE ON administration_patterns FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_administration_patterns_audit AFTER INSERT OR UPDATE OR DELETE ON administration_patterns FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_domain_links_touch BEFORE UPDATE ON medication_domain_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_domain_links_audit AFTER INSERT OR UPDATE OR DELETE ON medication_domain_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_ingredient_links_touch BEFORE UPDATE ON medication_ingredient_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_ingredient_links_audit AFTER INSERT OR UPDATE OR DELETE ON medication_ingredient_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_allergy_ingredient_rules_touch BEFORE UPDATE ON allergy_ingredient_rules FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_allergy_ingredient_rules_audit AFTER INSERT OR UPDATE OR DELETE ON allergy_ingredient_rules FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_strength_options_touch BEFORE UPDATE ON medication_strength_options FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_strength_options_audit AFTER INSERT OR UPDATE OR DELETE ON medication_strength_options FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_administration_defaults_touch BEFORE UPDATE ON medication_administration_defaults FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_administration_defaults_audit AFTER INSERT OR UPDATE OR DELETE ON medication_administration_defaults FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_protocols_touch BEFORE UPDATE ON medication_protocols FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_protocols_audit AFTER INSERT OR UPDATE OR DELETE ON medication_protocols FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_protocol_lines_touch BEFORE UPDATE ON medication_protocol_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_protocol_lines_audit AFTER INSERT OR UPDATE OR DELETE ON medication_protocol_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_protocol_diagnosis_links_touch BEFORE UPDATE ON medication_protocol_diagnosis_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_protocol_diagnosis_links_audit AFTER INSERT OR UPDATE OR DELETE ON medication_protocol_diagnosis_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_protocol_service_links_touch BEFORE UPDATE ON medication_protocol_service_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_protocol_service_links_audit AFTER INSERT OR UPDATE OR DELETE ON medication_protocol_service_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_encounter_diagnoses_touch BEFORE UPDATE ON encounter_diagnoses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_encounter_diagnoses_audit AFTER INSERT OR UPDATE OR DELETE ON encounter_diagnoses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_encounter_service_recommendations_touch BEFORE UPDATE ON encounter_service_recommendations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_encounter_service_recommendations_audit AFTER INSERT OR UPDATE OR DELETE ON encounter_service_recommendations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_feedback_templates_touch BEFORE UPDATE ON feedback_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_feedback_templates_audit AFTER INSERT OR UPDATE OR DELETE ON feedback_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_orders_touch BEFORE UPDATE ON medication_orders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_orders_audit AFTER INSERT OR UPDATE OR DELETE ON medication_orders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_order_diagnoses_touch BEFORE UPDATE ON medication_order_diagnoses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_order_diagnoses_audit AFTER INSERT OR UPDATE OR DELETE ON medication_order_diagnoses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_order_service_links_touch BEFORE UPDATE ON medication_order_service_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_order_service_links_audit AFTER INSERT OR UPDATE OR DELETE ON medication_order_service_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medication_order_lines_touch BEFORE UPDATE ON medication_order_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medication_order_lines_audit AFTER INSERT OR UPDATE OR DELETE ON medication_order_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_schedules_touch BEFORE UPDATE ON fee_schedules FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_schedules_audit AFTER INSERT OR UPDATE OR DELETE ON fee_schedules FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_schedule_items_touch BEFORE UPDATE ON fee_schedule_items FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_schedule_items_audit AFTER INSERT OR UPDATE OR DELETE ON fee_schedule_items FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_tax_codes_touch BEFORE UPDATE ON tax_codes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_tax_codes_audit AFTER INSERT OR UPDATE OR DELETE ON tax_codes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_statements_touch BEFORE UPDATE ON fee_statements FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_statements_audit AFTER INSERT OR UPDATE OR DELETE ON fee_statements FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_statement_lines_touch BEFORE UPDATE ON fee_statement_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_statement_lines_audit AFTER INSERT OR UPDATE OR DELETE ON fee_statement_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_receipts_touch BEFORE UPDATE ON collection_receipts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_receipts_audit AFTER INSERT OR UPDATE OR DELETE ON collection_receipts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_tenders_touch BEFORE UPDATE ON collection_tenders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_tenders_audit AFTER INSERT OR UPDATE OR DELETE ON collection_tenders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_allocations_touch BEFORE UPDATE ON fee_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_allocations_audit AFTER INSERT OR UPDATE OR DELETE ON fee_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_allocation_tender_splits_audit AFTER INSERT ON allocation_tender_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_allocation_fee_line_splits_audit AFTER INSERT ON allocation_fee_line_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinician_value_allocations_audit AFTER INSERT ON clinician_value_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_credits_touch BEFORE UPDATE ON fee_credits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_credits_audit AFTER INSERT OR UPDATE OR DELETE ON fee_credits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_credit_allocations_audit AFTER INSERT ON fee_credit_allocations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_reliefs_touch BEFORE UPDATE ON fee_reliefs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_reliefs_audit AFTER INSERT OR UPDATE OR DELETE ON fee_reliefs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_credit_line_splits_audit AFTER INSERT ON fee_credit_line_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_relief_line_splits_audit AFTER INSERT ON fee_relief_line_splits FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_refunds_touch BEFORE UPDATE ON collection_refunds FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_collection_refunds_audit AFTER INSERT OR UPDATE OR DELETE ON collection_refunds FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_collection_refund_tenders_audit AFTER INSERT ON collection_refund_tenders FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_legacy_balance_documents_touch BEFORE UPDATE ON legacy_balance_documents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_legacy_balance_documents_audit AFTER INSERT OR UPDATE OR DELETE ON legacy_balance_documents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_ledger_accounts_touch BEFORE UPDATE ON ledger_accounts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_ledger_accounts_audit AFTER INSERT OR UPDATE OR DELETE ON ledger_accounts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_journal_entries_audit AFTER INSERT ON journal_entries FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_journal_lines_audit AFTER INSERT ON journal_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinician_share_contracts_touch BEFORE UPDATE ON clinician_share_contracts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinician_share_contracts_audit AFTER INSERT OR UPDATE OR DELETE ON clinician_share_contracts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinician_share_accruals_touch BEFORE UPDATE ON clinician_share_accruals FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinician_share_accruals_audit AFTER INSERT OR UPDATE OR DELETE ON clinician_share_accruals FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinician_share_adjustments_touch BEFORE UPDATE ON clinician_share_adjustments FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinician_share_adjustments_audit AFTER INSERT OR UPDATE OR DELETE ON clinician_share_adjustments FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinician_share_payouts_touch BEFORE UPDATE ON clinician_share_payouts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinician_share_payouts_audit AFTER INSERT OR UPDATE OR DELETE ON clinician_share_payouts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_suppliers_touch BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_suppliers_audit AFTER INSERT OR UPDATE OR DELETE ON suppliers FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_expenses_touch BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_expenses_audit AFTER INSERT OR UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_lab_disbursements_touch BEFORE UPDATE ON lab_disbursements FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_lab_disbursements_audit AFTER INSERT OR UPDATE OR DELETE ON lab_disbursements FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_inventory_items_touch BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_inventory_items_audit AFTER INSERT OR UPDATE OR DELETE ON inventory_items FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_stock_documents_touch BEFORE UPDATE ON stock_documents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_stock_documents_audit AFTER INSERT OR UPDATE OR DELETE ON stock_documents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_stock_document_lines_touch BEFORE UPDATE ON stock_document_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_stock_document_lines_audit AFTER INSERT OR UPDATE OR DELETE ON stock_document_lines FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_stock_movements_audit AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_stock_balances_touch BEFORE UPDATE ON stock_balances FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_stock_balances_audit AFTER INSERT OR UPDATE OR DELETE ON stock_balances FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_communication_preferences_touch BEFORE UPDATE ON communication_preferences FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_communication_preferences_audit AFTER INSERT OR UPDATE OR DELETE ON communication_preferences FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_message_templates_touch BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_message_templates_audit AFTER INSERT OR UPDATE OR DELETE ON message_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_message_batches_touch BEFORE UPDATE ON message_batches FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_message_batches_audit AFTER INSERT OR UPDATE OR DELETE ON message_batches FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_outbound_messages_touch BEFORE UPDATE ON outbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_outbound_messages_audit AFTER INSERT OR UPDATE OR DELETE ON outbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_message_status_events_audit AFTER INSERT ON message_status_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_inbound_messages_touch BEFORE UPDATE ON inbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_inbound_messages_audit AFTER INSERT OR UPDATE OR DELETE ON inbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_education_videos_touch BEFORE UPDATE ON education_videos FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_education_videos_audit AFTER INSERT OR UPDATE OR DELETE ON education_videos FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_outbox_events_audit AFTER INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_job_runs_audit AFTER INSERT ON job_runs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_idempotency_keys_audit AFTER INSERT ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_report_exports_touch BEFORE UPDATE ON report_exports FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_report_exports_audit AFTER INSERT OR UPDATE OR DELETE ON report_exports FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
```

## Granular Permission Seed Catalog

```sql
INSERT INTO permissions (id, code, module, resource, action, description, sensitive, created_at) VALUES
  (gen_random_uuid(), 'patient.view', 'patient_registry', 'patient', 'view', 'patient.view authorization gate', false),
  (gen_random_uuid(), 'patient.create', 'patient_registry', 'patient', 'create', 'patient.create authorization gate', false),
  (gen_random_uuid(), 'patient.edit', 'patient_registry', 'patient', 'edit', 'patient.edit authorization gate', false),
  (gen_random_uuid(), 'patient.archive', 'patient_registry', 'patient', 'archive', 'patient.archive authorization gate', false),
  (gen_random_uuid(), 'patient.merge', 'patient_registry', 'patient', 'merge', 'patient.merge authorization gate', true),
  (gen_random_uuid(), 'patient.export', 'patient_registry', 'patient', 'export', 'patient.export authorization gate', true),
  (gen_random_uuid(), 'patient.kyc.view', 'patient_registry', 'patient_kyc', 'view', 'patient.kyc.view authorization gate', true),
  (gen_random_uuid(), 'scheduler.view', 'scheduler', 'care_booking', 'view', 'scheduler.view authorization gate', false),
  (gen_random_uuid(), 'scheduler.create', 'scheduler', 'care_booking', 'create', 'scheduler.create authorization gate', false),
  (gen_random_uuid(), 'scheduler.edit', 'scheduler', 'care_booking', 'edit', 'scheduler.edit authorization gate', false),
  (gen_random_uuid(), 'scheduler.cancel', 'scheduler', 'care_booking', 'cancel', 'scheduler.cancel authorization gate', false),
  (gen_random_uuid(), 'scheduler.override', 'scheduler', 'care_booking', 'override', 'scheduler.override authorization gate', true),
  (gen_random_uuid(), 'queue.view', 'clinical_queue', 'care_encounter', 'view', 'queue.view authorization gate', false),
  (gen_random_uuid(), 'queue.admit', 'clinical_queue', 'care_encounter', 'admit', 'queue.admit authorization gate', false),
  (gen_random_uuid(), 'queue.engage', 'clinical_queue', 'care_encounter', 'engage', 'queue.engage authorization gate', false),
  (gen_random_uuid(), 'queue.release', 'clinical_queue', 'care_encounter', 'release', 'queue.release authorization gate', false),
  (gen_random_uuid(), 'queue.reopen', 'clinical_queue', 'care_encounter', 'reopen', 'queue.reopen authorization gate', false),
  (gen_random_uuid(), 'clinical.view', 'care_workspace', 'care_record', 'view', 'clinical.view authorization gate', false),
  (gen_random_uuid(), 'clinical.edit', 'care_workspace', 'care_record', 'edit', 'clinical.edit authorization gate', false),
  (gen_random_uuid(), 'clinical.delete_draft', 'care_workspace', 'care_record', 'delete_draft', 'clinical.delete_draft authorization gate', false),
  (gen_random_uuid(), 'odontogram.edit', 'care_workspace', 'odontogram', 'edit', 'odontogram.edit authorization gate', false),
  (gen_random_uuid(), 'care_plan.create', 'care_workspace', 'care_plan', 'create', 'care_plan.create authorization gate', false),
  (gen_random_uuid(), 'care_plan.edit', 'care_workspace', 'care_plan', 'edit', 'care_plan.edit authorization gate', false),
  (gen_random_uuid(), 'care_delivery.complete', 'care_workspace', 'care_delivery', 'complete', 'care_delivery.complete authorization gate', false),
  (gen_random_uuid(), 'patient.intent_tier.view', 'patient_registry', 'patient_intent_tier', 'view', 'patient.intent_tier.view authorization gate', true),
  (gen_random_uuid(), 'patient.intent_tier.edit', 'patient_registry', 'patient_intent_tier', 'edit', 'patient.intent_tier.edit authorization gate', true),
  (gen_random_uuid(), 'clinical_case.view', 'care_workspace', 'clinical_case', 'view', 'clinical_case.view authorization gate', false),
  (gen_random_uuid(), 'clinical_case.create', 'care_workspace', 'clinical_case', 'create', 'clinical_case.create authorization gate', false),
  (gen_random_uuid(), 'clinical_case.edit_state', 'care_workspace', 'clinical_case', 'edit_state', 'clinical_case.edit_state authorization gate', false),
  (gen_random_uuid(), 'clinical_case.correct_state', 'care_workspace', 'clinical_case', 'correct_state', 'clinical_case.correct_state authorization gate', true),
  (gen_random_uuid(), 'case_consultation.finalize', 'care_workspace', 'case_consultation', 'finalize', 'case_consultation.finalize authorization gate', false),
  (gen_random_uuid(), 'treatment_bundle.manage', 'care_workspace', 'treatment_bundle', 'manage', 'treatment_bundle.manage authorization gate', false),
  (gen_random_uuid(), 'analytics.conversion.view', 'deep_analytics', 'conversion_intelligence', 'view', 'analytics.conversion.view authorization gate', true),
  (gen_random_uuid(), 'clinical_note.create', 'care_workspace', 'clinical_note', 'create', 'clinical_note.create authorization gate', false),
  (gen_random_uuid(), 'clinical_note.edit_own', 'care_workspace', 'clinical_note', 'edit_own', 'clinical_note.edit_own authorization gate', false),
  (gen_random_uuid(), 'clinical_note.delete_draft', 'care_workspace', 'clinical_note', 'delete_draft', 'clinical_note.delete_draft authorization gate', false),
  (gen_random_uuid(), 'medication_order.view', 'medication_orders', 'medication_order', 'view', 'medication_order.view authorization gate', false),
  (gen_random_uuid(), 'medication_order.create', 'medication_orders', 'medication_order', 'create', 'medication_order.create authorization gate', false),
  (gen_random_uuid(), 'medication_order.edit_draft', 'medication_orders', 'medication_order', 'edit_draft', 'medication_order.edit_draft authorization gate', false),
  (gen_random_uuid(), 'medication_order.void', 'medication_orders', 'medication_order', 'void', 'medication_order.void authorization gate', true),
  (gen_random_uuid(), 'medication_order.sign', 'medication_orders', 'medication_order', 'sign', 'medication_order.sign authorization gate', true),
  (gen_random_uuid(), 'fee_statement.view', 'financial_operations', 'fee_statement', 'view', 'fee_statement.view authorization gate', false),
  (gen_random_uuid(), 'fee_statement.create', 'financial_operations', 'fee_statement', 'create', 'fee_statement.create authorization gate', false),
  (gen_random_uuid(), 'fee_statement.edit_draft', 'financial_operations', 'fee_statement', 'edit_draft', 'fee_statement.edit_draft authorization gate', false),
  (gen_random_uuid(), 'fee_statement.issue', 'financial_operations', 'fee_statement', 'issue', 'fee_statement.issue authorization gate', false),
  (gen_random_uuid(), 'fee_statement.discount', 'financial_operations', 'fee_statement', 'discount', 'fee_statement.discount authorization gate', false),
  (gen_random_uuid(), 'fee_statement.void', 'financial_operations', 'fee_statement', 'void', 'fee_statement.void authorization gate', true),
  (gen_random_uuid(), 'fee_statement.print', 'financial_operations', 'fee_statement', 'print', 'fee_statement.print authorization gate', false),
  (gen_random_uuid(), 'collection.view', 'financial_operations', 'collection_receipt', 'view', 'collection.view authorization gate', false),
  (gen_random_uuid(), 'collection.create', 'financial_operations', 'collection_receipt', 'create', 'collection.create authorization gate', false),
  (gen_random_uuid(), 'collection.edit_reference', 'financial_operations', 'collection_receipt', 'edit_reference', 'collection.edit_reference authorization gate', false),
  (gen_random_uuid(), 'fee_allocation.create', 'financial_operations', 'fee_allocation', 'create', 'fee_allocation.create authorization gate', false),
  (gen_random_uuid(), 'fee_allocation.reverse', 'financial_operations', 'fee_allocation', 'reverse', 'fee_allocation.reverse authorization gate', false),
  (gen_random_uuid(), 'collection.refund', 'financial_operations', 'collection_receipt', 'refund', 'collection.refund authorization gate', true),
  (gen_random_uuid(), 'collection.void', 'financial_operations', 'collection_receipt', 'void', 'collection.void authorization gate', true),
  (gen_random_uuid(), 'collection.print', 'financial_operations', 'collection_receipt', 'print', 'collection.print authorization gate', false),
  (gen_random_uuid(), 'analytics.operational.view', 'deep_analytics', 'operational', 'view', 'analytics.operational.view authorization gate', false),
  (gen_random_uuid(), 'analytics.clinical.view', 'deep_analytics', 'clinical', 'view', 'analytics.clinical.view authorization gate', false),
  (gen_random_uuid(), 'analytics.financial.view', 'deep_analytics', 'financial', 'view', 'analytics.financial.view authorization gate', false),
  (gen_random_uuid(), 'analytics.inventory.view', 'deep_analytics', 'inventory', 'view', 'analytics.inventory.view authorization gate', false),
  (gen_random_uuid(), 'analytics.export', 'deep_analytics', 'report', 'export', 'analytics.export authorization gate', true),
  (gen_random_uuid(), 'analytics.print', 'deep_analytics', 'report', 'print', 'analytics.print authorization gate', false),
  (gen_random_uuid(), 'message.view', 'comms_center', 'message', 'view', 'message.view authorization gate', false),
  (gen_random_uuid(), 'message.send', 'comms_center', 'message', 'send', 'message.send authorization gate', false),
  (gen_random_uuid(), 'message.bulk_send', 'comms_center', 'message', 'bulk_send', 'message.bulk_send authorization gate', false),
  (gen_random_uuid(), 'document.view', 'patient_files', 'document', 'view', 'document.view authorization gate', false),
  (gen_random_uuid(), 'document.upload', 'patient_files', 'document', 'upload', 'document.upload authorization gate', false),
  (gen_random_uuid(), 'document.delete_draft', 'patient_files', 'document', 'delete_draft', 'document.delete_draft authorization gate', false),
  (gen_random_uuid(), 'expense.view', 'practice_assets', 'expense', 'view', 'expense.view authorization gate', false),
  (gen_random_uuid(), 'expense.create', 'practice_assets', 'expense', 'create', 'expense.create authorization gate', false),
  (gen_random_uuid(), 'expense.void', 'practice_assets', 'expense', 'void', 'expense.void authorization gate', true),
  (gen_random_uuid(), 'lab.view', 'laboratory_operations', 'lab_case', 'view', 'lab.view authorization gate', false),
  (gen_random_uuid(), 'lab.edit', 'laboratory_operations', 'lab_case', 'edit', 'lab.edit authorization gate', false),
  (gen_random_uuid(), 'inventory.view', 'inventory_control', 'stock', 'view', 'inventory.view authorization gate', false),
  (gen_random_uuid(), 'inventory.post', 'inventory_control', 'stock', 'post', 'inventory.post authorization gate', false),
  (gen_random_uuid(), 'inventory.negative_override', 'inventory_control', 'stock', 'negative_override', 'inventory.negative_override authorization gate', true),
  (gen_random_uuid(), 'configuration.practice.view', 'system_configuration', 'practice', 'view', 'configuration.practice.view authorization gate', false),
  (gen_random_uuid(), 'configuration.practice.edit', 'system_configuration', 'practice', 'edit', 'configuration.practice.edit authorization gate', false),
  (gen_random_uuid(), 'configuration.workforce.view', 'system_configuration', 'workforce', 'view', 'configuration.workforce.view authorization gate', false),
  (gen_random_uuid(), 'configuration.workforce.edit', 'system_configuration', 'workforce', 'edit', 'configuration.workforce.edit authorization gate', false),
  (gen_random_uuid(), 'security.user.create', 'security', 'user', 'create', 'security.user.create authorization gate', true),
  (gen_random_uuid(), 'security.user.edit', 'security', 'user', 'edit', 'security.user.edit authorization gate', true),
  (gen_random_uuid(), 'security.user.disable', 'security', 'user', 'disable', 'security.user.disable authorization gate', true),
  (gen_random_uuid(), 'security.role.manage', 'security', 'role', 'manage', 'security.role.manage authorization gate', true),
  (gen_random_uuid(), 'security.permission.override', 'security', 'permission', 'override', 'security.permission.override authorization gate', true),
  (gen_random_uuid(), 'configuration.numbering.edit', 'system_configuration', 'numbering_policy', 'edit', 'configuration.numbering.edit authorization gate', false),
  (gen_random_uuid(), 'backup.run', 'data_operations', 'backup', 'run', 'backup.run authorization gate', true),
  (gen_random_uuid(), 'audit.view', 'security', 'audit', 'view', 'audit.view authorization gate', true);
```

## Medication Order Permission Separation

| Operation | Required permission | Additional invariant |
|---|---|---|
| View medication domains, active ingredients, catalog medications, administration patterns, diagnosis masters, service mappings, and medication protocols | `configuration.practice.view` | active organization and clinic membership |
| Create, edit, activate, retire, or reorder medication order master data | `configuration.practice.edit` | active protocol versions cannot be edited in place; protocols use draft, active, and retired versions |
| Open an existing medication order | `medication_order.view` | patient and encounter are inside the authorized clinic scope |
| Create a draft medication order and load an active protocol | `medication_order.create` | selected prescribing clinician is active at the encounter clinic |
| Edit diagnosis, recommended-service, or medication rows | `medication_order.edit_draft` | parent medication order status is `draft` |
| Save a medication order | `medication_order.create` | diagnosis, recommended-service, and medication rows are nonempty and all snapshots validate |
| Sign and lock a medication order | `medication_order.sign` | authenticated user is actively linked to `medication_orders.clinician_id`; canonical hash fields are supplied |
| Void a saved or signed medication order | `medication_order.void` | reason is mandatory; clinical rows and original signature remain immutable |

The browser never receives a master-data mutation route merely because it can create a medication_order. The authorization middleware resolves the operation-specific permission before loading the row and repeats organization, clinic, state, and staff-link checks inside the command transaction.

## Financial Separation Invariants

```sql
ALTER TABLE collection_tenders ADD CONSTRAINT ck_collection_tenders_positive CHECK (amount > 0);
ALTER TABLE fee_allocations ADD CONSTRAINT ck_fee_allocations_positive CHECK (amount > 0);
ALTER TABLE allocation_tender_splits ADD CONSTRAINT ck_allocation_tender_splits_positive CHECK (amount > 0);
ALTER TABLE allocation_fee_line_splits ADD CONSTRAINT ck_allocation_fee_line_splits_positive CHECK (amount > 0);
ALTER TABLE clinician_value_allocations ADD CONSTRAINT ck_clinician_value_allocations_positive CHECK (amount > 0);
ALTER TABLE journal_lines ADD CONSTRAINT ck_journal_lines_one_side CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0));
```

The posting service must enforce these transaction-level equalities under row locks: collection receipt total equals tender total; application amount equals tender allocations; application amount equals fee statement-line allocations; application distribution equals both dimensions; active applications plus collection_refunds never exceed a collection receipt tender; active applications plus credits plus write-offs never exceed an issued Fee Statement; every journal entry has equal debit and credit totals.

## Triggered State Changes and Outbox Events

| Committed source change | Synchronous database change | Outbox event | Worker consequence |
|---|---|---|---|
| Patient created | patient serial consumed; clinic link and consent snapshot inserted | `patient.created` | welcome message eligibility evaluated |
| Care Booking saved | interval constraints checked; status history inserted | `care_booking.created` or `care_booking.updated` | reminder schedule recalculated |
| Care booking admitted | one encounter and one queue sequence created; care booking state updated | `care_encounter.created` and `care_encounter.status_changed` | Dashboard, Scheduler, and Clinical Queue projections refreshed |
| Clinical service completed with continuity | completion metadata, linked plan status, and one source-keyed continuity task commit together | `care_delivery.completed` | versioned SMS/WhatsApp reminder rows materialized after consent/template checks |
| Orthodontic adjustment completed | tracking assignment stores last encounter and next adjustment date; next recurring task inserted | `orthodontic_adjustment.completed` | monthly compliance projection and future reminders refreshed |
| Continuity schedule changed | reminder generation version increments; replaceable unsent messages cancelled | `continuity_task.schedule_changed` | complete new channel/offset schedule materialized |
| Medication protocol activated | draft diagnosis mappings, service mappings, medication lines, and administration-pattern links become an immutable version | `medication_protocol.activated` | type-ahead and recommendation caches evict the organization key |
| Medication Order saved | diagnosis, recommended-service, medication, administration-pattern, and protocol-version snapshots freeze under one encounter-bound parent | `medication_order.saved` | medication order-render creates the clinic-format artifact from the committed version |
| Medication Order signed | canonical clinical payload hash, signing user, signing time, and algorithm commit after permission and staff-link checks | `medication_order.signed` | medication order-render creates the signed artifact and invalidates the unsigned artifact |
| Medication Order voided | original clinical snapshots and any signature remain immutable; void actor, time, and reason are appended | `medication_order.voided` | rendered artifact gains VOID status without deleting the historical medication order |
| Fee Statement issued | number frozen; receivable journal posted | `fee_statement.issued` | production and due projections refreshed |
| Collection saved | one collection receipt and one tender posted; patient advance journal posted | `collection_receipt.created` | collection and unsettled projections refreshed |
| Collection applied | application dimensions posted; advance transferred to receivable | `fee_allocation.created` | applied, due, and unsettled projections refreshed |
| Refund posted | refund tender posted; cash/clearing reversal journal posted | `refund.posted` | refund and net-collection projections refreshed |
| Stock document posted | immutable stock movements inserted; balance projection updated | `stock.posted` | low-stock and expiry checks queued |
| Message provider webhook accepted | unique provider event inserted; monotonic message status applied | `message.status_changed` | delivery dashboard and batch totals refreshed |
| Inbound opt-out accepted | channel/purpose preferences updated; unsent matching messages suppressed | `communication.opted_out` | future continuity materialization and dispatch rechecks suppress the channel |

## Deployment Validation

A migration is rejected when a foreign key is unresolved, a required table is absent, a trigger name is duplicated, an audit trigger is missing from a mutable table, a permission code is duplicated, a care booking exclusion constraint is absent, or any financial invariant test in document 07 fails.

## Schema Fix Log

- `users.disabled_by`: `NOT NULL` in the pre-remediation contract -> nullable with `ck_users_disabled_pair`; an enabled or never-disabled user has no disabling actor, and actor/time must be absent or present together.
- `staff_user_links.unlinked_by`: `NOT NULL` -> nullable with `ck_staff_user_links_unlinked_pair`; an active link has not yet been unlinked.
- `patient_medical_responses.recorded_at`: nullable -> `NOT NULL DEFAULT clock_timestamp()`; the row is an already-recorded clinical response and `recorded_by` is mandatory.
- `patient_consents.captured_at`: nullable -> `NOT NULL DEFAULT clock_timestamp()`; the row is an already-captured consent decision and `captured_by` is mandatory.
- `patient_merge_events.merged_at`: nullable -> `NOT NULL DEFAULT clock_timestamp()`; the event row exists only after the merge and `merged_by` is mandatory.
- `encounter_state_events.changed_at`: nullable -> `NOT NULL DEFAULT clock_timestamp()`; the history row exists only after the transition and `changed_by` is mandatory.
- `odontogram_findings.recorded_at`: nullable -> `NOT NULL DEFAULT clock_timestamp()`; the finding row exists only after recording and `recorded_by` is mandatory.
- `care_plans.proposed_by`: `NOT NULL` -> nullable with `ck_care_plans_proposed_pair`; a draft plan may exist before proposal, while proposal actor/time must be set together.
- `clinical_cases.state_changed_by`: nullable retained with `ck_clinical_cases_state_actor`; only `applied_payment_future_encounter` and `eod_reconciliation` may omit a human actor.
- `clinical_case_state_events.changed_by`: nullable retained with `ck_clinical_case_state_events_actor`; only the two enumerated automated sources may omit a human actor.
- `lab_job_status_history.changed_at`: nullable -> `NOT NULL DEFAULT clock_timestamp()`; the history row exists only after the transition and `changed_by` is mandatory.
