-- Generated from Blueprint 01 — clinical audit triggers

SET search_path = dentos_data, dentos_runtime, public;

CREATE TRIGGER trg_service_domains_touch BEFORE UPDATE ON dentos_data.service_domains FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_service_domains_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.service_domains FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_diagnosis_catalog_touch BEFORE UPDATE ON dentos_data.diagnosis_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_diagnosis_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.diagnosis_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_service_catalog_touch BEFORE UPDATE ON dentos_data.service_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_service_catalog_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.service_catalog FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_odontogram_findings_touch BEFORE UPDATE ON dentos_data.odontogram_findings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_odontogram_findings_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.odontogram_findings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_deliveries_touch BEFORE UPDATE ON dentos_data.care_deliveries FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_deliveries_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.care_deliveries FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_clinical_notes_touch BEFORE UPDATE ON dentos_data.clinical_notes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_clinical_notes_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.clinical_notes FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_files_touch BEFORE UPDATE ON dentos_data.files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_files_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_patient_files_touch BEFORE UPDATE ON dentos_data.patient_files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_patient_files_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.patient_files FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_encounter_diagnoses_touch BEFORE UPDATE ON dentos_data.encounter_diagnoses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_encounter_diagnoses_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.encounter_diagnoses FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_encounter_service_recommendations_touch BEFORE UPDATE ON dentos_data.encounter_service_recommendations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_encounter_service_recommendations_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.encounter_service_recommendations FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();

