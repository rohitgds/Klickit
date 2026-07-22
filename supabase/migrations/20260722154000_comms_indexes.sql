-- Generated from Blueprint 01 — communications indexes

SET search_path = dentos_data, dentos_runtime, public;

CREATE INDEX ix_continuity_policies_scope_lookup ON dentos_data.continuity_policies (organization_id, created_at, id);
CREATE INDEX ix_continuity_recall_records_scope_lookup ON dentos_data.continuity_recall_records (clinic_id, patient_id, status, created_at);
CREATE INDEX ix_continuity_tasks_scope_lookup ON dentos_data.continuity_tasks (patient_id, status, created_at, id);
CREATE INDEX ix_communication_preferences_scope_lookup ON dentos_data.communication_preferences (patient_id, status, created_at, id);
CREATE INDEX ix_message_templates_scope_lookup ON dentos_data.message_templates (organization_id, created_at, id);
CREATE INDEX ix_message_batches_scope_lookup ON dentos_data.message_batches (clinic_id, status, created_at, id);
CREATE INDEX ix_outbound_messages_scope_lookup ON dentos_data.outbound_messages (patient_id, status, created_at, id);
CREATE INDEX ix_message_status_events_scope_lookup ON dentos_data.message_status_events (created_at, id);
CREATE INDEX ix_inbound_messages_scope_lookup ON dentos_data.inbound_messages (patient_id, created_at, id);
CREATE INDEX ix_continuity_tasks_due_dispatch ON dentos_data.continuity_tasks (clinic_id, status, due_at, id) WHERE status IN ('scheduled','due','snoozed');
CREATE INDEX ix_continuity_tasks_source_service ON dentos_data.continuity_tasks (care_delivery_id, status, id) WHERE care_delivery_id IS NOT NULL;
CREATE INDEX ix_outbound_messages_queue ON dentos_data.outbound_messages (clinic_id, status, scheduled_at, id);
CREATE INDEX ix_outbound_messages_continuity_schedule ON dentos_data.outbound_messages (continuity_task_id, channel, scheduled_at, status, id) WHERE continuity_task_id IS NOT NULL;

