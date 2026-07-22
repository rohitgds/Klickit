-- Generated from Blueprint 01 — patient registry indexes

SET search_path = dentos_data, dentos_runtime, public;

CREATE INDEX ix_patient_initials_scope_lookup ON dentos_data.patient_initials (organization_id, created_at, id);
CREATE INDEX ix_patient_categories_scope_lookup ON dentos_data.patient_categories (organization_id, created_at, id);
CREATE INDEX ix_patient_flags_scope_lookup ON dentos_data.patient_flags (organization_id, created_at, id);
CREATE INDEX ix_occupations_scope_lookup ON dentos_data.occupations (organization_id, created_at, id);
CREATE INDEX ix_document_series_scope_lookup ON dentos_data.document_series (organization_id, clinic_id, created_at, id);
CREATE INDEX ix_document_number_reservations_scope_lookup ON dentos_data.document_number_reservations (status, created_at, id);
CREATE INDEX ix_patients_scope_lookup ON dentos_data.patients (organization_id, created_at, id);
CREATE INDEX ix_patient_clinics_scope_lookup ON dentos_data.patient_clinics (clinic_id, patient_id, created_at);
CREATE INDEX ix_patient_contacts_scope_lookup ON dentos_data.patient_contacts (patient_id, created_at, id);
CREATE INDEX ix_patient_addresses_scope_lookup ON dentos_data.patient_addresses (patient_id, created_at, id);
CREATE INDEX ix_patient_family_links_scope_lookup ON dentos_data.patient_family_links (patient_id, created_at, id);
CREATE INDEX ix_referral_sources_scope_lookup ON dentos_data.referral_sources (organization_id, created_at, id);
CREATE INDEX ix_custom_field_definitions_scope_lookup ON dentos_data.custom_field_definitions (organization_id, created_at, id);
CREATE INDEX ix_patient_custom_field_values_scope_lookup ON dentos_data.patient_custom_field_values (patient_id, created_at, id);
CREATE INDEX ix_medical_question_definitions_scope_lookup ON dentos_data.medical_question_definitions (organization_id, created_at, id);
CREATE INDEX ix_patient_medical_responses_scope_lookup ON dentos_data.patient_medical_responses (patient_id, created_at, id);
CREATE INDEX ix_allergy_catalog_scope_lookup ON dentos_data.allergy_catalog (organization_id, created_at, id);
CREATE INDEX ix_patient_allergies_scope_lookup ON dentos_data.patient_allergies (patient_id, created_at, id);
CREATE INDEX ix_patient_consents_scope_lookup ON dentos_data.patient_consents (patient_id, created_at, id);
CREATE INDEX ix_patient_merge_events_scope_lookup ON dentos_data.patient_merge_events (created_at, id);
CREATE INDEX ix_fee_schedules_scope_lookup ON dentos_data.fee_schedules (organization_id, created_at, id);
CREATE INDEX ix_patients_intent_tier_pipeline ON dentos_data.patients (home_clinic_id, intent_tier, active, id);

