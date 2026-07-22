# Test Log

| Date/time | Phase | Test command or manual case | Environment | Result | Evidence/location | Notes |
|---|---:|---|---|---|---|---|
| 2026-07-21 | 1 | `powershell -ExecutionPolicy Bypass -File .\scripts\verify-blueprints.ps1` | Windows dev laptop | Pass | All 10 blueprint files OK | SHA-256 matches `blueprints/manifest.json` |
| 2026-07-21 | 4 | `npm run verify:toolchain` | Windows dev laptop | Pass | Rust, Docker CLI, C++ Build Tools installed | Docker engine must be started manually in Docker Desktop |
| 2026-07-21 | 5 | Cursor memory file validation | Workspace | Pass | `docs/CURSOR_MEMORY_CHECK.md` | AGENTS, rules, commands, portability docs present |
| 2026-07-21 | 6 | Local Git initialization | Windows dev laptop | Pass | `main` and `develop` branches | Remote GitHub pending owner URL |
| 2026-07-21 | 7 | `npx supabase start` + `npx supabase db reset` | Windows dev laptop | Pass | Local Supabase stack | Synthetic bootstrap migration applied |
| 2026-07-21 | 8 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Architecture/provider packages + gateway `/architecture` | 13 tests passed |
| 2026-07-21 | 10 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Gateway config/lifecycle + `/service/status` | 17 tests passed |
| 2026-07-22 | 23 | `npm test`, `npm run typecheck`, `npm run build` | Windows dev laptop | Pass | Milestone 3 identity, patients, auth and staging APIs | 41 tests passed |

## Rules

- Never delete a failing test to pass.
- Record automated and manual results.
- Use synthetic data before controlled migration.
- Financial reconciliation must reach INR 0.00 variance.
