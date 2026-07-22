-- Milestone 10 supplemental — pilot permissions

SET search_path = dentos_data, public;

INSERT INTO dentos_data.permissions (id, code, module, resource, action, description, sensitive) VALUES
  ('a1000000-0000-4000-8000-000000000051', 'pilot.view', 'pilot', 'release', 'view', 'View pilot release candidate, reconciliation and acceptance status', true),
  ('a1000000-0000-4000-8000-000000000052', 'pilot.manage', 'pilot', 'release', 'manage', 'Manage pilot go-live checklist, reconciliation and acceptance records', true)
ON CONFLICT (code) DO NOTHING;
