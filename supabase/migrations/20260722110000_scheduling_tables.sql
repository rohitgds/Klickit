-- Generated from Blueprint 01 — scheduler and clinical queue foundation (Milestone 4)

SET search_path = dentos_data, dentos_runtime, public;

CREATE TABLE dentos_data.chairs (
  id uuid NOT NULL CONSTRAINT pk_chairs PRIMARY KEY,
  clinic_id uuid NOT NULL,
  code character varying,
  name character varying,
  display_order integer NOT NULL,
  active boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_chairs_clinic_id_code UNIQUE(clinic_id, code),
  CONSTRAINT uq_chairs_clinic_id_name UNIQUE(clinic_id, name)
);

CREATE TABLE dentos_data.care_booking_reasons (
  id uuid NOT NULL CONSTRAINT pk_care_booking_reasons PRIMARY KEY,
  organization_id uuid NOT NULL,
  name character varying,
  default_minutes integer,
  color_hex char(7),
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.staff_working_hours (
  id uuid NOT NULL CONSTRAINT pk_staff_working_hours PRIMARY KEY,
  clinic_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  weekday smallint,
  starts_local time,
  ends_local time,
  effective_from date,
  effective_to date,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.chair_working_hours (
  id uuid NOT NULL CONSTRAINT pk_chair_working_hours PRIMARY KEY,
  chair_id uuid NOT NULL,
  weekday smallint,
  starts_local time,
  ends_local time,
  effective_from date,
  effective_to date,
  active boolean,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.resource_blackouts (
  id uuid NOT NULL CONSTRAINT pk_resource_blackouts PRIMARY KEY,
  clinic_id uuid NOT NULL,
  clinician_id uuid,
  chair_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason character varying,
  status character varying CONSTRAINT ck_resource_blackouts_status CHECK (status IN ('active','cancelled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.care_bookings (
  id uuid NOT NULL CONSTRAINT pk_care_bookings PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  care_booking_no character varying,
  patient_id uuid,
  patient_kind character varying CONSTRAINT ck_care_bookings_patient_kind CHECK (patient_kind IN ('new','established')),
  first_name_snapshot character varying,
  last_name_snapshot character varying,
  cell_phone_snapshot character varying,
  email_snapshot character varying,
  age_snapshot smallint,
  sex_snapshot character varying,
  starts_at timestamptz,
  ends_at timestamptz,
  lead_clinician_id uuid NOT NULL,
  chair_id uuid NOT NULL,
  reason_id uuid NOT NULL,
  orthodontic_program_enrollment_id uuid,
  comments character varying,
  notify_patient_sms boolean,
  notify_patient_whatsapp boolean,
  notify_clinician boolean,
  status dentos_data.care_booking_state NOT NULL DEFAULT 'scheduled',
  source character varying,
  cancellation_reason character varying,
  cancelled_at timestamptz,
  cancelled_by uuid,
  no_show_reason character varying,
  no_show_marked_at timestamptz,
  no_show_marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1
);

CREATE TABLE dentos_data.care_booking_state_events (
  id uuid NOT NULL CONSTRAINT pk_care_booking_state_events PRIMARY KEY,
  care_booking_id uuid NOT NULL,
  sequence_no bigint NOT NULL CONSTRAINT ck_care_booking_state_events_sequence_no CHECK (sequence_no >= 1),
  from_status dentos_data.care_booking_state,
  to_status dentos_data.care_booking_state NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid NOT NULL,
  reason character varying NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  CONSTRAINT ck_care_booking_state_events_reason CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  CONSTRAINT uq_care_booking_state_events_care_booking_sequence UNIQUE(care_booking_id, sequence_no)
);

CREATE TABLE dentos_data.care_encounters (
  id uuid NOT NULL CONSTRAINT pk_care_encounters PRIMARY KEY,
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  encounter_no character varying,
  encounter_date date NOT NULL,
  queue_sequence integer NOT NULL,
  patient_id uuid NOT NULL,
  care_booking_id uuid,
  encounter_type character varying CONSTRAINT ck_care_encounters_encounter_type CHECK (encounter_type IN ('care_booking','unscheduled','direct_patient')),
  lead_clinician_id uuid NOT NULL,
  chair_id uuid,
  reason_id uuid NOT NULL,
  scheduled_time time,
  arrival_at timestamptz,
  checked_in_at timestamptz,
  engaged_at timestamptz,
  checked_out_at timestamptz,
  status dentos_data.encounter_flow_state,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT uq_care_encounters_clinic_id_encounter_date_queue_seq UNIQUE(clinic_id, encounter_date, queue_sequence),
  CONSTRAINT uq_care_encounters_care_booking_id UNIQUE(care_booking_id)
);

CREATE TABLE dentos_data.encounter_state_events (
  id uuid NOT NULL CONSTRAINT pk_encounter_state_events PRIMARY KEY,
  care_encounter_id uuid NOT NULL,
  from_status character varying,
  to_status character varying,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  changed_by uuid NOT NULL,
  reason character varying,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid
);

