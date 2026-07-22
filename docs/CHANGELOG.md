# Changelog

## Unreleased

### Milestone 5 approved — 2026-07-22
- Owner approved Milestone 5 (Clinical & Files, Phases 30–34)
- `main` pushed to GitHub with approved work through Phase 34
- Next work: Phase 35 — Treatment plan phases

### Milestone 5 foundation — 2026-07-22
- Phases 30–34: encounter workspace, FDI clinical records, signed note amendments, file sync metadata and clinical permissions
- `@klickit/clinical` package with tooth validation, note rules and cross-clinic access evaluation
- Clinical PostgreSQL migrations plus note amendment and file sync job tables
- Gateway clinical and document APIs with permission gates

### Milestone 4 approved — 2026-07-22
- Owner approved Milestone 4 after local Supabase reset

### Milestone 4 foundation — 2026-07-22
- Phases 24–29: scheduling masters, views, booking state machine, clinical queue, live refresh and operational dashboard
- `@klickit/scheduling` package with transition and availability domain logic
- Scheduling PostgreSQL migrations compiled from Blueprint 01 (9 tables)
- Gateway scheduling and clinical queue APIs with permission gates
- Milestone 4 evidence checklist

### Milestone 3 approved — 2026-07-22
- Owner approved Milestone 3 (Access & Patients, Phases 17–23)
- `main` updated to include approved Milestone 3 work
- Next work: Phase 24 — Scheduling masters

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
- Patient registry migration batch compiled from Blueprint 01 (21 tables)
- `@klickit/identity` and `@klickit/patients` packages
- Gateway identity, auth, patient and migration staging APIs (Phases 17–23)
- Synthetic seed for memberships, role permissions and patient masters
- Milestone 3 evidence and migration staging blueprint amendment

### Changed
- `docs/CURRENT_STATUS.md` updated through Milestone 3 endpoint (Phase 23)
- Compile script now emits patient registry migrations
- Gateway architecture phase marker updated to 23
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
