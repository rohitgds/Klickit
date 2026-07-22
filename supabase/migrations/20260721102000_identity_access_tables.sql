-- Generated from Blueprint 01 — Phase 1 identity and access tables

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.organizations (
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

CREATE TABLE dentos_data.clinics (
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

CREATE TABLE dentos_data.users (
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

CREATE TABLE dentos_data.user_credentials (
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

CREATE TABLE dentos_data.password_reset_tokens (
  id uuid NOT NULL CONSTRAINT pk_password_reset_tokens PRIMARY KEY,
  user_id uuid NOT NULL,
  token_hash character varying NOT NULL CONSTRAINT uq_password_reset_tokens_token_hash UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  created_by uuid
);

CREATE TABLE dentos_data.user_sessions (
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

CREATE TABLE dentos_data.staff (
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

CREATE TABLE dentos_data.staff_clinics (
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

CREATE TABLE dentos_data.staff_user_links (
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

CREATE TABLE dentos_data.clinic_memberships (
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

CREATE TABLE dentos_data.roles (
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

CREATE TABLE dentos_data.permissions (
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

CREATE TABLE dentos_data.role_permissions (
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

CREATE TABLE dentos_data.membership_roles (
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

CREATE TABLE dentos_data.membership_permission_overrides (
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

