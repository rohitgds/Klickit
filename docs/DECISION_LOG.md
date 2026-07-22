# Decision Log

Record only accepted decisions. Do not place secrets here.

| ID | Date | Decision | Reason | Affected blueprints/phases | Approved by |
|---|---|---|---|---|---|
| DEC-001 | Initial | New product is KlickIt; DrKlick is migration reference only | Independent implementation boundary | All | User |
| DEC-002 | Initial | Tauri is required unless a documented blocker is approved | Shared Windows desktop strategy | 12, 51 | User |
| DEC-003 | Initial | Review at major milestones; small phases may auto-continue after tests | Practical non-coder workflow | All | User |
| DEC-004 | Initial | Only exact phrase `APPROVE MILESTONE` proceeds | Prevent accidental continuation | All milestones | User |
| DEC-005 | Initial | Development uses synthetic data and preview/staging only | Patient and production safety | All pre-pilot | User |

| DEC-006 | Initial | Every service and local-stack component has equal portability priority | Owner may rebuild, sell, transfer accounts or use cheaper providers | All phases | User |
| DEC-007 | Initial | Equal priority does not mean identical migration effort | Avoid false portability claims | All provider decisions | User |
| DEC-008 | 2026-07-21 | First-run discovery uses read-only audit only; no product code in this session | Bootstrap prompt boundary | Phases 1–3 | Agent |
| DEC-009 | 2026-07-21 | Blueprint originals verified by SHA-256 on 2026-07-21 | Establishes authoritative requirement baseline | Phase 1 | Agent |
| DEC-010 | 2026-07-21 | Owner approved setup review checkpoint with `APPROVE MILESTONE` | Authorizes Phases 4–7 within Milestone 1 | Milestone 1 | User |
| DEC-011 | 2026-07-21 | Pin Node.js 24 for reproducible builds | Current winget LTS channel installs Node 24.18.0 | Phase 4 | Agent |
| DEC-012 | 2026-07-21 | Milestone 1 approved after local Supabase verification | Owner accepted setup deliverables | Milestone 1 | User |
| DEC-013 | 2026-07-21 | Freeze offline-first component boundaries in code and docs | Phase 8 architecture gate | Phase 8 | Agent |
| DEC-014 | 2026-07-21 | Compile Blueprint 01 SQL into ordered Supabase migrations via script | Portable rebuild and provider-neutral schema baseline | Phase 9 | Agent |
| DEC-015 | 2026-07-22 | Milestone 2 foundation delivered through Phase 16 with gateway-local PostgreSQL, sync contracts, LAN discovery and 72-hour policy enforcement | Gateway & Sync milestone endpoint ready for manual review | Phases 11–16, Milestone 2 | Agent |
| DEC-016 | 2026-07-22 | Milestone 2 approved after owner review | Authorizes Phase 17 within Milestone 3 | Milestone 2 | User |
| DEC-017 | 2026-07-22 | Milestone 3 foundation delivered through Phase 23 with identity, patient registry and synthetic DrKlick staging | Access & Patients milestone endpoint ready for manual review | Phases 17–23, Milestone 3 | Agent |
| DEC-018 | 2026-07-22 | Milestone 3 approved after owner review | Authorizes Phase 24 within Milestone 4 | Milestone 3 | User |
| DEC-019 | 2026-07-22 | Milestone 4 foundation delivered through Phase 29 with scheduling masters, booking state machine, clinical queue, live refresh and operational dashboard | Scheduler & Queue milestone endpoint ready for manual review | Phases 24–29, Milestone 4 | Agent |
| DEC-020 | 2026-07-22 | Milestone 4 approved after owner review and local Supabase reset | Authorizes Phase 30 within Milestone 5 | Milestone 4 | User |
| DEC-021 | 2026-07-22 | Milestone 5 foundation delivered through Phase 34 with encounter workspace, FDI clinical records, signed note amendments, file sync metadata and cross-clinic access checks | Clinical & Files milestone endpoint ready for manual review | Phases 30–34, Milestone 5 | Agent |
| DEC-022 | 2026-07-22 | Milestone 5 approved after owner review | Authorizes Phase 35 within Milestone 6 | Milestone 5 | User |
| DEC-023 | 2026-07-22 | Milestone 6 foundation delivered through Phase 39 with care plans, acceptance, medication safety, signed orders and print snapshots | Plans & Prescriptions milestone endpoint ready for manual review | Phases 35–39, Milestone 6 | Agent |
| DEC-024 | 2026-07-22 | Milestone 6 approved after owner review | Authorizes Phase 40 within Milestone 7 | Milestone 6 | User |
| DEC-025 | 2026-07-22 | Milestone 7 foundation delivered through Phase 46 with finance masters, fee statements, collections, allocations, refunds, aging and reconciliation APIs | Finance milestone endpoint ready for manual review | Phases 40–46, Milestone 7 | Agent |
| DEC-026 | 2026-07-22 | Milestone 7 approved after owner review | Authorizes Phase 47 within Milestone 8 | Milestone 7 | User |
| DEC-027 | 2026-07-22 | Milestone 8 foundation delivered through Phase 50 with recall rules, Pabbly messaging adapter, ten automation route types and extended print workflows | Communications & Printing milestone endpoint ready for manual review | Phases 47–50, Milestone 8 | Agent |
| DEC-028 | 2026-07-22 | Milestone 8 approved after owner review | Authorizes Phase 51 within Milestone 9 | Milestone 8 | User |
| DEC-029 | 2026-07-22 | Milestone 9 foundation delivered through Phase 53 with backup/restore drills, migration dry run, readiness drills, synthetic fixtures and portability guards | Rohini Readiness milestone endpoint ready for manual review | Phases 51–53, Milestone 9 | Agent |
| DEC-030 | 2026-07-22 | Milestone 9 approved after owner review | Authorizes Phase 54 within Milestone 10 | Milestone 9 | User |
| DEC-031 | 2026-07-22 | Milestone 10 foundation delivered through Phase 55 with pilot release candidate, daily reconciliation, acceptance records, handover summary and Shalimar expansion plan | Pilot Acceptance milestone endpoint ready for manual review | Phases 54–55, Milestone 10 | Agent |
| DEC-032 | 2026-07-22 | UI Module 1 (Login and Application Shell) approved after owner review | Authorizes UI Module 2 — Dashboard | UI Module 1 | User |
| DEC-033 | 2026-07-22 | Milestone 10 (Pilot Acceptance, Phases 54–55) approved after owner review | Closes the 55-phase master plan; backend milestone track complete | Milestone 10 | User |
| DEC-034 | 2026-07-22 | UI Module 2 (Dashboard) approved after owner review | Authorizes UI Module 3 — Patient Registry | UI Module 2 | User |
| DEC-035 | 2026-07-22 | UI Module 3 (Patient Registry) approved after owner review | Authorizes UI Module 4 — Scheduler | UI Module 3 | User |
| DEC-036 | 2026-07-22 | UI Module 4 (Scheduler) approved after owner review | Authorizes UI Module 5 — Clinical Queue | UI Module 4 | User |
| DEC-037 | 2026-07-22 | UI Module 5 (Clinical Queue) approved; owner authorized continuous build of remaining UI modules without per-module approval gates | Authorizes UI Modules 6–14 in one continuous frontend track | UI Module 5 | User |
| DEC-038 | 2026-07-22 | Release state set to NOT READY; critical remediation track on branch `remediation/pilot-safety`; independent audit ~52% blueprint-verified | Milestone approvals do not override release gate; Part D security awaits approval | Remediation | Agent + User directive |
| DEC-039 | 2026-07-22 | Security Remediation 1: Argon2id via `@node-rs/argon2`, gateway-only sessions, offline snapshot per user | Server-only API; cloud RLS deferred; synthetic credentials only | Security Remediation 1 | Agent (owner: move to next step) |
| FIN-DEC-01 | 2026-07-22 | Pilot default: **manual allocation** — new collections remain unapplied until staff explicitly allocate | Resolves UNRESOLVED-01; matches BP10 §13 pilot closure | Finance Remediation | Owner (continue finance) |
| FIN-DEC-02 | 2026-07-22 | Document numbering: **clinic + document type + calendar year** via existing `document_series`; issued numbers never reused | Resolves UNRESOLVED-02 | Finance Remediation | Owner (continue finance) |
| FIN-DEC-03 | 2026-07-22 | Aging anchor: **`coalesce(due_date, statement_date)`**; buckets 0–30, 31–60, 61–90, 90+ days | Resolves UNRESOLVED-03 | Finance Remediation | Owner (continue finance) |
| FIN-DEC-04 | 2026-07-22 | Multi-clinician allocations: **proportional by outstanding line amount**, largest-remainder rounding | Resolves UNRESOLVED-04 | Finance Remediation | Owner (continue finance) |
| FIN-DEC-05 | 2026-07-22 | Refunds limited to **unapplied collection balance**; allocated amounts require reversal before refund | Resolves UNRESOLVED-05 | Finance Remediation | Owner (continue finance) |
| FIN-DEC-06 | 2026-07-22 | Pilot allows **split-tender collections** when tender totals equal gross collected | Resolves UNRESOLVED-06; pilot override of single-method default | Finance Remediation | Owner (continue finance) |
| DEC-040 | 2026-07-22 | FIN-OFF-002 (offline pending payments) **deferred** for pilot; release remains NOT READY until addressed or re-approved | Scope control for Finance Remediation 1 | Finance Remediation | Agent + Owner (continue finance) |
| DEC-041 | 2026-07-22 | SYNC-001 duplicate push replay returns **`already_applied`**; single outbox row per idempotency key | Idempotent sync without last-write-wins | Sync Remediation 1 | Agent (continue sync) |
| SYNC-DEC-01 | 2026-07-22 | Staging Supabase sync drills **deferred** until owner approves non-production cloud project | No production cloud credentials in remediation | Sync Remediation | Agent (continue sync) |
| SYNC-DEC-02 | 2026-07-22 | OFF-001 multi-workstation drill remains **manual** with evidence template; automated OFF-003 only | LAN drill needs physical second workstation | Sync Remediation | Agent (continue sync) |
| DEC-042 | 2026-07-22 | Owner approved **Vercel Pro** paid subscription for commercial staging web hosting (~$20/user/month) | Hobby plan not permitted for KlickIt commercial staging | Staging deployment | Owner (`APPROVE PAID SUBSCRIPTION`) |
| DEC-043 | 2026-07-22 | Owner defers **Vercel Pro** until go-live; first deploy uses **Vercel Hobby** with upgrade before production | Cost control; owner accepts ToS risk until live | Staging deployment | Owner |
| DEC-044 | 2026-07-22 | **DEPLOY STAGING** signed off for synthetic online demo (Vercel + Render + Supabase Mumbai); NOT production | Owner authorized staging stack after Chrome login + verification batch | Staging | Owner |
| DEC-045 | 2026-07-22 | Local backup uses **pg_dump custom format** via Docker; restore drill verifies SHA256 + row counts | Replaces synthetic SQL stub; BCP-001 evidence | Backup Remediation 1 | Agent |
| DEC-046 | 2026-07-22 | Tauri **code signing deferred** until SaaS/subscription go-to-market | Owner will sign desktop builds when selling subscriptions; not required for current synthetic staging | Backup/Desktop | Owner |
| DEC-047 | 2026-07-22 | Annotated tag **`pre-remediation-audit-baseline`** on commit `899032e` | Preserves pre-remediation audit baseline before pilot-safety track | Remediation | Owner (`APPROVE TAG`) |
| DEC-048 | 2026-07-22 | **Remediation staging milestone** approved — synthetic online stack + UI Modules 6–14 owner review; release remains NOT READY | Owner confirmed staging `/health` (`readOnly: false`) and authorized milestone close on `remediation/pilot-safety` | Remediation / Staging / UI 6–14 | User (`APPROVE MILESTONE`) |
