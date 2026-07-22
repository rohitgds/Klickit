-- Generated from Blueprint 01 — clinical workspace and files foundation (Milestone 5)

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.service_domains (
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

CREATE TABLE dentos_data.service_catalog (
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

CREATE TABLE dentos_data.diagnosis_catalog (
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

CREATE TABLE dentos_data.odontogram_findings (
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

CREATE TABLE dentos_data.encounter_diagnoses (
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

CREATE TABLE dentos_data.encounter_service_recommendations (
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

CREATE TABLE dentos_data.care_deliveries (
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

CREATE TABLE dentos_data.clinical_notes (
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

CREATE TABLE dentos_data.files (
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

CREATE TABLE dentos_data.patient_files (
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

