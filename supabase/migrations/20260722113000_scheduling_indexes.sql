-- Generated from Blueprint 01 — scheduling indexes

SET search_path = dentos_data, dentos_runtime, public;

CREATE INDEX ix_chairs_scope_lookup ON dentos_data.chairs (clinic_id, created_at, id);
CREATE INDEX ix_care_booking_reasons_scope_lookup ON dentos_data.care_booking_reasons (organization_id, created_at, id);
CREATE INDEX ix_staff_working_hours_scope_lookup ON dentos_data.staff_working_hours (clinic_id, created_at, id);
CREATE INDEX ix_chair_working_hours_scope_lookup ON dentos_data.chair_working_hours (created_at, id);
CREATE INDEX ix_resource_blackouts_scope_lookup ON dentos_data.resource_blackouts (clinic_id, status, created_at, id);
CREATE INDEX ix_care_bookings_scope_lookup ON dentos_data.care_bookings (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_care_booking_state_events_scope_lookup ON dentos_data.care_booking_state_events (created_at, id);
CREATE INDEX ix_care_encounters_scope_lookup ON dentos_data.care_encounters (organization_id, clinic_id, patient_id, status);
CREATE INDEX ix_encounter_state_events_scope_lookup ON dentos_data.encounter_state_events (created_at, id);
CREATE INDEX ix_care_bookings_clinic_start_clinician ON dentos_data.care_bookings (clinic_id, starts_at, lead_clinician_id, status);
CREATE INDEX ix_care_bookings_clinic_start_chair ON dentos_data.care_bookings (clinic_id, starts_at, chair_id, status);
CREATE INDEX ix_care_bookings_ortho_tracking_start ON dentos_data.care_bookings (orthodontic_program_enrollment_id, starts_at, status, id) WHERE orthodontic_program_enrollment_id IS NOT NULL;
CREATE INDEX ix_care_bookings_terminal_month_clinician ON dentos_data.care_bookings (clinic_id, starts_at, lead_clinician_id, status, id) INCLUDE (cancelled_at, cancelled_by, no_show_marked_at, no_show_marked_by) WHERE status IN ('cancelled','no_show');
CREATE INDEX ix_care_booking_state_events_latest ON dentos_data.care_booking_state_events (care_booking_id, sequence_no DESC) INCLUDE (from_status, to_status, changed_at, changed_by, reason);
CREATE INDEX ix_care_booking_state_events_terminal_changed ON dentos_data.care_booking_state_events (to_status, changed_at, care_booking_id, changed_by) INCLUDE (from_status, reason) WHERE to_status IN ('cancelled','no_show');
CREATE INDEX ix_visits_clinical_queue ON dentos_data.care_encounters (clinic_id, encounter_date, status, queue_sequence);
CREATE INDEX ix_care_encounters_patient_clinic_date ON dentos_data.care_encounters (patient_id, clinic_id, encounter_date, status, id) INCLUDE (checked_in_at, lead_clinician_id);

