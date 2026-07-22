-- Generated from Blueprint 01 — treatment plans and prescriptions foundation (Milestone 6)

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.care_plans (
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

CREATE TABLE dentos_data.care_plan_stages (
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

CREATE TABLE dentos_data.care_plan_services (
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

CREATE TABLE dentos_data.clinical_cases (
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

CREATE TABLE dentos_data.case_consultations (
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

CREATE TABLE dentos_data.treatment_bundles (
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

CREATE TABLE dentos_data.treatment_bundle_services (
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

CREATE TABLE dentos_data.medication_domains (
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

CREATE TABLE dentos_data.active_ingredient_catalog (
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

CREATE TABLE dentos_data.administration_patterns (
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

CREATE TABLE dentos_data.medication_catalog (
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

CREATE TABLE dentos_data.medication_domain_links (
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

CREATE TABLE dentos_data.medication_ingredient_links (
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

CREATE TABLE dentos_data.allergy_ingredient_rules (
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

CREATE TABLE dentos_data.medication_protocols (
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

CREATE TABLE dentos_data.medication_protocol_lines (
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

CREATE TABLE dentos_data.medication_protocol_diagnosis_links (
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

CREATE TABLE dentos_data.medication_protocol_service_links (
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

CREATE TABLE dentos_data.medication_orders (
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

CREATE TABLE dentos_data.medication_order_diagnoses (
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

CREATE TABLE dentos_data.medication_order_service_links (
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

CREATE TABLE dentos_data.medication_order_lines (
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

CREATE TABLE dentos_data.clinic_settings (
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

