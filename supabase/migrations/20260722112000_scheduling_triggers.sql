-- Generated from Blueprint 01 — scheduling audit triggers

SET search_path = dentos_data, dentos_runtime, public;

CREATE TRIGGER trg_chairs_touch BEFORE UPDATE ON dentos_data.chairs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_chairs_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.chairs FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_booking_reasons_touch BEFORE UPDATE ON dentos_data.care_booking_reasons FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_booking_reasons_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.care_booking_reasons FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_staff_working_hours_touch BEFORE UPDATE ON dentos_data.staff_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_staff_working_hours_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.staff_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_chair_working_hours_touch BEFORE UPDATE ON dentos_data.chair_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_chair_working_hours_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.chair_working_hours FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_resource_blackouts_touch BEFORE UPDATE ON dentos_data.resource_blackouts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_resource_blackouts_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.resource_blackouts FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_bookings_touch BEFORE UPDATE ON dentos_data.care_bookings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_bookings_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.care_bookings FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_booking_state_events_audit AFTER INSERT ON dentos_data.care_booking_state_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_care_encounters_touch BEFORE UPDATE ON dentos_data.care_encounters FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_care_encounters_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.care_encounters FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_encounter_state_events_audit AFTER INSERT ON dentos_data.encounter_state_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();

