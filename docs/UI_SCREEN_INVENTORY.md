# UI Screen Inventory

Track every owner-facing screen. Status codes match `docs/FRONTEND_READINESS_AUDIT.md`.

| Code | Meaning |
|---|---|
| NS | Not started |
| SC | Scaffold only |
| BW | Built, backend not wired |
| OK | Built and connected |
| DEF | Deferred (Blueprint 10) |
| DEC | Requires owner decision |

## Login and shell

| Ref | Screen | Route | Status | Backend routes | Notes |
|---|---|---|---|---|---|
| UI-SHL-001 | Login | `/login` | OK | `/auth/login`, `/auth/dev/session` | Dev session for local demo |
| UI-SHL-002 | Clinic selection | `/select-clinic` | SC | `/identity/clinics` | Single clinic shown in context bar for now |
| UI-SHL-003 | Application shell | `/*` layout | OK | `/clinic/config`, `/security/permissions/effective` | Compact Blueprint 06 navigation |
| UI-SHL-004 | Demo data banner | global | OK | — | Visible on login and app shell |

## Dashboard

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-DSH-001 | Operational dashboard | `/dashboard` | OK | `/dashboard/operational/daily` | Summary counts and quick actions; activity rows deferred |

## Patient Registry

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-PAT-001 | Patient search grid | `/patient-registry` | OK | `/patients/search` | Compact grid with paging |
| UI-PAT-002 | New patient registration | `/patient-registry/register` | OK | `/patients/register` | Identity-first minimal form |
| UI-PAT-003 | Duplicate warning dialog | modal | OK | `/patients/duplicates/review` | Warn on save; queue after create |
| UI-PAT-004 | Patient profile | `/patient-registry/:id` | OK | `/patients/:id/profile` | Care overview tab |
| UI-PAT-005 | Safety summary / alerts | profile tab | OK | `/patients/:id/safety-summary` | Read-only allergies |

## Scheduler

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-SCH-001 | Day/week calendar | `/scheduler` | OK | `/scheduling/views/:viewType` | Month/week/day/resource table views |
| UI-SCH-002 | Booking editor | modal | OK | `/scheduling/bookings` + transitions | Create, confirm, cancel, reschedule |
| UI-SCH-003 | Availability / blackouts | `/scheduler/setup` | OK | `/scheduling/masters`, `/scheduling/blackouts` | Masters list and blackout form |

## Clinical Queue

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-QUE-001 | Queue board | `/clinical-queue` | OK | `/clinical-queue` | Encounters + arrival candidates |
| UI-QUE-002 | Walk-in admit | modal | OK | `/clinical-queue/unscheduled` | Registered patient admit |
| UI-QUE-003 | Check-in / engage / checkout | row actions | OK | queue transition routes | Begin care, release, checkout |

## Clinical records

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-CLN-001 | Encounter workspace | `/clinical/encounters/:id` | NS | `/clinical/encounters/:id/workspace` |
| UI-CLN-002 | Odontogram / tooth records | workspace panel | NS | findings, diagnoses, deliveries |
| UI-CLN-003 | Clinical notes | workspace panel | NS | notes sign/amend |
| UI-CLN-004 | Files and images | workspace panel | NS | `/clinical/files/*` |

## Treatment plans and prescriptions

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-PLN-001 | Care plan editor | encounter tab | NS | `/plans/care-plans/*` |
| UI-PLN-002 | Estimate / acceptance | modal | NS | propose/accept routes |
| UI-RX-001 | Prescription editor | encounter tab | NS | `/medication/orders/*` |
| UI-RX-002 | Doctor PIN signing | dialog | NS | sign + `/medication/signing-pins` |

## Financial operations

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-FIN-001 | Fee statement editor | `/financial-operations/statements/:id` | NS | fee statement routes |
| UI-FIN-002 | Collection / mixed tender | modal | NS | `/finance/collections` |
| UI-FIN-003 | Allocation | modal | NS | `/finance/allocations` |
| UI-FIN-004 | Refund / reversal | dialog | NS | `/finance/refunds` |
| UI-FIN-005 | Patient balance / aging | panel | NS | balance + aging routes |
| UI-FIN-006 | Reconciliation view | panel | NS | `/finance/fee-statements/:id/reconcile` |

## Recall and communications

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-COM-001 | Recall / continuity tasks | `/comms-center/recalls` | NS | `/continuity/tasks/*` |
| UI-COM-002 | Message templates | `/comms-center/templates` | NS | `/messaging/templates` |
| UI-COM-003 | Outbound / delivery status | `/comms-center/messages` | NS | outbound + patient messages |

## Printing

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-PRT-001 | Print preview | modal | NS | print templates + snapshots |

## Settings and permissions

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-CFG-001 | Staff list | `/system-configuration/workforce` | NS | `/identity/staff` |
| UI-CFG-002 | Users and roles | `/system-configuration/access` | NS | users + permissions |
| UI-CFG-003 | Effective permissions viewer | panel | NS | `/security/permissions/effective` |

## Offline, sync, resilience

| Ref | Screen | Route | Status | Backend routes |
|---|---|---|---|---|
| UI-SYN-001 | Sync status panel | shell | SC | `/discovery` only today |
| UI-SYN-002 | Conflict review | `/system-configuration/sync-conflicts` | NS | `/sync/conflicts/open` |
| UI-RSV-001 | Backup / recovery status | `/system-configuration/backup` | NS | resilience routes |
| UI-AUD-001 | Audit history | panel | DEC | **No dedicated read API yet** |

## Deferred (hidden in pilot shell)

| Ref | Screen | Route | Status | Notes |
|---|---|---|---|---|
| UI-ANL-001 | Deep analytics catalog | `/deep-analytics` | DEF | Blueprint 10 excludes advanced catalog |
| UI-AST-001 | Practice assets (inventory/lab) | `/practice-assets` | DEF | Blueprint 10 excluded modules |
