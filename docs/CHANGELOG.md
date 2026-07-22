# Changelog

## Unreleased

### Milestone 10 approved — 2026-07-22
- Owner approved Pilot Acceptance milestone (Phases 54–55)
- 55-phase master plan complete; remaining work is frontend UI modules and pilot go-live preparation

### UI Module 1 approved — 2026-07-22
- Owner approved Login and Application Shell after manual review
- Next UI work: Module 2 — Dashboard

### UI Module 1 foundation — 2026-07-22
- `@klickit/ui` package with Blueprint 06 tokens, AppShell, navigation, sync indicator and form states
- Web app restructured with React Router, TanStack Query, auth context and protected routes
- Pilot navigation placeholders and owner test guide `docs/UI_MODULE_01_OWNER_TEST_GUIDE.md`

### Milestone 10 foundation — 2026-07-22
- Phases 54–55: pilot release candidate, go-live checklist, production approval gate, daily reconciliation, acceptance records, unresolved issues, rollback and Shalimar expansion plan
- `@klickit/pilot` package with checklist evaluation, production gate, reconciliation and handover helpers
- Pilot PostgreSQL migrations and gateway milestone 10 routes
- Rohini go-live and rollback runbooks, Shalimar expansion plan and Milestone 10 evidence checklist

### Milestone 9 approved — 2026-07-22
- Owner approved Milestone 9 (Rohini Readiness, Phases 51–53)
- Next work: Phase 54 within Milestone 10 — Pilot acceptance preparation

### Milestone 9 foundation — 2026-07-22
- Phases 51–53: backup and restore drill tracking, gateway incidents, readiness drills, migration batch accept/apply/report, synthetic DrKlick fixtures and portability guards
- `@klickit/resilience` and `@klickit/test-fixtures` packages
- Resilience PostgreSQL migration for backup runs, restore drills, gateway incidents and readiness drill runs
- Gateway milestone 9 routes, recovery runbooks, local installer preview scripts and synthetic staff UAT scripts
- Milestone 9 evidence checklist

### Milestone 8 approved — 2026-07-22
- Owner approved Milestone 8 (Communications & Printing, Phases 47–50)
- Next work: Phase 51 — Gateway installer and recovery drill

### Milestone 8 foundation — 2026-07-22
- Phases 47–50: continuity policies and tasks, messaging templates and preferences, outbound queue with Pabbly stub adapter, webhook deduplication, ten WhatsApp automations and extended print templates
- `@klickit/comms` package with due-date math, consent validation, automation registry and print type helpers
- Communications PostgreSQL migrations compiled from Blueprint 01 (9 tables) plus continuity contract trigger
- Gateway continuity, messaging and extended print APIs with permission gates
- Milestone 8 evidence checklist

### Milestone 7 approved — 2026-07-22
- Owner approved Milestone 7 (Finance, Phases 40–46)
- Next work: Phase 47 — Recall and follow-up rules

### Milestone 7 foundation — 2026-07-22
- Phases 40–46: finance masters, fee statement lifecycle, split-tender collections, allocations, refunds, journal posting, aging, opening balances and cent-level reconciliation
- `@klickit/finance` package with GST totals, discount ceilings, allocation/refund validation, aging buckets and reconciliation helpers
- Finance PostgreSQL migrations compiled from Blueprint 01 (23 tables)
- Gateway finance repository and `/finance/*` routes with permission gates
- Milestone 7 evidence checklist

### Milestone 6 approved — 2026-07-22
- Owner approved Milestone 6 (Plans & Prescriptions, Phases 35–39)
- Next work: Phase 40 — Financial masters and fee controls

### Milestone 6 foundation — 2026-07-22
- Phases 35–39: care plans with phases and treatment bundle alternatives, acceptance records, medication masters and safety checks, signed medication orders with PIN and revisions, document print snapshots
- `@klickit/plans-prescriptions` package with plan totals, allergy evaluation, signing hash and print snapshot helpers
- Plan and prescription PostgreSQL migrations plus acceptance, PIN, revision and print snapshot tables
- Gateway plan, medication and document print APIs with permission gates
- Milestone 6 evidence checklist

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
