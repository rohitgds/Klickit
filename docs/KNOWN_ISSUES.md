# Known Issues

| ID | Severity | Phase found | Area | Description | Workaround | Owner | Status |
|---|---|---:|---|---|---|---|---|
| KI-001 | 3 | 7 | Local Supabase | Docker Desktop is installed but the engine was not running during automated setup | Open Docker Desktop, wait until running, then run `npx supabase start` | Owner | Resolved 2026-07-21 |
| KI-002 | 2 | Remediation | Migration verify | `verify-migrations.ps1` previously ignored failing docker/supabase exit codes | Fixed 2026-07-22 — script now exits nonzero; see `TEST_REMEDIATION_PLAN.md` | Agent | Resolved 2026-07-22 |
| KI-003 | 1 | Remediation | Security | Fixed-salt password hashing in `@klickit/identity` | Security Remediation 1 delivered — verify with local Supabase tests | Agent | Resolved 2026-07-22 |
| KI-004 | 2 | Remediation | Clinical UI | Odontogram finding insert uses user ID for `recorded_by`; DB FK expects staff ID | API/UI “Add finding” fails until gateway route fixed | Agent | Open 2026-07-22 |

Severity 1 or 2 issues block milestone approval.
