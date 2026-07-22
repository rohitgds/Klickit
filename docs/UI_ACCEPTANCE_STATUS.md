# UI Acceptance Status

Tracks the 14 UI modules from the owner frontend integration plan.

| Module | Name | Status | Screens | Backend wired | Auto tests | Owner guide | Owner approved |
|---|---|---|---|---|---|---|---|
| 1 | Login and Application Shell | Approved | 4/4 scaffold | Yes | Yes | `docs/UI_MODULE_01_OWNER_TEST_GUIDE.md` | 2026-07-22 |
| 2 | Dashboard | Not started | 0/1 | No | No | — | — |
| 3 | Patient Registry | Not started | 0/5 | No | No | — | — |
| 4 | Scheduler | Not started | 0/3 | No | No | — | — |
| 5 | Clinical Queue | Not started | 0/3 | No | No | — | — |
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
| UI modules accepted by owner | 1 / 14 |
| Screens connected (OK) | 4 shell screens |
| Estimated frontend completion | ~12% |
| Weighted frontend progress | ~7% (Module 1 approved; Module 2 next) |

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
