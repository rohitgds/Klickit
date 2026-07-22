# Test Log

| Date/time | Phase | Test command or manual case | Environment | Result | Evidence/location | Notes |
|---|---:|---|---|---|---|---|
| 2026-07-22 | — | BCP-001 backup + restore drill | Local Docker Supabase | Pass | `docs/remediation/evidence/BACKUP_DRILL_20260722.md` | pg_dump 810KB; 90 permissions after restore |
| 2026-07-22 | — | OFF-003 offline read-only drill | Local gateway + Docker Supabase | Pass | `docs/remediation/evidence/SYNC_DRILL_20260722.md` | Push blocked with 403 after enter-read-only |
| 2026-07-22 | — | `npm run verify:migrations` | Windows + Docker Supabase | Pass | 90 permissions, 6 sync tables | Fixed `.env.local` UTF-8 BOM blocking supabase CLI |
| 2026-07-22 | — | Staging API smoke (login, dashboard, patients, scheduler) | Render + Supabase | Pass | `docs/remediation/evidence/STAGING_SMOKE_20260722.md` | Empty patient/booking lists OK — masters only in seed |
| 2026-07-22 | — | Staging Password Login (`dev.admin`) | Vercel + Render + Supabase | Pass | https://klickit-web-2c63.vercel.app | Owner verified; synthetic data only; Demo Login not used online |
| 2026-07-22 | — | `npm test` (gateway) before staging CORS commit | Windows dev laptop | Pass | 59 tests | Commit `242fdff` |
| 2026-07-21 | 1 | `powershell -ExecutionPolicy Bypass -File .\scripts\verify-blueprints.ps1` | Windows dev laptop | Pass | All 10 blueprint files OK | SHA-256 matches `blueprints/manifest.json` |
| 2026-07-21 | 4 | `npm run verify:toolchain` | Windows dev laptop | Pass | Rust, Docker CLI, C++ Build Tools installed | Docker engine must be started manually in Docker Desktop |
| 2026-07-21 | 5 | Cursor memory file validation | Workspace | Pass | `docs/CURSOR_MEMORY_CHECK.md` | AGENTS, rules, commands, portability docs present |
| 2026-07-21 | 6 | Local Git initialization | Windows dev laptop | Pass | `main` and `develop` branches | Remote GitHub pending owner URL |
| 2026-07-21 | 7 | `npx supabase start` + `npx supabase db reset` | Windows dev laptop | Pass | Local Supabase stack | Synthetic bootstrap migration applied |
| 2026-07-21 | 8 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Architecture/provider packages + gateway `/architecture` | 13 tests passed |
| 2026-07-21 | 10 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Gateway config/lifecycle + `/service/status` | 17 tests passed |
| 2026-07-22 | 55 | `npm test`, `npm run typecheck`, `npm run build`, `npx supabase db reset` | Windows dev laptop | Pass | Milestone 10 pilot release candidate, reconciliation, acceptance and handover | 120 automated tests passed |
| 2026-07-22 | 53 | `npm test`, `npm run typecheck`, `npm run build`, `npx supabase db reset` | Windows dev laptop | Pass | Milestone 9 resilience, migration dry run, readiness drills and synthetic fixtures | 112 automated tests passed |
| 2026-07-22 | 50 | `npm test`, `npm run typecheck` | Windows dev laptop | Pass | Milestone 8 recalls, messaging adapter, automations and extended printing | 103 automated tests passed |
| 2026-07-22 | 46 | `npm test`, `npm run typecheck`, `npm run build`, `npx supabase db reset` | Windows dev laptop | Pass | Milestone 7 finance APIs, GST math, allocations, aging and reconciliation | 91 automated tests passed |
| 2026-07-22 | 39 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Milestone 6 plans, prescriptions, signing and printing APIs | 76 tests passed |
| 2026-07-22 | 34 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Milestone 5 clinical workspace, FDI records, notes, files and permissions | 62 tests passed |
| 2026-07-22 | 29 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Milestone 4 scheduler, queue, live refresh and dashboard APIs | 53 tests passed |
| 2026-07-22 | 23 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Milestone 3 identity, patients, auth and staging APIs | 43 tests passed |

## Rules

- Never delete a failing test to pass.
- Record automated and manual results.
- Use synthetic data before controlled migration.
- Financial reconciliation must reach INR 0.00 variance.
