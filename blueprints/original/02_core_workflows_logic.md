# 02 Project DentOS Core Workflows and Automation

## Workflow Authority

This document is the first-party behavioral contract for Project DentOS. `PRODUCT_CONTRACT` identifies required user behavior, `MANDATORY` identifies safety or integrity behavior that cannot be disabled, and `OPTIONAL_DESIGN` identifies a named feature flag whose default state is stated where it appears. Acceptance is established only with the synthetic fixtures and evidence rules in document 07.

## Integrity Rules Applied

- Care booking, Clinical Queue encounter, fee statement, collection receipt, and fee allocation have independent lifecycles.
- New-versus-established patient branches are specified for care booking and walk-in entry.
- Recalls and continuitys have deterministic triggers, deduplication, snooze, completion, and messaging behavior.
- Communication opt-out and provider-webhook state machines are explicit.
- Care plan phases, multi-tooth items, completion, production, and financial operations are separated.
- Medication Order save is the draft-closing action; optional digital signing is immutable and clinically gated when enabled.
- Practice and Workforce configuration includes explicit user provisioning, staff linkage, clinic membership, role assignment, and per-permission overrides.
- Background jobs use an outbox and idempotency keys instead of fragile fire-and-forget calls.

## 1. Dashboard Operational Workflow

`PRODUCT_CONTRACT` controls:

- Scope: `This Clinic`, `My Clinics`
- `Reference Date`
- `Action Log`
- Quick actions: `Register Patient`, `Add to Clinical Queue`, `Create Booking`, `Record Collection`
- Compact grid with sequence, patient name, time, and clinician

### Read behavior

1. Resolve user organization, clinic memberships, default clinic, and permissions.
2. Convert reference date to clinic-local day boundaries.
3. For `This Clinic`, query only the active clinic. For `My Clinics`, union authorized clinics and show clinic identity on each row.
4. Load care booking/encounter summary, action log, collection snapshot, and outstanding tasks independently so one failed widget does not blank the page.
5. Preserve reference date and clinic scope while opening a quick-entry modal and returning to Dashboard.

### Quick actions

- `Register Patient` opens registration without leaving the operational context.
- `Create Booking` opens the New/Established care booking form.
- `Record Collection` creates a collection_receipt. It must not silently create or settle an fee_statement.
- `Record Expense` opens the Practice Assets expense form with clinic and date prefilled.

### Edge cases

- User has one clinic: hide or disable clinic switch without changing query scope.
- User changes clinic while a modal is dirty: require discard confirmation.
- Reference date differs from today: visually persistent date marker; never submit today by accident.
- A saved quick action refreshes only affected grids and counters.

## 2. Patient Registration and Profile Management

### Patient Registry

`PRODUCT_CONTRACT`:

- Commands: `Register Patient`, `Saved Cohorts`, paging, refresh, export
- Search placeholder: `Search name, patient ID, mobile, email`
- Filters: `Location`, `Birth Window`, `Household`, `Acquisition Channel`, `Referring Patient`, `Open Balance Above`, `Custom Attributes`, `Continuity Due`, `Encounter Date`
- Compact columns: `Patient ID`, `Patient`, `Mobile`, `Age / Gender`, `Lead Clinician`, `Last Encounter`, `Next Booking`, `Open Balance`, `Continuity Due`, `Status`, `Actions`

### Search behavior

1. Normalize phone digits, patient code, alternate code, email, and case-insensitive name.
2. Debounce text search by 200-300 ms; pressing Enter searches immediately.
3. Apply advanced filters with AND semantics unless the UI explicitly selects OR.
4. Return stable server-side paging and sorting; never page a client-side subset.
5. `Open Balance Above` uses the current patient net balance, not lifetime fee statements.
6. `Continuity Due` uses active continuity-task or recall due dates.
7. `Encounter Date` joins actual Clinical Queue encounters, not care bookings.

### Register Patient form

`PRODUCT_CONTRACT` dense form order:

1. Row 1: `Mobile Number`, `Given Name`, `Family Name`, generated/read-only `Patient ID`.
2. Row 2: `Preferred Name`, `Honorific`, `Birth Date`, `Gender Identity`, `Lead Clinician`.
3. Row 3: `Email`, `Alternate Phone`, `Communication Language`, `Welcome Consent` with independent SMS and WhatsApp channel choices.
4. Row 4: `Postal Code`, `City`, `Locality`, `Street Address`.
5. Row 5: `Identity Type`, encrypted `Identity Number`, `Acquisition Channel`, conditional `Referred By`.
6. Row 6: `Patient Segment`, `Fee Profile`, `Occupation`, `Emergency Contact`.
7. Row 7: `Registration Notes` spanning the form width.
8. Footer actions: `Save Profile`, `Save and Create Booking`, `Save and Start Encounter`, `Discard`.

### Save transaction

1. Validate at least first name plus one clinic-configured identity/contact requirement.
2. Normalize phone and email, but retain display formatting.
3. Run duplicate candidates by normalized mobile, exact email, alternate code, and fuzzy name plus age/date of birth.
4. Show candidates before commit. Only users with override permission may intentionally duplicate.
5. Lock and allocate the patient serial for the current clinic/period.
6. Insert patient, patient-clinic membership, contacts, flags, custom fields, consent, and medical answers in one transaction.
7. Append audit and outbox events in that transaction.
8. After commit, queue selected welcome messages. A provider failure does not roll back the patient.
9. `Save and Create Booking` opens the booking workspace with the new patient selected; `Save and Start Encounter` creates a Clinical Queue unscheduled encounter.

### KYC and privacy

- Government ID is optional unless clinic policy requires it.
- Store encrypted value and masked last four; do not expose full value in lists, logs, exports, or search results.
- Record consent version and capture time.
- Restrict medical history, allergy, and government-ID access by permission.

### Profile state changes

- New encounter updates `last_encounter_date` only when a real encounter is created.
- Checkout may create the next continuity/recall date.
- Fee Statement/application changes recalculate cached receivable, advance, and net balance.
- Merge marks the duplicate inactive, redirects all foreign keys through a reviewed merge map, retains both patient numbers, and is fully audited.

### Patient care workspace

`PRODUCT_CONTRACT` exact tab order:

```text
Care Overview | Activity Stream | Odontogram | Diagnostics | Care Plan |
Delivered Care | Clinical Notes | Medication Orders | Fee Statements |
Collections | Lab Cases | Files | Communications
```

- `Care Overview`: Edit Profile, Start Encounter, Clinician Summary, Add Continuity Task, Create Booking, and patient-scoped reports.
- `Activity Stream`: chronological bookings, encounters, care deliveries, medication orders, communications, and financial events.
- `Odontogram`: canvas tooth chart with `Tooth Detail`, `Clinical Alert`, service-domain search, and service selection.
- `Diagnostics`: examination and diagnosis history managed by `ClinicalDiagnosticsManager`.
- `Care Plan`: staged care-plan versions and `Create Care Plan`.
- `Delivered Care`: completed and reversed care-delivery history; remains distinct from Care Plan and Fee Statements.
- `Clinical Notes`: `Add Note` opens `Personal Templates` and `Clinic Repository`, with Preview and Select.
- `Medication Orders`: order history and `Create Medication Order`.
- `Fee Statements` and `Collections`: independent patient financial histories and entry commands.
- `Lab Cases`: laboratory-case history and `Create Lab Case`.
- `Files`: patient media and document library managed by `PatientMediaViewer`.
- `Communications`: patient communication history filtered by date, channel, and delivery state; `New Conversation` offers SMS and WhatsApp.

## 3. Care Booking Scheduling and Chair Mechanics

### Scheduler screen

`PRODUCT_CONTRACT`:

- Actions: `Create Booking`, `Reserve Resource Time`, `Refresh`, `Print`
- Views: `Month`, `Week`, `Day`, `Resource Day`, `Resource Week`
- Calendar grid with weekday/date columns and time rows

### Care booking form

`PRODUCT_CONTRACT` resource-first form:

1. Row 1: `Scheduled Date`, `Start Time`, `Duration`, `Operatory`, `Lead Clinician`.
2. Row 2: `Consultation Objective`, `Care Priority`, `Booking Source`, `Coordination Notes`.
3. Row 3: `Patient Mode`, patient type-ahead, mobile preview, consent indicator.
4. New-patient branch: `Mobile Number`, `Given Name`, `Family Name`, `Birth Date`, `Gender Identity`, `Email`.
5. Notification strip: `Patient SMS`, `Patient WhatsApp`, `Clinician Alert`.
6. Footer: `Save Booking`, `Save and Add to Clinical Queue`, `Discard`.

### Slot generation

1. Read clinic schedule, clinician hours, chair hours, holidays, active blocks, and care booking duration.
2. Generate candidate slots in clinic local time; persist UTC timestamps.
3. A slot is available only if its full interval is inside applicable working hours and does not overlap an active block or care_booking.
4. `Resource Day` groups one day by operatory; `Resource Week` groups operatory/date columns across a week.
5. All views use the same care booking IDs and statuses. Switching view cannot duplicate or mutate records.

### Save transaction

1. Resolve established patient or validate new-patient snapshot.
2. Validate clinician, chair, reason, start/end, clinic, and notification choices.
3. Acquire transactional conflict checks for chair and, when enabled, clinician.
4. Reject overlaps with a conflict message showing resource and time. Authorized override requires reason and audit.
5. Allocate care booking number if configured; insert care booking and its first status-history row with `sequence_no = 1`, `from_status = NULL`, `to_status = 'scheduled'`, and reason `CARE_BOOKING_CREATED`.
6. Create outbox events for patient/clinician notifications after commit.
7. Refresh affected calendar range and Dashboard/Clinical Queue projections.

### Reschedule, cancel, and no-show

- Reschedule preserves care booking identity and writes before/after time, clinician, and chair to history.
- Cancel sets `care_bookings.status = 'cancelled'`, stores `cancellation_reason`, `cancelled_at`, and `cancelled_by`, and appends the matching `care_booking_state_events` row in one transaction.
- No-show sets `care_bookings.status = 'no_show'`, stores `no_show_reason`, `no_show_marked_at`, and `no_show_marked_by`, and appends a separate history row. No-show is not cancellation and remains separately reportable.
- The terminal actor is always a `users.id`. Automatic no-show processing uses the clinic's dedicated service-user identity so `changed_by` and `no_show_marked_by` are never null.
- Cancellation notification is queued only when the selected channel remains consented and the clinic policy permits it. Notification failure cannot roll back or alter the care booking state.
- No-show may create one missed-care booking continuity task with idempotency key `care_booking_id + no_show_marked_at`.
- Completed care_bookings cannot be rescheduled. Create a new care booking instead.

### Care Booking attrition settings

The following rows are stored in `clinic_settings` with `group_code = 'schedule'`:

| Setting key | JSON value | Validation | Operational effect |
|---|---|---|---|
| `cancellation_reason_required` | `true` | boolean only | Reject cancellation when the trimmed reason is empty; production default is true |
| `send_cancellation_notice_default` | `true` | boolean only | Preselect patient notice on the cancellation dialog without bypassing consent |
| `auto_mark_no_show_enabled` | `false` | boolean only | Enables the no-show worker; false requires an authorized manual action |
| `no_show_grace_minutes` | `30` | integer from 0 through 1440 | Worker eligibility begins at `care_bookings.ends_at + grace interval` |
| `no_show_reason_required` | `true` | boolean only | Manual no-show requires a reason; worker writes `AUTO_END_PASSED` |
| `send_no_show_continuity` | `true` | boolean only | Creates one continuity/message candidate after a committed no-show |
| `terminal_status_correction_enabled` | `true` | boolean only | Allows an authorized correction from cancelled/no_show back to scheduled |

Missing setting rows use the displayed defaults. Organization-wide rows with `clinic_id IS NULL` are overridden by clinic-specific rows with the same group and key.

### Care booking state transition matrix

| From status | To status | Required condition | History reason |
|---|---|---|---|
| `NULL` | `scheduled` | Care Booking creation validation and interval constraints pass | `CARE_BOOKING_CREATED` |
| `scheduled` | `confirmed` | Authorized confirmation action succeeds | `PATIENT_CORE` or the configured confirmation channel code |
| `confirmed` | `scheduled` | Reschedule policy explicitly resets confirmation | `CONFIRMATION_RESET_BY_RESCHEDULE` |
| `scheduled` | `arrived` | A linked encounter is created or checked in | `PATIENT_ARRIVED` |
| `confirmed` | `arrived` | A linked encounter is created or checked in | `PATIENT_ARRIVED` |
| `arrived` | `completed` | Linked encounter checkout commits | `ENCOUNTER_COMPLETED` |
| `scheduled` | `cancelled` | Cancellation permission, row version, and required reason pass | Exact user-entered cancellation reason |
| `confirmed` | `cancelled` | Cancellation permission, row version, and required reason pass | Exact user-entered cancellation reason |
| `scheduled` | `no_show` | End plus grace has passed and no active encounter exists | Manual reason or `AUTO_END_PASSED` |
| `confirmed` | `no_show` | End plus grace has passed and no active encounter exists | Manual reason or `AUTO_END_PASSED` |
| `cancelled` | `scheduled` | Correction setting, correction permission, future interval, and conflict checks pass | Exact correction reason |
| `no_show` | `scheduled` | Correction setting, correction permission, future interval, and conflict checks pass | Exact correction reason |

Every transition not listed in this matrix is rejected with `CARE_BOOKING_STATUS_TRANSITION_INVALID`. A reschedule that changes time, clinician, or chair without changing status writes a care booking audit event but does not insert a false status transition. A confirmation may be cleared only through the listed authorized reschedule policy; if that policy is disabled, rescheduling retains `confirmed`.

### Reserve Resource Time

1. Choose clinic, interval, optional clinician, optional chair, and reason.
2. Show conflicting care_bookings before save.
3. Clinic policy decides whether blocks with conflicts are rejected or require override.
4. A block appears in every relevant schedule view and availability API.

## 4. Scheduler-to-Clinical-Queue Handoff

### Clinical Queue screen

`PRODUCT_CONTRACT`:

- Filters: Encounter Date, Lead Clinician, patient search by `Name / code`, Type
- Top actions: `Unscheduled Encounter`, `Care Booking`, `Patient`
- Row actions: `Edit`, `Engage`, `CheckIn` or `CheckOut` according to state

### Encounter creation from care booking

1. When the Clinical Queue operational date is loaded, eligible scheduled/confirmed care_bookings are presented as arrival candidates or projected rows according to clinic configuration.
2. Clicking `CheckIn` creates exactly one `care_encounters` row linked to the care booking if none exists.
3. Transactionally set care booking to `arrived`, encounter to `checked_in`, `arrival_at`, `checked_in_at`, and next queue sequence.
4. Repeated clicks with the same idempotency key return the existing care_encounter.
5. The care booking remains the scheduling record; the encounter becomes the operational/clinical record.

### Unscheduled Encounter form

`PRODUCT_CONTRACT`:

- Heading `Patient Encounter`
- `New`, `Established`, `Save`, `Cancel`
- First name, last name, cell phone, age/gender M/F
- Lead clinician, reason, Encounter Date, Time

### Walk-in save

- Established: search/select the patient; insert encounter with `care_booking_id = null`.
- New: create patient plus encounter atomically or use a provisional patient workflow if configured.
- Direct `Patient` action starts from selected patient and skips duplicate demographic entry.
- Allocate queue sequence within clinic/date under lock.

### Encounter state machine

```text
waiting -> checked_in -> engaged -> checked_out
waiting -> engaged                    (only if clinic allows direct engage)
waiting/checked_in -> cancelled
engaged -> checked_in                 (correction permission + reason only)
checked_out -> engaged                (reopen permission + reason only)
```

#### CheckIn

- Set `checked_in_at` once; repeated requests are idempotent.
- Update care booking to arrived when linked.
- Add status-history and queue events.

#### Engage

- Require lead clinician.
- Set `engaged_at`; open the patient clinical workspace.
- Warn if another active encounter for the same patient is engaged.
- Do not create production merely by engaging.

#### CheckOut

1. Validate/sign required clinical notes and medication-order decisions.
2. Complete selected care-plan services and convert completed chargeable services into draft fee statement lines.
3. Show fee statement/collection receipt/collection options but preserve their independence.
4. A clinic may allow checkout without fee statement only with reason and permission.
5. Set `checked_out_at`, update care booking to completed, update patient last encounter, and schedule selected recall/continuity.
6. Emit report-refresh events after commit.

## 5. Recall and Follow-Up Automation

### Trigger sources

- Encounter checkout
- Completed service domain
- Care plan item incomplete
- No-show/cancellation
- Manual patient continuity
- Medication Order/clinical continuity

### Creation algorithm

1. Match active clinic/organization recall rules to the trigger.
2. Compute due date using interval, clinic timezone, and optional working-day adjustment.
3. Deduplicate on patient + rule + source encounter/service.
4. Insert recall/continuity as `scheduled` or `due`.
5. Queue reminders only when contact and purpose-specific consent permit.

### Daily worker

1. Claim due tasks using `FOR UPDATE SKIP LOCKED`.
2. Mark tasks `due`; create staff queue entries.
3. Render channel templates from an allow-listed variable map.
4. Create outbound messages with unique deduplication key.
5. Retry transient provider failures with bounded exponential backoff.

### Lifecycle

```text
scheduled -> due -> contacted -> booked -> completed
due/contacted -> snoozed -> due
any open state -> cancelled
```

Booking links the recall to a care booking; completing the linked encounter completes the recall. A new interval can then be generated from the actual completion date, not the old due date.

### Post-care custom continuity controls

When a clinician changes a `care_deliveries.status` from `in_progress` to `completed`, the completion panel exposes these exact controls before commit:

| Control | Required behavior |
|---|---|
| Follow-Up | Segmented choice `No Follow-Up`, `Clinic Rule`, `Custom Date` |
| Follow-Up Date | Required calendar input when `Custom Date` is selected; clinic-local date |
| Follow-Up Time | Required time input when `Custom Date` is selected; defaults to the matched rule's `due_local_time` or `09:00` |
| Reason | Required stable reason code plus optional clinical note |
| Assign To | Optional staff user responsible for the due queue |
| SMS | Checkbox enabled only when an approved SMS template is resolved |
| WhatsApp | Checkbox enabled only when an approved WhatsApp template is resolved |
| Reminder Times | Compact multi-value control containing distinct nonnegative minute offsets before due time |

The clinician may select a date during service completion or during encounter checkout before the same transaction commits. Checkout cannot overwrite a service-level custom date with a default interval.

### Rule resolution order

For a completed service, candidate `continuity_policies` rows must have `trigger_event = 'service_completed'`, `active = true`, and the same organization. Resolve exactly one rule in this precedence order:

1. Same clinic and exact `service_id`.
2. Same clinic and exact `service_domain_id`.
3. Organization-wide `clinic_id IS NULL` and exact `service_id`.
4. Organization-wide `clinic_id IS NULL` and exact `service_domain_id`.
5. Organization-wide row with both service scope columns null.

Within one precedence level, more than one active rule is a configuration error `CONTINUITY_RULE_AMBIGUOUS`; the completion command stops without changing the service. No candidate means `Use Rule` is unavailable. `Custom Date` remains available only if the resolved rule has `allow_custom_date = true` or clinic policy permits custom dates for users with `clinical.edit`.

### Exact due-date calculation

Let `completion_local_date = (care_deliveries.completed_at AT TIME ZONE clinics.timezone)::date`.

```text
IF completion_continuity_mode = custom_date
THEN IF user-selected completion_continuity_date <= completion_local_date
THEN reject with 422 CONTINUITY_DATE_NOT_FUTURE and preserve service, plan item, continuity, audit, outbox, and message rows
ELSE continue
END IF
THEN due_date = user-selected completion_continuity_date
THEN due_local_time = user-selected time or resolved rule due_local_time
THEN date_mode = custom_date
ELSE IF completion_continuity_mode = rule AND interval_unit = day
THEN due_date = completion_local_date + interval_value days
ELSE IF completion_continuity_mode = rule AND interval_unit = week
THEN due_date = completion_local_date + (interval_value * 7) days
ELSE IF completion_continuity_mode = rule AND interval_unit = month
THEN due_date = completion_local_date + interval_value months using PostgreSQL calendar arithmetic
ELSE IF completion_continuity_mode = rule AND interval_unit = year
THEN due_date = completion_local_date + interval_value years using PostgreSQL calendar arithmetic
ELSE create no continuity task
END IF

due_at = (due_date + due_local_time) AT TIME ZONE clinics.timezone
```

When `adjust_to_working_day = true`, a calculated rule date that falls on a clinic holiday or closed weekday moves forward one local date at a time to the first open clinic date. A user-selected custom date never moves silently; the UI warns and requires the user to retain or change the date.

### Service completion transaction

```text
INPUT care_delivery_id, expected_row_version, completion_continuity_mode, optional custom_date, optional custom_time, reason_code, notes, channel selections, authenticated_user_id

BEGIN one database transaction
LOCK care_deliveries row FOR UPDATE
LOCK linked care_plan_services row when care_plan_service_id is present

IF user lacks care_delivery.complete in the encounter clinic
THEN reject with 403 CARE_DELIVERY_COMPLETE_FORBIDDEN; preserve all rows
ELSE continue
END IF

IF row_version differs OR current service status NOT IN (planned, in_progress)
THEN reject with 409 CARE_DELIVERY_STATE_CONFLICT; preserve all rows
ELSE continue
END IF

IF required signed clinical note is absent
THEN reject with 422 CARE_DELIVERY_COMPLETION_NOTE_MANDATORY; preserve all rows
ELSE continue
END IF

RESOLVE one continuity rule by the documented precedence
VALIDATE custom date, custom time, approved channel templates, reminder offsets, consent-purpose configuration, and clinic timezone
SET completion_event_at = clock_timestamp() once

UPDATE care_deliveries
   SET status = 'completed',
       completed_at = completion_event_at,
       completed_by = authenticated_user_id,
       completion_continuity_mode = selected mode,
       completion_continuity_date = selected custom date only for custom_date mode,
       completion_continuity_local_time = selected custom time only for custom_date mode,
       completion_continuity_notes = notes,
       updated_by = authenticated_user_id

IF care_plan_service_id is present
THEN set care_plan_services.status = 'completed' and completed_care_encounter_id = care_deliveries.care_encounter_id
ELSE change no care plan item
END IF

IF selected mode = none
THEN insert no continuity_tasks row
ELSE calculate due_date and due_at exactly once
THEN INSERT continuity_tasks with source_type = care_delivery, source_id = care_delivery_id, care_delivery_id = care_delivery_id, care_encounter_id, patient_id, clinic_id, organization_id, date_mode, due_date, due_local_time, due_at, rule snapshots, actor, owner, channel templates, reminder offsets, status = scheduled
THEN rely on unique clinic + source + task type + due date to make retries return the existing task
END IF

IF service has orthodontic_program_enrollment_id
THEN update the linked active orthodontic tracking row and create its next monthly task as specified below
ELSE change no orthodontic tracking row
END IF

INSERT outbox event care_delivery.completed with service_id, continuity_task_id, completion_event_at, source row_version
COMMIT

AFTER COMMIT materialize scheduled message rows for every enabled channel and reminder offset
```

The deferred database trigger blocks commit when a completed service has `completion_continuity_mode` equal to `rule` or `custom_date` but no matching non-cancelled `continuity_tasks` row exists. Service completion, continuity creation, plan-item completion, orthodontic state update, audit event, and outbox event therefore succeed or roll back together.

### Patient next-continuity cache

After continuity create, due-date change, completion, cancellation, booking, or snooze, projection refresh calculates:

```sql
UPDATE patients p
SET next_continuity_date = x.next_due_date
FROM (
  SELECT ft.patient_id,
         MIN(CASE WHEN ft.status = 'snoozed' THEN ft.snoozed_until::date ELSE ft.due_date END) AS next_due_date
  FROM continuity_tasks ft
  WHERE ft.status IN ('scheduled','due','contacted','snoozed')
  GROUP BY ft.patient_id
) x
WHERE p.id = x.patient_id;
```

Patients with no open task are updated to `next_continuity_date = NULL` in a separate anti-join update. This field is a cache for search; reports read `continuity_tasks` directly.

### Orthodontic monthly tracking enrollment

An orthodontic patient is not inferred from free text, a current Fee Statement description, or a patient category name. Enrollment creates a `patient_flag_assignments` row with:

```text
flag code = ORTHODONTIC_ACTIVE
tracking_program = orthodontic_monthly
program_status = active
clinic_id = treating clinic
patient_id = established patient
treating_clinician_id = orthodontist
enrolled_on = clinic-local enrollment date
expected_encounter_interval_months = integer 1 through 24; default 1
preferred_day_of_month = integer 1 through 28
next_adjustment_due_date = first expected adjustment date
default_adjustment_service_id = configured wire-change or adjustment service
appliance_type, orthodontic_stage, current_wire = clinical tracking values
```

`active -> paused` suspends new care booking-reminder and continuity generation but retains reports when `include_paused = true`. `paused -> active` requires a new `next_adjustment_due_date`. `active|paused -> completed|cancelled` stamps `ended_on`, `ended_by`, and `end_reason`, cancels unsent future reminders, and retains care_bookings, encounters, services, and historical tasks.

### Orthodontic care booking and adjustment linkage

- Every recurring adjustment care booking stores `care_bookings.orthodontic_program_enrollment_id`.
- The database verifies that the care booking patient and clinic match the tracking assignment.
- Every wire-change or adjustment service stores `care_deliveries.orthodontic_program_enrollment_id`.
- The database verifies that the service encounter patient and clinic match the tracking assignment.
- General emergency or hygiene care_bookings for an orthodontic patient leave this link null and do not enter the orthodontic churn denominator.

When a linked adjustment service completes on local date `D`, calculate the next target month and date:

```text
target_month_start = date_trunc('month', D)::date + expected_encounter_interval_months months
next_adjustment_due_date = target_month_start + (preferred_day_of_month - 1) days
```

Because `preferred_day_of_month` is limited to 1 through 28, this date exists in every target month. In the same transaction:

1. Set `last_adjustment_care_encounter_id = care_deliveries.care_encounter_id`.
2. Update `current_wire` and `orthodontic_stage` from the completion panel when supplied.
3. Set `next_adjustment_due_date` to the calculated date.
4. Complete the prior open orthodontic continuity task linked to the attended adjustment.
5. Insert the next `continuity_tasks` row with `source_type = 'orthodontic_program'`, `source_id = patient_flag_assignments.id`, `task_type = 'orthodontic_monthly_adjustment'`, and the new due date.
6. Materialize consent-aware SMS and WhatsApp reminders after commit.

## 6. Communication Gateway

### Specified screens and controls

- Messages: `SMS`, `email`, `Routine SMS`, `Bulk SMS`, `SMS Templates`
- Bulk SMS: route `Promotional` or `Transactional`, recipient list, `Next`
- System Configuration: Sender ID, SMS/email, WhatsApp, templates
- Account: SMS messages/credits/free credits, OTP settings

### Send pipeline

1. Resolve purpose (`care`, `transactional`, `marketing`, `otp`) and channel.
2. Check patient channel/purpose preference and global suppression.
3. Validate provider-approved template and variables when required.
4. Estimate SMS segments/credits or WhatsApp template charge.
5. Persist one message per recipient plus batch summary before provider call.
6. Worker sends with provider idempotency key and stores provider message ID.
7. Webhooks append status events and update monotonic message state.

### Continuity reminder materialization

For each committed `continuity_tasks` row with status `scheduled`, iterate over the persisted distinct `reminder_offsets_minutes` and enabled channels. This iteration creates rows; it never skips an offset or channel in documentation or code.

```text
FOR each reminder_offset_minutes in continuity_tasks.reminder_offsets_minutes
  scheduled_at = continuity_tasks.due_at - reminder_offset_minutes minutes

  IF continuity_tasks.send_sms = true
  THEN evaluate SMS eligibility and create one SMS outcome row
  ELSE create no SMS row
  END IF

  IF continuity_tasks.send_whatsapp = true
  THEN evaluate WhatsApp eligibility and create one WhatsApp outcome row
  ELSE create no WhatsApp row
  END IF
END FOR
```

The exact deduplication key is:

```text
CONTINUITY:{continuity_task_id}:V{reminder_generation_version}:{channel}:OFFSET:{reminder_offset_minutes}
```

The materializer inserts one `outbound_messages` row for every enabled channel/offset outcome. Eligible rows use `status = 'queued'`; ineligible rows use `status = 'suppressed'` and a required suppression reason. The allowed suppression reasons are `PATIENT_OPTED_OUT`, `CONSENT_UNKNOWN`, `NO_VALID_RECIPIENT`, `TEMPLATE_NOT_APPROVED`, `TEMPLATE_PURPOSE_MISMATCH`, `TASK_NOT_ACTIVE`, `CARE_BOOKING_ALREADY_BOOKED`, and `DUPLICATE_MESSAGE`.

### Consent and template decision table

| Condition at materialization or dispatch | Result |
|---|---|
| Preference is `opted_out` for exact patient, channel, and purpose | Suppress with `PATIENT_OPTED_OUT` |
| Preference is `unknown` and clinic policy is `suppress_unknown` | Suppress with `CONSENT_UNKNOWN` |
| Preference is `unknown` and clinic policy is `allow_care_unknown`, purpose is `care`, and an active care relationship exists | Continue |
| Preference is `opted_in` | Continue |
| No normalized deliverable mobile for SMS or WhatsApp | Suppress with `NO_VALID_RECIPIENT` |
| Template is inactive, not approved, wrong organization, wrong channel, or wrong purpose | Suppress with the matching template reason |
| Continuity is completed, cancelled, or already booked | Suppress or cancel with the matching task reason |
| Every check passes | Encrypt recipient, store recipient hash, render allow-listed variables, and queue |

Allowed continuity variables are `patient_first_name`, `patient_display_name`, `clinic_name`, `clinic_phone`, `clinician_name`, `continuity_date`, `continuity_time`, `continuity_reason`, and `booking_link`. Missing required variables suppress the row with `TEMPLATE_VARIABLE_MISSING`; arbitrary SQL expressions and template-supplied property paths are forbidden.

### Due-date change behavior

```text
IF an open continuity due_date, due_local_time, template, enabled channel, or reminder offset changes
THEN increment reminder_generation_version
THEN set old draft, queued, or retry rows to cancelled with source audit reason CONTINUITY_SCHEDULE_REPLACED
THEN retain submitted, sent, delivered, failed, and suppressed rows unchanged as history
THEN materialize the complete new channel/offset set using the new versioned deduplication keys
ELSE leave existing message rows unchanged
END IF
```

### Provider-submit claim

Every minute, the existing `provider-submit` worker claims at most the configured batch size:

```sql
SELECT om.id
FROM outbound_messages om
JOIN continuity_tasks ft ON ft.id = om.continuity_task_id
WHERE om.status IN ('queued','retry')
  AND om.scheduled_at <= clock_timestamp()
  AND COALESCE(om.next_attempt_at, om.scheduled_at) <= clock_timestamp()
  AND ft.status IN ('scheduled','due','contacted')
ORDER BY om.scheduled_at, om.id
FOR UPDATE OF om SKIP LOCKED;
```

For each claimed row, the worker repeats consent, recipient, task-state, template-approval, and clinic-scope checks. A newly detected opt-out suppresses the row without contacting the provider. An eligible row is sent with `deduplication_key` as the provider idempotency key, then stores `provider_message_id`, increments `attempt_count`, and changes status to `submitted` in one transaction.

Retry delays are exactly 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours after attempts 1 through 5. HTTP 408, HTTP 429, and provider 5xx responses retry. Invalid recipient, rejected template, authentication failure, and provider-declared permanent errors become `failed` immediately. Exhausting attempt 5 becomes `failed` and creates a communications-admin alert.

### Continuity webhook application

1. Verify provider HMAC signature against the raw request body and configured secret.
2. Reject timestamps outside the configured replay window.
3. Resolve exactly one `outbound_messages.provider_message_id`.
4. Insert `message_status_events` using the provider event ID; the unique constraint makes duplicate delivery idempotent.
5. Map provider state to rank: submitted `10`, sent `20`, delivered `30`, failed `90`.
6. Apply `sent_at`, `delivered_at`, or `failed_at` only when the incoming rank is greater than the stored nonfailure progression or supplies the terminal failure outcome.
7. Never change `delivered` back to `sent`, `submitted`, or `retry`.
8. Commit the event and current-state update together, then refresh message and continuity communication projections.

### Inbound opt-out effect

When a signed inbound SMS or WhatsApp webhook contains a configured normalized stop keyword, the processor inserts `inbound_messages` with `optout_detected = true`, upserts `communication_preferences.status = 'opted_out'` for the matching channel/purpose scope, stamps `changed_at` and the provider service user in `changed_by`, and changes every unsent matching draft/queued/retry message to `suppressed` with `PATIENT_OPTED_OUT`. Submitted, sent, delivered, and failed rows remain immutable delivery history.

### Status machine

```text
draft -> queued -> submitted -> sent -> delivered
draft/queued/retry -> suppressed
queued/submitted -> retry -> submitted
queued/submitted/sent/retry -> failed
draft/queued/retry -> cancelled
```

Late or duplicate webhooks may not regress `delivered` to `sent`. Provider event IDs are unique.

### Opt-out

- Marketing opt-out suppresses promotional messages immediately.
- Transactional/care messages follow jurisdiction and clinic policy but still require a valid care relationship and configured consent basis.
- Recognized inbound opt-out keywords update preference, audit the source, and suppress future matching messages.
- Bulk recipient preview must show selected, suppressed, invalid, and duplicate counts before `Next`/send.

### Failure handling

- Patient/care booking/collection receipt save succeeds even if notification fails.
- Permanent address/template errors fail without retry.
- Rate limit/provider outage retries with backoff and dead-letter alert.
- Credit exhaustion pauses queued SMS and creates an admin alert; it does not drop messages.

## 7. Clinical Treatment Planning

The live patient workspace confirmed separate `Chart`, `Exam`, `Plan`, and `Services` tabs.

### Plan workflow

1. Open `Plan` and choose `Create Care Plan`.
2. Enter `Proposed On`, `By` (clinician), `Status`, and `Comments`; `Amount` is displayed/derived.
3. Search services by text and `Category`, then `AddCharge` from the catalog.
4. If needed, add a service on the fly. The specified service form contains `Description`, `Type`, `Fees`, `Code`, `Cost`, `Tax Rate`, `Treatment Area`, `Material Options`, `Show in Plan Options`, `Can be Assessed`, and `Favourite`.
5. Save the care_plan. Service history and financial operations remain separate tabs.

### Rules

- Plan status uses the configured Project DentOS master/value set; do not hard-code an unverified acceptance state machine in DentOS core mode.
- Tooth, treatment area, material, and bridge choices are structural where the selected service requires them.
- A plan charge can be marked `Can be Assessed`; planning does not itself create a fee statement or collection.
- Service master edits do not rewrite saved plan/fee statement snapshots.
- Phases, partial acceptance, and multi-stage plan scheduling are useful modern extensions but were not visible in the audited form. Keep them disabled in DentOS core mode.

### Stock interaction

If service templates define consumables, completion can create a draft goods-outward proposal. Stock is reduced only when the stock document is posted, avoiding duplicate consumption on clinical edits.

## 8. Digital Medication Order Workflow

### Specified Project DentOS surface and required integrated record

The authorized Medication Studio contract exposes `Medication Domains`, `Active Ingredients`, `Medication Catalog`, `Administration Patterns`, and `Medication Protocols`. The Medication Detail screen exposes `Medication Name`, multi-value `Domains`, `Dosage Form`, `Priority Pin`, `Contraindications`, default `Dose Instruction`, `Frequency Expression`, `Duration`, `Duration Unit`, `Patient Directions`, `Add Strength Option`, and `Add Active Ingredient` with quantity. Medication Protocol exposes `Protocol Name`, `Protocol Notes`, repeatable medication lines, `Strength`, `Dose Instruction`, `Frequency Expression`, `Duration`, `Duration Unit`, `Patient Directions`, medication `Search`, and `Domain`. The patient Medication Order Builder exposes `Save as Protocol`, `Save`, `Cancel`, `Prescribing Clinician`, `Order Date`, `Clinical Guidance`, `Medication Lines`, `Recommended Protocol`, `Medication Catalog Search`, `Medication Domain`, and priority-pin actions.

The database treats Diagnosis, Recommended Service, and Medication Lines as one encounter-bound clinical record even when the visual workspace uses compact sections. The parent is `medication_orders`; its three ordered child collections are `medication_order_diagnoses`, `medication_order_service_links`, and `medication_order_lines`. Every parent has a non-null `care_encounter_id`, `patient_id`, `clinic_id`, and `clinician_id`. Save or sign is rejected unless all three child collections contain at least one row.

### Master-data configuration transactions

#### Predefined diagnosis

1. Require `configuration.practice.edit` and an active organization membership.
2. Accept `code`, `name`, optional `icd10_code`, `description`, `default_clinical_note`, explicit search `keywords`, `display_order`, and `active`.
3. Normalize code by trimming and uppercasing before uniqueness validation; preserve the entered display name.
4. Reject a blank code, blank name, negative display order, duplicate organization/code, or duplicate case-insensitive organization/name.
5. Insert or update `diagnosis_catalog`, append the audit event, increment `row_version`, and evict the diagnosis type-ahead cache for that organization.
6. Deactivation removes the diagnosis from new searches but never changes `encounter_diagnoses` or `medication_order_diagnoses` snapshots.

#### Service and domain

1. Require `configuration.practice.edit`.
2. Select one `service_domains` row before saving a `service_catalog` row.
3. Store `service_catalog.service_domain_id`; reject a domain from another organization.
4. Store service `code`, `description`, default duration, treatment area policy, material options, priority-pin state, financial operations eligibility, fees, cost, and tax.
5. Example master relationship: `Root Canal Treatment` is one `service_catalog` row whose `service_domain_id` resolves to the `Endodontics` domain row.
6. Deactivation removes the service from new type-ahead results while historical recommended-service and medication-order snapshots remain unchanged.

#### Medication, active-ingredient, administration, and safety mappings

1. Require `configuration.practice.edit`.
2. Create each administration phrase in `administration_patterns` with `take_text`, `frequency`, optional `route`, optional duration value/unit, and patient directions.
3. Create each active ingredient in `active_ingredient_catalog` with a stable code and searchable name.
4. Create the medication in `medication_catalog` with brand name, primary domain, primary active ingredient, dosage form, optional displayed strength, contraindication text, priority-pin flag, keywords, and default administration pattern.
5. Insert every selected domain into `medication_domain_links`; exactly one active row has `is_primary = true` and equals `medication_catalog.primary_domain_id`.
6. Insert every active ingredient and quantity into `medication_ingredient_links`; the primary ingredient equals `medication_catalog.active_ingredient_id` and additional ingredients remain independently searchable.
7. Insert every displayed strength into `medication_strength_options` in deterministic sequence order.
8. Insert age/weight-specific administration choices into `medication_administration_defaults`; overlapping rows are allowed only when their `priority_rank` differs, and the lowest rank wins.
9. Map each structured allergy master to affected active ingredients through `allergy_ingredient_rules`, selecting exactly one action: `block`, `warn`, or `information`.
10. Reject a domain, active ingredient, administration pattern, or allergy mapping from another organization. Deactivate referenced masters instead of deleting them.

#### Medication protocol

1. Require `configuration.practice.edit`; `medication_order.create` alone cannot modify shared master data.
2. Create a `medication_protocols` row with status `draft`, active `false`, stable code, name, comments, medication order note, and version.
3. Insert each medication line into `medication_protocol_lines` with `medication_id`, `administration_pattern_id`, `strength_option_text`, explicit overrides, required flag, and sequence.
4. Insert every diagnosis recommendation key into `medication_protocol_diagnosis_links` with match weight, autoload flag, and sequence.
5. Insert every recommended-service key into `medication_protocol_service_links` with match weight, autoload flag, and sequence.
6. Validate that the protocol, medication, administration pattern, diagnosis, and service all belong to the same organization.
7. Change the protocol to `active` and active `true` only after at least one active medication line exists.
8. An active version is immutable. Editing creates version `N + 1` as a new draft; retiring version `N` sets status `retired` and active `false` without changing medication_orders that snapshot version `N`.

### Type-ahead query contracts

Diagnosis search executes after two entered characters or immediately for an exact code. It returns at most 20 active rows:

```sql
SELECT
  pd.id,
  pd.code,
  pd.name,
  pd.icd10_code,
  pd.default_clinical_note
FROM diagnosis_catalog pd
WHERE pd.organization_id = $1
  AND pd.active = true
  AND (
    lower(pd.code) LIKE lower($2) || '%'
    OR lower(pd.name) LIKE '%' || lower($2) || '%'
    OR lower($2) = ANY(SELECT lower(keyword) FROM unnest(pd.keywords) AS keyword)
  )
ORDER BY
  CASE WHEN lower(pd.code) = lower($2) THEN 0 WHEN lower(pd.code) LIKE lower($2) || '%' THEN 1 ELSE 2 END,
  similarity(lower(pd.name), lower($2)) DESC,
  pd.display_order,
  pd.name,
  pd.id
LIMIT 20;
```

Recommended-service search always returns the structural domain:

```sql
SELECT
  pc.id,
  pc.code,
  pc.description AS service_name,
  pcat.id AS domain_id,
  pcat.code AS domain_code,
  pcat.name AS domain_name,
  pc.priority_pinned,
  pc.default_minutes
FROM service_catalog pc
JOIN service_domains pcat ON pcat.id = pc.service_domain_id
WHERE pc.organization_id = $1
  AND pc.active = true
  AND pcat.active = true
  AND (
    lower(pc.code) LIKE lower($2) || '%'
    OR lower(pc.description) LIKE '%' || lower($2) || '%'
    OR lower(pcat.name) LIKE '%' || lower($2) || '%'
  )
ORDER BY
  pc.priority_pinned DESC,
  CASE WHEN lower(pc.code) = lower($2) THEN 0 WHEN lower(pc.code) LIKE lower($2) || '%' THEN 1 ELSE 2 END,
  similarity(lower(pc.description), lower($2)) DESC,
  pc.description,
  pc.id
LIMIT 20;
```

Medication search uses domain, brand, strength, and every active ingredient:

```sql
SELECT
  d.id,
  d.brand_name,
  d.strength,
  d.dosage_form,
  d.priority_pinned,
  array_agg(DISTINCT dc.name ORDER BY dc.name) AS domain_names,
  array_agg(DISTINCT dg.name ORDER BY dg.name) AS active_ingredient_names,
  dt.id AS default_administration_pattern_id,
  dt.take_text,
  dt.frequency,
  dt.duration_value,
  dt.duration_period,
  dt.instructions
FROM medication_catalog d
JOIN medication_domain_links dca ON dca.medication_id = d.id AND dca.active = true
JOIN medication_domains dc ON dc.id = dca.domain_id AND dc.active = true
JOIN medication_ingredient_links di ON di.medication_id = d.id AND di.active = true
JOIN active_ingredient_catalog dg ON dg.id = di.active_ingredient_id AND dg.active = true
LEFT JOIN administration_patterns dt ON dt.id = d.default_administration_pattern_id AND dt.active = true
WHERE d.organization_id = $1
  AND d.active = true
  AND ($3::uuid IS NULL OR dca.domain_id = $3)
  AND (
    lower(d.brand_name) LIKE '%' || lower($2) || '%'
    OR lower(COALESCE(d.strength, '')) LIKE '%' || lower($2) || '%'
    OR lower(dg.name) LIKE '%' || lower($2) || '%'
    OR EXISTS (
      SELECT 1 FROM medication_strength_options dp
      WHERE dp.medication_id = d.id AND dp.active = true AND lower(dp.strength_option_text) LIKE '%' || lower($2) || '%'
    )
  )
GROUP BY d.id, d.brand_name, d.strength, d.dosage_form, d.priority_pinned,
         dt.id, dt.take_text, dt.frequency, dt.duration_value, dt.duration_period, dt.instructions
ORDER BY d.priority_pinned DESC, similarity(lower(d.brand_name), lower($2)) DESC, d.brand_name, d.id
LIMIT 30;
```

### Deterministic medication-protocol recommendation

The client sends the selected diagnosis IDs and service IDs. The server never accepts a client-supplied recommendation score. Candidate protocols and scores are calculated as follows:

```sql
WITH selected_diagnoses AS (
  SELECT unnest($2::uuid[]) AS diagnosis_id
),
selected_services AS (
  SELECT unnest($3::uuid[]) AS service_id
),
diagnosis_scores AS (
  SELECT ptd.medication_protocol_id, SUM(ptd.match_weight) AS diagnosis_score, COUNT(*) AS diagnosis_matches
  FROM medication_protocol_diagnosis_links ptd
  JOIN selected_diagnoses sd ON sd.diagnosis_id = ptd.diagnosis_id
  WHERE ptd.autoload = true
  GROUP BY ptd.medication_protocol_id
),
service_scores AS (
  SELECT ptp.medication_protocol_id, SUM(ptp.match_weight) AS service_score, COUNT(*) AS service_matches
  FROM medication_protocol_service_links ptp
  JOIN selected_services sp ON sp.service_id = ptp.service_id
  WHERE ptp.autoload = true
  GROUP BY ptp.medication_protocol_id
),
candidates AS (
  SELECT
    pt.id,
    pt.code,
    pt.name,
    pt.version,
    COALESCE(ds.diagnosis_score, 0) AS diagnosis_score,
    COALESCE(ps.service_score, 0) AS service_score,
    COALESCE(ds.diagnosis_matches, 0) AS diagnosis_matches,
    COALESCE(ps.service_matches, 0) AS service_matches
  FROM medication_protocols pt
  LEFT JOIN diagnosis_scores ds ON ds.medication_protocol_id = pt.id
  LEFT JOIN service_scores ps ON ps.medication_protocol_id = pt.id
  WHERE pt.organization_id = $1
    AND pt.status = 'active'
    AND pt.active = true
    AND (ds.medication_protocol_id IS NOT NULL OR ps.medication_protocol_id IS NOT NULL)
)
SELECT
  id,
  code,
  name,
  version,
  diagnosis_score,
  service_score,
  diagnosis_matches,
  service_matches,
  diagnosis_score + service_score + CASE WHEN diagnosis_matches > 0 AND service_matches > 0 THEN 2.0000 ELSE 0.0000 END AS recommendation_score
FROM candidates
ORDER BY recommendation_score DESC, diagnosis_matches DESC, service_matches DESC, name, version DESC, id
LIMIT 10;
```

IF exactly one candidate has the highest score and its mapped row has `autoload = true`, THEN show it as the selected recommendation and expose `Load Protocol` as the next keyboard target.

ELSE IF multiple candidates share the highest score, THEN show the ordered protocol dropdown and require the clinician to choose one.

ELSE show the medication search immediately and do not invent a protocol.

### Medication-protocol loading and line expansion

1. Fetch the selected active `medication_protocols` row by ID and exact version.
2. Fetch `medication_protocol_lines` ordered by `sequence_no`, joining `medication_catalog`, active `medication_ingredient_links`, `active_ingredient_catalog`, and `administration_patterns`.
3. For each item, use an explicit line override when present; otherwise use the selected administration-pattern value; otherwise use the medication default administration pattern.
4. Copy the medication name, active-ingredient text, strength, dosage form, take text, frequency, duration, duration unit, and patient directions into editable draft rows.
5. Preserve `source_protocol_id`, `source_protocol_version`, and each `source_protocol_line_id`; protocol edits cannot change the loaded draft.
6. Do not silently replace manually edited lines when diagnosis or service selection changes. Recalculation displays a compact `Recommendation changed` notice with `Keep Current` and `Reload Protocol`.
7. Loading a second protocol requires `Replace Draft Lines` or `Append Medications`. `Replace Draft Lines` removes only unsaved draft rows; `Append Medications` deduplicates exact `medication_id + administration_pattern_id + strength_option_text` matches and reports skipped rows.

### Allergy and contraindication gate

For every selected medication, expand all active ingredients and compare them with active patient allergies:

```sql
SELECT
  d.id AS medication_id,
  d.brand_name,
  dg.id AS active_ingredient_id,
  dg.name AS active_ingredient_name,
  ac.id AS allergy_id,
  ac.name AS allergy_name,
  agx.interaction_level,
  agx.warning_text,
  pa.severity,
  pa.reaction
FROM medication_catalog d
JOIN medication_ingredient_links di ON di.medication_id = d.id AND di.active = true
JOIN active_ingredient_catalog dg ON dg.id = di.active_ingredient_id
JOIN allergy_ingredient_rules agx ON agx.active_ingredient_id = dg.id AND agx.active = true
JOIN patient_allergies pa ON pa.allergy_id = agx.allergy_id AND pa.patient_id = $1 AND pa.active = true
JOIN allergy_catalog ac ON ac.id = pa.allergy_id
WHERE d.id = ANY($2::uuid[])
ORDER BY
  CASE agx.interaction_level WHEN 'block' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END,
  d.brand_name,
  dg.name,
  ac.name;
```

IF any result has `interaction_level = 'block'`, THEN disable Save and Sign, identify the medication and active ingredient, and require removal or an authorized clinical override capability configured by policy.

ELSE IF any result has `interaction_level = 'warn'`, THEN require the prescribing clinician to acknowledge each warning before Save or Sign; store the acknowledgement in the medication-order audit payload.

ELSE display informational matches without interrupting keyboard flow.

Free-text contraindications are always displayed on medication selection but never converted into an automatic patient-specific decision without a structured mapping.

### Encounter-bound save transaction

1. Require `medication_order.create`; require `medication_order.edit_draft` when updating an existing draft.
2. Lock `care_encounters` and the draft `medication_orders` row with `FOR UPDATE` and verify submitted `row_version`.
3. Verify that encounter, patient, clinic, prescribing clinician, and authenticated clinic membership agree.
4. Insert or reuse the selected `encounter_diagnoses`; copy master code/name and tooth context into immutable snapshots.
5. Insert or reuse `encounter_service_recommendations`; copy service code, description, domain, tooth context, and diagnosis link into immutable snapshots.
6. Insert the draft `medication_orders` parent and ordered `medication_order_diagnoses`, `medication_order_service_links`, and `medication_order_lines` children.
7. Resolve every master ID again inside the transaction; reject inactive newly selected masters, cross-organization IDs, stale protocol versions, blank administration fields, or a duplicate line sequence.
8. Re-run the allergy query after locks are acquired. A warning acknowledged against an older allergy version does not satisfy the current transaction.
9. IF the command is `Save`, THEN set status `saved`, `saved_at`, and `saved_by`; append audit event `medication_order.save` and outbox event `medication_order.saved`.
10. IF the command is `Save and Sign`, THEN also require `medication_order.sign`, an active `staff_user_links` row linking the authenticated user to `clinician_id`, and the signing confirmation; set status `signed` and write signature fields in the same transaction.
11. IF validation fails, THEN roll back the parent, all three child collections, audit row, outbox row, and idempotency response together.
12. Cancel closes the unsaved browser draft after dirty confirmation and performs no database write.

### Canonical signing payload

The signature hash is SHA-256 over canonical UTF-8 JSON with lexicographically sorted object keys and arrays ordered by `sequence_no`. The payload contains `medication_order_id`, organization ID, clinic ID, patient ID, encounter ID, clinician ID, medication-order reference, medication-order date, notes, source protocol ID/version, ordered diagnosis snapshot fields, ordered service snapshot fields, ordered medication snapshot/administration fields, and the final saved `row_version`. It excludes rendered file ID, browser state, audit timestamps, and mutable display preferences.

IF the live-conformance feature flag disables cryptographic signing, THEN the visible command remains `Save` and the record ends in `saved`; the selected clinician, saved actor, timestamp, and audit history still identify authorship.

IF signing is enabled, THEN show `Save and Sign`; a separate user with `configuration.practice.edit` cannot sign unless that user also has `medication_order.sign` and is actively linked to the selected clinician.

Signed and void medication_orders are immutable. A void operation requires `medication_order.void`, reason, actor, and time; it preserves the original snapshots and any signature.

### Sub-30-second keyboard path

| Elapsed target | Clinician action | System response |
|---|---|---|
| 0-2 seconds | Open `Create Medication Order` from the active encounter | Prescribing Clinician, Order Date, encounter context, prior allergies, and recent diagnosis/service context load in parallel |
| 2-6 seconds | Focus Diagnosis and type two characters; press ArrowDown and Enter | Up to 20 ranked diagnoses appear without changing panel height; default note is copied into the draft context |
| 6-10 seconds | Focus Suggested Service; type or accept the linked service | Service and structural domain appear as one compact token; recommendation request starts |
| 10-14 seconds | Press Enter on `Load Protocol` | Ordered medication lines populate with medication, active ingredient, strength, dose instruction, frequency, duration, and patient directions |
| 14-22 seconds | Review warnings and edit any administration cell with Tab navigation | Line dimensions remain fixed; no mouse is required for the primary path |
| 22-27 seconds | Focus Clinical Guidance and enter optional text | Draft remains local until Save or Save and Sign |
| 27-30 seconds | Press the configured save shortcut and confirm signing when enabled | One idempotent transaction freezes the clinical record and queues rendering |

The 30-second objective is measured after the patient encounter is already open, with warm application assets and representative organization masters. The performance budget is diagnosis type-ahead p95 under 250 ms, service type-ahead p95 under 250 ms, medication type-ahead p95 under 300 ms, recommendation p95 under 350 ms, protocol expansion p95 under 300 ms, and save acknowledgement p95 under 900 ms.

### Rendering and continuity interaction

Print uses the versioned Medication Order print settings and the committed clinical snapshots, never current master labels. `medication order-render` claims `medication_order_id + row_version + status`; signing or voiding produces a new artifact while retaining prior artifact history.

Medication Order save does not itself create revenue, collection, a fee statement, a stock movement, or a continuity. A service transition to `completed` invokes the Post-care custom continuity transaction defined earlier in this document. When checkout performs both commands, service completion and its continuity task commit before the encounter can become `checked_out`; medication order rendering and reminder materialization occur after commit through separate idempotent workers.

## 9. Patient Fee Statementing, Collections, and Lab

### New Fee Statement

`PRODUCT_CONTRACT` fields/actions:

```text
New Fee Statement | Statement Date | Fee Statement No | Comments | Amount | Paid | Save | Cancel
service Search | Category | add charge | Rate | Notes | discount toggle
```

1. Select/add service charges from the same configured catalog used by Plan.
2. Preserve the rate and notes snapshot on the fee statement line.
3. Calculate Amount; derive Paid from settlements/collections rather than allowing an arbitrary edit.
4. Save creates production. It does not create collection.

### Record Collection

`PRODUCT_CONTRACT` patient form:

```text
Amount | Collection Method | Collection Reference | Collection Date | Cheque/Ref # | Notes | Save | Cancel
```

Dashboard `Record Collection` additionally starts with Patient selection and uses `Collection Reference`; Cheque/Ref is conditional by collection method.

<!-- BLOCKED BY UNRESOLVED-06: single-method Collection entry is assumed here for spec completeness; do not implement until FIN-DEC-06 passes per 07. -->
1. One visible collection entry has one collection method. DentOS core mode creates a separate collection/collection receipt for each mode.
2. Save creates collection and a collection receipt number/date record, freezing patient category and selected encounter/attending-clinician context; patient-level advances without encounter remain Unassigned.
3. The form does not expose fee statement selection or an Apply/Settle command.
4. Backend settlement is nevertheless required because specified reports distinguish fee allocations, open fee exposure, collections not settled against fees, and unallocated collections/advance.
<!-- BLOCKED BY UNRESOLVED-01: explicit settlement with optional clinic-versioned automation is assumed here for spec completeness; do not implement automatic settlement until FIN-DEC-01 passes per 07. -->
5. Until the automatic settlement rule is confirmed with synthetic transactions, keep application policy configurable and covered by `07_acceptance_criteria.md`.

<!-- BLOCKED BY UNRESOLVED-04: proportional line-level clinician attribution is assumed here for spec completeness; do not implement until FIN-DEC-04 passes per 07. -->
When an application is created, atomically write the application header, tender allocations, fee statement-line allocations, and line-by-tender `clinician_value_allocations`. Their sums must all equal the application amount. Reversal retains these rows, records reversal date/actor/reason, restores collection receipt unapplied and Fee Statement due, and emits projection events without changing original collection.

<!-- BLOCKED BY UNRESOLVED-05: reverse-or-reallocate-before-refund behavior is assumed here for spec completeness; do not implement until FIN-DEC-05 passes per 07. -->
A posted refund retains its own refund date and mode rows. Reversal retains the original refund event and creates an equal negative refund effect on reversal date; it does not delete the original Day-wise refund history.

### Create Lab Case

`PRODUCT_CONTRACT` fields:

```text
Ref No | Lab Work | Assigned To Lab | Teeth | Shade and Notes |
Request Date | Requested By | Expected Date | Work Status | Work Step |
Received Date | Received By | Amount
```

Save creates the job and status history; it does not create supplier/lab collection. Expected-date and received-date reports use their matching fields.

## 10. Practice Assets and Inventory Workflow

`PRODUCT_CONTRACT` Practice Assets tabs: Expenses, Goods Inward, Goods Outward, In Stock.

### Expense

1. Select expense date, head, supplier/lab if relevant, collection method, amount, and notes.
2. Allocate voucher serial; validate reference for configured modes.
3. Post expense and balanced journal entry atomically.
4. Void with permission and reason; create reversal journal entry.

### Goods inward/outward

1. Create draft stock document and item lines.
2. Validate units, quantities, batch/expiry, and negative-stock policy.
3. Posting creates immutable stock movements and updates stock balance under row lock.
4. In Stock reads posted movements/balances only.
5. Corrections use reversal and replacement documents.

## 11. System Configuration, Account, and Clinic Switching

### Clinic and Clinician/Staff split-screen

System Configuration -> Practice and Workforce opens one desktop workspace with `Practice Identity` options grouped in the left pane and `Workforce and Access` options grouped in the right pane. Selecting or saving one pane must not clear unsaved data in the other; a dirty-pane switch requires confirmation. The right pane is the only entry point for staff profiles, login creation/linkage, clinic access, roles, and granular permissions.

### Create staff without login

1. Require `configuration.workforce.edit` for the active clinic.
2. Capture staff name, type, registration/specialization where applicable, display color/order, clinic assignments, and active state.
3. Create `staff` plus `staff_clinics`; do not create `users`, credentials, sessions, or permissions.
4. Audit `staff.created` and refresh the right-pane grid.

A clinician/staff profile does not automatically grant application access.

### Create or link a system login

1. Require `security.user.create`; require `security.role.manage` or `security.permission.override` for each corresponding assignment operation.
2. From a selected staff row enable `Create Login` or `Link Existing User`.
3. Capture unique Login Name, display name, email/mobile, temporary password plus confirmation or Send Invite, Must Change Password, account status, allowed clinics, default clinic, one or more roles, and explicit allow/deny overrides.
4. Normalize and lock the organization login-name key; reject duplicates case-insensitively.
5. Validate that the selected staff and user belong to the same organization and that every clinic is present in `staff_clinics` where the policy requires staff assignment.
6. Validate delegation: the acting user may not grant a permission or clinic scope beyond their own grantable ceiling. Prevent disabling/demoting the last active security administrator.
7. In one transaction create/update `users`, Argon2id `user_credentials` or hashed invitation token, `staff_user_links`, `clinic_memberships`, `membership_roles`, overrides, audit events, and invitation outbox event.
8. Commit before sending an invitation. Return the user/staff IDs and effective capability summary, never the password/hash/token.

### Edit, disable, unlock, and reset

- Changing profile fields does not silently change login permissions; staff and user edits are separate commands.
- Role, override, membership, status, or credential change increments `authz_version` and revokes or invalidates stale sessions immediately.
- `Disable Login` blocks authentication and revokes sessions but does not erase the staff profile, care_bookings, clinical authorship, Fee Statements, Collections, or audit history.
- `Unlock` clears failed-attempt state only with `security.user.edit` and audit.
- Password reset issues a single-use hashed token or sets a temporary password with Must Change Password; existing passwords are never displayed.
- Unlink requires reason and preserves historical actor/staff references. It does not transfer authorship to another user.

### Effective permission calculation

For the active clinic:

```text
if user/status/session/membership invalid -> deny
if unexpired membership override is deny -> deny
if unexpired membership override is allow -> allow
if any assigned active role grants permission -> allow
else -> deny
```

Tenant and clinic boundaries, record state, and resource ownership constraints are evaluated after the permission flag and can only narrow access. `patient.view` does not imply `patient.edit`; `fee_statement.view` does not imply `fee_statement.void`; `analytics.operational.view` does not imply `analytics.financial.view` or `analytics.export`.

Delete buttons are permission- and state-aware. Draft deletion requires the matching `*.delete_draft` flag. Posted clinical/financial records never expose hard delete; authorized users receive archive, void, reversal, or supersede actions instead.

### Configuration mutation behavior

- Preserve the exact groups and child options listed in `01_database_schema.md`; do not flatten Application and Document Output.
<!-- BLOCKED BY UNRESOLVED-02: clinic/type/period series scope, rollover, and non-reuse are assumed here for spec completeness; do not implement until FIN-DEC-02 passes per 07. -->
- `Serials` supports `Patient Code`, `Collection Reference`, `Statement Reference`, `Lab Order No.`, `Exp. Voucher`, `Goods In`, and `Goods Out` with Manual, Year-based, or Year-Month-based generation, Prefix, Start From, Edit, Save, and Reset.
- Document Output for Fee Statement/Collection Receipt/Clinical Summary/Medication Order/Care Plan expose page size, portrait/landscape, logo placement, barcode type/size/text/placement, headers, footers, margins, spacing, font, options, Save, and Reset.
- Configuration changes use typed validation, row versioning, permission checks, and audit.
- Serial changes cannot collide with prior rendered numbers and require `configuration.numbering.edit`.
- Disabling a master prevents new use but preserves historical references.
- Switch Clinic clears clinic-scoped caches, aborts dirty forms after confirmation, and reloads permissions.
- `My Clinics` reporting never broadens access beyond memberships.
- Backup generation runs as a background job, encrypts output, records requester/expiry, and never exposes raw credentials.

## 12. Financial Report Execution Workflow

1. Resolve the report key to one versioned registry entry and require its report-family permission.
2. Intersect requested Clinic Branch values with active clinic memberships; reject any unauthorized branch rather than dropping it silently.
<!-- BLOCKED BY UNRESOLVED-03: the aging anchor, as-of event treatment, and bucket boundaries are assumed here for spec completeness; do not implement aging reports until FIN-DEC-03 passes per 07. -->
3. Parse Date Range in each clinic timezone. For Open Fee Exposure also require As-of Date; Date Range filters Fee Statement dates but never changes the aging cut-off.
4. Validate optional Patient Category/basis, Lead Clinician or Clinician Split, cashier/user, and collection-mode filters against the report's allowed schema.
5. Select the canonical fact family. Due Fee Statements uses fee statement settlement events; Date-wise Collections uses collection receipt tenders; applied-collection reports use application distributions.
6. Execute source SQL or a projection whose query version/filter grain and freshness meet the registry contract.
7. Calculate page and grand totals from the same filtered result. Do not recompute totals with a second controller query.
8. Return effective filters, authoritative date field, category basis, source-as-of watermark, query version, rows, aging/mode columns, and reconciliation totals.
9. Drill-down carries the exact signed filter snapshot and source IDs. Export repeats authorization and executes the same query version asynchronously when large.
10. Emit a report audit event. Sensitive denial, stale-projection fallback, and reconciliation mismatch are also auditable.

Required state behavior:

- Collection creation updates collection/unsettled projections but not production or applied-collection totals.
- Application creation/reversal updates applied-collection, Fee Statement due, aging, and unsettled projections but never original gross collection.
- Refund posting updates refund/net collection on refund date; it does not rewrite original collection receipt-date gross collection.
- Fee Statement issue/void and credit/write-off events update production/due projections and exact line-level Clinician Split.
- Patient category edits do not rewrite historical snapshot-category reports.

## 13. Intent Tier, Clinical Case, Dual-Clinician, and Treatment-Bundle Workflow

### Mandatory patient intent tier

Every active patient has exactly one current `patients.intent_tier`. Registration and Patient Details cannot save without a tier, a tier-compatible reason code, assessment timestamp, and assessing user.

| Visible tier | Stored value | Permitted reason codes | Operational meaning |
|---|---|---|---|
| 1 Star: Do Not Treat | `one_star_do_not_treat` | `blacklisted`, `difficult_profile`, `safety_boundary` | Clinic has determined that treatment must not proceed under the current relationship or safety boundary. The tier does not delete prior clinical or financial history. |
| 2 Star: In-Budget Friction | `two_star_budget_friction` | `financial_hesitation`, `value_hesitation`, `timing_hesitation` | Clinic is willing to treat, but budget, perceived value, or timing hesitation prevents immediate progression. |
| 3 Star: High-Intent Friction | `three_star_high_intent_friction` | `external_cbct_pending`, `external_blood_report_pending`, `chair_capacity_delay`, `clinician_availability_delay`, `short_logistical_delay` | Patient and clinic are aligned on care; only a defined report, chair, clinician, or short scheduling dependency remains. |

Registration executes these exact conditions:

```text
IF intent tier is absent
THEN return 422 INTENT_TIER_REQUIRED and write no patient, clinic link, contact, tier event, or welcome outbox row
ELSE IF reason code is not permitted for the selected tier
THEN return 422 INTENT_TIER_REASON_MISMATCH and preserve the unsaved form
ELSE IF note is present and trimmed length is outside 1 through 1000 characters
THEN return 422 INTENT_TIER_NOTE_INVALID
ELSE require patient.create and patient.intent_tier.edit
THEN insert patients with intent_tier_assessed_at equal to the server timestamp and intent_tier_assessed_by equal to the authenticated user
THEN the database trigger inserts one patient_intent_tier_events row with from_tier null, source registration, and the identical reason and note
THEN append patient.created and patient.intent_tier_changed outbox events in the patient registration transaction
END IF
```

Patient Details tier editing executes these exact conditions:

```text
IF patient.intent_tier.view is absent
THEN hide tier text, reason, history, and report drill-down values and return 403 for direct reads
ELSE show current tier and immutable history
IF patient.intent_tier.edit is absent
THEN render tier controls read-only and reject direct mutation with 403
ELSE require a new selected tier, compatible reason code, optional note, If-Match row_version, and explicit confirmation
THEN update current patient tier fields and insert one patient_intent_tier_events row through the database trigger
THEN retain every prior event; never update or delete a prior tier event
END IF
```

Tier classification is operational metadata. Protected traits, diagnosis labels, disability, sex, age, religion, caste, ethnicity, and payment history cannot be used as automatic tier inputs. Tier 1 never authorizes deleting records, cancelling issued financial documents, withholding emergency stabilization, or bypassing a clinician's legal duty of care.

### Clinical case creation and initial consultation

One clinical case represents one advised-treatment decision cohort. Case creation, its initial consultation, and its initial state event commit in one transaction using deferred circular foreign keys:

1. Require `clinical_case.create`, `clinical.view`, and active clinic membership.
2. Lock the patient and read the current intent tier.
3. Reserve `case_no` from the clinic case-number series.
4. Generate `clinical_case_id` and `case_consultation_id` before either insert.
5. Insert `clinical_cases` with `initial_consultation_id`, immutable `intent_tier_snapshot`, `execution_state = not_started`, `state_change_source = consultation_close`, server `state_changed_at`, and authenticated `state_changed_by`.
6. Insert `case_consultations` with `consultation_kind = initial`, the same patient encounter, both clinician roles, and status `draft`.
7. Insert at least one Primary treatment bundle and at least one treatment-bundle service before finalizing the consultation unless the selected execution state is `no_treatment_needed`.
8. Defer the two circular foreign keys until commit so each row must reference the other correctly.
9. Insert the initial `clinical_case_state_events` row through the state-history trigger.
10. Append `clinical_case.created`; no worker, report, or message reads the case before transaction commit.

### Dual-clinician attribution

The initial consultation cannot be finalized without two distinct active clinicians assigned to the case clinic:

| Role | Column | Attribution use |
|---|---|---|
| Primary Consult Doctor | `case_consultations.primary_consult_clinician_id` | Denominator owner for primary-doctor initial consultations and primary-doctor conversion ratio. |
| Secondary Review Doctor | `case_consultations.secondary_review_clinician_id` | Specialist or senior reviewer shown independently in high-value conversion reporting. |

```text
IF either clinician is inactive, belongs to another organization, or lacks an active staff_clinics row for the case clinic
THEN return 422 CASE_CLINICIAN_SCOPE_INVALID
ELSE IF both clinician IDs are equal
THEN return 422 CASE_CLINICIAN_ROLES_MUST_DIFFER
ELSE IF a finalized consultation is edited
THEN require an authorized void-and-replace consultation; retain the original clinician attribution
ELSE save both role IDs and continue
END IF
```

The primary role does not receive the secondary role's cases in a role-specific report. The secondary role does not enter the primary-doctor conversion denominator. A clinician assigned in both roles across different cases appears once in each corresponding role row.

### Hierarchical treatment presentation

Every advised service belongs to exactly one `treatment_bundles` row through one immutable `treatment_bundle_services.care_plan_service_id` link.

| Bundle tier | Stored value | Required content | Intended sequence |
|---|---|---|---|
| Primary Treatment Bundle | `primary` | Chief complaint, emergency, or core disease-control services | First clinical priority. At least one Primary bundle is required for an advised-treatment case. |
| Secondary Treatment Bundle | `secondary` | Additional active pathology not included in the chief complaint | Begins after or alongside Primary care according to clinician sequencing. |
| Tertiary Treatment Bundle | `tertiary` | Elective, cosmetic, or preventative services | Presented after essential disease-control choices and never counted in the Pending Primary or Pending Secondary registers. |

Bundle save executes these exact checks:

```text
IF treatment_bundle.manage is absent
THEN hide mutation controls and return 403 for the command
ELSE IF bundle tier is absent, sequence is less than 1, title is blank, rationale is blank, or proposed value is negative
THEN return 422 TREATMENT_BUNDLE_INVALID
ELSE IF care plan patient or clinic differs from clinical case patient or clinic
THEN return 422 TREATMENT_BUNDLE_SCOPE_MISMATCH
ELSE IF one care_plan_service_id is already linked to another bundle
THEN return 409 PLAN_SERVICE_ALREADY_BUNDLED
ELSE resolve service ID, service domain, code, name, tooth, surfaces, and net proposed amount from the care-plan service
THEN insert treatment_bundle_services with immutable snapshots and deterministic sequence_no
THEN recalculate treatment_bundles.estimated_value as the exact sum of active line proposed_amount_snapshot values
THEN append treatment_bundle.saved and invalidate the case pipeline projection
END IF
```

The originally advised plan identity is `clinical_case_id -> treatment_bundles.id -> treatment_bundle_services.care_plan_service_id`. Service text, fee-statement description, patient category, free-text note, and collection receipt clinician are not substitutes for that identity.

### Execution-state machine

| Current state | Allowed next state | Required evidence |
|---|---|---|
| `not_started` | `minor_issue_treated_same_day` | One linked completed care delivery for the same patient whose encounter date equals the initial consultation encounter date. |
| `not_started` | `no_treatment_needed` | Nonblank controlled reason plus optional clinical note. No applied-payment or delivery evidence is required. |
| `not_started` | `treatment_started` | One bundled care delivery enters `in_progress` or `completed`, or one qualifying future-encounter applied-payment chain exists. |
| `minor_issue_treated_same_day` | none | Terminal analytical state. An authorized correction creates a new event and requires `clinical_case.correct_state`. |
| `no_treatment_needed` | none | Terminal analytical state. An authorized correction creates a new event and requires `clinical_case.correct_state`. |
| `treatment_started` | none | Terminal conversion state. Allocation reversal does not silently regress it. |

Every state change updates `clinical_cases`, inserts exactly one `clinical_case_state_events` row, appends one audit event, and appends one `clinical_case.execution_state_changed` outbox event in the same transaction. The event records old state, new state, source, actor, reason, timestamp, allocation identity, future encounter identity, and resulting row version.

### Event-driven applied-payment progression

The deferred trigger on `allocation_fee_line_splits` evaluates the committed transaction graph. All conditions must be true:

1. `clinical_cases.execution_state = not_started`.
2. `fee_allocations.status = active` and `fee_allocations.amount > 0`.
3. The current `allocation_fee_line_splits.amount > 0`.
4. The split resolves to `fee_statement_lines.id` and an issued, part-paid, or paid `fee_statements` parent.
5. `fee_statement_lines.care_plan_service_id`, or its linked `care_deliveries.care_plan_service_id`, equals `treatment_bundle_services.care_plan_service_id`.
6. The treatment bundle belongs to the same clinical case and is not declined or cancelled.
7. Fee Statement patient, future encounter patient, and case patient are identical.
8. Future encounter clinic and case clinic are identical.
9. The future encounter differs from the initial consultation encounter.
10. Future encounter engaged, checked-in, arrival, or clinic-local encounter timestamp is later than `case_consultations.consulted_at`.

```text
IF all ten conditions are true
THEN lock the not-started clinical case
THEN set execution_state to treatment_started
THEN set state_change_source to applied_payment_future_encounter
THEN copy fee_allocation_id, future encounter ID, applied_by, and allocation created_at into progression evidence columns
THEN state-history and outbox triggers fire once
ELSE leave the case unchanged and return the allocation transaction normally
END IF
```

The following rows never cause automatic progression:

- An unapplied collection receipt with no fee allocation.
- An active allocation without a positive fee-line split.
- An allocation applied to a fee statement line for a different care-plan service.
- An allocation linked only by matching service text, service domain, tooth, amount, patient category, or clinician.
- An allocation from the initial consultation encounter.
- An allocation from an earlier encounter.
- A reversed allocation.
- A split attached to a void Fee Statement.
- A bundle in declined or cancelled state.
- A payment for another patient or clinic.

### Reversal and correction behavior

Reversing the triggering allocation changes financial settlement only. It does not automatically change `treatment_started` back to `not_started`, because clinical execution may already have begun and a conversion event is historical. The reversal worker adds `triggering_allocation_reversed = true` to the case projection and raises a review item when no linked care delivery has started. A user with `clinical_case.correct_state` may correct the state only after entering a reason; the original start event remains immutable.

### End-of-day reconciliation

At clinic-local 23:50, `case-progression-reconcile` calls `dentos_runtime.reconcile_case_progression(clinic_id, business_date)` for each active clinic. It runs the same ten-condition evidence test over source tables, chooses the earliest qualifying active allocation per case, updates only cases still in `not_started`, writes source `eod_reconciliation`, and returns the number of changed cases. Zero qualifying cases is a successful run with count zero. A database or validation failure retries without changing already progressed cases.

## 14. Background Workers

| Worker | Trigger | Idempotent output |
|---|---|---|
| notification dispatcher | outbox/message due | provider submission per message key |
| webhook processor | provider webhook | one status event per provider event ID |
| recall scheduler | checkout/rule cron | one recall per source/rule |
| clinical_queue projector | care booking/date event | one encounter candidate/projection |
| balance projector | fee statement/application/refund event | patient and fee statement balances |
| report projector | financial/encounter/stock event | refreshed summary partitions |
| low-stock monitor | posted movement/nightly | one open alert per item/clinic |
| lab due monitor | expected date | pending/overdue queue entry |
| backup worker | requested schedule | encrypted backup artifact |
| case progression reconciler | clinic-local 23:50 | one evidence-backed not-started to treatment-started transition per case |

Workers use the transactional outbox, bounded retries, dead-letter visibility, and replay-safe handlers. Financial totals remain queryable from source transactions even if a projection worker is delayed.

## 15. Operational Invariants

1. A care booking is not a care_encounter.
2. A encounter is not production until a chargeable service is assessed.
3. Checkout is not collection.
4. A collection receipt is collection, even when unapplied.
5. An application settles a collection receipt against an fee statement and reduces due.
6. DentOS core mode records one collection method per collection entry. If the optional split-tender extension is enabled, each tender must retain its contribution to every application.
7. No void or reversal deletes history.
8. Every queue-changing action is idempotent and audited.
9. Clinic and reference date remain visible in every operational screen.
10. Reports use the event date defined for that report, never a generic created timestamp.
11. Open Fee Exposure equals Fee Statement receivable as of the cut-off and is never netted by unapplied advances.
12. Date-wise Collections equals collection receipt tenders at collection receipt-date/cashier/mode grain; fee allocations remain a separate fact.
13. Aging and collection-mode buckets are exhaustive, mutually exclusive, and reconcile to their report grand total.
14. A mandatory patient intent tier is current operational data; each clinical case preserves its creation-time tier snapshot.
15. A case has one initial consultation with one Primary Consult Doctor and one distinct Secondary Review Doctor.
16. Every advised care-plan service belongs to exactly one Primary, Secondary, or Tertiary treatment bundle.
17. A collection receipt does not progress a case; only exact bundled-service delivery evidence or a qualifying active applied-payment chain can do so.
18. Allocation reversal never silently erases a historical treatment-started conversion event.

<!-- ZERO_SHORTCUT_EXPANSION -->

## 17. Executable Conditional Transition Register

Every command below is atomic. A failed condition writes no domain row, consumes no reusable document number, and publishes no success event. An idempotent retry returns the original committed result.

### PATIENT_REGISTER_NEW

```text
IF no duplicate selected
THEN allocate patient number; insert patient, clinic link, contacts, address, medical answers, allergies, consents; emit patient.created
THEN enqueue only selected welcome channels after commit
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### PATIENT_REGISTER_DUPLICATE_BLOCK

```text
IF duplicate candidates exist and override permission is absent
THEN return 409 duplicate_candidate; insert no patient; consume no final number
THEN enqueue no message
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### PATIENT_REGISTER_DUPLICATE_OVERRIDE

```text
IF duplicate candidates exist and patient.create plus duplicate override policy are satisfied
THEN record override reason; insert one patient; audit candidate IDs without sensitive fields
THEN enqueue selected welcome channels after commit
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_BOOKING_CREATE_ESTABLISHED

```text
IF patient_id is present and active in authorized organization
THEN lock clinician/chair interval; allocate care booking number; insert scheduled care booking and history sequence 1 from NULL to scheduled with reason CARE_BOOKING_CREATED
THEN schedule patient/clinician reminders
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_BOOKING_CREATE_NEW

```text
IF patient_id is absent and patient_kind is new
THEN store demographic snapshot only; insert scheduled care booking and history sequence 1 from NULL to scheduled with reason CARE_BOOKING_CREATED
THEN schedule reminders using care booking snapshot recipient
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_BOOKING_CONFLICT_BLOCK

```text
IF active clinician or chair interval overlaps and scheduler.override is absent
THEN return 409 with conflicting resource and interval; insert no care booking
THEN enqueue no reminder
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_BOOKING_CONFLICT_OVERRIDE

```text
IF active interval overlaps and scheduler.override plus reason are present
THEN insert care booking with override marker and audit reason
THEN schedule reminders and notify schedule supervisors
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_BOOKING_RESCHEDULE

```text
IF status permits reschedule and row_version matches
THEN lock care booking; recheck interval; update times/resources; append status history without changing document number
THEN cancel obsolete reminder jobs and enqueue replacements
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_BOOKING_CANCEL

```text
INPUT care_booking_id, expected_row_version, cancellation_reason, notify_patient, request_id, authenticated_user_id

BEGIN one database transaction
LOCK care_bookings row FOR UPDATE

IF authenticated user lacks scheduler.edit in the care booking clinic
THEN reject with 403 CARE_BOOKING_CANCEL_FORBIDDEN; change no row; enqueue no message
ELSE continue
END IF

IF care_bookings.row_version <> expected_row_version
THEN reject with 409 CARE_BOOKING_VERSION_CONFLICT; return current row version; change no row
ELSE continue
END IF

IF care_bookings.status NOT IN ('scheduled','confirmed')
THEN reject with 409 CARE_BOOKING_STATUS_NOT_CANCELLABLE; change no row
ELSE continue
END IF

IF scheduler.cancellation_reason_required = true AND NULLIF(BTRIM(cancellation_reason), '') IS NULL
THEN reject with 422 CANCELLATION_REASON_MANDATORY; change no row
ELSE continue
END IF

SET terminal_event_at = clock_timestamp() once
SET previous_status = care_bookings.status
SET next_status_sequence = COALESCE(MAX(care_booking_state_events.sequence_no for care_booking_id), 0) + 1
UPDATE care_bookings
   SET status = 'cancelled',
       cancellation_reason = BTRIM(cancellation_reason),
       cancelled_at = terminal_event_at,
       cancelled_by = authenticated_user_id,
       no_show_reason = NULL,
       no_show_marked_at = NULL,
       no_show_marked_by = NULL,
       updated_by = authenticated_user_id
 WHERE id = care_booking_id

INSERT care_booking_state_events with
  care_booking_id = care_booking_id,
  sequence_no = next_status_sequence,
  from_status = previous_status,
  to_status = 'cancelled',
  changed_at = terminal_event_at,
  changed_by = authenticated_user_id,
  reason = BTRIM(cancellation_reason),
  created_by = authenticated_user_id

INSERT outbox event care_booking.cancelled with care_booking_id, clinic_id, terminal_event_at, request_id
CANCEL unsent care booking reminders by care_booking_id
COMMIT

IF notify_patient = true AND communication consent permits the selected channel
THEN the outbox worker renders and sends the cancellation notice after commit
ELSE no cancellation notice is sent
END IF

The cancelled status removes the row from active clinician/chair exclusion constraints, retains care_booking_no, starts_at, ends_at, lead_clinician_id, chair_id, and reason_id, and does not delete linked audit or history rows.
```

### CARE_BOOKING_NO_SHOW

```text
INPUT care_booking_id, expected_row_version, no_show_reason, request_id, authenticated_or_service_user_id

BEGIN one database transaction
LOCK care_bookings row FOR UPDATE

IF the command is manual AND authenticated user lacks scheduler.edit
THEN reject with 403 CARE_BOOKING_NO_SHOW_FORBIDDEN; change no row
ELSE continue
END IF

IF the command is automatic AND scheduler.auto_mark_no_show_enabled <> true
THEN stop as NO_SHOW_AUTOMATION_DISABLED; change no row
ELSE continue
END IF

IF care_bookings.row_version <> expected_row_version
THEN reject or retry from the newly read row; never overwrite the newer state
ELSE continue
END IF

IF care_bookings.status NOT IN ('scheduled','confirmed')
THEN reject with 409 CARE_BOOKING_STATUS_NOT_NO_SHOW_ELIGIBLE; change no row
ELSE continue
END IF

IF clock_timestamp() < care_bookings.ends_at + make_interval(mins => scheduler.no_show_grace_minutes)
THEN reject with 409 NO_SHOW_GRACE_NOT_ELAPSED; change no row
ELSE continue
END IF

IF EXISTS care_encounters WHERE care_encounters.care_booking_id = care_booking_id AND care_encounters.status <> 'cancelled'
THEN reject with 409 CARE_BOOKING_HAS_ACTIVE_ENCOUNTER; change no row
ELSE continue
END IF

IF manual command AND scheduler.no_show_reason_required = true AND NULLIF(BTRIM(no_show_reason), '') IS NULL
THEN reject with 422 NO_SHOW_REASON_MANDATORY; change no row
ELSE continue
END IF

IF automatic command
THEN SET effective_reason = 'AUTO_END_PASSED'
ELSE SET effective_reason = BTRIM(no_show_reason)
END IF

SET terminal_event_at = clock_timestamp() once
SET previous_status = care_bookings.status
SET next_status_sequence = COALESCE(MAX(care_booking_state_events.sequence_no for care_booking_id), 0) + 1
UPDATE care_bookings
   SET status = 'no_show',
       no_show_reason = effective_reason,
       no_show_marked_at = terminal_event_at,
       no_show_marked_by = authenticated_or_service_user_id,
       cancellation_reason = NULL,
       cancelled_at = NULL,
       cancelled_by = NULL,
       updated_by = authenticated_or_service_user_id
 WHERE id = care_booking_id

INSERT care_booking_state_events with
  care_booking_id = care_booking_id,
  sequence_no = next_status_sequence,
  from_status = previous_status,
  to_status = 'no_show',
  changed_at = terminal_event_at,
  changed_by = authenticated_or_service_user_id,
  reason = effective_reason,
  created_by = authenticated_or_service_user_id

INSERT outbox event care_booking.no_show with care_booking_id, clinic_id, terminal_event_at, request_id
COMMIT

IF scheduler.send_no_show_continuity = true
THEN create one continuity/message candidate keyed by care_booking_id + terminal_event_at
ELSE create no continuity candidate
END IF

The no_show status retains care_booking_no, starts_at, ends_at, lead_clinician_id, chair_id, and reason_id and remains distinct from cancelled in every analytics.
```

### CARE_BOOKING_TERMINAL_STATUS_CORRECTION

```text
INPUT care_booking_id, expected_row_version, correction_reason, authenticated_user_id

IF scheduler.terminal_status_correction_enabled <> true OR authenticated user lacks scheduler.override
THEN reject with 403 CARE_BOOKING_TERMINAL_CORRECTION_FORBIDDEN; preserve current state
ELSE continue
END IF

BEGIN one database transaction
LOCK care_bookings row FOR UPDATE

IF care_bookings.row_version <> expected_row_version
THEN reject with 409 CARE_BOOKING_VERSION_CONFLICT; change no row
ELSE continue
END IF

IF care_bookings.status NOT IN ('cancelled','no_show')
THEN reject with 409 CARE_BOOKING_NOT_IN_TERMINAL_ATTRITION_STATE; change no row
ELSE continue
END IF

IF care_bookings.ends_at <= clock_timestamp()
THEN reject with 409 CARE_BOOKING_TIME_EXPIRED; create a new care booking instead
ELSE continue
END IF

IF NULLIF(BTRIM(correction_reason), '') IS NULL
THEN reject with 422 CORRECTION_REASON_MANDATORY; change no row
ELSE continue
END IF

RECHECK clinician and chair exclusion constraints for the original interval
SET correction_event_at = clock_timestamp() once
SET previous_status = care_bookings.status
SET next_status_sequence = COALESCE(MAX(care_booking_state_events.sequence_no for care_booking_id), 0) + 1
UPDATE care_bookings
   SET status = 'scheduled',
       cancellation_reason = NULL,
       cancelled_at = NULL,
       cancelled_by = NULL,
       no_show_reason = NULL,
       no_show_marked_at = NULL,
       no_show_marked_by = NULL,
       updated_by = authenticated_user_id
 WHERE id = care_booking_id

INSERT care_booking_state_events with
  care_booking_id = care_booking_id,
  sequence_no = next_status_sequence,
  from_status = previous_status,
  to_status = 'scheduled',
  changed_at = correction_event_at,
  changed_by = authenticated_user_id,
  reason = BTRIM(correction_reason),
  created_by = authenticated_user_id

INSERT outbox event care_booking.terminal_status_corrected
COMMIT

The former cancelled/no_show history row remains immutable. Current-state attrition reports exclude the corrected care booking because its latest history event and care_bookings.status are scheduled; status-event audit reports retain the former event.
```

### ENCOUNTER_FROM_CARE_BOOKING

```text
IF care booking has no encounter
THEN lock care booking; allocate queue sequence; insert one encounter; mark care booking arrived or checked_in
THEN publish care_encounter.created and refresh Dashboard/Scheduler/Clinical Queue
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ENCOUNTER_FROM_CARE_BOOKING_RETRY

```text
IF care booking already has a encounter
THEN return existing encounter ID without new sequence or timestamp
THEN publish no duplicate event
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### WALKIN_ESTABLISHED

```text
IF existing patient is selected
THEN insert walk-in encounter linked to patient; allocate queue sequence
THEN publish care_encounter.created and refresh Clinical Queue
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### WALKIN_NEW

```text
IF new demographics supplied and duplicate policy passes
THEN insert patient plus walk-in encounter in one transaction
THEN publish patient.created and care_encounter.created after commit
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ENCOUNTER_CHECKIN

```text
IF encounter is waiting
THEN set checked_in; stamp checked_in_at once; append history
THEN publish care_encounter.status_changed
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ENCOUNTER_DIRECT_ENGAGE

```text
IF encounter is waiting and direct engage policy plus queue.engage are satisfied
THEN set engaged; set checked_in_at when absent; set engaged_at; append history
THEN publish care_encounter.status_changed
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ENCOUNTER_ENGAGE

```text
IF encounter is checked_in
THEN set engaged; stamp engaged_at; append history
THEN open clinical context and publish care_encounter.status_changed
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ENCOUNTER_CHECKOUT_CLEAR

```text
IF encounter is engaged and no unresolved required clinical or financial operations decision exists
THEN set checked_out; stamp checked_out_at; append history
THEN generate recall/continuity candidates and refresh operational projections
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ENCOUNTER_CHECKOUT_BLOCKED

```text
IF chargeable completed service lacks required Fee Statement and override is absent
THEN return 409 checkout_requirements; leave encounter engaged
THEN enqueue no recall completion event
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ENCOUNTER_CHECKOUT_OVERRIDE

```text
IF financial operations requirement is unresolved and queue.release override policy is satisfied
THEN store reason; set checked_out; retain unassessed-production candidate
THEN publish checkout and supervisor-review events
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### PLAN_SAVE

```text
IF care-plan header and at least one valid line exist
THEN freeze service, tooth, material, fee, tax, clinician and category snapshots; calculate displayed total
THEN publish treatment_plan.saved
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### PLAN_SAVE_EMPTY

```text
IF plan contains no valid line
THEN return 422; insert no care-plan header
THEN publish no event
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_DELIVERY_START

```text
IF plan item is accepted or direct service policy allows creation
THEN insert or update clinical service to in_progress; retain source plan link
THEN publish care_delivery.started
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### CARE_DELIVERY_COMPLETE

```text
IF care_deliveries.status = in_progress, row_version matches, clinical.edit is allowed, and required signed notes are present
THEN capture one completion timestamp; set status = completed, completed_at, completed_by, completion_continuity_mode, custom date/time fields, notes, and updated_by
THEN mark the linked care_plan_services row completed when present
THEN for mode rule or custom_date insert the uniquely keyed continuity_tasks row with exact clinic-local due_date, due_local_time, UTC due_at, source service, rule snapshots, templates, offsets, owner, and selected-date actor
THEN for a linked orthodontic tracking assignment update last adjustment encounter, stage/wire values, next adjustment date, and the next recurring orthodontic continuity task
THEN create stock-consumption and production candidates without posting stock or a Fee Statement
THEN publish care_delivery.completed after commit and materialize enabled consent-aware channel reminders
ELSE reject the entire transaction with a typed authorization, version, note, rule, date, template, or constraint error; preserve service, plan, continuity, orthodontic, stock, production, audit, and message state
END IF
```

### RECALL_CREATE

```text
IF completed trigger matches active recall rule and unique source key is absent
THEN insert one open patient recall with computed due date
THEN schedule due-queue activation
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### RECALL_CREATE_RETRY

```text
IF same patient/rule/source key exists
THEN return existing recall without changing due date
THEN publish no duplicate job
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### RECALL_SNOOZE

```text
IF open recall has a future snooze date
THEN set snoozed and retain original due date/history
THEN schedule wake job for snooze date
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### RECALL_BOOK

```text
IF open recall is linked to a new care booking
THEN set booked and store care booking link
THEN cancel due-message jobs for that recall
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### MESSAGE_QUEUE_ALLOWED

```text
IF recipient is valid, consent permits purpose, template is approved, and credits are available
THEN insert one outbound message with queued status and deduplication key
THEN provider-submit worker claims after commit
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### MESSAGE_QUEUE_SUPPRESSED

```text
IF opt-out, invalid recipient, duplicate recipient, missing consent, or unapproved template applies
THEN insert suppression outcome with reason; do not insert provider-send attempt
THEN increment suppressed batch count
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### MESSAGE_WEBHOOK_FORWARD

```text
IF provider event ID is new and status rank does not regress
THEN insert provider event; update current message status and timestamp
THEN refresh batch/message report projection
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### MESSAGE_WEBHOOK_DUPLICATE

```text
IF provider event ID already exists
THEN return success without inserting or changing current status
THEN publish no duplicate status event
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### MEDICATION_ORDER_SAVE

```text
IF medication_order.create is allowed, the patient encounter is in the active clinic, the clinician is active at that clinic, row_version matches, at least one diagnosis exists, at least one recommended service exists, and at least one complete medication line exists
THEN lock the encounter and draft parent; resolve every diagnosis, service/domain, medication, active ingredient, administration pattern, and protocol version under organization scope
THEN run the current patient allergy-to-active-ingredient cross-reference query and reject every unresolved block result
THEN insert ordered diagnosis, recommended-service, and medication snapshots; set saved_at, saved_by, and status saved
THEN append medication_order.save audit and medication_order.saved outbox rows in the same transaction
THEN render the printable medication order asynchronously from medication_order_id + row_version + status
ELSE reject with a typed authorization, scope, stale-version, missing-section, inactive-master, allergy, administration-pattern, or constraint response; preserve every prior clinical row and emit no render job
END IF
```

### MEDICATION_ORDER_SIGN

```text
IF medication_order.sign is allowed, the authenticated user has an active staff_user_links row to medication_orders.clinician_id, the medication order is draft or saved, every clinical section validates, and all blocking safety results are resolved
THEN canonicalize the ordered diagnosis, service, and medication snapshot payload; calculate SHA-256; set signed_at, signed_by, signature_hash, signature_algorithm, and status signed
THEN append medication_order.sign audit and medication_order.signed outbox rows in the same transaction
THEN render a new signed artifact without overwriting the unsigned artifact history
ELSE reject with 403, 409, or 422 according to permission, linkage, state, row version, or clinical validation; retain the prior saved or draft medication order unchanged
END IF
```

### MEDICATION_ORDER_VOID

```text
IF saved or signed medication order exists, medication_order.void is allowed, row_version matches, and a nonblank reason is present
THEN set voided_at, voided_by, void_reason, and status void; retain number, diagnosis snapshots, service snapshots, medication snapshots, protocol version, and original signature fields
THEN append medication_order.void audit and medication_order.voided outbox rows in the same transaction
THEN render a VOID artifact and retain every prior artifact version
ELSE reject with a typed authorization, state, stale-version, or validation response; preserve prior state and render no artifact
END IF
```

### PATIENT_INTENT_TIER_CHANGE

```text
IF patient.intent_tier.edit is allowed, patient is in active clinic scope, If-Match equals row_version, selected tier is one of the three configured values, and reason code belongs to that tier
THEN set intent_tier, intent_tier_reason_code, intent_tier_note, intent_tier_assessed_at, and intent_tier_assessed_by
THEN insert one immutable patient_intent_tier_events row through the database trigger
THEN append patient.intent_tier.update audit and patient.intent_tier_changed outbox rows
ELSE reject with 403, 404, 409, or 422 and preserve patient and tier history
END IF
```

### CLINICAL_CASE_CREATE

```text
IF clinical_case.create is allowed, patient is active in clinic, active encounter belongs to patient, both distinct clinician roles are active in clinic, and patient has a valid current intent tier
THEN reserve case number; pre-generate case and consultation IDs
THEN insert clinical_cases as not_started with an immutable intent tier snapshot and consultation_close source
THEN insert the initial draft case_consultations row with Primary Consult Doctor and Secondary Review Doctor
THEN insert the initial state event and outbox row through triggers
THEN commit both deferred circular foreign keys together
ELSE roll back case number reservation, case, consultation, event, audit, and outbox rows
END IF
```

### CASE_CONSULTATION_FINALIZE

```text
IF case_consultation.finalize is allowed, consultation is draft, row_version matches, both clinician assignments remain active and distinct, objective is nonblank, and clinical summary is complete
THEN require at least one Primary Treatment Bundle with at least one immutable service line unless execution state is no_treatment_needed
THEN set status finalized, finalized_at, and finalized_by
THEN append case_consultation.finalized and refresh conversion cohorts
ELSE reject with typed missing-role, missing-primary-bundle, scope, state, or stale-version response
END IF
```

### TREATMENT_BUNDLE_SAVE

```text
IF treatment_bundle.manage is allowed, clinical case and care plan share patient and clinic, bundle tier is primary, secondary, or tertiary, sequence is positive, and title and rationale are nonblank
THEN lock selected care_plan_services in ID order
THEN reject any service already assigned to another treatment bundle
THEN resolve and freeze service domain, code, name, tooth, surfaces, and proposed net amount for every service line
THEN insert or update bundle header and allowed line-state fields; preserve line identity snapshots
THEN recalculate estimated_value from bundle lines and append treatment_bundle.saved
ELSE roll back header, lines, audit, and outbox rows together
END IF
```

### CASE_PROGRESS_FROM_DELIVERY

```text
IF a care delivery linked through treatment_bundle_services enters in_progress or completed with started_at and its clinical case is not_started
THEN set execution_state treatment_started, source care_delivery_start, started timestamp and actor, and triggering encounter
THEN append one state event, one audit event, and one clinical_case.execution_state_changed outbox event
ELSE preserve the current case state
END IF
```

### CASE_PROGRESS_FROM_APPLIED_PAYMENT

```text
IF a positive allocation_fee_line_splits row commits under an active positive fee allocation
AND its fee statement line resolves to the exact care_plan_service_id frozen in a non-declined treatment bundle
AND the Fee Statement and future encounter belong to the case patient and clinic
AND the future encounter differs from and occurs after the initial consultation encounter
AND clinical case execution_state is not_started
THEN set execution_state treatment_started, source applied_payment_future_encounter, fee allocation evidence, future encounter evidence, started timestamp, and actor
THEN append one state event, one audit event, and one clinical_case.execution_state_changed outbox event
ELSE commit the financial allocation without changing case state
END IF
```

### CASE_PROGRESS_EOD_RECONCILE

```text
IF clinic-local 23:50 reconciliation finds a not_started case satisfying every applied-payment progression condition
THEN select the earliest qualifying active allocation by created_at and ID
THEN progress the case once with source eod_reconciliation and preserve complete evidence
ELSE record a successful zero-change result for that case or clinic
END IF
```

### CASE_STATE_CORRECTION

```text
IF clinical_case.correct_state is allowed, target case is in clinic scope, If-Match equals row_version, correction reason and note are nonblank, and allow_case_state_correction is enabled only inside the authorized command transaction
THEN update the corrected state and evidence shape, set source authorized_correction, and append a new state event without modifying prior events
ELSE return 403, 404, 409, or 422 and preserve all prior case rows
END IF
```

### USER_CREATE

```text
IF security.user.create is allowed and credentials are unique
THEN insert user, Argon2id credential, clinic memberships, roles, overrides, optional staff link in one transaction
THEN send invite only after commit; publish capabilities_changed
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### USER_CREATE_DUPLICATE

```text
IF login name or active staff/user link conflicts
THEN return field conflict; insert no credential, membership, role, override, or link
THEN send no invite
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### ROLE_CHANGE

```text
IF security.role.manage is allowed and delegation ceiling passes
THEN replace membership role set; increment authz_version
THEN invalidate capability cache and active sessions according to policy
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### PERMISSION_OVERRIDE

```text
IF security.permission.override is allowed and delegation ceiling passes
THEN upsert Inherit removal, Allow, or Deny; increment authz_version
THEN publish capabilities_changed and audit sensitive change
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### SERIAL_ALLOCATE

<!-- BLOCKED BY UNRESOLVED-02: clinic/type/period counter selection and issued-number non-reuse are assumed here for spec completeness; do not implement until FIN-DEC-02 passes per 07. -->
```text
IF document command is ready to commit
THEN lock clinic/type/period counter; reserve next value; insert document; mark reservation issued
THEN publish source document event
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

### SERIAL_COLLISION

```text
IF manual or rendered number already exists
THEN return 409; retain attempted audit context; do not reuse an issued number
THEN notify settings administrator only after repeated collision threshold
ELSE reject with a typed 4xx conflict or validation response; preserve prior state; append a denial audit event only when the attempted operation is sensitive
END IF
```

## 18. Background Worker Register

| Worker | Trigger | Run-time condition | Idempotency key | Retry schedule | Terminal handling |
|---|---|---|---|---|---|
| welcome-message | patient.created | channel consent selected and recipient valid | patient_id + channel + template_version | 5 attempts: 1m, 5m, 30m, 2h, 12h | dead-letter and alert communications admin |
| care booking-reminder | care_booking.created or care_booking.updated | care booking remains active at scheduled run time | care_booking_id + reminder_rule_id + scheduled_at | 4 attempts: 2m, 10m, 1h, 4h | cancel when care booking state is cancelled, no_show, or completed |
| recall-due-activation | daily clinic local 00:10 | recall due_date is today or earlier and status is open or snoozed-due | clinic_id + recall_id + due_date | 3 attempts: 5m, 30m, 2h | leave recall open and alert on failure |
| continuity-due-activation | continuity created/changed plus every 15 minutes | materialize every missing version/channel/offset row; mark task due when due_at passed and status scheduled or snoozed-due | continuity_task_id + reminder_generation_version + channel + offset; task activation uses continuity_task_id + due_at | 3 attempts: 5m, 20m, 1h | keep task visible in manual queue; record per-channel suppression or materialization failure |
| provider-submit | every minute while queued or retry messages exist | scheduled_at and next_attempt_at reached; continuity remains open; consent, recipient, clinic, and approved template pass again | outbound_messages.deduplication_key | 5 attempts: 1m, 5m, 30m, 2h, 12h | mark failed with provider error and alert communications admin; never claim delivered/cancelled/suppressed rows |
| provider-webhook-apply | signed webhook received | signature, timestamp window, and provider event uniqueness pass | provider_event_id | 3 attempts: immediate, 1m, 5m | retain raw signed payload hash and alert integration admin |
| medication order-render | medication_order.saved, medication_order.signed, or medication_order.voided | source status and row_version still equal the outbox snapshot | medication_order_id + row_version + status | 3 attempts: 1m, 5m, 20m | keep the clinical record authoritative; mark only that artifact version unavailable and expose retry |
| low-stock-check | stock.posted | on_hand is at or below reorder_level | clinic_id + item_id + open_alert | 3 attempts: 1m, 10m, 1h | one open alert remains visible |
| lab-overdue-check | daily clinic local 08:00 | expected_date is earlier than today and status remains pending | lab_job_id + expected_date | 3 attempts: 10m, 1h, 4h | retain pending job and show overdue state |
| projection-refresh | financial or operational source event | event source version exceeds projection watermark | source_event_id + projection_name | 5 attempts: 10s, 30s, 2m, 10m, 1h | serve source SQL or explicit unavailable state |
| nightly-reconciliation | daily clinic local 02:00 | clinic is active | clinic_id + business_date + query_version | 3 attempts: 15m, 1h, 4h | block authoritative projection and alert finance admin |
| case-progression-reconcile | daily clinic local 23:50 | clinic is active; only not_started cases with exact future-encounter bundled-service allocation evidence qualify | clinic_id + business_date + clinical_case_id + fee_allocation_id | 3 attempts: 5m, 20m, 1h | retain case state, create a conversion-operations alert, and expose source evidence for replay |
| encrypted-backup | daily organization local 01:00 | backup policy active and storage reachable | organization_id + scheduled_date | 3 attempts: 30m, 2h, 6h | raise critical backup alert without deleting prior backup |

## 19. Explicit Rollback Rules

1. A patient plus walk-in transaction rolls back the patient, clinic link, contacts, encounter, queue sequence, audit rows, and outbox rows together when any validation or database constraint fails.
2. A care booking transaction rolls back the care booking, history, serial reservation, audit row, and reminder outbox row together when clinician/chair exclusion fails.
3. A checkout transaction rolls back encounter status, service completion links, recall candidates, stock-consumption candidates, and outbox events together when a required checkout rule fails.
4. A user creation transaction rolls back user, credential, staff link, clinic memberships, role assignments, permission overrides, audit event, and invitation outbox event together when uniqueness, delegation, or last-admin constraints fail.
5. No provider, object-storage, print-render, or export call runs inside a domain transaction; only an outbox row is committed with the source state.
6. A case-creation transaction rolls back the case number, clinical case, initial consultation, treatment bundles, bundle-service snapshots, state event, audit rows, and outbox rows together when either clinician, patient/clinic scope, tier snapshot, or deferred circular reference fails.
7. An allocation transaction remains financially atomic when the case-progression trigger finds no qualifying case; when it finds one, the allocation, split, case state, state event, audit, and outbox rows commit or roll back together.
