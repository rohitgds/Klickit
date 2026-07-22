# UI Acceptance Status

Tracks the 14 UI modules from the owner frontend integration plan.

| Module | Name | Status | Screens | Backend wired | Auto tests | Owner guide | Owner approved |
|---|---|---|---|---|---|---|---|
| 1 | Login and Application Shell | Approved | 4/4 scaffold | Yes | Yes | `docs/UI_MODULE_01_OWNER_TEST_GUIDE.md` | 2026-07-22 |
| 2 | Dashboard | Approved | 1/1 summary | Yes | Yes | `docs/UI_MODULE_02_OWNER_TEST_GUIDE.md` | 2026-07-22 |
| 3 | Patient Registry | Approved | 5/5 core screens | Yes | Yes | `docs/UI_MODULE_03_OWNER_TEST_GUIDE.md` | 2026-07-22 |
| 4 | Scheduler | Approved | 3/3 core screens | Yes | Yes | `docs/UI_MODULE_04_OWNER_TEST_GUIDE.md` | 2026-07-22 |
| 5 | Clinical Queue | Ready for owner review | 3/3 core screens | Yes | Yes | `docs/UI_MODULE_05_OWNER_TEST_GUIDE.md` | — |
| 6 | Clinical Records | Not started | 0/4 | No | No | — | — |
| 7 | Treatment Plans | Not started | 0/2 | No | No | — | — |
| 8 | Prescriptions | Not started | 0/2 | No | No | — | — |
| 9 | Financial Operations | Not started | 0/6 | No | No | — | — |
| 10 | Recall and Communications | Not started | 0/3 | No | No | — | — |
| 11 | Files and Printing | Not started | 0/1 | No | No | — | — |
| 12 | Settings and Permissions | Not started | 0/3 | No | No | — | — |
| 13 | Offline, Sync and Conflicts | Not started | 0/2 | Partial | No | — | — |
| 14 | End-to-End Demo | Not started | — | No | No | — | — |

## Progress

| Metric | Value |
|---|---|
| UI modules accepted by owner | 4 / 14 |
| Screens connected (OK) | 16 |
| Estimated frontend completion | ~34% |
| Weighted frontend progress | ~34% (Module 5 ready for review) |

## Module 1 completion report

```
UI module completed: 1 — Login and Application Shell
Screens completed: Login, application shell, global navigation, module placeholders
Backend connections: POST /auth/dev/session, POST /auth/login, POST /auth/logout, GET /auth/me, GET /clinic/config, GET /permissions/me, GET /discovery (sync indicator)
Automated tests: apps/web/test/ui-module1.test.ts (8 passing)
Manual tests: Owner approved 2026-07-22 after login, navigation and shell review
Screenshots: Not captured in repo
Known issues: Demo login requires gateway on :8787; use npm.cmd on Windows PowerShell
Owner decisions required: None for Module 1
Phase-count progress: 55/55 backend; UI 1/14 modules
Weighted frontend progress: ~7%
Next UI module: 2 — Dashboard
```

## Module 2 completion report

```
UI module completed: 2 — Dashboard
Screens completed: UI-DSH-001 operational dashboard summary
Backend connections: GET /dashboard/operational/daily?date=YYYY-MM-DD
Automated tests: apps/web/test/ui-module2.test.ts (5 passing)
Manual tests: Owner approved 2026-07-22
Screenshots: Not captured in repo
Known issues: Gateway returns summary counts only; activity grid rows deferred until list API exists
Owner decisions required: None for Module 2 scope
Phase-count progress: 55/55 backend; UI 2/14 modules delivered (1 approved, 2 ready for review)
Weighted frontend progress: ~14%
Next UI module: 3 — Patient Registry
```

## Module 3 completion report

```
UI module completed: 3 — Patient Registry
Screens completed: UI-PAT-001 search, UI-PAT-002 register, UI-PAT-003 duplicate dialog, UI-PAT-004 profile, UI-PAT-005 safety summary
Backend connections: GET /patients/search, POST /patients/register, GET /patients/:id/profile, GET /patients/:id/safety-summary, POST /patients/duplicates/review
Automated tests: apps/web/test/ui-module3.test.ts (5 passing)
Manual tests: Owner approved 2026-07-22
Screenshots: Not captured in repo
Known issues: Registration form is minimal vs full Blueprint 06 grid; advanced registry filters deferred
Owner decisions required: None for Module 3 pilot scope
Phase-count progress: 55/55 backend; UI 3/14 modules delivered (2 approved, 3 ready for review)
Weighted frontend progress: ~21%
Next UI module: 4 — Scheduler
```

## Module 4 completion report

```
UI module completed: 4 — Scheduler
Screens completed: UI-SCH-001 calendar views, UI-SCH-002 booking editor, UI-SCH-003 setup/blackouts
Backend connections: GET /scheduling/views/:viewType, GET/POST /scheduling/bookings, transitions, GET /scheduling/masters, POST /scheduling/blackouts, GET /scheduling/availability
Automated tests: apps/web/test/ui-module4.test.ts (5 passing)
Manual tests: Owner approved 2026-07-22
Screenshots: Not captured in repo
Known issues: Compact table views instead of full calendar grid; Resource Week and print deferred
Owner decisions required: None for Module 4 pilot scope
Phase-count progress: 55/55 backend; UI 4/14 modules delivered (3 approved, 4 ready for review)
Weighted frontend progress: ~28%
Next UI module: 5 — Clinical Queue
```

## Module 5 completion report

```
UI module completed: 5 — Clinical Queue
Screens completed: UI-QUE-001 queue board, UI-QUE-002 unscheduled admit, UI-QUE-003 row transitions
Backend connections: GET /clinical-queue, POST /clinical-queue/unscheduled, POST /clinical-queue/bookings/:id/check-in, POST /clinical-queue/encounters/:id/engage|release|checkout
Automated tests: apps/web/test/ui-module5.test.ts (5 passing)
Manual tests: Pending owner review — docs/UI_MODULE_05_OWNER_TEST_GUIDE.md
Screenshots: Not captured in repo
Known issues: Patient names shown via ID link only; live refresh and reopen encounter deferred
Owner decisions required: None for Module 5 pilot scope
Phase-count progress: 55/55 backend; UI 5/14 modules delivered (4 approved, 5 ready for review)
Weighted frontend progress: ~34%
Next UI module: 6 — Clinical Records
```

## Module completion report template

After each module, the agent will fill:

```
UI module completed: <number/name>
Screens completed:
Backend connections:
Automated tests:
Manual tests:
Screenshots:
Known issues:
Owner decisions required:
Phase-count progress:
Weighted frontend progress:
Next UI module:
```
