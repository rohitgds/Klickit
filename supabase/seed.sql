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
