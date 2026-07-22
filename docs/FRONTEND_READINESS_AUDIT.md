# Frontend Readiness Audit

**Date:** 2026-07-22  
**Auditor:** KlickIt agent (repository inspection)  
**Scope:** Approved first-release frontend modules (28) vs actual `apps/web`, `apps/desktop`, `packages/ui`, gateway APIs, seed data and tests.

## Executive summary

The **55 backend milestones are largely complete**, but the **frontend is not**.

| Metric | Value |
|---|---|
| **Frontend completion (screens connected)** | **~3%** |
| **Backend API readiness for UI wiring** | **~85%** (domain routes exist; demo seed gaps remain) |
| **Approved modules fully working end-to-end in UI** | **0 / 28** |
| **Partially working today** | Gateway discovery probe on the web shell page |

**What you can open today:** a single development page at `http://localhost:5173` that shows “KlickIt Web”, runtime mode controls, and whether the local gateway is reachable. It is **not** a clinic application.

**Recommendation:** Do **not** assume milestone completion means UI is ready. Begin **UI Module 1 — Login and Application Shell** after owner approval. Fix demo seed data in parallel so workflows can be clicked through without API tools.

---

## What was inspected

| Area | Location | Finding |
|---|---|---|
| Web app | `apps/web/` | 1 page (`App.tsx`), no router, no feature screens |
| Desktop shell | `apps/desktop/` | Tauri 2 loads same web app; no extra UI |
| UI package | `packages/ui/` | **Does not exist** |
| Shared client | `packages/shared/` | API base + `/discovery` only; no auth client |
| Gateway APIs | `apps/gateway/src/routes/` | ~155 routes across milestones 3–10 |
| Seed data | `supabase/seed.sql` | Masters + `dev.admin`; **no patients, bookings, credentials** |
| Automated UI tests | `apps/web/test/` | Shared helper tests only; no component/E2E tests |
| Print templates | DB seed + gateway | Backend ready; no print preview UI |
| Blueprint 06 | Navigation/density | Not implemented in frontend |
| Blueprint 10 | Pilot scope | Defines included/excluded modules (aligned with owner list) |

---

## Approved stack vs installed

| Requested (owner prompt §4) | Installed in `apps/web`? |
|---|---|
| React + TypeScript + Vite | Yes |
| React Router | **No** |
| TanStack Query | **No** |
| React Hook Form + Zod | **No** |
| TanStack Table + Virtual | **No** |
| FullCalendar | **No** |
| `packages/ui` design system | **No** |
| Tauri desktop shell | Scaffold only (loads web) |

---

## Classification key

| Code | Meaning |
|---|---|
| **1** | Complete and connected |
| **2** | UI exists but backend not connected |
| **3** | Backend exists but UI missing |
| **4** | Partially implemented |
| **5** | Broken |
| **6** | Deferred by Blueprint 10 |
| **7** | Requires owner decision |

---

## Module-by-module audit (28 approved first-release modules)

| # | Module | Class | Frontend | Backend | Owner can test today? |
|---|---|---|---|---|---|
| 1 | Login and clinic selection | **3** | No login page, no token storage | `POST /auth/login`, `POST /auth/dev/session`, `GET /auth/session` | No (except via developer tools) |
| 2 | Global application shell | **4** | Basic `<main>` only; no Blueprint 06 nav | N/A | Partially (static shell) |
| 3 | Dashboard | **3** | No route/screen | `GET /dashboard/operational/daily` | No |
| 4 | Patient Registry | **3** | Placeholder text only | `GET /patients/search`, register, profile | No |
| 5 | Patient registration + duplicate warning | **3** | No form | `POST /patients/register`, duplicate review | No |
| 6 | Patient profile and medical alerts | **3** | No screen | `GET /patients/:id/profile`, safety summary | No |
| 7 | Scheduler | **3** | No calendar | Full scheduling API + masters seeded | No |
| 8 | Clinical Queue | **3** | No queue grid | Queue admit/engage/checkout routes | No |
| 9 | Clinical encounter workspace | **3** | No workspace | Encounter workspace + clinical writes | No |
| 10 | Tooth-wise treatment records | **3** | No odontogram UI | Findings/diagnoses/deliveries routes | No |
| 11 | Clinical notes and amendments | **3** | No editor | Notes sign/amend routes | No |
| 12 | Treatment plans, phases, alternatives | **3** | No UI | `@klickit/plans-prescriptions` + gateway routes | No |
| 13 | Estimates and acceptance | **3** | No UI | Care plan accept/propose routes | No |
| 14 | Prescriptions and signing | **3** | No UI | Medication orders + PIN signing routes | No |
| 15 | Billing and invoice creation | **3** | No UI | Fee statement lifecycle routes | No |
| 16 | Payments and mixed tenders | **3** | No UI | Collections route | No |
| 17 | Advances and allocations | **3** | No UI | Allocations route | No |
| 18 | Refund and reversal workflows | **3** | No UI | Refunds + journal routes | No |
| 19 | Recall and follow-up | **3** | No UI | Continuity tasks/recalls routes | No |
| 20 | Clinical files and images | **3** | No uploader/viewer | File register/sync/verify routes | No |
| 21 | WhatsApp/Pabbly communication status | **3** | No UI | Messaging templates/outbound (stub adapter) | No |
| 22 | Printing and document preview | **3** | No PrintPreview | Print catalog/templates/snapshots | No |
| 23 | Users, roles and permissions | **3** | No admin screens | Identity + effective permissions routes | No |
| 24 | System Configuration | **3** | No config tree | Partial via scheduling/finance masters APIs | No |
| 25 | Offline mode and sync status | **4** | Discovery + indicator only | Sync/outbox/conflict routes (mostly unauthenticated) | Partial (connection text only) |
| 26 | Conflict review | **3** | No ConflictPanel | `GET /sync/conflicts/open`, resolve | No |
| 27 | Backup and recovery status | **3** | No UI | Resilience/pilot routes | No |
| 28 | Audit history | **3** | No AuditHistoryPanel | Audit written server-side; no read UI route found | **7** — needs API decision |

**Totals:** 0 × class 1 · 0 × class 2 · 24 × class 3 · 2 × class 4 · 0 × class 5 · 0 × class 6 · 1 × class 7

---

## Deferred modules (Blueprint 10 §2.2 — do not build without separate owner approval)

| Module | Class | Notes |
|---|---|---|
| Inventory | **6** | Explicitly excluded from Rohini pilot |
| Laboratory | **6** | Excluded |
| Advanced analytics catalog | **6** | Excluded (Blueprint 06 `/deep-analytics` exists in spec but not first pilot) |
| Full CGHS claim submission | **6** | CGHS/corporate **printing** is in scope; full claims workflow is not |
| Patient portal | **6** | Excluded |
| Native Android/iOS app | **6** | Browser + Tauri desktop only for pilot |
| Complete built-in WhatsApp helpdesk | **6** | Pabbly Chatflow is primary inbox |
| Automatic payment-gateway confirmation | **6** | Staff-entered payments only in pilot |
| Automatic HA failover | **6** | Manual spare gateway only |

---

## Screens already working (owner-visible)

| Screen | URL | What works | What does not |
|---|---|---|---|
| KlickIt Web shell | `http://localhost:5173` | Title, runtime mode dropdown, gateway URL field, `/discovery` probe | No login, no menus, no clinic workflows |
| Gateway health (JSON) | `http://127.0.0.1:8787/health` | Phase 55, product name | Not a UI screen |
| Gateway clinic config (JSON) | `http://127.0.0.1:8787/clinic/config` | Clinic metadata | Not a UI screen |

---

## Screens missing (Blueprint 06 primary routes)

All of these are **missing** as React routes/pages:

- `/dashboard`
- `/clinical-queue`
- `/scheduler`
- `/patient-registry`
- `/financial-operations`
- `/comms-center`
- `/system-configuration`
- `/practice-assets` (deferred content; route should stay hidden or disabled in pilot)
- `/deep-analytics` (deferred catalog; minimal pilot reports TBD — **owner decision**)

Account utilities also missing: My Profile, Change Active Clinic, Session Security, Sign Out.

---

## Features that cannot yet be tested by the owner (without developer help)

Because there is no connected UI:

- Register a patient
- Create or move an appointment
- Check in / engage / checkout queue
- Open encounter workspace or odontogram
- Create fee statement, take payment, allocate, refund
- Create/sign prescription
- Send or view WhatsApp message status
- Print preview any document
- Review sync conflicts
- View backup/recovery dashboard
- Manage users/roles visually

Even with UI, these need **demo seed fixes** first:

| Gap | Impact |
|---|---|
| No `user_credentials` in seed | Normal password login UI cannot be tested |
| No demo patients/bookings/encounters in seed | Lists empty on first open |
| No doctor signing PIN seeded | Prescription signing flow needs setup step |
| No dedicated audit-history read API | Audit panel needs backend route or owner decision |

---

## Backend readiness summary (safe to wire — do not rewrite)

| Domain | Ready? | Notes |
|---|---|---|
| Auth/session | Yes (dev) | Use `POST /auth/dev/session` locally; add credentials seed for password login |
| Patients | Yes | Search/register/profile; merge execute route incomplete |
| Scheduling + dashboard | Yes | Masters seeded; create data via UI/API |
| Clinical queue | Yes | Full state machine |
| Clinical workspace | Yes | Encounters, notes, files |
| Plans + prescriptions | Yes | Includes signing PIN setup |
| Finance | Yes | GST math stays in `@klickit/finance` |
| Comms + continuity | Yes | Pabbly stub; test mode |
| Printing | Yes | Templates in seed |
| Identity/permissions | Yes | Effective permissions endpoint |
| Sync/conflicts | Partial | Routes exist; **should add auth before production UI** |
| Resilience/pilot | Yes | Admin/audit permissions |

---

## Design system status (owner prompt §5)

**Not started.** Required locations absent:

- `packages/ui/src/tokens`
- `packages/ui/src/components` (AppShell, DenseDataGrid, PermissionGuard, etc.)
- Documented density tokens from Blueprint 06 (38px nav, 28–30px controls, dense grids)

---

## Owner Demo Mode status (owner prompt §6)

**Not started.** Required:

- Visible banner: `DEMO DATA — NOT REAL PATIENT DATA`
- Synthetic patients, appointments, bills, etc. loadable from one reset command
- Full click-through workflows listed in owner prompt §6

**Suggested prerequisite work (small, not full UI):**

1. `scripts/reset-owner-demo-data.mjs` (or SQL seed extension)
2. Seed `user_credentials` for demo login **or** documented dev-session bootstrap for owner
3. Pre-create 2–3 demo patients + today’s booking + one draft fee statement

---

## Stop conditions review

| Condition | Triggered? | Action |
|---|---|---|
| Missing backend APIs | **No** (domain APIs exist) | Proceed after owner approval |
| Conflicting requirements | **Minor** | Blueprint 06 includes Deep Analytics route; Blueprint 10 excludes advanced catalog — treat as **owner decision** |
| Security/finance uncertainty | **Low** | Sync/device routes unauthenticated; finance calculations correctly server-side |
| Destructive DB changes | **No** | Not required for UI Module 1 |
| Features reported complete but absent | **Yes (frontend)** | Documented in this audit; backend milestone claims remain valid |

**Conclusion:** Safe to begin frontend work **after owner approval**. Do not rewrite backend domain logic.

---

## Recommended first UI module

**Module 1 — Login and Application Shell**

Why first:

1. Every screen needs session token + permission guards.
2. Blueprint 06 navigation and density tokens belong in the shell.
3. Installs approved stack: React Router, TanStack Query, React Hook Form, Zod, `packages/ui` scaffold.

Deliverables for Module 1 review:

- Login screen (dev demo login + optional password path)
- AppShell with compact primary navigation (pilot modules only)
- Clinic context bar + sync indicator placeholder
- `DEMO DATA — NOT REAL PATIENT DATA` banner
- Protected empty routes for Dashboard, Patient Registry, Scheduler, etc.
- Owner click guide: `docs/UI_MODULE_01_OWNER_TEST_GUIDE.md` (to be created with Module 1)

**Owner approval phrase for next module:** `APPROVE UI MODULE`

---

## How to run the app locally (today)

### Prerequisites

1. Open **Docker Desktop** and wait until it is running.
2. Open **PowerShell** in the project folder.

### Terminal 1 — database

```powershell
cd "C:\Users\drroh\OneDrive\Desktop\KlickIt_Cursor_Starter_Pack_v2_Portable"
npx supabase start
npx supabase db reset
```

### Terminal 2 — gateway (backend)

```powershell
cd "C:\Users\drroh\OneDrive\Desktop\KlickIt_Cursor_Starter_Pack_v2_Portable"
npm run dev --workspace @klickit/gateway
```

### Terminal 3 — web UI

```powershell
cd "C:\Users\drroh\OneDrive\Desktop\KlickIt_Cursor_Starter_Pack_v2_Portable"
npm run dev --workspace @klickit/web
```

### What to open

| Option | Open this |
|---|---|
| **Browser (recommended)** | **http://localhost:5173** |
| **Windows desktop app (optional)** | Run `npm run dev --workspace @klickit/desktop` — opens a window loading the same URL |
| **Backend check (JSON, not UI)** | http://127.0.0.1:8787/health |

Keep Terminal 2 and 3 open while testing.

---

## Related documents

- `docs/UI_SCREEN_INVENTORY.md` — screen list and status codes
- `docs/UI_FEEDBACK_REGISTER.md` — owner feedback log (empty template)
- `docs/UI_ACCEPTANCE_STATUS.md` — module acceptance tracker
- `docs/USER_FEEDBACK.md` — general product feedback
- `blueprints/original/06_ui_and_menu_hierarchy.md` — UI authority
- `blueprints/original/10_klickit_offline_first_roadmap.md` — pilot scope

---

## Next step

**Waiting for owner direction.** Reply with one of:

1. **`APPROVE UI MODULE`** — start Module 1 (Login and Application Shell)
2. **Questions or scope changes** — recorded before coding
3. **“Add demo data first”** — seed/reset script before Module 1 (recommended parallel task)
