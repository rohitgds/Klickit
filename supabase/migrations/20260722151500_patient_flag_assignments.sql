-- Milestone 8 prerequisite — patient flag assignments referenced by continuity tasks

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.patient_flag_assignments (
  id uuid NOT NULL CONSTRAINT pk_patient_flag_assignments PRIMARY KEY,
  patient_id uuid NOT NULL,
  flag_id uuid NOT NULL,
  clinic_id uuid,
  tracking_program character varying NOT NULL DEFAULT 'clinical_flag' CONSTRAINT ck_patient_flag_assignments_tracking_program CHECK (tracking_program IN ('clinical_flag','orthodontic_monthly')),
  program_status character varying NOT NULL DEFAULT 'active' CONSTRAINT ck_patient_flag_assignments_program_status CHECK (program_status IN ('active','paused','completed','cancelled')),
  enrolled_on date,
  enrolled_by uuid,
  treating_clinician_id uuid,
  source_care_plan_id uuid,
  source_care_plan_service_id uuid,
  expected_encounter_interval_months smallint,
  preferred_day_of_month smallint,
  next_adjustment_due_date date,
  appliance_type character varying,
  orthodontic_stage character varying,
  current_wire character varying,
  default_adjustment_service_id uuid,
  last_adjustment_care_encounter_id uuid,
  ended_on date,
  ended_by uuid,
  end_reason character varying,
  notes character varying,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT ck_patient_flag_assignments_preferred_day CHECK (preferred_day_of_month IS NULL OR preferred_day_of_month BETWEEN 1 AND 28),
  CONSTRAINT ck_patient_flag_assignments_ortho_interval CHECK (expected_encounter_interval_months IS NULL OR expected_encounter_interval_months BETWEEN 1 AND 24),
  CONSTRAINT ck_patient_flag_assignments_program_dates CHECK (ended_on IS NULL OR enrolled_on IS NULL OR ended_on >= enrolled_on),
  CONSTRAINT ck_patient_flag_assignments_program_shape CHECK (
    (tracking_program = 'clinical_flag'
      AND program_status = 'active'
      AND clinic_id IS NULL
      AND enrolled_on IS NULL
      AND enrolled_by IS NULL
      AND treating_clinician_id IS NULL
      AND source_care_plan_id IS NULL
      AND source_care_plan_service_id IS NULL
      AND expected_encounter_interval_months IS NULL
      AND preferred_day_of_month IS NULL
      AND next_adjustment_due_date IS NULL
      AND appliance_type IS NULL
      AND orthodontic_stage IS NULL
      AND current_wire IS NULL
      AND default_adjustment_service_id IS NULL
      AND last_adjustment_care_encounter_id IS NULL)
    OR
    (tracking_program = 'orthodontic_monthly'
      AND clinic_id IS NOT NULL
      AND enrolled_on IS NOT NULL
      AND enrolled_by IS NOT NULL
      AND treating_clinician_id IS NOT NULL
      AND expected_encounter_interval_months IS NOT NULL
      AND next_adjustment_due_date IS NOT NULL
      AND default_adjustment_service_id IS NOT NULL)
  ),
  CONSTRAINT ck_patient_flag_assignments_program_closure CHECK (
    (program_status IN ('active','paused') AND ended_on IS NULL AND ended_by IS NULL AND end_reason IS NULL)
    OR
    (program_status IN ('completed','cancelled') AND ended_on IS NOT NULL AND ended_by IS NOT NULL AND NULLIF(BTRIM(end_reason), '') IS NOT NULL)
  )
);

ALTER TABLE dentos_data.patient_flag_assignments
  ADD CONSTRAINT fk_patient_flag_assignments_patient_id
  FOREIGN KEY (patient_id) REFERENCES dentos_data.patients(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.patient_flag_assignments
  ADD CONSTRAINT fk_patient_flag_assignments_flag_id
  FOREIGN KEY (flag_id) REFERENCES dentos_data.patient_flags(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE dentos_data.patient_flag_assignments
  ADD CONSTRAINT fk_patient_flag_assignments_clinic_id
  FOREIGN KEY (clinic_id) REFERENCES dentos_data.clinics(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;
