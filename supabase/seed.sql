-- Synthetic development seed only. No real patient data.

SET search_path = dentos_data, dentos_runtime, public;

INSERT INTO dentos_data.organizations (
  id, name, legal_name, timezone, country_code, active, created_at, updated_at
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'KlickIt Development Organization',
  'KlickIt Development Organization',
  'Asia/Kolkata',
  'IN',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.clinics (
  id, organization_id, clinic_code, name, timezone, active, created_at, updated_at
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'DEV',
  'Development Clinic',
  'Asia/Kolkata',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.roles (
  id, organization_id, code, name, system_role, active, created_at, updated_at
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'clinic_admin',
  'Clinic Admin',
  true,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.users (
  id, organization_id, login_name, display_name, status, created_at, updated_at
)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'dev.admin',
  'Development Admin',
  'active',
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.clinic_memberships (
  id, clinic_id, user_id, is_default, active, created_at, updated_at
)
VALUES (
  '66666666-6666-4666-8666-666666666666',
  '22222222-2222-4222-8222-222222222222',
  '55555555-5555-4555-8555-555555555555',
  true,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.membership_roles (
  membership_id, role_id, assigned_by, assigned_at, created_at, updated_at
)
VALUES (
  '66666666-6666-4666-8666-666666666666',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  clock_timestamp(),
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (membership_id, role_id) DO NOTHING;

INSERT INTO dentos_data.role_permissions (role_id, permission_id, granted_by, granted_at, created_at, updated_at)
SELECT '33333333-3333-4333-8333-333333333333', p.id, '55555555-5555-4555-8555-555555555555', clock_timestamp(), clock_timestamp(), clock_timestamp()
FROM dentos_data.permissions p
WHERE p.code IN (
  'patient.view',
  'patient.create',
  'patient.edit',
  'patient.merge',
  'configuration.practice.view',
  'configuration.workforce.view',
  'configuration.workforce.edit',
  'scheduler.view',
  'scheduler.create',
  'scheduler.edit',
  'scheduler.cancel',
  'scheduler.override',
  'queue.view',
  'queue.admit',
  'queue.engage',
  'queue.release',
  'queue.reopen',
  'clinical.view',
  'clinical.edit',
  'clinical.delete_draft',
  'document.view',
  'document.upload',
  'document.delete_draft',
  'care_plan.create',
  'care_plan.edit',
  'treatment_bundle.manage',
  'clinical_case.create',
  'medication_order.view',
  'medication_order.create',
  'medication_order.edit_draft',
  'medication_order.sign',
  'medication_order.void',
  'fee_statement.view',
  'fee_statement.create',
  'fee_statement.edit_draft',
  'fee_statement.issue',
  'fee_statement.discount',
  'fee_statement.print',
  'collection.view',
  'collection.create',
  'fee_allocation.create',
  'collection.refund',
  'analytics.financial.view',
  'audit.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO dentos_data.staff (
  id, organization_id, display_name, staff_type, active, created_at, updated_at
)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  '11111111-1111-4111-8111-111111111111',
  'Development Reception',
  'reception',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.staff_clinics (
  staff_id, clinic_id, active, created_at, updated_at
)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  '22222222-2222-4222-8222-222222222222',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (staff_id, clinic_id) DO NOTHING;

INSERT INTO dentos_runtime.clinic_gateways (
  id, organization_id, clinic_id, gateway_code, hostname, software_version, active, created_at, updated_at
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'DEV-GW-01',
  'development-laptop',
  '0.0.0',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.patient_initials (id, organization_id, label, display_order, active, created_at, updated_at)
VALUES ('88888881-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111', 'Mr', 1, true, clock_timestamp(), clock_timestamp())
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.patient_categories (id, organization_id, code, name, active, created_at, updated_at)
VALUES ('88888882-8888-4888-8888-888888888882', '11111111-1111-4111-8111-111111111111', 'GENERAL', 'General', true, clock_timestamp(), clock_timestamp())
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.referral_sources (id, organization_id, name, active, created_at, updated_at)
VALUES ('88888883-8888-4888-8888-888888888883', '11111111-1111-4111-8111-111111111111', 'Walk-in', true, clock_timestamp(), clock_timestamp())
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.fee_schedules (id, organization_id, code, name, active, created_at, updated_at)
VALUES ('88888884-8888-4888-8888-888888888884', '11111111-1111-4111-8111-111111111111', 'STANDARD', 'Standard Fees', true, clock_timestamp(), clock_timestamp())
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.document_series (
  id, organization_id, clinic_id, document_type, series_code, prefix, separator, number_width,
  code_generation_type, start_from, next_number, period_key, active, created_at, updated_at
)
VALUES (
  '88888885-8888-4888-8888-888888888885',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'patient',
  'PAT',
  'DEV',
  '-',
  5,
  'manual',
  1,
  1,
  '2026',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.allergy_catalog (id, organization_id, name, active, created_at, updated_at)
VALUES ('88888886-8888-4888-8888-888888888886', '11111111-1111-4111-8111-111111111111', 'Penicillin', true, clock_timestamp(), clock_timestamp())
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.medical_question_definitions (id, organization_id, question, response_type, active, created_at, updated_at)
VALUES (
  '88888887-8888-4888-8888-888888888887',
  '11111111-1111-4111-8111-111111111111',
  'Any heart condition?',
  'yes_no',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.staff (
  id, organization_id, display_name, staff_type, active, created_at, updated_at
)
VALUES (
  '88888891-8888-4891-8891-888888888891',
  '11111111-1111-4111-8111-111111111111',
  'Development Clinician',
  'clinician',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.staff_clinics (
  staff_id, clinic_id, active, created_at, updated_at
)
VALUES (
  '88888891-8888-4891-8891-888888888891',
  '22222222-2222-4222-8222-222222222222',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (staff_id, clinic_id) DO NOTHING;

INSERT INTO dentos_data.chairs (
  id, clinic_id, code, name, display_order, active, created_at, updated_at
)
VALUES (
  '88888892-8888-4892-8892-888888888892',
  '22222222-2222-4222-8222-222222222222',
  'CH01',
  'Chair 1',
  1,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.care_booking_reasons (
  id, organization_id, name, default_minutes, color_hex, active, created_at, updated_at
)
VALUES (
  '88888893-8888-4893-8893-888888888893',
  '11111111-1111-4111-8111-111111111111',
  'Consultation',
  30,
  '#2563EB',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.staff_working_hours (
  id, clinic_id, staff_id, weekday, starts_local, ends_local, active, created_at, updated_at
)
VALUES (
  '88888894-8888-4894-8894-888888888894',
  '22222222-2222-4222-8222-222222222222',
  '88888891-8888-4891-8891-888888888891',
  1,
  '09:00',
  '18:00',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.chair_working_hours (
  id, chair_id, weekday, starts_local, ends_local, active, created_at, updated_at
)
VALUES (
  '88888895-8888-4895-8895-888888888895',
  '88888892-8888-4892-8892-888888888892',
  1,
  '09:00',
  '18:00',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.service_domains (
  id, organization_id, code, name, display_order, active, created_at, updated_at
)
VALUES (
  '88888896-8888-4896-8896-888888888896',
  '11111111-1111-4111-8111-111111111111',
  'RESTORATIVE',
  'Restorative',
  1,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.service_catalog (
  id, organization_id, code, description, service_domain_id, default_minutes, active, created_at, updated_at
)
VALUES (
  '88888897-8888-4897-8897-888888888897',
  '11111111-1111-4111-8111-111111111111',
  'FILL-001',
  'Composite Filling',
  '88888896-8888-4896-8896-888888888896',
  45,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.diagnosis_catalog (
  id, organization_id, code, name, active, created_at, updated_at
)
VALUES (
  '88888898-8888-4898-8898-888888888898',
  '11111111-1111-4111-8111-111111111111',
  'CARIES',
  'Dental Caries',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.medication_domains (
  id, organization_id, code, name, display_order, active, created_at, updated_at
)
VALUES (
  '888888a1-8888-48a1-88a1-8888888888a1',
  '11111111-1111-4111-8111-111111111111',
  'ANALGESIC',
  'Analgesic',
  1,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.active_ingredient_catalog (
  id, organization_id, code, name, active, created_at, updated_at
)
VALUES (
  '888888a2-8888-48a2-88a2-8888888888a2',
  '11111111-1111-4111-8111-111111111111',
  'PARACETAMOL',
  'Paracetamol',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.administration_patterns (
  id, organization_id, code, label, take_text, frequency, duration_value, duration_period, instructions, active, created_at, updated_at
)
VALUES (
  '888888a3-8888-48a3-88a3-8888888888a3',
  '11111111-1111-4111-8111-111111111111',
  'TAB-BD-3D',
  'Tablet twice daily for 3 days',
  '1 tablet after food',
  'twice daily',
  3,
  'days',
  'After meals',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.medication_catalog (
  id, organization_id, primary_domain_id, active_ingredient_id, brand_name, strength, dosage_form,
  default_administration_pattern_id, active, created_at, updated_at
)
VALUES (
  '888888a4-8888-48a4-88a4-8888888888a4',
  '11111111-1111-4111-8111-111111111111',
  '888888a1-8888-48a1-88a1-8888888888a1',
  '888888a2-8888-48a2-88a2-8888888888a2',
  'Dolo 650',
  '650 mg',
  'tablet',
  '888888a3-8888-48a3-88a3-8888888888a3',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.medication_ingredient_links (
  id, medication_id, active_ingredient_id, sequence_no, active, created_at, updated_at
)
VALUES (
  '888888a5-8888-48a5-88a5-8888888888a5',
  '888888a4-8888-48a4-88a4-8888888888a4',
  '888888a2-8888-48a2-88a2-8888888888a2',
  1,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.allergy_ingredient_rules (
  id, allergy_id, active_ingredient_id, interaction_level, warning_text, active, created_at, updated_at
)
VALUES (
  '888888a6-8888-48a6-88a6-8888888888a6',
  '88888886-8888-4888-8888-888888888886',
  '888888a2-8888-48a2-88a2-8888888888a2',
  'warn',
  'Penicillin-class caution for paracetamol combination products',
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.tax_codes (
  id, organization_id, code, cgst_rate, sgst_rate, igst_rate, active, created_at, updated_at
)
VALUES (
  '888888b1-8888-48b1-88b1-8888888888b1',
  '11111111-1111-4111-8111-111111111111',
  'GST18',
  9,
  9,
  0,
  true,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.collection_methods (
  id, organization_id, code, name, requires_reference, active, created_at, updated_at
)
VALUES
  (
    '888888b2-8888-48b2-88b2-8888888888b2',
    '11111111-1111-4111-8111-111111111111',
    'CASH',
    'Cash',
    false,
    true,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '888888b3-8888-48b3-88b3-8888888888b3',
    '11111111-1111-4111-8111-111111111111',
    'UPI',
    'UPI',
    true,
    true,
    clock_timestamp(),
    clock_timestamp()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.fee_schedule_items (
  id, fee_schedule_id, service_id, fee, tax_code_id, created_at, updated_at
)
VALUES (
  '888888b4-8888-48b4-88b4-8888888888b4',
  '88888884-8888-4888-8888-888888888884',
  '88888897-8888-4897-8897-888888888897',
  2500,
  '888888b1-8888-48b1-88b1-8888888888b1',
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.ledger_accounts (
  id, organization_id, code, name, account_type, active, created_at, updated_at
)
VALUES
  (
    '888888b5-8888-48b5-88b5-8888888888b5',
    '11111111-1111-4111-8111-111111111111',
    '1100',
    'Accounts Receivable',
    'asset',
    true,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '888888b6-8888-48b6-88b6-8888888888b6',
    '11111111-1111-4111-8111-111111111111',
    '1000',
    'Cash',
    'asset',
    true,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '888888b7-8888-48b7-88b7-8888888888b7',
    '11111111-1111-4111-8111-111111111111',
    '4000',
    'Clinical Revenue',
    'revenue',
    true,
    clock_timestamp(),
    clock_timestamp()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO dentos_data.clinic_settings (
  id, organization_id, clinic_id, group_code, key, value_json, value_schema_version, created_at, updated_at
)
VALUES (
  '888888a7-8888-48a7-88a7-8888888888a7',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'document_output',
  'care_plan_a4',
  '{"pageSize":"A4","orientation":"portrait","showLogo":true,"headerText":"Care Plan","footerText":"KlickIt Development Clinic"}'::jsonb,
  1,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;
