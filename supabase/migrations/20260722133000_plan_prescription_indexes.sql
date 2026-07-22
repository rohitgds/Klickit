-- Generated from Blueprint 01 — plan and prescription indexes

SET search_path = dentos_data, dentos_runtime, public;

CREATE INDEX ix_clinic_settings_scope_lookup ON dentos_data.clinic_settings (organization_id, clinic_id, created_at, id);
CREATE INDEX ix_medication_domains_scope_lookup ON dentos_data.medication_domains (organization_id, created_at, id);
CREATE INDEX ix_care_plans_scope_lookup ON dentos_data.care_plans (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_care_plan_stages_scope_lookup ON dentos_data.care_plan_stages (status, created_at, id);
CREATE INDEX ix_care_plan_services_scope_lookup ON dentos_data.care_plan_services (status, created_at, id);
CREATE INDEX ix_active_ingredient_catalog_scope_lookup ON dentos_data.active_ingredient_catalog (organization_id, created_at, id);
CREATE INDEX ix_medication_catalog_scope_lookup ON dentos_data.medication_catalog (organization_id, created_at, id);
CREATE INDEX ix_administration_patterns_scope_lookup ON dentos_data.administration_patterns (organization_id, created_at, id);
CREATE INDEX ix_medication_domain_links_scope_lookup ON dentos_data.medication_domain_links (medication_id, active, sequence_no, id);
CREATE INDEX ix_medication_ingredient_links_scope_lookup ON dentos_data.medication_ingredient_links (medication_id, active, sequence_no, id);
CREATE INDEX ix_allergy_ingredient_rules_scope_lookup ON dentos_data.allergy_ingredient_rules (allergy_id, active, interaction_level, active_ingredient_id);
CREATE INDEX ix_medication_protocols_scope_lookup ON dentos_data.medication_protocols (organization_id, created_at, id);
CREATE INDEX ix_medication_protocol_lines_scope_lookup ON dentos_data.medication_protocol_lines (medication_protocol_id, active, sequence_no, id);
CREATE INDEX ix_medication_protocol_diagnosis_links_scope_lookup ON dentos_data.medication_protocol_diagnosis_links (diagnosis_id, medication_protocol_id, autoload, sequence_no);
CREATE INDEX ix_medication_protocol_service_links_scope_lookup ON dentos_data.medication_protocol_service_links (service_id, medication_protocol_id, autoload, sequence_no);
CREATE INDEX ix_medication_orders_scope_lookup ON dentos_data.medication_orders (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_medication_order_diagnoses_scope_lookup ON dentos_data.medication_order_diagnoses (medication_order_id, sequence_no, id);
CREATE INDEX ix_medication_order_service_links_scope_lookup ON dentos_data.medication_order_service_links (medication_order_id, sequence_no, id);
CREATE INDEX ix_medication_order_lines_scope_lookup ON dentos_data.medication_order_lines (created_at, id);
CREATE INDEX ix_clinical_cases_pipeline ON dentos_data.clinical_cases (clinic_id, execution_state, intent_tier_snapshot, created_at, id);
CREATE INDEX ix_clinical_cases_patient_state ON dentos_data.clinical_cases (patient_id, execution_state, state_changed_at DESC, id);
CREATE INDEX ix_case_consultations_month_primary ON dentos_data.case_consultations (consulted_at, primary_consult_clinician_id, status, clinical_case_id) WHERE consultation_kind = 'initial' AND status = 'finalized';
CREATE INDEX ix_case_consultations_month_secondary ON dentos_data.case_consultations (consulted_at, secondary_review_clinician_id, status, clinical_case_id) WHERE consultation_kind = 'initial' AND status = 'finalized';
CREATE INDEX ix_treatment_bundles_pending_month ON dentos_data.treatment_bundles (target_start_date, bundle_tier, status, clinical_case_id) WHERE bundle_tier IN ('primary','secondary') AND status IN ('advised','accepted','scheduled','in_progress');
CREATE INDEX ix_treatment_bundle_services_domain_case ON dentos_data.treatment_bundle_services (service_domain_id_snapshot, treatment_bundle_id, line_state, care_plan_service_id);
CREATE INDEX ix_medication_ingredient_links_generic_medication ON dentos_data.medication_ingredient_links (active_ingredient_id, medication_id, sequence_no) WHERE active = true;
CREATE INDEX ix_allergy_ingredient_rules_generic_allergy ON dentos_data.allergy_ingredient_rules (active_ingredient_id, allergy_id, interaction_level) WHERE active = true;
CREATE INDEX ix_medication_protocol_diagnosis_links_recommend ON dentos_data.medication_protocol_diagnosis_links (diagnosis_id, autoload, match_weight DESC, medication_protocol_id);
CREATE INDEX ix_medication_protocol_service_links_recommend ON dentos_data.medication_protocol_service_links (service_id, autoload, match_weight DESC, medication_protocol_id);
CREATE INDEX ix_medication_orders_encounter_date ON dentos_data.medication_orders (care_encounter_id, medication_order_date DESC, created_at DESC, id);
CREATE INDEX ix_medication_order_lines_medication_order_sequence ON dentos_data.medication_order_lines (medication_order_id, sequence_no, id);

