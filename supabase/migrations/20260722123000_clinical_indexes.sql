-- Generated from Blueprint 01 — clinical indexes

SET search_path = dentos_data, dentos_runtime, public;

CREATE INDEX ix_service_domains_scope_lookup ON dentos_data.service_domains (organization_id, created_at, id);
CREATE INDEX ix_diagnosis_catalog_scope_lookup ON dentos_data.diagnosis_catalog (organization_id, active, display_order, id);
CREATE INDEX ix_service_catalog_scope_lookup ON dentos_data.service_catalog (organization_id, created_at, id);
CREATE INDEX ix_odontogram_findings_scope_lookup ON dentos_data.odontogram_findings (patient_id, status, created_at, id);
CREATE INDEX ix_care_deliveries_scope_lookup ON dentos_data.care_deliveries (patient_id, status, created_at, id);
CREATE INDEX ix_clinical_notes_scope_lookup ON dentos_data.clinical_notes (patient_id, status, created_at, id);
CREATE INDEX ix_files_scope_lookup ON dentos_data.files (organization_id, created_at, id);
CREATE INDEX ix_patient_files_scope_lookup ON dentos_data.patient_files (patient_id, created_at, id);
CREATE INDEX ix_encounter_diagnoses_scope_lookup ON dentos_data.encounter_diagnoses (care_encounter_id, status, diagnosed_at, id);
CREATE INDEX ix_encounter_service_recommendations_scope_lookup ON dentos_data.encounter_service_recommendations (care_encounter_id, status, suggested_at, id);
CREATE INDEX ix_care_deliveries_ortho_tracking_visit ON dentos_data.care_deliveries (orthodontic_program_enrollment_id, care_encounter_id, status, completed_at) WHERE orthodontic_program_enrollment_id IS NOT NULL;
CREATE INDEX ix_service_domains_high_value ON dentos_data.service_domains (organization_id, high_value, active, id) WHERE high_value = true AND active = true;

