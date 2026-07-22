# KlickIt Master Phase Plan

**Baseline:** 55 small phases, 10 major milestones, total weight 100%.

Cursor may improve phase boundaries only under the governance rules. It may not remove scope.

| Phase | Weight | Milestone | Phase name | Primary outcome | Gate |
|---:|---:|---|---|---|---|
| 1 | 1% | Milestone 1 — Setup | Workspace discovery and blueprint verification | Locate/copy the ten blueprints, verify hashes, establish read-only originals. | Auto-continue only if tests pass |
| 2 | 1% | Milestone 1 — Setup | Blueprint authority, portability charter and product-name audit | Build authority, override, terminology and contradiction matrices; KlickIt is new product. | Auto-continue only if tests pass |
| 3 | 1% | Milestone 1 — Setup | Windows machine and capability audit | Inspect Windows, storage, RAM, virtualization, WSL, installed tools and Cursor capabilities. | Auto-continue only if tests pass |
| 4 | 2% | Milestone 1 — Setup | Safe and replaceable toolchain installation | Install approved Git, Node LTS, Docker/WSL, Rust and Tauri prerequisites after required approvals. | Auto-continue only if tests pass |
| 5 | 1% | Milestone 1 — Setup | Persistent Cursor memory and commands | Validate AGENTS, rules, commands, status, decisions, logs and startup workflow. | Auto-continue only if tests pass |
| 6 | 1% | Milestone 1 — Setup | Provider-neutral Git and private GitHub foundation | Initialize Git, guide private repository creation, branches, ignore rules and secret protection. | Auto-continue only if tests pass |
| 7 | 1% | Milestone 1 — Setup | Rebuildable monorepo, local Supabase and CI skeleton | Create buildable workspace, local Supabase, synthetic seed and baseline CI. | STOP: manual milestone review |
| 8 | 2% | Milestone 2 — Gateway & Sync | Architecture, provider adapters and module boundaries | Freeze app/web/gateway/cloud boundaries and deployment responsibilities. | Auto-continue only if tests pass |
| 9 | 3% | Milestone 2 — Gateway & Sync | Portable PostgreSQL migration baseline | Convert executable schema into safe ordered migrations and initial permission foundations. | Auto-continue only if tests pass |
| 10 | 2% | Milestone 2 — Gateway & Sync | Clinic Gateway Windows-service skeleton | Create local API/service host, configuration, logs and lifecycle. | Auto-continue only if tests pass |
| 11 | 2% | Milestone 2 — Gateway & Sync | Local PostgreSQL and clinic configuration | Provision local database, clinic identity, local migrations and safe configuration. | Auto-continue only if tests pass |
| 12 | 2% | Milestone 2 — Gateway & Sync | Desktop-shell abstraction, Tauri implementation and browser fallback | Shared frontend in Tauri, local/cloud mode selection and browser backup. | Auto-continue only if tests pass |
| 13 | 2% | Milestone 2 — Gateway & Sync | LAN discovery and local routing | Securely discover the gateway and allow authorised LAN/Wi-Fi clients. | Auto-continue only if tests pass |
| 14 | 3% | Milestone 2 — Gateway & Sync | Provider-neutral sync outbox, inbox, cursors and idempotency | Implement interruption-safe push/pull contracts and replay protection. | Auto-continue only if tests pass |
| 15 | 2% | Milestone 2 — Gateway & Sync | Conflict, duplicate and collision engine | Implement field merge rules, manual conflicts, duplicate candidates and appointment warnings. | Auto-continue only if tests pass |
| 16 | 2% | Milestone 2 — Gateway & Sync | Offline devices, 72-hour control, health, backup and updater | Complete device approval, offline access, read-only timeout, health, backups and update foundations. | STOP: manual milestone review |
| 17 | 2% | Milestone 3 — Access & Patients | Organizations, clinics, staff and users | Implement multi-clinic identity and workforce records. | Auto-continue only if tests pass |
| 18 | 2% | Milestone 3 — Access & Patients | Roles, permissions, overrides and audit | Server-side authorization, role limits, immutable audit and denial tests. | Auto-continue only if tests pass |
| 19 | 2% | Milestone 3 — Access & Patients | Online and offline authentication | Approved-device login, cached verifier, invalidation and session controls. | Auto-continue only if tests pass |
| 20 | 2% | Milestone 3 — Access & Patients | Patient Registry and high-density search | Registration, paging, filters, search normalization and compact UI. | Auto-continue only if tests pass |
| 21 | 2% | Milestone 3 — Access & Patients | Patient profile, medical history, allergies and consent | Longitudinal profile, restricted clinical data and purpose/channel consent. | Auto-continue only if tests pass |
| 22 | 2% | Milestone 3 — Access & Patients | Global patient identity, numbering, safety summary and merge | UUID identity, clinic codes, duplicate review and cross-clinic safety summary. | Auto-continue only if tests pass |
| 23 | 2% | Milestone 3 — Access & Patients | DrKlick demographic migration staging | Authorised import staging, validation, read-only source references and synthetic dry run. | STOP: manual milestone review |
| 24 | 1% | Milestone 4 — Scheduler & Queue | Scheduling masters, chairs and availability | Clinicians, chairs, booking reasons, hours and blackouts. | Auto-continue only if tests pass |
| 25 | 2% | Milestone 4 — Scheduler & Queue | Scheduler views and keyboard workflow | Month/week/day/resource views with dense interactions. | Auto-continue only if tests pass |
| 26 | 2% | Milestone 4 — Scheduler & Queue | Booking state machine and rescheduling | Create, confirm, reschedule, cancel, no-show and complete with history. | Auto-continue only if tests pass |
| 27 | 2% | Milestone 4 — Scheduler & Queue | Walk-ins and Clinical Queue | Arrival, admission, chair flow, engagement and checkout. | Auto-continue only if tests pass |
| 28 | 2% | Milestone 4 — Scheduler & Queue | LAN live refresh and offline appointment reconciliation | Same-clinic live updates and safe preservation/warning of cross-clinic collisions. | Auto-continue only if tests pass |
| 29 | 1% | Milestone 4 — Scheduler & Queue | Operational Dashboard | Daily summaries and quick actions without enabling blocked future features. | STOP: manual milestone review |
| 30 | 2% | Milestone 5 — Clinical & Files | Encounter workspace and clinical state | Create encounters, status transitions, clinician attribution and safety context. | Auto-continue only if tests pass |
| 31 | 2% | Milestone 5 — Clinical & Files | FDI tooth-wise clinical records | Findings, diagnosis, advised/completed treatment, dates, clinician and financial links. | Auto-continue only if tests pass |
| 32 | 2% | Milestone 5 — Clinical & Files | Completed notes and signed amendments | Lock completed notes and preserve correction history. | Auto-continue only if tests pass |
| 33 | 2% | Milestone 5 — Clinical & Files | Images, PDF processing and encrypted file synchronization | Compression policy, PDF warnings, local cache, hashes and resumable transfer. | Auto-continue only if tests pass |
| 34 | 2% | Milestone 5 — Clinical & Files | Clinical permissions, cross-clinic access and UAT | Doctor access, branch finance restrictions, denied tests and clinical milestone evidence. | STOP: manual milestone review |
| 35 | 2% | Milestone 6 — Plans & Prescriptions | Treatment-plan phases and alternatives | Multiple plans, phases, primary/secondary/tertiary alternatives and service lines. | Auto-continue only if tests pass |
| 36 | 2% | Milestone 6 — Plans & Prescriptions | Estimates, acceptance and signatures | Staff confirmation, OTP, handwritten signature, upload and audit. | Auto-continue only if tests pass |
| 37 | 2% | Milestone 6 — Plans & Prescriptions | Medicine masters, templates and safety checks | Medication catalog, dose/frequency/duration, allergy and interaction warnings. | Auto-continue only if tests pass |
| 38 | 1% | Milestone 6 — Plans & Prescriptions | Doctor signing PIN and immutable prescription revisions | Doctor-only signature image use, PIN confirmation, hashes and revisions. | Auto-continue only if tests pass |
| 39 | 1% | Milestone 6 — Plans & Prescriptions | Plan, prescription and consent printing | A4 layouts, source snapshots, template versions and reprint behavior. | STOP: manual milestone review |
| 40 | 2% | Milestone 7 — Finance | Financial masters, fees, taxes and discount controls | Services, fee profiles, GST fields and role-based discount ceilings. | Auto-continue only if tests pass |
| 41 | 2% | Milestone 7 — Finance | Fee statements and clinic/year numbering | Draft/issue/void lifecycle, January reset and offline local invoice numbers. | Auto-continue only if tests pass |
| 42 | 2% | Milestone 7 — Finance | Payments, split tenders and patient advances | Cash/UPI/card/bank/cheque/mixed methods and offline pending acknowledgement. | Auto-continue only if tests pass |
| 43 | 2% | Milestone 7 — Finance | Allocations and multi-doctor distribution | Manual allocation or advance and proportional clinician distribution. | Auto-continue only if tests pass |
| 44 | 2% | Milestone 7 — Finance | Refunds, reversals, voids and immutable journals | Block unsafe refunds, preserve non-negative balances and dated effects. | Auto-continue only if tests pass |
| 45 | 2% | Milestone 7 — Finance | Aging, balances and verified opening balances | Due-date aging, custom buckets and manually verified DrKlick openings. | Auto-continue only if tests pass |
| 46 | 2% | Milestone 7 — Finance | Financial documents, reconciliation and UAT | Private/CGHS/corporate formats and cent-level source-to-output reconciliation. | STOP: manual milestone review |
| 47 | 1% | Milestone 8 — Communications & Printing | Recall and follow-up rules | Deterministic recalls, snooze, completion, due lists and tasks. | Auto-continue only if tests pass |
| 48 | 2% | Milestone 8 — Communications & Printing | Provider-neutral messaging adapter with Pabbly implementation | Approved connection, webhook verification, patient links, consent and retry state. | Auto-continue only if tests pass |
| 49 | 2% | Milestone 8 — Communications & Printing | Ten WhatsApp automations and retention | Welcome through campaigns, per-rule approval, test recipients and three-year message history. | Auto-continue only if tests pass |
| 50 | 1% | Milestone 8 — Communications & Printing | Thermal, labels, appointment and CGHS/corporate printing | Remaining print hardware workflows and versioned templates. | STOP: manual milestone review |
| 51 | 2% | Milestone 9 — Rohini Readiness | Gateway installer, alternate-runtime boundary and recovery drill | Unsigned internal installer, service setup, backup restore and spare-gateway runbook. | Auto-continue only if tests pass |
| 52 | 2% | Milestone 9 — Rohini Readiness | Migration dry run, training data and complete synthetic UAT | 5,000-patient scale fixture, DrKlick demographic dry run and staff test scripts. | Auto-continue only if tests pass |
| 53 | 2% | Milestone 9 — Rohini Readiness | Staging, security, portability, performance and 72-hour drills | Preview/staging only, security tests, sync interruption and long-offline simulation. | STOP: manual milestone review |
| 54 | 2% | Milestone 10 — Pilot Acceptance | Controlled Rohini pilot release candidate | Go-live checklist, rollback, daily reconciliation and explicit production approval gate. | Auto-continue only if tests pass |
| 55 | 2% | Milestone 10 — Pilot Acceptance | Final acceptance, sale/transfer handover and Shalimar expansion plan | Acceptance evidence, operating runbooks, unresolved list and second-clinic plan. | STOP: manual milestone review |

## Progress calculation

- Phase-count progress = completed phases / current total phases.
- Weighted progress = sum of completed phase weights.
- A phase is completed only when implementation, tests, documentation, evidence and commit are complete.
- A milestone is approved only after manual testing and the exact phrase `APPROVE MILESTONE`.

## Milestone endpoints

1. Phase 7 — Computer and project setup
2. Phase 16 — Architecture, Clinic Gateway and synchronization foundation
3. Phase 23 — Users, permissions and Patient Registry
4. Phase 29 — Scheduler and Clinical Queue
5. Phase 34 — Clinical records and files
6. Phase 39 — Treatment plans and prescriptions
7. Phase 46 — Billing and financial operations
8. Phase 50 — Recall, WhatsApp and printing
9. Phase 53 — Rohini pilot readiness
10. Phase 55 — Final pilot acceptance


## Cross-cutting portability gate

Every phase that adds a provider, service, framework, account, build step, data store or external workflow must update:

- `docs/PROVIDER_INVENTORY.md`
- `docs/PROVIDER_EXIT_PLAN.md`
- `docs/ACCOUNT_TRANSFER_RUNBOOK.md`
- `docs/ENVIRONMENT_AND_SECRET_INVENTORY.md`
- `docs/DEPENDENCY_AND_LICENSE_REGISTER.md`
- relevant portability tests

Before Milestone 9 approval, a clean rebuild, database restore, file restore and provider-exit rehearsal must pass.

Before Milestone 10 approval, sale/handover readiness and account ownership must be reviewed.
