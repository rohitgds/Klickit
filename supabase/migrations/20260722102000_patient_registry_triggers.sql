-- Generated from Blueprint 01 — patient registry audit triggers

SET search_path = dentos_data, dentos_runtime, public;

CREATE TRIGGER trg_patient_initials_touch BEFORE UPDATE ON dentos_data.patient_initials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_initials_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_initials FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_categories_touch BEFORE UPDATE ON dentos_data.patient_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_categories_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_categories FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_flags_touch BEFORE UPDATE ON dentos_data.patient_flags FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_flags_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_flags FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_occupations_touch BEFORE UPDATE ON dentos_data.occupations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_occupations_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.occupations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_document_series_touch BEFORE UPDATE ON dentos_data.document_series FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_document_series_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.document_series FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_document_number_reservations_touch BEFORE UPDATE ON dentos_data.document_number_reservations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_document_number_reservations_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.document_number_reservations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patients_touch BEFORE UPDATE ON dentos_data.patients FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patients_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patients FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_clinics_touch BEFORE UPDATE ON dentos_data.patient_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_clinics_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_clinics FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_contacts_touch BEFORE UPDATE ON dentos_data.patient_contacts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_contacts_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_contacts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_addresses_touch BEFORE UPDATE ON dentos_data.patient_addresses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_addresses_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_addresses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_family_links_touch BEFORE UPDATE ON dentos_data.patient_family_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_family_links_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_family_links FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_referral_sources_touch BEFORE UPDATE ON dentos_data.referral_sources FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_referral_sources_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.referral_sources FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_custom_field_definitions_touch BEFORE UPDATE ON dentos_data.custom_field_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_custom_field_definitions_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.custom_field_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_custom_field_values_touch BEFORE UPDATE ON dentos_data.patient_custom_field_values FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_custom_field_values_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_custom_field_values FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_medical_question_definitions_touch BEFORE UPDATE ON dentos_data.medical_question_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_medical_question_definitions_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.medical_question_definitions FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_medical_responses_touch BEFORE UPDATE ON dentos_data.patient_medical_responses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_medical_responses_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_medical_responses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_allergy_catalog_touch BEFORE UPDATE ON dentos_data.allergy_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_allergy_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.allergy_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_allergies_touch BEFORE UPDATE ON dentos_data.patient_allergies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_allergies_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_allergies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_consents_touch BEFORE UPDATE ON dentos_data.patient_consents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_consents_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_consents FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_merge_events_audit AFTER INSERT ON dentos_data.patient_merge_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_fee_schedules_touch BEFORE UPDATE ON dentos_data.fee_schedules FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_fee_schedules_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.fee_schedules FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();

