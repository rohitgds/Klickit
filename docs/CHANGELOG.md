# Changelog

## Unreleased

### Added
- Universal provider/account/local-stack portability framework
- Clean rebuild, account transfer, provider exit and sale/handover documentation
- Portability rules, commands and tests
- Initial Cursor starter governance package
- 55-phase baseline
- Blueprint manifest and read-only originals
- First-run discovery outputs: `docs/MACHINE_AUDIT.md`, expanded blueprint authority docs, setup checklist sections, traceability seeds, conflict register
- Toolchain docs/scripts and installed Rust, Docker Desktop, C++ Build Tools
- Monorepo skeleton: `apps/web`, `apps/gateway`, `packages/shared`, `supabase/`, CI workflow
- Milestone 1 manual test guide and Git setup guide

### Changed
- `docs/SETUP_AND_SECRETS_CHECKLIST.md` reorganized into already available / required now / later / deferred
- `docs/CURRENT_STATUS.md` updated through Milestone 1 and Phase 8
- `README.md` updated for monorepo quick start
- Gateway exposes architecture boundary endpoint

### Added
- `@klickit/sync-contracts` package for push/pull/idempotency/offline policy contracts
- Gateway local PostgreSQL connection, clinic bootstrap and migration apply script
- LAN discovery beacon, sync push/pull routes, conflict queues and device approval APIs
- 72-hour offline read-only enforcement foundation
- Tauri desktop scaffold with browser fallback
- Web runtime mode selection (local gateway / cloud / auto)
- `docs/LOCAL_GATEWAY.md`, `docs/MILESTONE2_EVIDENCE.md`

### Changed
- `docs/CURRENT_STATUS.md` updated through Milestone 2 endpoint (Phase 16)
- Gateway README expanded for Phases 11–16 endpoints
- `.env.example` includes gateway database and discovery variable names
- `docs/ENVIRONMENT_AND_SECRET_INVENTORY.md` populated for gateway variables

### Fixed

### Security
- No secrets collected during first-run read-only audit
