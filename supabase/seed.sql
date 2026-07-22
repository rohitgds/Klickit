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
