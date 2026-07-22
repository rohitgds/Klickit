-- Generated from Blueprint 01 — communications audit triggers

SET search_path = dentos_data, dentos_runtime, public;

CREATE TRIGGER trg_continuity_policies_touch BEFORE UPDATE ON dentos_data.continuity_policies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_continuity_policies_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.continuity_policies FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_continuity_recall_records_touch BEFORE UPDATE ON dentos_data.continuity_recall_records FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_continuity_recall_records_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.continuity_recall_records FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_continuity_tasks_touch BEFORE UPDATE ON dentos_data.continuity_tasks FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_continuity_tasks_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.continuity_tasks FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_communication_preferences_touch BEFORE UPDATE ON dentos_data.communication_preferences FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_communication_preferences_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.communication_preferences FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_message_templates_touch BEFORE UPDATE ON dentos_data.message_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_message_templates_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.message_templates FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_message_batches_touch BEFORE UPDATE ON dentos_data.message_batches FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_message_batches_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.message_batches FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_outbound_messages_touch BEFORE UPDATE ON dentos_data.outbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_outbound_messages_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.outbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_message_status_events_audit AFTER INSERT ON dentos_data.message_status_events FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();
CREATE TRIGGER trg_inbound_messages_touch BEFORE UPDATE ON dentos_data.inbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.touch_mutable_row();
CREATE TRIGGER trg_inbound_messages_audit AFTER INSERT OR UPDATE OR DELETE ON dentos_data.inbound_messages FOR EACH ROW EXECUTE FUNCTION dentos_runtime.write_audit_event();

