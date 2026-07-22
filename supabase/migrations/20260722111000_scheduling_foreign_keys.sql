-- Generated from Blueprint 01 — scheduling foreign keys

SET search_path = dentos_data, dentos_runtime, public;

ALTER TABLE dentos_data.chairs ADD CONSTRAINT fk_chairs_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.chairs ADD CONSTRAINT fk_chairs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.chairs ADD CONSTRAINT fk_chairs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_booking_reasons ADD CONSTRAINT fk_care_booking_reasons_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_booking_reasons ADD CONSTRAINT fk_care_booking_reasons_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_booking_reasons ADD CONSTRAINT fk_care_booking_reasons_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.staff_working_hours ADD CONSTRAINT fk_staff_working_hours_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.staff_working_hours ADD CONSTRAINT fk_staff_working_hours_staff_id FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.staff_working_hours ADD CONSTRAINT fk_staff_working_hours_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.staff_working_hours ADD CONSTRAINT fk_staff_working_hours_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.chair_working_hours ADD CONSTRAINT fk_chair_working_hours_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.chair_working_hours ADD CONSTRAINT fk_chair_working_hours_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.chair_working_hours ADD CONSTRAINT fk_chair_working_hours_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.resource_blackouts ADD CONSTRAINT fk_resource_blackouts_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.resource_blackouts ADD CONSTRAINT fk_resource_blackouts_clinician_id FOREIGN KEY (clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.resource_blackouts ADD CONSTRAINT fk_resource_blackouts_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.resource_blackouts ADD CONSTRAINT fk_resource_blackouts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.resource_blackouts ADD CONSTRAINT fk_resource_blackouts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_lead_clinician_id FOREIGN KEY (lead_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_reason_id FOREIGN KEY (reason_id) REFERENCES care_booking_reasons(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_no_show_marked_by FOREIGN KEY (no_show_marked_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_bookings ADD CONSTRAINT fk_care_bookings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_booking_state_events ADD CONSTRAINT fk_care_booking_state_events_care_booking_id FOREIGN KEY (care_booking_id) REFERENCES care_bookings(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_booking_state_events ADD CONSTRAINT fk_care_booking_state_events_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_booking_state_events ADD CONSTRAINT fk_care_booking_state_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_organization_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_clinic_id FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_care_booking_id FOREIGN KEY (care_booking_id) REFERENCES care_bookings(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_lead_clinician_id FOREIGN KEY (lead_clinician_id) REFERENCES staff(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_chair_id FOREIGN KEY (chair_id) REFERENCES chairs(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_reason_id FOREIGN KEY (reason_id) REFERENCES care_booking_reasons(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.care_encounters ADD CONSTRAINT fk_care_encounters_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.encounter_state_events ADD CONSTRAINT fk_encounter_state_events_care_encounter_id FOREIGN KEY (care_encounter_id) REFERENCES care_encounters(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.encounter_state_events ADD CONSTRAINT fk_encounter_state_events_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE dentos_data.encounter_state_events ADD CONSTRAINT fk_encounter_state_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

