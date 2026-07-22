<!-- LEGAL REVIEW: confirm original wording throughout this file is not derived from any protected material before shipping -->

# 06 UI, Navigation, and High-Density Interaction Specification

## Project DentOS Interface Contract

This file defines the proprietary Project DentOS interface. Navigation, labels, field order, geometry, focus behavior, and permission states originate in this document and are validated against DentOS-owned design captures. No external interface hierarchy or captured controller structure is authoritative.

## 1. Global Navigation

The primary navigation order is fixed:

```text
Dashboard | Clinical Queue | Scheduler | Patient Registry | Practice Assets |
Comms Center | Financial Operations | Deep Analytics | System Configuration
```

- `Dashboard` contains cross-module operational summaries and quick commands.
- `Clinical Queue` owns arrivals, admission, engagement, chair flow, and encounter release.
- `Scheduler` owns bookings, resource availability, clinician availability, and blackouts.
- `Patient Registry` owns search, registration, patient context, and longitudinal records.
- `Practice Assets` owns patient education, laboratory work, inventory, suppliers, and expenses.
- `Comms Center` owns direct messages, campaigns, templates, delivery state, and consent suppression.
- `Financial Operations` owns fee statements, collection receipts, allocations, credits, refunds, and patient balances.
- `Deep Analytics` owns operational, clinical, financial, inventory, and compliance analysis.
- `System Configuration` owns clinic, staff, security, clinical masters, communication masters, print layouts, and serial policies.

Route availability is sequenced by first shippable behavior:

| Route | Build phase | First enabled surface |
|---|---|---|
| `/dashboard` | `[Phase 1]` | patient, booking, and Clinical Queue operational summary; blocked financial commands remain unavailable |
| `/clinical-queue` | `[Phase 1]` | arrival, admission, engagement, chair assignment, and encounter release |
| `/scheduler` | `[Phase 1]` | booking calendar, resource views, availability, and blackouts |
| `/patient-registry` | `[Phase 1]` | registration, search, profile, medical history, allergies, consents, bookings, encounters, and basic Fee Statements |
| `/financial-operations` | `[Phase 1]` | draft/basic Fee Statement surface; Phase 2 enables blocked Collection, allocation, refund, aging, and settlement functions |
| `/deep-analytics` | `[Phase 1]` | the three Phase 1 report leaves; Phase 2 enables the remaining report catalog |
| `/system-configuration` | `[Phase 1]` | minimum workforce, access, chair, booking-reason, service, fee, and tax setup; later phases expand the tree |
| `/practice-assets` | `[Phase 3]` | laboratory, inventory, suppliers, expenses, and patient education |
| `/comms-center` | `[Phase 3]` | direct and automated patient communications, consent suppression, templates, and delivery tracking |

Account utility menu:

```text
My Profile
Change Active Clinic
Session Security
Sign Out
```

Backup and duplicate-patient resolution are privileged System Configuration utilities. The global context bar always shows active clinic and operational date. Multi-clinic scope appears only for users with more than one active clinic membership.

## 2. Application Shell

### Desktop structure

```text
+----------------------------------------------------------------------------------+
| DentOS | Dashboard Clinical Queue Scheduler Patient Registry Practice Assets      |
|        | Comms Center Financial Operations Deep Analytics System Configuration   |
+----------------------------------------------------------------------------------+
| Clinic scope | Reference date | page-specific filters/actions | Account          |
+----------------------------------------------------------------------------------+
| Page title / tabs / compact alerts                                               |
+----------------------------------------------------------------------------------+
| Main grid, calendar matrix, split panel, or form                                 |
+----------------------------------------------------------------------------------+
| Paging / totals / status                                                         |
+----------------------------------------------------------------------------------+
```

### Density tokens

| Element | Required size |
|---|---|
| Global navigation height | 38 px |
| Context/action toolbar | 34 px |
| Compact button | 28-30 px high |
| Icon button | 28 x 28 px |
| Text input/select | 28-30 px high |
| Grid header | 30 px |
| Standard grid row | 28 px |
| Two-line grid row | 40 px maximum |
| Horizontal cell padding | 6 px |
| Vertical cell padding | 3-4 px |
| Base UI font | 13 px |
| Grid/toolbar font | 12-13 px |
| Section heading | 15-18 px, never hero-scale |
| Border radius | 2-4 px; cards at most 6 px |

Use visible 1 px grid separators, sticky headers, stable column widths, restrained shadows, and high-contrast focus rings. Page sections are not floating cards. Avoid oversized whitespace, illustrations, marketing panels, rounded pills, decorative gradients, and dashboard card mosaics.

Color has operational meaning:

- Neutral white/light gray surfaces for data.
- Dark text with muted secondary metadata.
- One brand/accent color for active navigation and primary command.
- Distinct status colors for scheduled, waiting, checked-in, engaged, completed, cancelled/no-show, due, and unapplied.
- Never rely on color alone; include text/icon/state label.

## 3. Interaction Rules

- One click selects a grid row; double click opens the default detail where supported.
- Enter activates the focused primary row action.
- Escape closes a non-destructive modal or clears transient menus; dirty forms require confirmation.
- Tab order follows visual order and skips decorative elements.
- `/` focuses the current screen's primary search when no text field is active.
- `Alt+N` invokes the screen's New action: patient, care booking, walk-in, collection receipt, or expense according to route.
- `Ctrl+Enter` submits a valid compact form; destructive/financial actions still require their explicit confirmation rules.
- Arrow keys navigate calendar cells/grid rows without changing column widths or scroll position.
- Tooltips name unfamiliar icons and may include keyboard shortcut text; the main screen does not carry instructional prose.
- After save, focus returns to the triggering row/action and relevant data refreshes without full-page reload.

Every toolbar command is either icon-only with tooltip for familiar actions (refresh, print, export, close) or icon plus text for domain commands (Unscheduled Encounter, Reserve Resource Time, Record Collection).

## 4. Dashboard

### Toolbar

Left to right:

```text
Active Clinic / Authorized Clinics segmented control
Operational Date compact date field
Refresh icon
Activity Audit command
```

### Quick actions

Single compact action strip, not four promotional cards:

```text
[Register Patient] [Add to Clinical Queue] [Create Booking] [Record Collection]
```

At desktop width these remain one row. At narrow width they wrap to two rows while retaining 30 px height and text visibility.

### Operational grid

| Column | Width/behavior |
|---|---|
| # | 42 px, right aligned |
| Name | min 180 px, flexible |
| Time | 82 px |
| Lead Clinician | 140 px |
| Clinic | 120 px only in Authorized Clinics mode |
| Status/action | 120-180 px |

Rows are 28 px, sortable where meaningful, and open booking/encounter context without losing operational date.

## 5. Scheduler

### Fixed action bar

```text
[Refresh icon] [Print icon] [Reserve Resource Time] [Create Booking]
[Month | Week | Day | Resource Day | Resource Week]
Date navigation: previous, today, next, compact date picker
Lead Clinician and chair filters where applicable
```

The five view buttons are a segmented control. Selected view remains visible after refresh and date navigation.

### Shared event visual

Each care booking renders patient display name, start time, clinician or chair when not encoded by column, and compact status marker. Minimum event height is stable. Long text truncates with tooltip; it never expands a row/slot unexpectedly.

### Month

- Seven equal weekday columns.
- Day cells have fixed minimum height and internal scroll/overflow count.
- Clicking a date cell opens Create Booking with date prefilled.

### Week

- Time axis fixed 64-72 px; seven equal date columns.
- Configured slot interval, default 15 minutes.
- Current time indicator and working-hours shading.

### Day

- One day, columns grouped by clinician or configured schedule source.
- Vertical time grid; horizontal scroll only when resources exceed viewport.

### Resource Day

One-day resource matrix:

```text
fixed time axis | Chair 1 | Chair 2 | Chair 3 | Chair 4
08:00           | event   |         | block   |
08:15           | event   | event   |         | event
```

- Chair columns are 160-220 px and never collapse below readable width.
- Header sticks horizontally; time axis sticks vertically.
- Blocks and care_bookings occupy exact interval height.
- Chair conflict is impossible unless override permission exists and the event visibly indicates override.

### Resource Week

Two-level header:

```text
Monday
  Chair 1 | Chair 2 | Chair 3 | Chair 4
Tuesday
  Chair 1 | Chair 2 | Chair 3 | Chair 4
```

- Virtualize off-screen resource columns.
- Preserve vertical time alignment across all days/chairs.
- Minimum resource column 140 px; horizontal scrolling is expected.
- Switching between Resource Day and Resource Week keeps the selected date, filters, and event selection.

### Reserve Resource Time modal

Compact two-column form: blackout start, blackout end, resource type, selected resources, operational note, Save Blackout, and Discard. Existing conflicts appear as a dense inline grid, not a large warning card.

### Create Booking workspace

The booking form opens as a 12-column dense sheet with scheduling decisions before patient identity. This order supports resource-first booking from Scheduler while remaining efficient when launched from a patient record.

```text
Row 1: Booking Date(3) | Start Time(2) | Duration(2) | Chair(2) | Lead Clinician(3)
Row 2: Consultation Objective(4) | Care Priority(2) | Booking Source(2) | Coordination Notes(4)
Row 3: Patient Mode(2) | Patient Lookup(6) | Mobile Preview(2) | Consent State(2)
Quick-registration row: Mobile Number(3) | Given Name(3) | Family Name(3) | Birth Date or Age(3)
Notification row: Patient SMS | Patient WhatsApp | Clinician Alert
Footer: Save Booking | Save and Add to Clinical Queue | Discard
```

- Patient Mode values are `Registered Patient` and `Quick Registration`; the selected branch never changes the outer sheet width.
- `Consultation Objective` is a structured booking-objective master and may set default duration, chair capabilities, and care priority.
- `Lead Clinician` is filtered by clinic membership, working hours, leave, service capability, and overlapping active bookings.
- `Chair` is filtered by clinic, chair capability, blackout interval, and overlapping active bookings.
- `Save and Add to Clinical Queue` is available only when the booking date equals the clinic-local operational date and queue admission permission is present.
- Validation order is resource interval, clinician availability, chair availability, patient identity, communication consent, then notification eligibility.

## 6. Patient Registry

### Toolbar and filter strip

First row:

```text
[Register Patient] [Saved Cohorts] [primary search: Name / Patient ID / Mobile / Email] [search icon]
```

Second row is a collapsible dense advanced-filter matrix:

```text
Location | Birth Window | Household | Acquisition Channel | Referring Patient
Open Balance Above | Custom Attributes | Continuity Due | Encounter Date | Clear Filters
```

All labels in this matrix are DentOS product terms. Localization may translate visible text while stable field keys remain unchanged.

### Registry grid

| Column | Width/behavior |
|---|---|
| Sr | 48 px |
| Patient ID | 104 px |
| Patient Name | min 220 px, flexible |
| Mobile | 120 px |
| Email | min 180 px |
| Patient Segment | 130 px |
| Lead Clinician | 140 px |
| Open Balance | 110 px, right aligned |
| Actions | 118 px, fixed right |

Server paging footer shows first/previous/page/next/last, row range, total count, and page size. Header remains sticky. Search/filter changes return to page 1.

### Register Patient modal/page

Desktop uses an identity-first 12-column form grid:

```text
Row 1: Mobile Number(3) | Given Name(3) | Family Name(3) | Patient ID(3)
Row 2: Intent Tier(4) | Intent Reason(4) | Intent Note(4)
Row 3: Preferred Name(2) | Honorific(2) | Birth Date(2) | Gender Identity(2) | Lead Clinician(4)
Row 4: Email Address(4) | Alternate Phone(3) | Communication Language(2) | Welcome Consent(3)
Row 5: Postal Code(2) | City(2) | Locality(3) | Street Address(5)
Row 6: Identity Type(2) | Identity Number(3) | Acquisition Channel(3) | Referred By(4)
Row 7: Patient Segment(3) | Fee Profile(3) | Occupation(3) | Emergency Contact(3)
Row 8: Registration Notes(12)
```

`Intent Tier` is a required three-option segmented control: `1 Star: Do Not Treat`, `2 Star: In-Budget Friction`, and `3 Star: High-Intent Friction`. Selecting a tier immediately restricts `Intent Reason` to that tier's reason-code list. `Intent Note` accepts 1-1000 trimmed characters when populated. Save remains disabled until tier, reason, assessed timestamp, and assessing user are valid.

The sticky footer order is `Save Profile`, `Save and Create Booking`, `Save and Start Encounter`, `Discard`. Mobile duplicate detection runs after normalization and before identity fields unlock. Identity values are encrypted and permission-filtered. Validation appears beside fields and never shifts unrelated rows.

## 7. Patient Care Workspace

Opening a patient uses one route-preserving shell with this exact secondary menu:

```text
Care Overview | Activity Stream | Odontogram | Diagnostics | Care Plan | Delivered Care |
Clinical Notes | Medication Orders | Fee Statements | Collections | Lab Cases | Files | Communications
```

The patient identity/context header remains stable while tabs change. Returning to the registry restores its filter, page, selected row, and scroll position.

### Care Overview and Activity Stream

- Care Overview actions: `Edit Profile`, `Start Encounter`, `Create Booking`, and `Create Continuity Task`.
- Care Overview sections: Patient Details, Clinical Team, Active Cases, Active Alerts, Next Continuity Action, Open Fee Exposure, and Recent Care.
- Patient documents are `Clinical Summary`, `Account Ledger`, `Fee Activity`, `Statement Ledger`, `Care Chronology`, and `Patient Card`. Selecting a document opens `Period`, `Generate`, and `Discard` when date input is applicable.
- Activity Stream combines bookings, encounters, diagnoses, delivered care, medication orders, files, communications, and financial events in chronological order.

Patient Details shows the current Intent Tier, tier reason, assessment timestamp, assessing user, and `View Tier History`. Users with `patient.intent_tier.edit` can select `Change Intent Tier`; the inline editor requires a new tier, compatible reason, optional note, and confirmation. The history grid is append-only with Changed At, From Tier, To Tier, Reason, Note, Source, and Changed By.

Active Cases is a 28 px-row matrix with Case No., Initial Consultation, Primary Consult Doctor, Secondary Review Doctor, Intent Snapshot, Execution State, Primary Pending Value, Secondary Pending Value, Target Date, and Actions. `Create Clinical Case` opens the consultation workspace without losing patient context.

### Odontogram, Diagnostics, and Delivered Care

- Odontogram is a dense interactive tooth surface with `Tooth Context`, `Clinical Alerts`, service search, and service-domain filter. Tooth selection must not resize the chart or toolbar.
- Diagnostics remains a separate clinical record tab; an empty record renders inside the tab rather than redirecting.
- Delivered Care is distinct from Care Plan and Fee Statements and lists completed or active service history with encounter, clinician, tooth, and source links.

### Care Plan

`Create Care Plan` opens a dense header plus line-entry workspace:

```text
Plan Name | Proposed On | Authoring Clinician | Proposed Value | Care Plan State | Clinical Rationale
Service Search | Service Domain | service results | Add Service
[Save Care Plan] [Discard Care Plan]
```

Each selected line preserves service, tooth/care area, material, fee/rate, tax, notes, and state. `Add Service Definition` exposes `Service Name`, `Service Type`, `Fee`, `Code`, `Cost`, `Tax Rate`, `Care Area`, `Material Choices`, `Care Plan Visibility`, `Chargeable`, and `Priority Pin`, ending with `Add Service to Care Plan` or `Discard Service Definition`.

The Treatment Presentation matrix sits directly below the care-plan header and above service search:

```text
Bundle Tier [Primary | Secondary | Tertiary] | Sequence | Bundle Title | Target Start | Bundle State
Clinical Rationale | Estimated Value | Accepted Value
Service Domain | Service Search | Tooth | Surfaces | Proposed Amount | Add to Bundle
[Save Bundle] [Add Next Bundle] [Discard Bundle Changes]
```

- `Primary` renders a red left rule, `Secondary` renders an amber left rule, and `Tertiary` renders a neutral graphite left rule; status is never conveyed by color alone.
- Each bundle band is full width, 86 px collapsed and 168 px expanded. It is not a nested card.
- At least one Primary bundle with one service is required before an advised-treatment consultation can be finalized.
- A care-plan service can appear in exactly one bundle. Attempting to add an assigned service displays the owning bundle and does not duplicate the row.
- Every line displays the frozen service domain, service name, tooth, surfaces, proposed amount, and line state.
- Primary, Secondary, and Tertiary sequence numbers are independent, positive, and stable after save.
- `Target Start` drives the month-based pending register. Blank target dates appear only when the report uses Advised Month.
- Tertiary bundles never appear in the Pending Primary or Pending Secondary operational registers.

Care-plan stages and per-stage acceptance remain available. Stage order answers when care is delivered; Bundle Tier answers clinical presentation priority. One stage can contain services from different bundle tiers, and one bundle can contain services from multiple stages only when every line preserves its original care-plan-stage link.

### Clinical case and consultation workspace

`Create Clinical Case` opens a full-width dense workspace within the patient route:

```text
Case No. | Consultation Date/Time | Intent Tier Snapshot | Execution State
Primary Consult Doctor | Secondary Review Doctor | Consultation Objective
Chief Complaint | Clinical Summary | Presentation Summary | Review Outcome
[Not Started] [Minor Issue & Treated Same Day] [No Treatment Needed] [Treatment Started]
State Reason | State Note | Evidence Preview
[Save Draft] [Finalize Consultation] [Discard]
```

- Primary Consult Doctor and Secondary Review Doctor are mandatory, clinic-scoped, active-clinician selectors and cannot contain the same clinician.
- Intent Tier Snapshot is read-only and is copied from Patient Details when the case is created.
- New cases default to `Not Started`.
- `Minor Issue & Treated Same Day` enables a required Completed Care Delivery selector limited to the initial consultation date.
- `No Treatment Needed` enables a required controlled reason and optional note.
- `Treatment Started` can be selected manually only with `clinical_case.edit_state` and a visible evidence selector for an in-progress bundled care delivery. The applied-payment trigger does not require a browser action.
- Evidence Preview displays the exact care-plan service, bundle tier, future encounter, allocation reference, allocation date, and applied amount when progression is automatic.
- Finalize remains disabled until both clinicians, objective, clinical summary, execution-state evidence, and required Primary bundle pass validation.
- Finalized consultations are immutable. Corrections use `clinical_case.correct_state`, require a reason and note, and append a new state event.

### Care delivery completion and continuity panel

Changing a care delivery from `Planned` or `In Progress` to `Completed`, or activating `Complete Care Delivery`, opens a compact inline closure panel directly below that delivery row. It does not navigate away from the clinical encounter, and release remains blocked until the panel is saved or discarded.

```text
Completion Follow-Up  [No Follow-Up] [Clinic Rule] [Custom Date]
Rule Preview [resolved rule and calculated date, read-only]
Custom Date [DD-MMM-YYYY] | Time [HH:MM] | Follow-Up Rationale [select] | Assign To [staff]
Notes [single-line text] | Reminder Times [minute tokens] | SMS [checkbox] | WhatsApp [checkbox]
[Use Recommended Date] [Save Completion] [Cancel]
```

- The inline panel is 122 px high with 28 px control rows and a 32 px command row; switching modes never changes its outer height.
- `No Follow-Up` clears rule and custom scheduling fields and creates no continuity task.
- `Clinic Rule` resolves the service-specific rule first, the service-domain rule second, and the clinic-wide rule third. `Rule Preview` displays the selected rule name and resulting clinic-local due date.
- `Custom Date` is disabled when clinic policy disallows custom scheduling. When enabled, it requires a date strictly after the clinic-local completion date. Time defaults from the selected rule when one exists, otherwise from the clinic continuity default, and remains user-editable.
- `Follow-Up Rationale` is required for `Clinic Rule` and `Custom Date`; `Notes` accepts 0-1000 characters.
- `Assign To` lists active staff in the encounter clinic and may remain blank for the unassigned queue. `Reminder Times` contains distinct nonnegative minute offsets before the due instant, ordered from greatest to smallest.
- SMS and WhatsApp are selectable only when the clinic channel is enabled, the patient has a valid destination, and consent is not opted out. A blocked channel remains visible, unchecked, read-only, and labelled with its exact suppression reason.
- `Use Recommended Date` copies the currently resolved rule date and time into the custom fields without saving.
- `Save Completion` submits care-delivery completion, linked care-plan-service completion, continuity-task creation, state histories, audit rows, and outbox event as one command. A failure leaves the delivery and every continuity row unchanged.
- `Discard` restores the delivery's persisted state and closes the panel. It never cancels an already committed continuity task.
- During encounter release, each unsaved completion panel is shown in the release requirements grid with command `Resolve`; release cannot silently apply a default continuity choice.

### Clinical Notes and Medication Orders

- `Add Note` first opens a protocol picker with `Personal Templates`, `Clinic Repository`, `Name`, `Preview`, `Select`, and `Discard`.

`Create Medication Order` is one dense clinical workspace. It does not use a wizard, stacked cards, or separate full-page editors for diagnosis, suggested services, and medications.

```text
+--------------------------------------------------------------------------------------------------+
| Medication Orders | [Save as Protocol] [Save Order] [Save and Sign*] [Discard Order]                   |
| Prescribing Clinician [select] | Order Date [DD/MM/YY] | Clinical Guidance [text]                         |
+----------------------------+------------------------------------------+--------------------------+
| Clinical Context           | Medication Order Draft                       | Add to Medication Order      |
| Diagnosis [type-ahead]     | Dx  | diagnosis | tooth | remove         | (Catalog) (Protocols)    |
| selected diagnosis tokens  | Svc | domain / service | tooth           | Search medications       |
| Suggested Service          | Rx1 | medication / ingredient / strength | Domain [All]             |
| [type-ahead]               |     | Dose | Pattern | Duration | Unit     | ranked compact results   |
| selected service tokens    |     | Patient Directions | safety state   | priority pin             |
| Recommended Protocol       | Rx2 | medication / ingredient / strength |                          |
| [protocol] [Load Protocol] |     | Dose | Pattern | Duration | Unit     |                          |
|                            |     | Instructions | safety state         |                          |
+----------------------------+------------------------------------------+--------------------------+
```

`Save and Sign` is visible only when cryptographic signing is enabled and the user has `medication_order.sign`. `Save Order` is always the base commit action; disabling the feature flag removes `Save and Sign` without changing the remaining geometry.

#### Stable geometry

- At 1280 px and wider, use columns `minmax(250px, 3fr) minmax(500px, 6fr) minmax(300px, 3fr)` with 1 px separators.
- At 1024-1279 px, use columns `240px minmax(470px, 1fr) 280px`; the entire clinical area may scroll horizontally but controls do not collapse into cards.
- Workspace header height is 34 px; clinical identity row is 34 px; section headings are 28 px; result rows and selected diagnosis/service rows are 28 px.
- Medication draft rows use a stable 82 px minimum and 96 px maximum. Long directions use one truncated line plus tooltip until the input receives focus.
- The right result grid remains 300 px high. Loading, empty, and error states occupy the same height so the medication order draft never shifts.
- Footer/action commands remain in the header; there is no oversized bottom action bar.

#### Clinical Context pane

1. `Diagnosis` is a combobox with placeholder `Search diagnosis`; it opens after two characters or an exact code.
2. Results display code, name, optional ICD-10 code, and no descriptive paragraph. ArrowDown/ArrowUp changes the active row, Enter selects, and Escape closes.
3. Selected diagnosis rows show diagnosis name, optional tooth selector, optional surface selector, and remove icon. The first selected row receives sequence 1.
4. `Suggested Service` is a combobox with placeholder `Search service`; each result displays service name followed by its service-domain name.
5. A selected service row shows domain, service, optional tooth/surfaces, linked diagnosis selector, and remove icon.
6. `Recommended Protocol` is read-only until a diagnosis or service exists. A unique highest match is preselected; ties remain an explicit dropdown choice.
7. `Load Protocol` is disabled without an active protocol. Activating it loads the exact version and moves focus to the first editable medication field.
8. Changing diagnosis or service after a protocol load shows one 28 px reconciliation strip with `Keep Current` and `Reload Protocol`; it never discards manual edits silently.

#### Medication Order Draft pane

1. Diagnosis rows, service rows, and medication rows are visible in one scroll region with sticky labels `Dx`, `Svc`, and `Rx`.
2. Each medication line displays brand name, active ingredients, strength, dosage form, and safety state above the editable administration controls.
3. Editable columns are `Strength`, `Dose Instruction`, `Administration Pattern`, `Duration`, `Duration Unit`, and `Patient Directions`; duration units are blank, Days, Weeks, and Months, while saved values normalize to `days`, `weeks`, or `months`.
4. Administration Pattern is a type-ahead selector sourced from `administration_patterns`; manually entered text is rejected unless policy permits a custom line and records a rationale.
5. `Remove Medication` is an icon button with tooltip. Removing the final medication disables `Save Order` and `Save and Sign`.
6. A blocking allergy uses text `Blocked: allergy match`, names the ingredient, and disables final commands. A warning uses text `Warning: review required` and an acknowledgement checkbox. Informational matches do not add row height.
7. Duplicate protocol lines are not merged by brand text. Exact `medication_id + administration_pattern_id + strength_option_text` duplicates show `Already added` and remain a single row.

#### Add to Medication Order pane

1. Segmented controls are exactly `Catalog` and `Protocols`.
2. Search placeholder is `Search medications`; `Domain` defaults to `All domains`.
3. Catalog results show priority pin, medication name, optional strength, and active-ingredient summary. Selecting a result adds one draft line using its applicable administration default.
4. Protocol results show protocol name and version. Selecting a protocol exposes `Load Protocol`; loading over existing rows requires `Replace Draft Lines` or `Append Medications`.
5. Result selection never saves data. `Save as Protocol` opens the shared protocol draft editor and requires `configuration.practice.edit`; without that permission the command is hidden.

#### Header and keyboard order

1. On open, `Prescribing Clinician` defaults to the active encounter clinician; `Order Date` defaults to the clinic-local encounter date; focus moves to Diagnosis.
2. Tab order is Diagnosis, selected diagnosis tooth/surfaces, Suggested Service, selected service tooth/surfaces, Recommended Protocol, Load Protocol, first medication Strength, Dose Instruction, Administration Pattern, Duration, Duration Unit, Patient Directions, Clinical Guidance, Save Order, Save and Sign when enabled, Discard Order.
3. Enter selects the active type-ahead row; Escape closes only the active popup; Delete removes a focused selected token after a confirmation-free undo period inside the unsaved draft.
4. The configured save key invokes Save only when all required sections are valid. The configured sign key invokes Save and Sign only after the explicit signing confirmation.
5. Keyboard hints are available through control tooltips and accessibility metadata, not persistent explanatory text inside the clinical workspace.

#### Measured 30-second medication order path

| Elapsed window | Exact focused controls | Required visible result |
|---|---|---|
| 0-2 seconds | Create Medication Order, Prescribing Clinician, Date | active encounter clinician and clinic-local date are populated; focus is on Diagnosis Search |
| 2-6 seconds | Diagnosis Search, Diagnosis Results | two typed characters return at most 20 stable rows; ArrowDown and Enter add one diagnosis |
| 6-10 seconds | Suggested Service Search, treatment result | selected service displays its structural category and starts recommendation loading |
| 10-14 seconds | Recommended Protocol, Load Protocol | exact active protocol version expands ordered medication lines and focuses the first editable dose field |
| 14-22 seconds | Strength, Take, Frequency, For, Duration Period, Instructions, Safety Acknowledgement | Tab navigation edits values without row resize; blocking safety alerts disable final commands |
| 22-27 seconds | Clinical Guidance | optional note is entered while the browser draft retains all selected context |
| 27-30 seconds | Save or Save and Sign | one idempotent request freezes the complete diagnosis, treatment, and medication catalog graph; signing confirmation appears only for Save and Sign |

The timed acceptance test starts with an open patient encounter, warm application assets, and representative clinic master data. Passing requires diagnosis and service type-ahead p95 below 250 ms, medication type-ahead p95 below 300 ms, recommendation p95 below 350 ms, protocol expansion p95 below 300 ms, and save acknowledgement p95 below 900 ms.

### Fee Statements and Collections

`New Fee Statement` uses:

```text
Statement Date | Fee Statement No | Amount | Paid | Comments
Search | Category | charge results | Add charge
[Save] [Cancel]
```

An added charge exposes `Fees`, `Rate`, `Notes`, remove, and discount availability. The UI term is `Fee Statement`; backend accounting may call it an fee_statement.

`Record Collection` uses exactly one collection method per saved entry:

```text
Amount | Collection Method | Collection Reference | Collection Date | Cheque/Ref # | Notes
[Save] [Cancel]
```

There is no visible Fee Statement selector, split-tender grid, `Apply`, or `Settle` action on the audited form. Cash + UPI requires two collection entries in DentOS core mode. Collection-to-fee statement application remains separate behind-the-scenes accounting logic; any split-tender UI is an extension.

### Lab, Docs, and Messages

- `Create Lab Case`: `Ref No`, `Lab Work`, `Assigned To Lab`, `Teeth`, `Shade and Notes`, `Request Date`, `Requested By`, `Expected Date`, `Work Status`, `Work Step`, `Received Date`, `Received By`, and `Amount`.
- `Docs` provides `Add Files` and a compact patient document gallery/list with upload metadata and permission-aware actions.
- Patient `Messages` provides `Date`, message type, and `Refresh`; Communicate offers `SMS` and `WhatsApp`. External send requires confirmation.

## 8. Clinical Queue

### Filter/action bar

```text
Operational Date | Queue State | Lead Clinician | Patient Lookup | Care Stream | Refresh
[Add Unscheduled Encounter] [Admit Existing Booking] [Open Patient]
```

Primary actions remain visible without scrolling.

### Queue grid

| Column | Width/behavior |
|---|---|
| # | 42 px queue sequence |
| Time | 72 px |
| Patient | min 190 px, flexible |
| Code | 90 px |
| Care Stream | 104 px |
| Consultation Objective | min 160 px |
| Lead Clinician | 140 px |
| Chair | 80 px |
| Status | 96 px |
| Waiting | 72 px, live minute counter |
| Actions | 190-240 px, fixed right |

Rows remain 30 px maximum unless a second status line is genuinely required. Patient phone/medical detail does not appear by default in the queue.

### Action matrix

| Encounter state | Visible row actions |
|---|---|
| Arriving | Edit, Admit, Begin Care when direct entry is permitted |
| Admitted | Edit, Begin Care |
| In Care | Open Care Workspace, Release Encounter |
| Released | View; Reopen only with permission |
| Cancelled | View only |

Only valid actions render. Do not show a disabled wall of impossible commands.

### State behavior

- Admit changes status in place and stamps the admission time.
- Begin Care changes row status and opens the Patient Care Workspace.
- Release Encounter completes the encounter only after required clinical and financial decisions.
- Concurrent change shows a compact conflict banner and refreshes that row.
- Sort defaults to queue sequence/time; active waiting/engaged rows are visually distinct but remain in stable order.

### Add Unscheduled Encounter sheet

The queue-first sheet uses a different order from both registration and booking:

```text
Row 1: Patient Mode(2) | Patient Lookup or Mobile Number(5) | Care Stream(2) | Priority(3)
Row 2: Consultation Objective(4) | Lead Clinician(3) | Chair(2) | Expected Duration(3)
Quick-registration row: Given Name(3) | Family Name(3) | Birth Date or Age(3) | Gender Identity(3)
Row 4: Operational Date(3) | Arrival Time(2) | Communication Consent(3) | Queue Notes(4)
Footer: Add to Queue | Add and Begin Care | Discard
```

`Add and Begin Care` requires `queue.engage` and an available clinician/chair combination. The sheet creates one patient only in Quick Registration mode, one encounter, one queue state event, and one audit event in a single transaction.

## 9. Practice Assets

Primary tabs are `Patient Education`, `Laboratory`, `Inventory`, `Suppliers`, and `Operating Expenses`.

### Patient Education

- Toolbar commands are `Add Learning Resource`, `Search`, `Resource Domain`, and `Status`.
- The main surface is a dense list with columns Title, Domain, Format, Language, Active, Display Order, Updated By, and Actions.
- Playback opens an internal media viewer and preserves patient context when launched from a care workspace.

### Laboratory

- Laboratory uses `Open Cases`, `Due Soon`, `Received`, `Quality Review`, and `Closed` segmented views.
- Each row displays Case Reference, Patient, Lab Partner, Work Definition, Tooth Context, Requested Date, Expected Date, Current Step, Owner, Amount, and Actions.
- `Create Lab Case` uses the patient/encounter context when launched clinically and does not duplicate identity fields.

### Inventory and suppliers

- Inventory tabs are `Stock Position`, `Inbound`, `Outbound`, `Adjustments`, and `Reorder Queue`.
- Inbound and outbound documents use a compact header plus editable lines for Item, Batch, Expiry, Quantity, Unit Cost, Storage Location, and Line Value.
- Posting is distinct from saving a draft. Posted inventory movement is immutable and corrected through a reversing document.
- Supplier registry columns are Supplier ID, Name, GSTIN, Contact, Active Terms, Open Payables, and Actions.

### Operating expenses

Filters are Expense Period, Expense Domain, Supplier, Collection Method, Status, and Entered By. Columns are Voucher, Date, Domain, Supplier, Method, Amount, Owner, Approval State, and Actions.

## 10. Comms Center

Secondary navigation:

```text
Conversations | Scheduled Care | Campaigns | Templates | Delivery Monitor | Consent Registry
```

Campaign setup:

```text
Purpose: Care / Transactional / Promotional
Audience rules | Channel priority | Template version
Recipient eligibility preview
[Review Campaign]
```

Before final submission, show a compact reconciliation grid: eligible, duplicate, opted-out, invalid destination, missing variables, estimated segments, and estimated credits. External transmission requires explicit confirmation.

Batch grid columns: created time, route, template, recipients, queued, sent, delivered, failed, suppressed, creator, status/actions.

## 11. Financial Operations

Primary tabs are `Fee Statements`, `Collection Receipts`, `Fee Allocations`, `Credits and Relief`, `Refunds`, and `Account Ledger`.

### Fee Statements

The worklist shows Statement Reference, Statement Date, Patient, Encounter, Lead Clinician, Gross Fees, Concessions, Tax, Net Fees, Allocated, Open Amount, State, and Actions. Commands are `Create Fee Statement`, `Post`, `Void`, `Print`, and `Open Allocation` according to permission and document state.

### Collection Receipts

The worklist shows Collection Reference, Collection Date, Patient, Collection Method, Collected Amount, Allocated Amount, Unallocated Amount, Operator, State, and Actions. `Record Collection` never implies fee allocation; allocation is a separate command and transaction.

### Fee Allocations

The allocation workspace uses a left grid of available collection balances and a right grid of open statement lines. The footer displays Selected Collection, Proposed Allocation, Remaining Collection, Remaining Fee Exposure, and `Commit Allocation`.

### Credits, relief, refunds, and ledger

- Credits reduce a selected fee statement and preserve tax attribution.
- Relief requires a policy reason and privileged approval.
- Refunds can consume only refundable collection balance and preserve original collection method lineage.
- Account Ledger renders immutable journal activity with source links; it never edits financial documents directly.

## 12. Deep Analytics

Two-pane desktop layout:

```text
left: category/report tree, 230-280 px
right: filter toolbar, report grid, paging/totals
```

Category order:

```text
Priority Views
Conversion Intelligence
Expense Control
Clinician Performance
Collection Operations
Communication Delivery
Laboratory Operations
Clinical Value
Patient Intelligence
Booking Operations
Acquisition Intelligence
Practice Performance
Clinical Intelligence
Asset Intelligence
```

Report grid uses sticky header, numeric right alignment, stable totals footer, server paging, column resize/reorder, print, and export. Opening a drill-down retains parent filters and provides a clear back path.

### Open Fee Exposure Register

Compact filter toolbar:

```text
Clinic Branch | As-of Date | Statement Date From | Statement Date To
Patient Category | Category Basis: Snapshot / Current
Lead Clinician | Clinician Split toggle | Aging Bucket | Minimum Due
[Run/Refresh] [Print] [Export]
```

Grid columns:

```text
Clinic | Patient Code | Patient | Category | Statement Reference | Statement Date | Due Date
Lead Clinician(s) | Fee Statement Total | Applied | Credits | Write-off | Due
Age Days | Aging Bucket | Actions
```

The sticky totals footer shows Fee Statement count, patient count, total due, and amount/count for `0-30`, `31-60`, `61-90`, and `90+`. Bucket headers include tooltips with boundaries; `90+` is displayed as `>90 days` in the tooltip so day 90 is not double-counted. Selecting Clinician Split changes the grain to clinician/line due and adds an Unassigned row where needed; its footer must equal the unsplit Due total for identical filters.

Patient advances/unapplied Collections are not subtracted in this grid. A patient with both due Fee Statements and an advance may show an Advance indicator/link, but Due remains the sum of Fee Statement receivable. Clicking Due opens settlement drill-down; clicking Advance opens the separate unsettled-collections register.

### Conversion Intelligence

The category contains six independent report leaves. Every leaf uses server paging, a sticky totals row, clinic-local dates, immutable consultation snapshots, and row-level drill-down to the source clinical case. `Primary Consult Doctor` and `Secondary Review Doctor` are separate attribution dimensions; neither label is substituted with the patient's current Lead Clinician.

#### Monthly Total Category Consultations

```text
Filters: Clinic Branch | Month From | Month To | Service Domain | Consultation Status
Grid: Month | Clinic | Service Domain | Total Consultations | Distinct Patients | Distinct Cases
Commands: [Run/Refresh] [Print] [Export]
```

One finalized consultation contributes once to each distinct service domain represented by its saved treatment bundles. Repeated services in the same domain and case do not multiply the consultation count.

#### High-Intent Pipeline Bottleneck

```text
Filters: Clinic Branch | As-of Date | Primary Consult Doctor | Secondary Review Doctor | Service Domain | Minimum Proposed Value
Grid: Intent Tier | Patient ID | Patient | Mobile | Case Reference | Consultation Date | Primary Consult Doctor | Secondary Review Doctor | Primary Bundle Value | Total Proposed Value | Days Pending | Last Contact | Next Action | Actions
Commands: [Run/Refresh] [Assign Follow-Up] [Print] [Export]
```

The fixed population is `3 Star High-Intent Friction` plus `Not Started`. The UI cannot weaken either predicate. `Days Pending` is the whole clinic-local day difference between As-of Date and consultation date.

#### Doctor-Wise Clinical Conversion Ratios

```text
Filters: Clinic Branch | Consultation From Date | Consultation To Date | As-of At | Primary Consult Doctor | Service Domain | Intent Tier Basis | Intent Tier | Include Zero-Consultation Doctors
Grid: Clinic | Primary Consult Doctor | Total Initial Consultations | Treatment Started Cases | Not Started Cases | Minor Issue and Treated Same Day Cases | No Treatment Needed Cases | Conversion Percentage
Commands: [Run/Refresh] [Print] [Export]
```

`Conversion Percentage = Treatment Started Cases / Total Initial Consultations * 100`. Minor Issue & Treated Same Day is reported in its own column and is not added to the numerator. A zero denominator renders a blank percentage with an explanatory tooltip and never renders `NaN`.

#### High-Value Category Conversions

```text
Filters: Clinic Branch | Consultation From Date | Consultation To Date | As-of At | Doctor Role: Primary / Secondary | Doctor | High-Value Service Domain | Intent Tier | Execution State
Grid: Month | Clinic | Service Domain | Doctor Role | Doctor | High-Value Consultations | Treatment Started Cases | Conversion Percentage | Advised Value | Converted Advised Value
Commands: [Run/Refresh] [Print] [Export]
```

Only service domains with `High Value = On` qualify. A case contributes once per treatment domain and selected doctor role; Primary and Secondary role totals must be deduplicated by case before they are used as a clinic-wide total.

#### Cross-Tier Matrix Generator

```text
Filters: Clinic Branch | Consultation From Date | Consultation To Date | Group Dimensions: Treatment Category / Intent Tier / Execution Status | Treatment Category | Intent Tier Basis | Intent Tier | Execution State | Primary Consult Doctor | Secondary Review Doctor
Grid: Treatment Category Group | Intent Tier Group | Execution Status Group | Case Count | Total Advised Value | Average Advised Value | Treatment Started Count | Treatment Started Percentage
Commands: [Run/Refresh] [Print] [Export]
```

Intent Tier Basis explicitly selects current patient tier or the case-creation snapshot. Omitted grouping dimensions collapse to `All`; the query deduplicates by case after each omitted dimension becomes null so a multi-category case is not multiplied when category grouping is off.

#### Pending Priority Treatment Registers

```text
Filters: Clinic Branch | Selected Month | Month Basis: Target Start / Advised | Register Tier: Primary / Secondary | Bundle State | Treatment Category | Intent Tier | Execution State | Primary Consult Doctor | Secondary Review Doctor
Grid: Register Tier | Clinic | Target or Advised Date | Patient ID | Patient | Mobile | Case Reference | Intent Tier | Execution State | Primary Consult Doctor | Secondary Review Doctor | Bundle Title | Bundle State | Treatment Categories | Pending Services | Pending Service Count | Pending Advised Value | Actions
Commands: [Run/Refresh] [Assign Follow-Up] [Print] [Export]
```

The Primary register admits Primary bundles only; the Secondary register admits Secondary bundles only. Tertiary bundles remain visible through the case drill-down and are excluded from both priority registers by design.

### Collection Activity by Date

Compact filter toolbar:

```text
Clinic Branch | From Date | To Date
Patient Category | Category Basis: Snapshot / Current
Lead Clinician | Include Unassigned | Cashier/User | Collection Method
[Collections | Fee Allocations] [Run/Refresh] [Print] [Export]
```

The default `Collections` grid is one row per Date + Clinic + Cashier:

```text
Date | Clinic | Cashier/User | Collection Receipt Count | Patient Count
Cash | UPI | Card | Net Banking | Other | Gross Collection | Refund | Net Collection
```

The sticky footer enforces:

```text
Cash + UPI + Card + Net Banking + Other = Gross Collection
Gross Collection - Refund = Net Collection
sum cashier Gross Collection = clinic/date Gross Collection
```

`Fee Allocations` is a separate segmented view with Application Date, Clinic, Applied By, Lead Clinician, Collection Method, and Applied Amount. It never relabels applied amounts as collection and never uses collection receipt-date/cashier semantics. Switching views preserves applicable filters and visibly changes the authoritative date/user labels.

Drill-down from a collection cell opens collection receipt/tender IDs and amounts only. Applied/unapplied values may be displayed as pre-aggregated informational columns in collection receipt detail but must not change collection totals.

## 13. System Configuration

Use a 248 px configuration navigator and a compact work surface. Do not use a gallery of configuration cards.

```text
Practice Identity
  Clinics | Workforce | Chairs and Resources | Working Calendar | Visual Theme
Care Delivery Masters
  Consultation Objectives | Care Priorities | Service Domains | Service Catalog | Materials | Bridges
Patient Data Masters
  Acquisition Channels | Honorifics | Patient Segments | Flags | Occupations | Custom Attributes
Clinical Safety
  Allergies | Risk Factors | Alert Rules | Treatment Priorities | Document Domains
Medication Studio
  Medication Domains | Active Ingredients | Medication Catalog | Administration Patterns | Medication Protocols
Clinical Documentation
  Note Protocols | Custom Forms | Clinical Note Policies | Feedback Forms
Communications
  Sender Identities | SMS Providers | WhatsApp Providers | Consent Policies | Message Templates
Financial Masters
  Collection Methods | Ledger Accounts | Fee Profiles | Tax Definitions | Fee Statement Domains
Practice Assets
  Stock Domains | Inventory Items | Suppliers | Lab Partners | Lab Work Definitions | Quality Gates
Document Output
  Fee Statement | Collection Receipt | Clinical Summary | Medication Order | Care Plan
Security and Governance
  Users | Roles | Permission Matrix | Sessions | Audit Retention | Backup Policies
Numbering Policies
  Patient ID | Collection Reference | Statement Reference | Lab Case | Expense Voucher | Stock In | Stock Out
Data Operations
  Backup Run | Restore Drill | Duplicate Patient Resolution | Import Queue | Export Queue
```

### Practice identity and workforce split-screen

Opening `System Configuration -> Practice Identity` divides the content area into two simultaneous option groups. Do not implement these as separate routes, accordions, stacked cards, or a wizard at desktop/laptop widths.

```text
+--------------------------------------+------------------------------------------------------+
| Practice Identity                    | Workforce and Access                                  |
|--------------------------------------|------------------------------------------------------|
| Clinic selector / Add Clinic         | Search Workforce | Add Team Member                      |
| Legal identity and contacts          | Team Member compact grid                              |
| Address / GST / timezone             | Name | Function | Clinics | Login | State | Actions    |
| Working calendar / resources         |------------------------------------------------------|
|                                      | Selected workforce profile                           |
|                                      | [Create Account] / [Link Existing Account]           |
|                                      | Authentication | Clinic Scope | Access Policies        |
|--------------------------------------|------------------------------------------------------|
| Save Practice | Revert               | Save Member | Suspend Account | Reset Credential       |
+--------------------------------------+------------------------------------------------------+
```

Required layout behavior:

- At 1024 px and above use stable tracks such as `minmax(340px, 5fr) minmax(560px, 7fr)` with a 1 px vertical divider. The right pane is wider because it contains the user/permission matrix.
- Each pane has its own sticky heading, scroll region, validation summary, dirty state, and footer actions. Saving one pane does not submit or reset the other.
- Selecting a different clinic reloads both panes only after resolving dirty-state confirmation.
- Below 1024 px the panes stack in the same order: Practice Identity first, Workforce and Access second. They never become decorative cards.

### Workforce and account controls

The upper right grid is 28 px per row and includes Name, Workforce Function, Registration/Specialization summary, assigned Clinics, Account ID, Account State, and Actions. A workforce profile may display `No Account`; this is a valid state.

`Add Team Member` and `Edit Team Member` fields use this order:

```text
Workforce Function | Display Name | Assigned Clinics | Active
Registration No. | Specialization | Calendar Color | Display Order
```

Selecting `Create Account` expands three compact sections in the right pane:

```text
Authentication
  Account ID | Work Email | Mobile | Display Name
  Temporary Secret | Confirm Secret | Send Activation
  Force Secret Rotation | Account State

Clinic Scope
  Clinic checkbox grid | Default Clinic selector

Access Policies
  Assigned Roles | Effective Capabilities | User Overrides
```

Existing secrets and password hashes are never displayed. After creation, secret inputs disappear; the available commands are `Reset Credential`, `Unlock Account`, and `Suspend Account` according to permission and state. `Link Existing Account` uses a searchable organization account selector and previews current clinic scope before confirmation.

### Permission matrix

The permission editor is a dense grouped table, not one Administrator checkbox:

| Module/resource | View | Create | Edit | Delete draft/archive | Execute/void | Print | Export |
|---|---:|---:|---:|---:|---:|---:|---:|
| Patient Registry | checkbox | checkbox | checkbox | checkbox | resolve duplicate | - | checkbox |
| Scheduler/Clinical Queue | checkbox | checkbox | checkbox | cancel | admit/begin/release/override | print | - |
| Care Workspace/Odontogram/Care Plan/Medication | checkbox | checkbox | checkbox | draft only | complete/void/sign | print | - |
| Fee Statements | checkbox | checkbox | draft | - | issue/discount/void | checkbox | - |
| Collections | checkbox | checkbox | reference | - | apply/reverse/refund/void | checkbox | - |
| Deep Analytics | operational/clinical/financial/inventory | - | - | - | - | checkbox | checkbox |
| Comms Center/Files | checkbox | send/upload | edit | draft only | campaign submit | - | - |
| Practice Assets | checkbox | checkbox | checkbox | draft only | post/void/override | print | export |
| System Configuration/Governance | clinic/workforce/audit | account | member/account | suspend | roles/overrides/numbering/backup | - | - |

Each checkbox maps to one stable permission code from document 01. Role grants show as checked and locked with the role name; a user override is a three-state control `Inherit | Allow | Deny`. Deny is visually distinct and has a tooltip, but the state also has text and an icon so it is not color-only. The footer shows `Save Access Policies` and `Discard`.

Users lacking `security.role.manage` see the effective matrix read-only. Users lacking `security.user.create` do not see Create Account. Users lacking a resource permission do not see its action, but every request remains subject to server authorization as specified in document 05.

### Medication Catalog Studio

The Medication Studio navigator uses this order: `Medication Domains`, `Active Ingredients`, `Medication Catalog`, `Administration Patterns`, and `Medication Protocols`. Selecting a leaf replaces only the right configuration surface and retains navigator scroll position. Every editable control requires `configuration.practice.edit`; users with only `configuration.practice.view` receive the same grids and detail fields in read-only form with mutation commands removed.

#### Shared registry frame

```text
Title | Search [type to filter] | lifecycle filter | [Create]
sticky 28 px header
28 px paged rows
selected row editor below or to the right
[Save] [Discard] or [Deactivate]
```

- Search runs after 120 ms, retains the selected row when it remains in the result set, and returns to page 1 when the filter changes.
- `Create` opens a blank editor without clearing the grid filters.
- `Save` validates and submits one idempotent command. `Discard` restores the selected persisted version after dirty confirmation.
- Referenced masters use `Deactivate` or `Retire`; Delete is not shown for a row referenced by an encounter, protocol, medication order, care plan, service, or safety mapping.
- A stale `row_version` keeps entered values, displays a one-line conflict strip, and provides `Reload Current`.

#### Medication Domains

Grid columns and widths:

| Column | Width | Value |
|---|---:|---|
| Sr | 44 px | page-relative sequence |
| Code | 110 px | stable uppercase code |
| Name | min 220 px | medication-domain display name |
| Order | 72 px | nonnegative display order |
| Status | 82 px | Active or Inactive text |
| Actions | 108 px | Edit and Deactivate/Activate |

Editor controls are `Code` text input, `Name` text input, `Display Order` integer input, `Active` toggle, `Save Domain`, and `Discard Domain`. Code and name are required and case-insensitively unique inside the organization.

#### Active Ingredients

Grid columns are `Sequence`, `Code`, `Ingredient Name`, `Lifecycle`, and `Actions`. The editor contains `Ingredient Code`, `Ingredient Name`, `Default Contraindications`, `Ingredient Synonyms`, `Active`, `Save Active Ingredient`, and `Discard Active Ingredient`. Synonyms use token entry with Enter to commit one token and Backspace to remove the focused final token. Deactivation does not remove the ingredient snapshot from historical medication orders.

#### Medication Catalog

The list header is `Medication Catalog`. Its toolbar is `Medication Domain`, `Lifecycle`, `Medication Search`, and `New Medication`; domain defaults to `All domains` and the search placeholder is `Search brand, ingredient, strength`. Grid columns are `Sequence`, `Medication`, `Primary Domain`, `Active Ingredient`, `Dosage Form`, `Lifecycle`, and `Actions` with 28 px rows.

Medication Detail uses this exact dense order:

```text
Medication Name [brand name]                       Priority Pin [toggle]
Domains [multi-select tokens]                      Dosage Form [select]
Contraindications [textarea, two compact rows]
Administration Default
  Dose Instruction [text] | Administration Pattern [type-ahead]
  Duration [number] | Duration Unit [blank/Days/Weeks/Months]
  Patient Directions [single-line input] | Insert Phrase [menu]
Strength Options
  Strength [text] | [Add Strength Option]
  Sequence | Strength | Lifecycle | Remove
Active Ingredients
  Active Ingredient [type-ahead] | Quantity [numeric] | Unit [text] | [Add Active Ingredient]
  Sequence | Active Ingredient | Quantity | Unit | Primary | Remove
[Save Medication] [Discard Medication]
```

- Medication Name is required and becomes the medication-order brand snapshot.
- Domains accepts multiple values and requires one `Primary Domain`; it is marked by text and a filled radio indicator.
- Dosage Form is a searchable selector backed by the clinic pharmaceutical-form catalog.
- Administration Default resolves to one `administration_patterns` row; visible values remain editable before save.
- Add Strength Option requires nonblank strength and appends a 28 px row. Duplicate case-insensitive strength is rejected inline.
- Add Active Ingredient requires an ingredient; Quantity and Unit are both blank or both populated. At least one active ingredient is required, and exactly one is Primary.
- Save writes the medication header, domain links, administration default, strength options, and ingredient links atomically. Partial child saves are not exposed.

#### Administration Patterns

The compact list exposes `Pattern Search`, `New Pattern`, `Sequence`, `Label`, `Route`, `Lifecycle`, and `Actions`. Selecting an entry opens one compact editor:

```text
Pattern Code | Display Label | Dose Instruction | Frequency Expression | Route
Duration | Duration Unit [blank/Days/Weeks/Months] | Patient Directions | Display Order | Active
[Save Administration Pattern] [Discard Administration Pattern]
```

`Display Label` is the visible administration phrase, while Frequency Expression stores the normalized medication-order value. Deactivate replaces Delete when a medication default, protocol line, or medication-order line references the pattern.

#### Medication Protocols

The registry has `Medication Protocols`, search placeholder `Search protocols`, `New Protocol`, and grid columns `Sequence`, `Protocol`, `Version`, `Lifecycle`, `Actions`. Edit opens a three-tab compact editor: `Medication Lines`, `Diagnosis Links`, `Service Links`.

Protocol header controls:

```text
Protocol Code | Protocol Name | Version | Lifecycle
Protocol Notes
Default Clinical Guidance
```

Medication Lines tab:

```text
left 68%: ordered medication rows
right 32%: Medication Search | Domain [All domains] | medication result list
selected row: Strength | Dose Instruction | Administration Pattern | Duration | Unit | Patient Directions | Required | Remove
```

Diagnosis Links tab:

```text
Search Diagnosis | [New Diagnosis Definition]
selected links: Sequence | Code | Diagnosis | Priority Weight | Auto-load | Remove
```

`New Diagnosis Definition` opens a 420 px side panel with `Code`, `Name`, `ICD-10 Code`, `Description`, `Default Clinical Note`, `Synonyms`, `Display Order`, `Active`, `Save Diagnosis`, and `Discard Diagnosis`. It requires `configuration.practice.edit`; after save, the diagnosis is selected into the draft link.

Service Links tab:

```text
Search Service | Service Domain
selected links: Sequence | Service Code | Service Domain | Service | Priority Weight | Auto-load | Remove
```

Every service result displays its `service_domains.name`; the editor cannot store free-text domain or service names. `Priority Weight` is a positive decimal and Auto-load is a checkbox. Duplicate diagnosis or service links are rejected before submission.

Protocol footer commands are `Save Protocol Draft`, `Activate Protocol Version`, `Create Protocol Version`, `Retire Protocol Version`, and `Discard Protocol Changes`. Only draft versions expose editable rows. Activation requires one medication line. Create Protocol Version copies the selected active version into a new draft with its version incremented by one. Retirement preserves every historical medication-order source link.

#### Permission behavior

| User capability | Master grids | Master editors | Patient medication order | Signing |
|---|---|---|---|---|
| `configuration.practice.view` only | visible | read-only | unavailable unless separately granted | unavailable |
| `configuration.practice.edit` without medication order permissions | visible | editable | unavailable | unavailable |
| `medication_order.create` without settings edit | active values searchable | unavailable | create and save | unavailable unless separately granted |
| `medication_order.sign` without settings edit | unavailable unless separately granted | unavailable | view through separate `medication_order.view`; sign authorized record | available only for the linked prescribing clinician |
| `configuration.practice.edit` plus `medication_order.sign` | visible | editable | requires separate `medication_order.create` to create | available only for the linked prescribing clinician |

### Serials grid

Toolbar/actions: `Save`, `Reset`, `Type`, `Generate`, `Prefix`, `Start From`, and `Edit`. Exact serial rows: `Patient Code`, `Collection Reference`, `Statement Reference`, `Lab Order No.`, `Exp. Voucher`, `Goods In`, and `Goods Out`. `Generate` choices are `Manual Serial Number`, `Year based Serial`, and `Year Month based Serial`. Changes require privileged save and show collision validation inline.

### Document Output

Each of `Fee Statement`, `Collection Receipt`, `Clinical Summary`, `Medication Order`, and `Care Plan` shares a compact property editor: Page Size (A3/A4/A5/B5/Ledger/Legal/Letter/Custom), Orientation (`Potrait` as specified, Landscape), Logo placement, Barcode (None/QR Code/Code39/Code128) with size/show-text/placement, Page Header, Footer, Margins, Spacings, Font, Options, `Save`, and `Reset`.

## 14. Responsive Behavior

Primary target is desktop/laptop reception use. Minimum fully supported width: 1024 px.

- At 1024-1279 px, hide optional columns and preserve fixed action columns.
- Below 1024 px, navigation becomes a compact drawer; operational grids retain horizontal scroll rather than collapsing into cards.
- Scheduler Resource Week always permits horizontal scroll.
- Modal forms become one/two columns on narrow screens; footer actions remain sticky.
- Text never overlaps controls. Long identifiers truncate with tooltip; amounts and dates do not wrap.

## 15. Loading, Empty, Error, and Concurrency States

- Skeleton rows preserve exact grid dimensions.
- Empty state is one compact row/message within the grid area, with relevant New action.
- Error state appears in the affected panel and provides Retry; global navigation remains usable.
- Save buttons disable during submission and idempotency prevents duplicates.
- Stale edit shows who/what changed when available, offers reload, and never overwrites silently.
- Provider/job delays show queued/retry state rather than indefinite spinner.

## 16. Print and Export

- Print views remove navigation, keep clinic identity, report/form title, filters, generated time, page numbers, and totals.
- Fee Statement, Collection Receipt, Clinical Summary, Medication Order, Care Plan, Scheduler, and analytic document-output settings are version-controlled.
- Printed tables repeat headers and never split a single logical total row.
- Exported columns and totals match the visible filtered report unless the user explicitly selects all columns.

## 17. Visual Acceptance Gate

Release requires DentOS-owned design captures at 1440x900 and 1024x768 for Dashboard, each Scheduler view, Patient Registry, Register Patient, all 13 patient workspace tabs, Create Care Plan, Create Medication Order, New Fee Statement, Record Collection, Create Lab Case, Clinical Queue, Unscheduled Encounter, Comms Center, Practice Assets, Deep Analytics, System Configuration, serials, and each document-output editor. Compare:

- navigation order and labels
- information visible above the fold
- row/header/input heights within 2 px of target tokens
- column order and action placement
- no card-heavy/spacious substitutions
- no overlap, clipping, layout shift, or hidden primary command
- keyboard and focus behavior

Exact brand colors and tenant-specific theme values must be defined by the approved Project DentOS design system before claiming visual conformance.

<!-- ZERO_SHORTCUT_EXPANSION -->

## 18. Complete Control Registry

Coordinates are deterministic grid locations within the dense application shell. They are not claims about unmeasured tenant-specific pixels. Exact screenshot coordinates remain a release gate in document 08.

| Screen | Exact label | Control | Placeholder or tooltip | Coordinate | Width | Permission | Validation | Action | Build phase |
|---|---|---|---|---|---|---|---|---|---|
| Global shell | Dashboard | navigation link | none | top navigation position 1 | route width 84 px | session active | exact label | open /dashboard | [Phase 1] |
| Global shell | Clinical Queue | navigation link | none | top navigation position 2 | route width 112 px | queue.view | exact label | open /clinical-queue | [Phase 1] |
| Global shell | Scheduler | navigation link | none | top navigation position 3 | route width 86 px | scheduler.view | exact label | open /scheduler | [Phase 1] |
| Global shell | Patient Registry | navigation link | none | top navigation position 4 | route width 118 px | patient.view | exact label | open /patient-registry | [Phase 1] |
| Global shell | Practice Assets | navigation link | none | top navigation position 5 | route width 112 px | expense.view or inventory.view or lab.view | exact label | open /practice-assets | [Phase 3] |
| Global shell | Comms Center | navigation link | none | top navigation position 6 | route width 106 px | message.view | exact label | open /comms-center | [Phase 3] |
| Global shell | Financial Operations | navigation link | none | top navigation position 7 | route width 146 px | fee_statement.view or collection.view | exact label | open /financial-operations | [Phase 1] |
| Global shell | Deep Analytics | navigation link | none | top navigation position 8 | route width 108 px | one analytics view permission | exact label | open /deep-analytics | [Phase 1] |
| Global shell | System Configuration | navigation link | none | top navigation position 9 | route width 152 px | one configuration view permission | exact label | open /system-configuration | [Phase 1] |
| Global shell | Active Clinic | select | Select Active Clinic | context toolbar left | 190 px | active clinic membership | required authorized clinic | change active clinic and refresh scoped capabilities | [Phase 1] |
| Global shell | Operational Date | date input | DD-MMM-YYYY | context toolbar after clinic | 132 px | session active | valid clinic-local date | change operational date without changing posted dates | [Phase 1] |
| Global shell | My Profile | menu button | none | top-right | 92 px | session active | none | open profile and session menu | [Phase 1] |
| Global shell | Sign Out | menu command | none | profile menu last row | full menu width | session active | confirmation when dirty | revoke current session | [Phase 1] |
| Dashboard | Active Clinic | segmented option | none | toolbar position 1 | 108 px | clinic membership | one scope selected | show active clinic activity | [Phase 1] |
| Dashboard | Authorized Clinics | segmented option | none | toolbar position 2 | 132 px | multiple clinic memberships | one scope selected | show all authorized clinic activity | [Phase 3] |
| Dashboard | Refresh | icon button | Refresh dashboard | toolbar after operational date | 28 px | session active | none | reload current scope | [Phase 1] |
| Dashboard | Activity Audit | command button | none | toolbar right | 104 px | audit.view | none | open scoped activity audit | [Phase 1] |
| Dashboard | Register Patient | command button | none | quick command position 1 | 118 px | patient.create | none | open identity-first registration | [Phase 1] |
| Dashboard | Add to Clinical Queue | command button | none | quick command position 2 | 154 px | queue.admit | none | open queue-first unscheduled encounter sheet | [Phase 1] |
| Dashboard | Create Booking | command button | none | quick command position 3 | 132 px | scheduler.create | none | open resource-first booking sheet | [Phase 1] |
| Dashboard | Record Collection | command button | none | quick command position 4 | 142 px | collection.create | none | open collection receipt entry | [Phase 2] |
| Scheduler | Refresh | icon button | Refresh scheduler | action bar position 1 | 28 px | scheduler.view | none | reload selected view | [Phase 1] |
| Scheduler | Print | icon button | Print scheduler | action bar position 2 | 28 px | analytics.print | none | print selected scheduler range | [Phase 1] |
| Scheduler | Reserve Resource Time | command button | none | action bar position 3 | 146 px | scheduler.edit | none | open resource blackout sheet | [Phase 1] |
| Scheduler | Create Booking | command button | none | action bar position 4 | 132 px | scheduler.create | none | open resource-first booking sheet | [Phase 1] |
| Scheduler | Month | segmented option | none | view selector position 1 | 62 px | scheduler.view | one view selected | render month grid | [Phase 1] |
| Scheduler | Week | segmented option | none | view selector position 2 | 62 px | scheduler.view | one view selected | render week time grid | [Phase 1] |
| Scheduler | Day | segmented option | none | view selector position 3 | 54 px | scheduler.view | one view selected | render day clinician grid | [Phase 1] |
| Scheduler | Resource Day | segmented option | none | view selector position 4 | 104 px | scheduler.view | one view selected | render chair-day matrix | [Phase 1] |
| Scheduler | Resource Week | segmented option | none | view selector position 5 | 116 px | scheduler.view | one view selected | render date-chair matrix | [Phase 1] |
| Scheduler | Previous Period | icon button | Previous period | date navigator position 1 | 28 px | scheduler.view | none | move one selected-view period backward | [Phase 1] |
| Scheduler | Today | command button | none | date navigator position 2 | 62 px | scheduler.view | none | select clinic-local today | [Phase 1] |
| Scheduler | Next Period | icon button | Next period | date navigator position 3 | 28 px | scheduler.view | none | move one selected-view period forward | [Phase 1] |
| Scheduler | Scheduler Date | date input | DD-MMM-YYYY | date navigator position 4 | 132 px | scheduler.view | valid date | jump to date | [Phase 1] |
| Scheduler | Lead Clinician | multi-select | All Lead Clinicians | filter strip position 1 | 190 px | scheduler.view | authorized active clinicians only | filter without changing bookings | [Phase 1] |
| Scheduler | Chair | multi-select | All Chairs | filter strip position 2 | 150 px | scheduler.view | active chairs only | filter resources | [Phase 1] |
| Scheduler | Blackout Start | datetime input | DD-MMM-YYYY HH:mm | blackout sheet row 1 columns 1-4 | 4/12 | scheduler.edit | before Blackout End | set blackout start | [Phase 1] |
| Scheduler | Blackout End | datetime input | DD-MMM-YYYY HH:mm | blackout sheet row 1 columns 5-8 | 4/12 | scheduler.edit | after Blackout Start | set blackout end | [Phase 1] |
| Scheduler | Resource Type | select | Clinician / Chair / Clinic | blackout sheet row 1 columns 9-10 | 2/12 | scheduler.edit | one resource type | select resource class | [Phase 1] |
| Scheduler | Selected Resources | multi-select | Select Resources | blackout sheet row 2 columns 1-6 | 6/12 | scheduler.edit | at least one active resource | select blackout resources | [Phase 1] |
| Scheduler | Operational Note | text input | Operational note | blackout sheet row 2 columns 7-12 | 6/12 | scheduler.edit | required, 1-250 characters | store blackout note | [Phase 1] |
| Scheduler | Save Blackout | primary button | none | blackout sheet footer position 1 | 112 px | scheduler.edit | no unresolved conflict | commit resource blackout | [Phase 1] |
| Scheduler | Discard Blackout | secondary button | none | blackout sheet footer position 2 | 118 px | scheduler.edit | dirty confirmation | close without mutation | [Phase 1] |
| Patient Registry | Register Patient | command button | none | toolbar position 1 | 118 px | patient.create | none | open identity-first registration | [Phase 1] |
| Patient Registry | Saved Cohorts | menu button | none | toolbar position 2 | 112 px | patient.view | configured cohort | apply saved cohort filter | [Phase 1] |
| Patient Registry | Primary Search | search input | Name / Patient ID / Mobile / Email | toolbar flexible center | min 360 px | patient.view | 2 characters or exact patient ID | query authorized patients | [Phase 1] |
| Patient Registry | Search | icon button | Search registry | toolbar after search | 28 px | patient.view | search valid | run registry search | [Phase 1] |
| Patient Registry | Location | text input | City, locality, or postal code | advanced filter row | 210 px | patient.view | 0-200 characters | filter location values | [Phase 1] |
| Patient Registry | Birth Window | date-range input | From - To | advanced filter row | 190 px | patient.view | valid recurring month-day range | filter birthdays | [Phase 1] |
| Patient Registry | Household | patient selector | Household member | advanced filter row | 190 px | patient.view | authorized patient | filter household links | [Phase 1] |
| Patient Registry | Acquisition Channel | multi-select | All acquisition channels | advanced filter row | 210 px | patient.view | active or historical channel | filter acquisition source | [Phase 1] |
| Patient Registry | Referring Patient | patient selector | Patient name or ID | advanced filter row | 210 px | patient.view | authorized patient | filter referring patient | [Phase 1] |
| Patient Registry | Open Balance Above | money input | 0.00 | advanced filter row | 130 px | patient.view | nonnegative amount | filter net patient balance | [Phase 1] |
| Patient Registry | Custom Attributes | typed filter builder | Select attribute | advanced filter row | 240 px | patient.view | operator matches data type | filter custom data | [Phase 1] |
| Patient Registry | Continuity Due | date-state filter | Due date / state | advanced filter row | 190 px | patient.view | valid state and date | filter continuity tasks | [Phase 1] |
| Patient Registry | Encounter Date | date-range input | From - To | advanced filter row | 190 px | patient.view | from not after to | filter actual encounters | [Phase 1] |
| Patient Registry | Clear Filters | command button | none | advanced filter row last | 100 px | patient.view | none | clear filters and return page 1 | [Phase 1] |
| Patient Registry | Open Patient | row command | none | grid action column position 1 | 92 px | patient.view | selected row | open Care Overview | [Phase 1] |
| Patient Registry | Edit Profile | row command | none | grid action column position 2 | 88 px | patient.edit | active patient | open patient profile editor | [Phase 1] |
| Register Patient | Mobile Number | tel input | Mobile number | form row 1 columns 1-3 | 3/12 | patient.create | normalized mobile and duplicate policy | set primary mobile | [Phase 1] |
| Register Patient | Given Name | text input | Given name | form row 1 columns 4-6 | 3/12 | patient.create | required, 1-80 characters | set given name | [Phase 1] |
| Register Patient | Family Name | text input | Family name | form row 1 columns 7-9 | 3/12 | patient.create | 0-80 characters | set family name | [Phase 1] |
| Register Patient | Patient ID | text input | Automatic or manual ID | form row 1 columns 10-12 | 3/12 | patient.create | unique under numbering policy | preview or set patient ID | [Phase 1] |
| Register Patient | Intent Tier | segmented control | 1 Star / 2 Star / 3 Star | form row 2 columns 1-4 | 4/12 | patient.create and patient.intent_tier.edit | exactly one mandatory tier | set current patient intent tier and seed immutable tier event | [Phase 1] |
| Register Patient | Intent Reason | select | Select intent reason | form row 2 columns 5-8 | 4/12 | patient.create and patient.intent_tier.edit | active reason code permitted for selected tier | set structured intent rationale | [Phase 1] |
| Register Patient | Intent Note | text input | Clinical suitability or friction note | form row 2 columns 9-12 | 4/12 | patient.create and patient.intent_tier.edit | blank or 1-1000 trimmed characters | set accountable assessment note | [Phase 1] |
| Register Patient | Preferred Name | text input | Preferred name | form row 3 columns 1-2 | 2/12 | patient.create | 0-80 characters | set preferred display name | [Phase 1] |
| Register Patient | Honorific | select | Select honorific | form row 3 columns 3-4 | 2/12 | patient.create | active honorific or blank | set honorific | [Phase 1] |
| Register Patient | Birth Date | date input | DD-MMM-YYYY | form row 3 columns 5-6 | 2/12 | patient.create | not future | set birth date | [Phase 1] |
| Register Patient | Gender Identity | select | Select gender identity | form row 3 columns 7-8 | 2/12 | patient.create | configured value | set gender identity | [Phase 1] |
| Register Patient | Lead Clinician | select | Select lead clinician | form row 3 columns 9-12 | 4/12 | patient.create | active clinician in clinic | set primary clinician relationship | [Phase 1] |
| Register Patient | Email Address | email input | Email address | form row 4 columns 1-4 | 4/12 | patient.create | valid email or blank | set email | [Phase 1] |
| Register Patient | Alternate Phone | tel input | Alternate phone | form row 4 columns 5-7 | 3/12 | patient.create | normalized phone or blank | set alternate phone | [Phase 1] |
| Register Patient | Communication Language | select | Select language | form row 4 columns 8-9 | 2/12 | patient.create | configured language | set preferred communication language | [Phase 1] |
| Register Patient | Welcome Consent | channel consent group | SMS / WhatsApp / Email | form row 4 columns 10-12 | 3/12 | patient.create | explicit state per channel | set welcome-message consent | [Phase 1] |
| Register Patient | Postal Code | text input | Postal code | form row 5 columns 1-2 | 2/12 | patient.create | country-specific format | set postal code | [Phase 1] |
| Register Patient | City | text input | City | form row 5 columns 3-4 | 2/12 | patient.create | 0-100 characters | set city | [Phase 1] |
| Register Patient | Locality | text input | Locality | form row 5 columns 5-7 | 3/12 | patient.create | 0-120 characters | set locality | [Phase 1] |
| Register Patient | Street Address | text input | Street address | form row 5 columns 8-12 | 5/12 | patient.create | 0-300 characters | set street address | [Phase 1] |
| Register Patient | Identity Type | select | Select identity type | form row 6 columns 1-2 | 2/12 | patient.create plus KYC policy | configured identity type or blank | choose encrypted identity format | [Phase 1] |
| Register Patient | Identity Number | masked text input | Identity number | form row 6 columns 3-5 | 3/12 | patient.create plus KYC policy | valid selected identity format | encrypt identity value | [Phase 1] |
| Register Patient | Acquisition Channel | select | Select acquisition channel | form row 6 columns 6-8 | 3/12 | patient.create | active channel | set acquisition source | [Phase 1] |
| Register Patient | Referred By | patient or contact selector | Search patient or contact | form row 6 columns 9-12 | 4/12 | patient.create | compatible with acquisition channel | set referral source entity | [Phase 1] |
| Register Patient | Patient Segment | multi-select | Select patient segments | form row 7 columns 1-3 | 3/12 | patient.create | active segments | assign patient segments | [Phase 1] |
| Register Patient | Fee Profile | select | Select fee profile | form row 7 columns 4-6 | 3/12 | patient.create | active fee profile | set default pricing profile | [Phase 1] |
| Register Patient | Occupation | select | Select occupation | form row 7 columns 7-9 | 3/12 | patient.create | active occupation or blank | set occupation | [Phase 1] |
| Register Patient | Emergency Contact | compound input | Name and mobile | form row 7 columns 10-12 | 3/12 | patient.create | both blank or valid name and mobile | set emergency contact | [Phase 1] |
| Register Patient | Registration Notes | textarea | Registration notes | form row 8 columns 1-12 | 12/12 | patient.create | 0-2000 characters | set registration note | [Phase 1] |
| Register Patient | Save Profile | primary button | none | sticky footer position 1 | 108 px | patient.create | complete valid form | commit patient profile | [Phase 1] |
| Register Patient | Save and Create Booking | command button | none | sticky footer position 2 | 176 px | patient.create and scheduler.create | patient form valid | commit patient and open booking sheet | [Phase 1] |
| Register Patient | Save and Start Encounter | command button | none | sticky footer position 3 | 184 px | patient.create and queue.admit | patient form valid | commit patient and open encounter admission | [Phase 1] |
| Register Patient | Discard | secondary button | none | sticky footer position 4 | 86 px | patient.create | dirty confirmation | close without mutation | [Phase 1] |
| Patient workspace tabs | Care Overview | tab | none | secondary navigation position 1 | auto | patient.view | patient context fixed | open Care Overview without changing patient | [Phase 1] |
| Patient workspace tabs | Activity Stream | tab | none | secondary navigation position 2 | auto | patient.view | patient context fixed | open chronological activity without changing patient | [Phase 1] |
| Patient workspace tabs | Odontogram | tab | none | secondary navigation position 3 | auto | patient.view | patient context fixed | open odontogram without changing patient | [Phase 3] |
| Patient workspace tabs | Diagnostics | tab | none | secondary navigation position 4 | auto | patient.view | patient context fixed | open diagnostics without changing patient | [Phase 3] |
| Patient workspace tabs | Care Plan | tab | none | secondary navigation position 5 | auto | patient.view | patient context fixed | open care plans without changing patient | [Phase 3] |
| Patient workspace tabs | Delivered Care | tab | none | secondary navigation position 6 | auto | patient.view | patient context fixed | open delivered care without changing patient | [Phase 3] |
| Patient workspace tabs | Clinical Notes | tab | none | secondary navigation position 7 | auto | patient.view | patient context fixed | open clinical notes without changing patient | [Phase 3] |
| Patient workspace tabs | Medication Orders | tab | none | secondary navigation position 8 | auto | patient.view | patient context fixed | open medication orders without changing patient | [Phase 3] |
| Patient workspace tabs | Fee Statements | tab | none | secondary navigation position 9 | auto | patient.view | patient context fixed | open fee statements without changing patient | [Phase 1] |
| Patient workspace tabs | Collections | tab | none | secondary navigation position 10 | auto | patient.view | patient context fixed | open collection receipts without changing patient | [Phase 2] |
| Patient workspace tabs | Lab Cases | tab | none | secondary navigation position 11 | auto | patient.view | patient context fixed | open laboratory cases without changing patient | [Phase 3] |
| Patient workspace tabs | Files | tab | none | secondary navigation position 12 | auto | patient.view | patient context fixed | open files without changing patient | [Phase 3] |
| Patient workspace tabs | Communications | tab | none | secondary navigation position 13 | auto | patient.view | patient context fixed | open patient communications without changing patient | [Phase 3] |
| Patient care workspace commands | Edit Profile | command button | none | Care Overview action bar position 1 | 104 px | patient.edit | active patient | open profile editor | [Phase 1] |
| Patient care workspace commands | Start Encounter | command button | none | Care Overview action bar position 2 | 94 px | queue.admit | active patient | create patient encounter | [Phase 1] |
| Patient care workspace commands | Create Booking | command button | none | Care Overview action bar position 3 | 132 px | scheduler.create | active patient | create patient care booking | [Phase 1] |
| Patient Details | Current Intent Tier | read-only status cell | none | intent panel row 1 columns 1-3 | 3/12 | patient.intent_tier.view | current patient tier exists | display current tier, reason, assessor, and assessment time | [Phase 1] |
| Patient Details | Change Intent Tier | command button | none | intent panel heading right | 126 px | patient.intent_tier.edit | active patient | open tier change sheet | [Phase 1] |
| Patient Details | New Intent Tier | segmented control | 1 Star / 2 Star / 3 Star | tier change sheet row 1 columns 1-4 | 4/12 | patient.intent_tier.edit | differs from current tier | select replacement tier | [Phase 1] |
| Patient Details | Tier Change Reason | select | Select intent reason | tier change sheet row 1 columns 5-8 | 4/12 | patient.intent_tier.edit | active reason permitted for replacement tier | set structured change reason | [Phase 1] |
| Patient Details | Tier Change Note | textarea | Explain the reassessment | tier change sheet row 2 columns 1-12 | 12/12 | patient.intent_tier.edit | blank or 1-1000 trimmed characters | set reassessment evidence | [Phase 1] |
| Patient Details | Save Intent Change | primary button | none | tier change sheet footer position 1 | 138 px | patient.intent_tier.edit | tier, reason, note, and row version valid | update current tier and append immutable history event | [Phase 1] |
| Patient Details | Intent History | expandable grid | none | intent panel below current state | 100% | patient.intent_tier.view | patient fixed | show old tier, new tier, reason, note, assessor, and timestamp | [Phase 1] |
| Active Cases | Create Clinical Case | command button | none | case grid toolbar position 1 | 144 px | clinical_case.create | active patient and encounter | open clinical case editor | [Phase 3] |
| Active Cases | Open Clinical Case | row command | none | case grid action column | 112 px | clinical_case.view | authorized selected case | open consultation and bundle workspace | [Phase 3] |
| Clinical Case | Consultation Objective | select | Select consultation objective | case header row 1 columns 1-4 | 4/12 | clinical_case.create | active objective | set objective snapshot | [Phase 3] |
| Clinical Case | Primary Consult Doctor | staff select | Select primary doctor | consultation row 1 columns 1-4 | 4/12 | case_consultation.finalize | active clinician in encounter clinic | set principal consultation attribution | [Phase 3] |
| Clinical Case | Secondary Review Doctor | staff select | Select secondary doctor | consultation row 1 columns 5-8 | 4/12 | case_consultation.finalize | active clinician in encounter clinic and different from primary | set independent review attribution | [Phase 3] |
| Clinical Case | Case Execution State | select | Select execution state | consultation row 1 columns 9-12 | 4/12 | clinical_case.edit_state | one of four defined states with required evidence | stage initial execution classification | [Phase 3] |
| Clinical Case | Consultation Summary | textarea | Findings, decision, and patient response | consultation row 2 columns 1-12 | 12/12 | case_consultation.finalize | required, 1-4000 characters | store immutable consultation summary snapshot | [Phase 3] |
| Clinical Case | Finalize Consultation | primary button | none | consultation footer position 1 | 148 px | case_consultation.finalize | doctors, objective, summary, state, and Primary bundle valid | lock consultation and append case state event | [Phase 3] |
| Clinical Case | Correct Case State | command button | none | case state history toolbar right | 126 px | clinical_case.correct_state | reason and note required | append authorized correction without rewriting history | [Phase 3] |
| Treatment Presentation | Bundle Tier | segmented control | Primary / Secondary / Tertiary | bundle header columns 1-3 | 3/12 | treatment_bundle.manage | unique tier per active case | select presentation priority | [Phase 3] |
| Treatment Presentation | Bundle Label | text input | Patient-facing option name | bundle header columns 4-7 | 4/12 | treatment_bundle.manage | required, 1-120 characters | set bundle label | [Phase 3] |
| Treatment Presentation | Bundle State | select | Advised / Accepted / Declined / Scheduled / In Progress / Completed / Cancelled | bundle header columns 8-10 | 3/12 | treatment_bundle.manage | valid state transition and required acceptance/completion metadata | set bundle decision state | [Phase 3] |
| Treatment Presentation | Add Service | command button | none | bundle header columns 11-12 | 2/12 | treatment_bundle.manage | active care-plan service from same patient and case | append linked service to bundle | [Phase 3] |
| Treatment Presentation | Service Search | combobox | Search proposed service | bundle line toolbar flexible | min 260 px | treatment_bundle.manage | exact service code or at least 2 characters | search case care-plan services | [Phase 3] |
| Treatment Presentation | Service Domain | read-only text | none | bundle service row column 2 | 150 px | clinical_case.view | snapshot resolved | display service-domain attribution | [Phase 3] |
| Treatment Presentation | Proposed Amount | money input | 0.00 | bundle service row column 5 | 110 px | treatment_bundle.manage | nonnegative and not greater than care-plan service balance | set presented service value | [Phase 3] |
| Treatment Presentation | Save Bundle | primary button | none | bundle footer position 1 | 112 px | treatment_bundle.manage | tier, label, state, and at least one service valid | commit bundle and service snapshots atomically | [Phase 3] |
| Patient care workspace commands | Add Continuity Task | command button | none | Continuity heading right | 98 px | clinical.edit | due date and rationale required | open continuity editor | [Phase 3] |
| Patient care workspace commands | Create Care Plan | command button | none | Care Plan toolbar position 1 | 92 px | care_plan.create | active patient | open care-plan editor | [Phase 3] |
| Patient care workspace commands | Plan Name | text input | Plan | care-plan header column 1 | 160 px | care_plan.create | required | set care-plan name | [Phase 3] |
| Patient care workspace commands | Proposed On | date input | DD-MMM-YYYY | care-plan header column 2 | 132 px | care_plan.create | valid date | set proposal date | [Phase 3] |
| Patient care workspace commands | Authoring Clinician | staff select | Select Clinician | care-plan header column 3 | 170 px | care_plan.create | active clinician | set proposing clinician | [Phase 3] |
| Patient care workspace commands | Proposed Value | read-only money | 0.00 | care-plan header column 4 | 110 px | care_plan.create | sum saved lines | display proposed value | [Phase 3] |
| Patient care workspace commands | Care Plan State | select | Select Status | care-plan header column 5 | 130 px | care_plan.edit | valid plan transition | set care-plan state | [Phase 3] |
| Patient care workspace commands | Clinical Rationale | text input | Comments | care-plan header column 6 | min 220 px | care_plan.edit | 0-1000 characters | set clinical rationale | [Phase 3] |
| Patient care workspace commands | Service Search | search input | Search | plan line toolbar flexible | min 260 px | care_plan.create | 2 characters | search service catalog | [Phase 3] |
| Patient care workspace commands | Service Domain | select | Category | plan line toolbar | 180 px | care_plan.create | active category | filter services | [Phase 3] |
| Patient care workspace commands | Add Service Definition | command button | none | plan line toolbar right | 190 px | care_plan.create | feature enabled | open service editor | [Phase 3] |
| Patient care workspace commands | Save Care Plan | primary button | none | care-plan footer right | 78 px | care_plan.create | header and line validation pass | commit care plan | [Phase 3] |
| Patient care workspace commands | Discard Care Plan | secondary button | none | care-plan footer after Save | 78 px | care_plan.create | dirty confirmation | discard care-plan draft | [Phase 3] |
| Patient care workspace commands | Add Note | command button | none | Clinical Clinical Notes toolbar position 1 | 88 px | clinical_note.create | none | open note-protocol picker | [Phase 3] |
| Patient care workspace commands | Create Medication Order | command button | none | Medication Orders toolbar position 1 | 142 px | medication_order.create | active patient | open medication order | [Phase 3] |
| Patient care workspace commands | Save as Protocol | command button | none | Medication Order form header position 1 | 120 px | medication_order.create | medication lines valid | open protocol-save sheet | [Phase 3] |
| Patient care workspace commands | Save Order | primary button | none | Medication Order form header position 2 | 78 px | medication_order.create | clinician, date, and medication valid | commit medication order | [Phase 3] |
| Patient care workspace commands | Create Fee Statement | command button | none | Fee Statements toolbar position 1 | 88 px | fee_statement.create | active patient | open Fee Statement entry | [Phase 1] |
| Patient care workspace commands | Statement Date | date input | DD-MMM-YYYY | Fee Statement header position 1 | 132 px | fee_statement.create | open accounting date | set Fee Statement date | [Phase 3] |
| Patient care workspace commands | Fee Statement No | text input | Auto / manual number | Fee Statement header position 2 | 130 px | fee_statement.create | unique series value | preview or enter number | [Phase 2] |
| Patient care workspace commands | Fee Statement Amount | read-only money | 0.00 | Fee Statement header position 3 | 110 px | fee_statement.view | sum charge lines | display amount | [Phase 1] |
| Patient care workspace commands | Fee Statement Paid | read-only money | 0.00 | Fee Statement header position 4 | 110 px | collection.view | active applications only | display applied amount | [Phase 2] |
| Patient care workspace commands | Fee Statement Comments | text input | Comments | Fee Statement header position 5 | min 220 px | fee_statement.create | 0-1000 characters | set Fee Statement comment | [Phase 1] |
| Patient care workspace commands | Save Fee Statement | primary button | none | Fee Statement footer right | 78 px | fee_statement.create | Fee Statement lines and totals valid | save or issue under configured command | [Phase 1] |
| Patient care workspace commands | Record Collection | command button | none | Collections toolbar position 1 | 112 px | collection.create | active patient | open Collection entry | [Phase 2] |
| Patient care workspace commands | Collection Amount | money input | 0.00 | Collection form row 1 position 1 | 120 px | collection.create | greater than zero | set collected amount | [Phase 2] |
| Patient care workspace commands | Collection Method | select | Select Collection Method | Collection form row 1 position 2 | 180 px | collection.create | one active mode | set one tender mode | [Phase 2] |
| Patient care workspace commands | Collection Reference | text input | Auto / manual collection receipt number | Collection form row 1 position 3 | 160 px | collection.create | unique series value | set collection receipt number | [Phase 2] |
| Patient care workspace commands | Collection Date | date input | DD-MMM-YYYY | Collection form row 1 position 4 | 132 px | collection.create | open accounting date | set collection date | [Phase 2] |
| Patient care workspace commands | Cheque/Ref # | text input | Cheque / reference number | Collection form row 2 position 1 | 190 px | collection.create | required by mode policy | set external reference | [Phase 3] |
| Patient care workspace commands | Collection Notes | text input | Notes | Collection form row 2 flexible | min 260 px | collection.create | 0-1000 characters | set collection receipt note | [Phase 2] |
| Patient care workspace commands | Save Collection | primary button | none | Collection footer right | 78 px | collection.create | amount, mode, number, date valid | post one Collection | [Phase 2] |
| Patient care workspace commands | Discard Collection Entry | secondary button | none | Collection footer after Save | 78 px | collection.create | dirty confirmation | close without collection | [Phase 2] |
| Patient care workspace commands | Create Lab Case | command button | none | Lab toolbar position 1 | 112 px | lab.edit | active patient | open lab job | [Phase 3] |
| Patient care workspace commands | Add Files | command button | none | Files toolbar position 1 | 92 px | document.upload | file policy satisfied | open file picker | [Phase 3] |
| Patient care workspace commands | SMS | channel command | none | Communications compose menu position 1 | 64 px | message.send | SMS consent valid | open SMS composer | [Phase 3] |
| Patient care workspace commands | WhatsApp | channel command | none | Communications compose menu position 2 | 92 px | message.send | WhatsApp consent valid | open WhatsApp composer | [Phase 3] |
| Create Booking | Booking Date | date input | DD-MMM-YYYY | form row 1 columns 1-3 | 3/12 | scheduler.create | valid scheduler date | set booking date | [Phase 1] |
| Create Booking | Start Time | time input | HH:mm | form row 1 columns 4-5 | 2/12 | scheduler.create | inside clinic working policy | set start time | [Phase 1] |
| Create Booking | Duration | stepper | Minutes | form row 1 columns 6-7 | 2/12 | scheduler.create | 5-480 minutes and slot aligned | calculate end time | [Phase 1] |
| Create Booking | Chair | select | Select chair | form row 1 columns 8-9 | 2/12 | scheduler.create | active capable chair without conflict | allocate chair | [Phase 1] |
| Create Booking | Lead Clinician | select | Select lead clinician | form row 1 columns 10-12 | 3/12 | scheduler.create | active capable clinician without conflict | allocate clinician | [Phase 1] |
| Create Booking | Consultation Objective | select | Select consultation objective | form row 2 columns 1-4 | 4/12 | scheduler.create | active objective | set objective and proposed duration | [Phase 1] |
| Create Booking | Care Priority | select | Routine / Priority / Urgent | form row 2 columns 5-6 | 2/12 | scheduler.create | configured priority | set operational priority | [Phase 1] |
| Create Booking | Booking Source | select | Select booking source | form row 2 columns 7-8 | 2/12 | scheduler.create | configured source | set acquisition channel | [Phase 1] |
| Create Booking | Coordination Notes | text input | Coordination notes | form row 2 columns 9-12 | 4/12 | scheduler.create | 0-1000 characters | store booking note | [Phase 1] |
| Create Booking | Patient Mode | segmented control | none | form row 3 columns 1-2 | 2/12 | scheduler.create | Registered Patient or Quick Registration | choose patient identity branch | [Phase 1] |
| Create Booking | Patient Lookup | patient selector | Name / Patient ID / Mobile | form row 3 columns 3-8 | 6/12 | scheduler.create | required for Registered Patient | link existing patient | [Phase 1] |
| Create Booking | Mobile Preview | read-only text | none | form row 3 columns 9-10 | 2/12 | scheduler.create | derived from selected patient | display reminder destination | [Phase 3] |
| Create Booking | Consent State | read-only status | none | form row 3 columns 11-12 | 2/12 | scheduler.create | derived by channel and purpose | display communication eligibility | [Phase 1] |
| Create Booking | Mobile Number | tel input | Mobile number | quick-registration row columns 1-3 | 3/12 | scheduler.create | normalized mobile and duplicate policy | set quick patient mobile | [Phase 1] |
| Create Booking | Given Name | text input | Given name | quick-registration row columns 4-6 | 3/12 | scheduler.create | required for Quick Registration | set quick patient given name | [Phase 1] |
| Create Booking | Family Name | text input | Family name | quick-registration row columns 7-9 | 3/12 | scheduler.create | 0-80 characters | set quick patient family name | [Phase 1] |
| Create Booking | Birth Date or Age | compound date/integer input | DD-MMM-YYYY or Age | quick-registration row columns 10-12 | 3/12 | scheduler.create | valid date or age 0-130 | set quick demographic snapshot | [Phase 1] |
| Create Booking | Patient SMS | checkbox | none | notification row position 1 | auto | message.send | SMS consent and mobile | queue patient SMS reminder | [Phase 3] |
| Create Booking | Patient WhatsApp | checkbox | none | notification row position 2 | auto | message.send | WhatsApp consent and destination | queue patient WhatsApp reminder | [Phase 3] |
| Create Booking | Clinician Alert | checkbox | none | notification row position 3 | auto | message.send | clinician destination configured | queue clinician alert | [Phase 1] |
| Create Booking | Save Booking | primary button | none | footer position 1 | 108 px | scheduler.create | no unresolved resource conflict | commit booking | [Phase 1] |
| Create Booking | Save and Add to Clinical Queue | command button | none | footer position 2 | 208 px | scheduler.create and queue.admit | booking date is operational date and form valid | commit booking and admit encounter | [Phase 1] |
| Create Booking | Discard | secondary button | none | footer position 3 | 86 px | scheduler.create | dirty confirmation | close without mutation | [Phase 1] |
| Odontogram and patient documents | Tooth Context | panel toggle | none | Odontogram toolbar position 1 | 92 px | clinical.view | selected tooth | show tooth details | [Phase 3] |
| Odontogram and patient documents | Clinical Alerts | panel toggle | none | Odontogram toolbar position 2 | 92 px | clinical.view | selected tooth | show clinical warnings | [Phase 3] |
| Odontogram and patient documents | Odontogram Service Search | search input | Search Service | Odontogram toolbar flexible | min 240 px | odontogram.edit | 2 characters | search service catalog | [Phase 3] |
| Odontogram and patient documents | Odontogram Service Domain | select | Category | Odontogram toolbar after search | 170 px | odontogram.edit | active category | filter chart services | [Phase 3] |
| Odontogram and patient documents | Clinical Summary | report command | none | Care Overview document menu position 1 | 104 px | analytics.clinical.view | patient fixed | open patient Clinical Summary options | [Phase 3] |
| Odontogram and patient documents | Account Ledger | report command | none | Care Overview document menu position 2 | 82 px | analytics.financial.view | patient fixed | open patient Ledger options | [Phase 3] |
| Odontogram and patient documents | Fee Activity | report command | none | Care Overview document menu position 3 | 102 px | analytics.financial.view | patient fixed | open Fee Activity options | [Phase 3] |
| Odontogram and patient documents | Statement Ledger | report command | none | Care Overview document menu position 4 | 118 px | analytics.financial.view | patient fixed | open Statement Ledger options | [Phase 3] |
| Odontogram and patient documents | Care Chronology | report command | none | Care Overview document menu position 5 | 92 px | analytics.operational.view | patient fixed | open Care Chronology options | [Phase 3] |
| Odontogram and patient documents | Patient Card | report command | none | Care Overview document menu position 6 | 68 px | analytics.operational.view | patient fixed | open patient Card | [Phase 3] |
| Odontogram and patient documents | Report Date Range | date-range input | From - To | patient report modal row 1 | 260 px | matching report permission | from not after to | set patient report period | [Phase 3] |
| Odontogram and patient documents | Generate Document | primary button | none | patient report modal footer position 1 | 86 px | matching report permission | report inputs valid | generate patient report | [Phase 3] |
| Odontogram and patient documents | Discard Document Options | secondary button | none | patient report modal footer position 2 | 78 px | patient.view | none | close report options | [Phase 3] |
| Service Definition | Service Name | text input | Description | modal row 1 columns 1-8 | 8/12 | care_plan.create | required, 1-200 characters | set service name snapshot | [Phase 1] |
| Service Definition | Service Type | select | Select Type | modal row 1 columns 9-12 | 4/12 | care_plan.create | configured service type | set service type | [Phase 1] |
| Service Definition | Standard Fee | money input | 0.00 | modal row 2 columns 1-3 | 3/12 | care_plan.create | non-negative | set standard fee | [Phase 1] |
| Service Definition | Code | text input | Code | modal row 2 columns 4-6 | 3/12 | care_plan.create | organization-unique when supplied | set service code | [Phase 1] |
| Service Definition | Cost | money input | 0.00 | modal row 2 columns 7-9 | 3/12 | care_plan.create | non-negative | set service cost | [Phase 1] |
| Service Definition | Tax Rate | percentage input | 0.0000 | modal row 2 columns 10-12 | 3/12 | care_plan.create | 0-100 | set tax rate | [Phase 1] |
| Service Definition | Care Area | select | Select Treatment Area | modal row 3 columns 1-4 | 4/12 | care_plan.create | configured value | set tooth, surface, quadrant, arch, or mouth basis | [Phase 1] |
| Service Definition | Material Choices | multi-select | Select Materials | modal row 3 columns 5-8 | 4/12 | care_plan.create | active materials | set allowed materials | [Phase 1] |
| Service Definition | Care Plan Visibility | multi-select | Select Plan Options | modal row 3 columns 9-12 | 4/12 | care_plan.create | configured options | set plan visibility | [Phase 1] |
| Service Definition | Chargeable | checkbox | none | modal row 4 position 1 | auto | care_plan.create | boolean | allow charge creation | [Phase 1] |
| Service Definition | Priority Pin | checkbox | none | modal row 4 position 2 | auto | care_plan.create | boolean | mark quick-access service | [Phase 1] |
| Service Definition | Add Service to Care Plan | primary button | none | modal footer position 1 | 156 px | care_plan.create | service fields valid | create catalog entry and add one patient line | [Phase 1] |
| Service Definition | Discard Service Definition | secondary button | none | modal footer position 2 | 86 px | care_plan.create | dirty confirmation | close without entry | [Phase 1] |
| Care Delivery Completion | Care Delivery State | select | Select Status | service row status column | 132 px | clinical.edit | planned, in_progress, completed, or cancelled with valid transition | stage service status | [Phase 3] |
| Care Delivery Completion | Complete Care Delivery | command button | none | service row actions after Edit | 132 px | care_delivery.complete | current status planned or in_progress | open completion continuity panel | [Phase 3] |
| Care Delivery Completion | No Follow-Up | segmented option | none | completion panel row 1 position 1 | 112 px | care_delivery.complete | exactly one completion mode selected | set completion_continuity_mode none and clear scheduling fields | [Phase 3] |
| Care Delivery Completion | Clinic Rule | segmented option | none | completion panel row 1 position 2 | 104 px | care_delivery.complete | active matching rule required | set completion_continuity_mode rule and calculate due date | [Phase 3] |
| Care Delivery Completion | Custom Date | segmented option | none | completion panel row 1 position 3 | 108 px | care_delivery.complete | custom date and time required | set completion_continuity_mode custom_date | [Phase 3] |
| Care Delivery Completion | Rule Preview | read-only text | none | completion panel row 2 columns 1-4 | 4/12 | care_delivery.complete | selected rule or explicit no-rule state | display rule name and calculated clinic-local date | [Phase 3] |
| Care Delivery Completion | Follow-Up Date | date input | DD-MMM-YYYY | completion panel row 2 columns 5-7 | 3/12 | care_delivery.complete | strictly after completion local date for custom_date | set custom due date | [Phase 3] |
| Care Delivery Completion | Follow-Up Time | time input | HH:MM | completion panel row 2 columns 8-9 | 2/12 | care_delivery.complete | valid clinic-local time for custom_date | set custom due time | [Phase 3] |
| Care Delivery Completion | Follow-Up Rationale | select | Select rationale | completion panel row 2 columns 10-12 | 3/12 | care_delivery.complete | required for rule and custom_date | set continuity reason snapshot | [Phase 3] |
| Care Delivery Completion | Follow-Up Notes | text input | Notes | completion panel row 3 columns 1-5 | 5/12 | care_delivery.complete | 0-1000 characters | set completion and continuity note snapshot | [Phase 3] |
| Care Delivery Completion | Assign To | staff select | Select Staff | completion panel row 3 columns 6-7 | 2/12 | care_delivery.complete | blank or active staff in encounter clinic | assign the continuity queue owner | [Phase 3] |
| Care Delivery Completion | Reminder Times | integer token input | Minutes before due | completion panel row 3 columns 8-10 | 3/12 | care_delivery.complete | 1-10 distinct nonnegative minute values in descending order | set reminder offsets snapshot | [Phase 3] |
| Care Delivery Completion | SMS Reminder | checkbox | none | completion panel row 3 column 11 | 1/12 | care_delivery.complete | clinic channel, valid mobile, and consent allow | request SMS reminder materialization | [Phase 3] |
| Care Delivery Completion | WhatsApp Reminder | checkbox | none | completion panel row 3 column 12 | 1/12 | care_delivery.complete | clinic channel, valid WhatsApp number, and consent allow | request WhatsApp reminder materialization | [Phase 3] |
| Care Delivery Completion | Use Recommended Date | command button | none | completion panel command row position 1 | 158 px | care_delivery.complete | resolved active rule | copy calculated rule date and time into custom fields | [Phase 3] |
| Care Delivery Completion | Save Completion | primary button | none | completion panel command row position 2 | 128 px | care_delivery.complete | valid state, mode, row version, date, time, rationale, and channels | atomically complete service and create required continuity | [Phase 3] |
| Care Delivery Completion | Discard Completion | secondary button | none | completion panel command row position 3 | 126 px | clinical.edit | dirty confirmation | restore persisted service state and close panel | [Phase 3] |
| Medication Order Builder | Prescribing Clinician | staff select | Select Clinician | header row columns 1-4 | 4/12 | medication_order.create | active clinician and delegation | set prescribing clinician | [Phase 3] |
| Medication Order Builder | Order Date | date input | DD-MMM-YYYY | header row columns 5-7 | 3/12 | medication_order.create | valid clinical date | set medication-order date | [Phase 3] |
| Medication Order Builder | Catalog | stage tab | none | stage selector position 1 | 112 px | medication_order.create | one stage active | show medication search | [Phase 3] |
| Medication Order Builder | Protocols | stage tab | none | stage selector position 2 | 96 px | medication_order.create | one stage active | show medication protocols | [Phase 3] |
| Medication Order Builder | Medication Catalog Search | search input | Search medication | medication toolbar flexible | min 260 px | medication_order.create | 2 characters | search the medication catalog | [Phase 3] |
| Medication Order Builder | Medication Domain | select | Domain | medication toolbar after search | 180 px | medication_order.create | active domain | filter medication results | [Phase 3] |
| Medication Order Builder | Clinical Guidance | textarea | Clinical Guidance | form full-width row | 100% | medication_order.create | 0-2000 characters | store medication order note | [Phase 3] |
| Medication Order Builder | Strength | text input | Strength | medication line column 1 | 110 px | medication_order.create | required when the catalog record has no value | store strength snapshot | [Phase 3] |
| Medication Order Builder | Dose Instruction | text input | Take | medication line column 2 | 110 px | medication_order.create | required | store dose instruction | [Phase 3] |
| Medication Order Builder | Administration Pattern | select | Frequency | medication line column 3 | 130 px | medication_order.create | configured frequency | store frequency | [Phase 3] |
| Medication Order Builder | Duration | numeric input | Duration | medication line column 4 | 86 px | medication_order.create | positive value | store duration value | [Phase 3] |
| Medication Order Builder | Duration Unit | select | Days / Weeks / Months | medication line column 5 | 130 px | medication_order.create | configured period | store duration unit | [Phase 3] |
| Medication Order Builder | Patient Directions | text input | Instructions | medication line column 6 | min 220 px | medication_order.create | 0-500 characters | store patient instructions | [Phase 3] |
| Medication Order Builder | Remove Medication | icon button | Remove medication | medication line last column | 28 px | medication_order.create | at least one line remains to save | remove draft line | [Phase 3] |
| Medication Order Builder | Save and Sign | primary command button | none | form header after Save Order | 112 px | medication_order.sign | enabled feature, valid draft or saved record, active user-clinician link | atomically save, sign, lock, and queue signed rendering | [Phase 3] |
| Medication Order Builder | Discard Order | secondary command button | none | form header after signing command | 86 px | medication_order.create | dirty confirmation | discard unsaved browser draft and return to history | [Phase 3] |
| Medication Order Builder | Diagnosis Search | combobox input | Search diagnosis | Clinical Context row 1 | 100% | medication_order.create | exact code or at least 2 characters | load ranked active diagnosis results | [Phase 3] |
| Medication Order Builder | Diagnosis Results | virtualized listbox | none | below Diagnosis Search | 100% x 224 px | medication_order.create | maximum 20 ordered rows | select diagnosis with pointer or keyboard | [Phase 3] |
| Medication Order Builder | Diagnosis Tooth | tooth selector | Select tooth | selected diagnosis row column 3 | 92 px | medication_order.create | valid configured tooth or blank | store tooth snapshot context | [Phase 3] |
| Medication Order Builder | Diagnosis Surfaces | multi-select | Select surfaces | selected diagnosis row column 4 | 120 px | medication_order.create | valid surfaces for selected tooth | store ordered surface codes | [Phase 3] |
| Medication Order Builder | Remove Diagnosis | icon button | Remove diagnosis | selected diagnosis row last column | 28 px | medication_order.edit_draft | unsaved draft row | remove diagnosis and recalculate recommendations | [Phase 3] |
| Medication Order Builder | Suggested Service Search | combobox input | Search service | Clinical Context after diagnoses | 100% | medication_order.create | exact service code or at least 2 characters | load ranked services with domains | [Phase 3] |
| Medication Order Builder | Service Domain | read-only text | none | selected service row column 1 | 128 px | medication_order.create | domain resolved from service_catalog.service_domain_id | display structural domain | [Phase 3] |
| Medication Order Builder | Service Linked Diagnosis | select | Link diagnosis | selected service row column 3 | 150 px | medication_order.create | selected diagnosis from same encounter | link service recommendation to diagnosis | [Phase 3] |
| Medication Order Builder | Service Tooth | tooth selector | Select tooth | selected service row column 4 | 92 px | medication_order.create | valid configured tooth or blank | store tooth snapshot context | [Phase 3] |
| Medication Order Builder | Service Surfaces | multi-select | Select surfaces | selected service row column 5 | 120 px | medication_order.create | valid surfaces for selected tooth | store ordered surface codes | [Phase 3] |
| Medication Order Builder | Remove Suggested Service | icon button | Remove suggested service | selected service row last column | 28 px | medication_order.edit_draft | unsaved draft row | remove service and recalculate recommendations | [Phase 3] |
| Medication Order Builder | Recommended Protocol | select | Select protocol | Clinical Context recommendation row | 100% minus Load Protocol | medication_order.create | active exact protocol version | choose ranked recommendation | [Phase 3] |
| Medication Order Builder | Load Protocol | command button | none | recommendation row right | 112 px | medication_order.create | selected active protocol | expand ordered medication lines | [Phase 3] |
| Medication Order Builder | Keep Current | command button | none | recommendation-changed strip position 1 | 94 px | medication_order.edit_draft | current manual lines exist | retain current medication lines | [Phase 3] |
| Medication Order Builder | Reload Protocol | command button | none | recommendation-changed strip position 2 | 112 px | medication_order.edit_draft | active recommendation selected | replace protocol-derived draft rows after confirmation | [Phase 3] |
| Medication Order Builder | Safety Acknowledgement | checkbox | Acknowledge warning | warning row last column | 170 px | medication_order.create | one acknowledgement per current warning | record warning acknowledgement in save audit payload | [Phase 3] |
| Medication Order Builder | Add Medication Result | listbox option | none | Add to Medication Order result row | 100% x 28 px | medication_order.create | active medication and applicable administration pattern | add one editable draft medication line | [Phase 3] |
| Medication Order Builder | Replace Draft Lines | confirmation command | none | protocol-load confirmation position 1 | 118 px | medication_order.edit_draft | existing unsaved rows | remove current unsaved medication lines and load protocol | [Phase 3] |
| Medication Order Builder | Append Medications | confirmation command | none | protocol-load confirmation position 2 | 128 px | medication_order.edit_draft | existing unsaved rows | append nonduplicate protocol medications | [Phase 3] |
| Medication Order Builder | Priority Medication | icon toggle | Set priority pin | medication result row first column | 28 px | configuration.practice.edit | active medication | update medication priority-pin state and master version | [Phase 3] |
| Medication Studio Domains | Domain Search | search input | enter filter text | registry toolbar flexible | min 240 px | configuration.practice.view | 0-80 characters | filter category grid and return page 1 | [Phase 3] |
| Medication Studio Domains | New Domain | command button | none | registry toolbar right | 102 px | configuration.practice.edit | none | open blank category editor | [Phase 3] |
| Medication Studio Domains | Domain Code | text input | Code | editor row 1 column 1 | 140 px | configuration.practice.edit | required organization-unique code | set stable category code | [Phase 3] |
| Medication Studio Domains | Domain Name | text input | Name | editor row 1 column 2 | min 240 px | configuration.practice.edit | required case-insensitive unique name | set category display name | [Phase 3] |
| Medication Studio Domains | Domain Display Order | integer input | 0 | editor row 2 column 1 | 96 px | configuration.practice.edit | nonnegative integer | set result ordering | [Phase 3] |
| Medication Studio Domains | Domain Active | toggle | none | editor row 2 column 2 | 86 px | configuration.practice.edit | historical references retained | activate or deactivate domain | [Phase 3] |
| Medication Studio Domains | Save Domain | primary button | none | editor footer position 1 | 102 px | configuration.practice.edit | valid code, name, order, and row version | commit domain and increment master version | [Phase 3] |
| Medication Studio Domains | Discard Domain | secondary button | none | editor footer position 2 | 102 px | configuration.practice.view | dirty confirmation | restore selected domain | [Phase 3] |
| Medication Studio Active Ingredients | Ingredient Search | search input | enter filter text | registry toolbar flexible | min 240 px | configuration.practice.view | 0-80 characters | filter the active-ingredient grid and return page 1 | [Phase 3] |
| Medication Studio Active Ingredients | New Active Ingredient | command button | none | registry toolbar right | 102 px | configuration.practice.edit | none | open a blank active-ingredient editor | [Phase 3] |
| Medication Studio Active Ingredients | Ingredient Code | text input | Code | editor row 1 column 1 | 140 px | configuration.practice.edit | required organization-unique code | set stable active-ingredient code | [Phase 3] |
| Medication Studio Active Ingredients | Ingredient Name | text input | Name | editor row 1 column 2 | min 240 px | configuration.practice.edit | required case-insensitive unique name | set ingredient display name | [Phase 3] |
| Medication Studio Active Ingredients | Contraindications Default | textarea | Contraindications Default | editor row 2 | 100% | configuration.practice.edit | 0-2000 characters | set default active-ingredient contraindication text | [Phase 3] |
| Medication Studio Active Ingredients | Ingredient Synonyms | token input | Add keyword | editor row 3 | 100% | configuration.practice.edit | unique normalized tokens, 1-80 characters | set type-ahead synonyms | [Phase 3] |
| Medication Studio Active Ingredients | Ingredient Active | toggle | none | editor row 4 column 1 | 86 px | configuration.practice.edit | historical references retained | activate or deactivate active ingredient | [Phase 3] |
| Medication Studio Active Ingredients | Save Active Ingredient | primary button | none | editor footer position 1 | 102 px | configuration.practice.edit | valid code, name, keywords, and row version | commit active ingredient and increment master version | [Phase 3] |
| Medication Studio Active Ingredients | Discard Active Ingredient | secondary button | none | editor footer position 2 | 102 px | configuration.practice.view | dirty confirmation | restore selected active ingredient | [Phase 3] |
| Medication Studio Catalog | Medication Domain Filter | select | -- All -- | registry toolbar position 1 | 180 px | configuration.practice.view | active or historical domain | filter medications | [Phase 3] |
| Medication Studio Catalog | Medication Search | search input | enter filter text | registry toolbar flexible | min 260 px | configuration.practice.view | 0-80 characters | filter medication grid and return page 1 | [Phase 3] |
| Medication Studio Catalog | New Medication | command button | none | registry toolbar right | 104 px | configuration.practice.edit | none | open Medication Detail | [Phase 3] |
| Medication Studio Catalog | Medication Name | text input | enter name | detail row 1 flexible | min 300 px | configuration.practice.edit | required, 1-200 characters | set medication brand description | [Phase 3] |
| Medication Studio Catalog | Domains | multi-select combobox | Select domains | detail row 2 columns 1-6 | 6/12 | configuration.practice.edit | at least one same-organization domain | set medication domain assignments | [Phase 3] |
| Medication Studio Catalog | Primary Domain | radio selector | none | selected domain token | 28 px per token | configuration.practice.edit | exactly one active domain | set medication_catalog.primary_domain_id and primary assignment | [Phase 3] |
| Medication Studio Catalog | Dosage Form | searchable select | Select dosage form | detail row 2 columns 7-10 | 4/12 | configuration.practice.edit | required configured pharmaceutical form | set dosage form | [Phase 3] |
| Medication Studio Catalog | Priority Pin | toggle | none | detail row 2 columns 11-12 | 2/12 | configuration.practice.edit | boolean | set priority ordering | [Phase 3] |
| Medication Studio Catalog | Contraindications | textarea | Contraindications | detail row 3 full width | 100% | configuration.practice.edit | 0-4000 characters | set medication contraindication text | [Phase 3] |
| Medication Studio Catalog | Default Dose Instruction | text input | Take | Default Dose row column 1 | 100 px | configuration.practice.edit | required for default dose | set take text | [Phase 3] |
| Medication Studio Catalog | Default Administration Pattern | combobox | Frequency | Default Dose row column 2 | 160 px | configuration.practice.edit | active dosage phrase | set frequency | [Phase 3] |
| Medication Studio Catalog | Default Duration | numeric input | Duration | Default Dose row column 3 | 86 px | configuration.practice.edit | positive when unit selected | set duration value | [Phase 3] |
| Medication Studio Catalog | Default Duration Unit | select | blank / Days / Weeks / Months | Default Dose row column 4 | 150 px | configuration.practice.edit | blank with blank duration or valid unit | set duration period | [Phase 3] |
| Medication Studio Catalog | Default Patient Directions | text input | Instructions | Default Dose row columns 5-10 | min 240 px | configuration.practice.edit | 0-500 characters | set default instructions | [Phase 3] |
| Medication Studio Catalog | Strength Option | text input | Strength | Strengths toolbar flexible | min 180 px | configuration.practice.edit | nonblank and unique per medication | stage strength text | [Phase 3] |
| Medication Studio Catalog | Add Strength Option | command button | none | Strengths toolbar right | 108 px | configuration.practice.edit | valid staged strength | append strength-option row | [Phase 3] |
| Medication Studio Catalog | Active Ingredient | combobox | Select active ingredient | Ingredients toolbar columns 1-4 | 4/12 | configuration.practice.edit | active same-organization ingredient | stage ingredient | [Phase 3] |
| Medication Studio Catalog | Ingredient Quantity | numeric input | Quantity | Ingredients toolbar columns 5-6 | 2/12 | configuration.practice.edit | positive or blank with blank unit | stage ingredient quantity | [Phase 3] |
| Medication Studio Catalog | Ingredient Unit | text input | Unit | Ingredients toolbar columns 7-8 | 2/12 | configuration.practice.edit | required when quantity exists | stage quantity unit | [Phase 3] |
| Medication Studio Catalog | Add Active Ingredient | command button | none | Ingredients toolbar columns 9-10 | 2/12 | configuration.practice.edit | valid nonduplicate ingredient | append ingredient row | [Phase 3] |
| Medication Studio Catalog | Primary Ingredient | radio selector | none | Ingredients row column 5 | 72 px | configuration.practice.edit | exactly one active ingredient | set medication_catalog.active_ingredient_id | [Phase 3] |
| Medication Studio Catalog | Save Medication | primary button | none | detail footer position 1 | 112 px | configuration.practice.edit | complete valid medication catalog graph and row version | atomically save header and child rows | [Phase 3] |
| Medication Studio Catalog | Discard Medication | secondary button | none | detail footer position 2 | 112 px | configuration.practice.view | dirty confirmation | restore selected medication catalog graph | [Phase 3] |
| Medication Studio Administration Patterns | Pattern Search | text input | Type new entry here | conformance toolbar flexible | min 240 px | configuration.practice.edit | nonblank unique label | stage quick administration phrase | [Phase 3] |
| Medication Studio Administration Patterns | New Pattern | command button | none | conformance toolbar right | 72 px | configuration.practice.edit | valid staged phrase | create normalized administration pattern | [Phase 3] |
| Medication Studio Administration Patterns | Open Pattern Details | toggle command | none | selected pattern row action | 148 px | configuration.practice.view | selected pattern | show normalized editor | [Phase 3] |
| Medication Studio Administration Patterns | Pattern Code | text input | Code | advanced row 1 column 1 | 120 px | configuration.practice.edit | required organization-unique code | set stable administration-pattern code | [Phase 3] |
| Medication Studio Administration Patterns | Display Label | text input | Label | advanced row 1 columns 2-4 | 3/12 | configuration.practice.edit | required unique visible label | set administration-pattern label | [Phase 3] |
| Medication Studio Administration Patterns | Dose Instruction | text input | Take | advanced row 1 columns 5-6 | 2/12 | configuration.practice.edit | required | set take text | [Phase 3] |
| Medication Studio Administration Patterns | Frequency Expression | text input | Frequency | advanced row 1 columns 7-9 | 3/12 | configuration.practice.edit | required | set frequency phrase | [Phase 3] |
| Medication Studio Administration Patterns | Route | text input | Route | advanced row 1 columns 10-12 | 3/12 | configuration.practice.edit | 0-100 characters | set administration route | [Phase 3] |
| Medication Studio Administration Patterns | Duration | numeric input | Duration | advanced row 2 column 1 | 86 px | configuration.practice.edit | positive or blank | set duration value | [Phase 3] |
| Medication Studio Administration Patterns | Duration Unit | select | blank / Days / Weeks / Months | advanced row 2 columns 2-3 | 150 px | configuration.practice.edit | blank with blank duration or valid unit | set duration period | [Phase 3] |
| Medication Studio Administration Patterns | Patient Directions | text input | Instructions | advanced row 2 columns 4-9 | 6/12 | configuration.practice.edit | 0-500 characters | set instructions | [Phase 3] |
| Medication Studio Administration Patterns | Display Order | integer input | 0 | advanced row 2 column 10 | 86 px | configuration.practice.edit | nonnegative integer | set selector ordering | [Phase 3] |
| Medication Studio Administration Patterns | Active | toggle | none | advanced row 2 columns 11-12 | 2/12 | configuration.practice.edit | historical references retained | activate or deactivate administration pattern | [Phase 3] |
| Medication Studio Administration Patterns | Save Administration Pattern | primary button | none | advanced footer position 1 | 102 px | configuration.practice.edit | valid normalized fields and row version | commit administration pattern and increment master version | [Phase 3] |
| Medication Studio Administration Patterns | Discard Administration Pattern | secondary button | none | advanced footer position 2 | 102 px | configuration.practice.view | dirty confirmation | restore selected administration pattern | [Phase 3] |
| Medication Studio Protocols | Protocol Search | search input | enter filter text | registry toolbar flexible | min 240 px | configuration.practice.view | 0-80 characters | filter protocol versions and return page 1 | [Phase 3] |
| Medication Studio Protocols | New Protocol | command button | none | registry toolbar right | 108 px | configuration.practice.edit | none | create blank draft version | [Phase 3] |
| Medication Studio Protocols | Protocol Code | text input | Code | header row column 1 | 130 px | configuration.practice.edit | required unique code/version | set stable protocol code | [Phase 3] |
| Medication Studio Protocols | Protocol Name | text input | Description | header row columns 2-6 | 5/12 | configuration.practice.edit | required, 1-200 characters | set protocol name | [Phase 3] |
| Medication Studio Protocols | Protocol Version | read-only integer | none | header row column 7 | 72 px | configuration.practice.view | positive version | display immutable version | [Phase 3] |
| Medication Studio Protocols | Protocol State | read-only status | none | header row column 8 | 92 px | configuration.practice.view | draft, active, or retired | display version lifecycle | [Phase 3] |
| Medication Studio Protocols | Protocol Notes | text input | Comments | header row columns 9-12 | 4/12 | configuration.practice.edit | 0-1000 characters | set protocol comments | [Phase 3] |
| Medication Studio Protocols | Default Clinical Guidance | textarea | Clinical Guidance | header row 2 full width | 100% | configuration.practice.edit | 0-2000 characters | set default note | [Phase 3] |
| Medication Studio Protocols | Medication Lines Tab | tab | none | editor tab position 1 | 96 px | configuration.practice.view | exact tab | edit ordered medication lines | [Phase 3] |
| Medication Studio Protocols | Diagnosis Links Tab | tab | none | editor tab position 2 | 154 px | configuration.practice.view | exact tab | edit diagnosis recommendation mappings | [Phase 3] |
| Medication Studio Protocols | Service Links Tab | tab | none | editor tab position 3 | 158 px | configuration.practice.view | exact tab | edit service recommendation mappings | [Phase 3] |
| Medication Studio Protocols | Protocol Medication Search | search input | filter | Medication Lines tab right toolbar | min 210 px | configuration.practice.edit | 0-80 characters | filter active medications | [Phase 3] |
| Medication Studio Protocols | Protocol Medication Domain | select | -- All -- | Medication Lines tab right toolbar | 150 px | configuration.practice.edit | active domain or all | filter medication results | [Phase 3] |
| Medication Studio Protocols | Medication Line Required | checkbox | none | selected medication row before remove | 88 px | configuration.practice.edit | boolean | require clinician review of line | [Phase 3] |
| Medication Studio Protocols | Diagnosis Link Search | combobox | Search Diagnosis | Diagnosis Mappings toolbar flexible | min 240 px | configuration.practice.edit | exact code or at least 2 characters | find diagnosis master | [Phase 3] |
| Medication Studio Protocols | New Diagnosis Definition | command button | none | Diagnosis Mappings toolbar right | 126 px | configuration.practice.edit | none | open predefined diagnosis side panel | [Phase 3] |
| Medication Studio Protocols | Diagnosis Match Weight | decimal input | 1.0000 | diagnosis mapping row column 4 | 92 px | configuration.practice.edit | greater than zero | set diagnosis recommendation weight | [Phase 3] |
| Medication Studio Protocols | Diagnosis Autoload | checkbox | none | diagnosis mapping row column 5 | 86 px | configuration.practice.edit | boolean | include mapping in autoload recommendation | [Phase 3] |
| Medication Studio Protocols | Service Link Search | combobox | Search Service | Service Mappings toolbar flexible | min 240 px | configuration.practice.edit | exact code or at least 2 characters | find service with domain | [Phase 3] |
| Medication Studio Protocols | Service Link Domain | select | -- All -- | Service Mappings toolbar after search | 170 px | configuration.practice.edit | active domain or all | filter services | [Phase 3] |
| Medication Studio Protocols | Service Match Weight | decimal input | 1.0000 | service mapping row column 5 | 92 px | configuration.practice.edit | greater than zero | set service recommendation weight | [Phase 3] |
| Medication Studio Protocols | Service Autoload | checkbox | none | service mapping row column 6 | 86 px | configuration.practice.edit | boolean | include mapping in autoload recommendation | [Phase 3] |
| Medication Studio Protocols | Save Protocol Draft | primary button | none | sticky footer position 1 | 128 px | configuration.practice.edit | draft valid and matching row version | commit draft header and mappings | [Phase 3] |
| Medication Studio Protocols | Activate Protocol Version | primary command | none | sticky footer position 2 | 124 px | configuration.practice.edit | draft with at least one active medication | activate immutable version and increment master version | [Phase 3] |
| Medication Studio Protocols | Create Protocol Version | command button | none | sticky footer position 3 | 142 px | configuration.practice.edit | selected active or retired version | copy into version N plus 1 draft | [Phase 3] |
| Medication Studio Protocols | Retire Protocol Version | command button | none | sticky footer position 4 | 116 px | configuration.practice.edit | selected active version | retire without changing historical links | [Phase 3] |
| Medication Studio Protocols | Cancel Protocol Edit | secondary button | none | sticky footer position 5 | 112 px | configuration.practice.view | dirty confirmation | restore selected version | [Phase 3] |
| Medication Studio Diagnosis Catalog | Diagnosis Code | text input | Code | side panel row 1 column 1 | 120 px | configuration.practice.edit | required organization-unique code | set stable diagnosis code | [Phase 3] |
| Medication Studio Diagnosis Catalog | Diagnosis Name | text input | Name | side panel row 1 column 2 | min 220 px | configuration.practice.edit | required case-insensitive unique name | set diagnosis display name | [Phase 3] |
| Medication Studio Diagnosis Catalog | ICD-10 Code | text input | ICD-10 Code | side panel row 2 column 1 | 120 px | configuration.practice.edit | valid code or blank | set optional coding reference | [Phase 3] |
| Medication Studio Diagnosis Catalog | Diagnosis Description | textarea | Description | side panel row 3 | 100% | configuration.practice.edit | 0-2000 characters | set master description | [Phase 3] |
| Medication Studio Diagnosis Catalog | Default Clinical Note | textarea | Default Clinical Note | side panel row 4 | 100% | configuration.practice.edit | 0-2000 characters | set encounter note default | [Phase 3] |
| Medication Studio Diagnosis Catalog | Diagnosis Keywords | token input | Add keyword | side panel row 5 | 100% | configuration.practice.edit | unique normalized tokens, 1-80 characters | set type-ahead synonyms | [Phase 3] |
| Medication Studio Diagnosis Catalog | Diagnosis Display Order | integer input | 0 | side panel row 6 column 1 | 86 px | configuration.practice.edit | nonnegative integer | set type-ahead tie ordering | [Phase 3] |
| Medication Studio Diagnosis Catalog | Diagnosis Active | toggle | none | side panel row 6 column 2 | 86 px | configuration.practice.edit | historical references retained | activate or deactivate diagnosis | [Phase 3] |
| Medication Studio Diagnosis Catalog | Save Diagnosis | primary button | none | side panel footer position 1 | 108 px | configuration.practice.edit | valid fields and row version | commit diagnosis and select mapping | [Phase 3] |
| Medication Studio Diagnosis Catalog | Cancel Diagnosis | secondary button | none | side panel footer position 2 | 108 px | configuration.practice.view | dirty confirmation | close without mutation | [Phase 3] |
| New Fee Statement charge entry | Charge Search | search input | Search | charge toolbar flexible | min 260 px | fee_statement.create | 2 characters | search chargeable services | [Phase 1] |
| New Fee Statement charge entry | Charge Category | select | Category | charge toolbar after search | 180 px | fee_statement.create | active category | filter chargeable services | [Phase 1] |
| New Fee Statement charge entry | Add charge | command button | none | charge toolbar right | 104 px | fee_statement.create | selected chargeable service | add draft Fee Statement line | [Phase 1] |
| New Fee Statement charge entry | Charge Fees | read-only money | 0.00 | charge line column 1 | 100 px | fee_statement.view | catalog snapshot | show listed fee | [Phase 1] |
| New Fee Statement charge entry | Charge Rate | money input | 0.00 | charge line column 2 | 100 px | fee_statement.create | non-negative | set assessed rate | [Phase 1] |
| New Fee Statement charge entry | Charge Notes | text input | Notes | charge line flexible column | min 220 px | fee_statement.create | 0-500 characters | set line note | [Phase 1] |
| New Fee Statement charge entry | Charge Discount | money or percentage input | 0.00 | charge line discount column | 110 px | fee_statement.discount | does not exceed line gross | set line discount | [Phase 1] |
| New Fee Statement charge entry | Remove Charge | icon button | Remove charge | charge line last column | 28 px | fee_statement.create | draft line | remove draft charge | [Phase 1] |
| New Fee Statement charge entry | Cancel Fee Statement | secondary button | none | Fee Statement footer after Save | 78 px | fee_statement.create | dirty confirmation | close without Fee Statement | [Phase 1] |
| Create Lab Case | Ref No | text input | Ref No | form row 1 columns 1-3 | 3/12 | lab.edit | unique under clinic policy when supplied | set lab reference | [Phase 3] |
| Create Lab Case | Lab Work | select | Select Lab Work | form row 1 columns 4-6 | 3/12 | lab.edit | active lab work | set work type | [Phase 3] |
| Create Lab Case | Assigned To Lab | select | Select Dental Lab | form row 1 columns 7-9 | 3/12 | lab.edit | active dental lab | set assigned lab | [Phase 3] |
| Create Lab Case | Teeth | tooth multi-select | Select Teeth | form row 1 columns 10-12 | 3/12 | lab.edit | valid tooth codes | set teeth | [Phase 3] |
| Create Lab Case | Shade and Notes | textarea | Shade and Notes | form row 2 columns 1-12 | 12/12 | lab.edit | 0-2000 characters | set shade and instruction | [Phase 3] |
| Create Lab Case | Request Date | date input | DD-MMM-YYYY | form row 3 columns 1-3 | 3/12 | lab.edit | valid date | set request date | [Phase 3] |
| Create Lab Case | Requested By | staff select | Select Clinician/Staff | form row 3 columns 4-6 | 3/12 | lab.edit | active staff | set requester | [Phase 3] |
| Create Lab Case | Expected Date | date input | DD-MMM-YYYY | form row 3 columns 7-9 | 3/12 | lab.edit | not before request date | set expected date | [Phase 3] |
| Create Lab Case | Work Status | select | Select Status | form row 3 columns 10-12 | 3/12 | lab.edit | valid transition | set work status | [Phase 3] |
| Create Lab Case | Work Step | select | Select Work Step | form row 4 columns 1-3 | 3/12 | lab.edit | active step | set workflow step | [Phase 3] |
| Create Lab Case | Received Date | date input | DD-MMM-YYYY | form row 4 columns 4-6 | 3/12 | lab.edit | required for received/closed | set received date | [Phase 3] |
| Create Lab Case | Received By | staff select | Select Staff | form row 4 columns 7-9 | 3/12 | lab.edit | required for received/closed | set receiving staff | [Phase 3] |
| Create Lab Case | Amount | money input | 0.00 | form row 4 columns 10-12 | 3/12 | lab.edit | non-negative | set lab charge | [Phase 3] |
| Create Lab Case | Save Lab Job | primary button | none | footer right position 1 | 86 px | lab.edit | form valid | commit lab job | [Phase 3] |
| Create Lab Case | Cancel Lab Job | secondary button | none | footer right position 2 | 86 px | lab.edit | dirty confirmation | close without job | [Phase 3] |
| Unscheduled Encounter | Operational Date | date input | DD-MMM-YYYY | sheet row 1 columns 1-3 | 3/12 | queue.admit | valid clinic-local date | set queue date | [Phase 1] |
| Unscheduled Encounter | Initial Queue State | select | Arriving / Admitted | sheet row 1 columns 4-6 | 3/12 | queue.admit | one allowed entry state | set first encounter state | [Phase 1] |
| Unscheduled Encounter | Care Stream | select | Select care stream | sheet row 1 columns 7-9 | 3/12 | queue.admit | active clinic care stream | classify queue demand | [Phase 1] |
| Unscheduled Encounter | Lead Clinician | select | Select lead clinician | sheet row 1 columns 10-12 | 3/12 | queue.admit | active clinician at clinic | assign encounter owner | [Phase 1] |
| Unscheduled Encounter | Patient Mode | segmented control | none | sheet row 2 columns 1-2 | 2/12 | queue.admit | Registered Patient or Quick Registration | choose patient branch | [Phase 1] |
| Unscheduled Encounter | Patient Lookup | patient selector | Name / Patient ID / Mobile | sheet row 2 columns 3-8 | 6/12 | patient.view | required for Registered Patient | link patient | [Phase 1] |
| Unscheduled Encounter | Mobile Preview | read-only text | none | sheet row 2 columns 9-10 | 2/12 | patient.view | derived from linked patient | show contact destination | [Phase 1] |
| Unscheduled Encounter | Alert Summary | read-only status | none | sheet row 2 columns 11-12 | 2/12 | clinical.view | derived from active alerts | show safety alert count | [Phase 1] |
| Unscheduled Encounter | Mobile Number | tel input | Mobile number | quick-registration row columns 1-3 | 3/12 | queue.admit | normalized mobile and duplicate policy | set quick patient mobile | [Phase 1] |
| Unscheduled Encounter | Given Name | text input | Given name | quick-registration row columns 4-6 | 3/12 | queue.admit | required for Quick Registration | set quick patient given name | [Phase 1] |
| Unscheduled Encounter | Family Name | text input | Family name | quick-registration row columns 7-9 | 3/12 | queue.admit | 0-80 characters | set quick patient family name | [Phase 1] |
| Unscheduled Encounter | Birth Date or Age | compound date/integer input | DD-MMM-YYYY or Age | quick-registration row columns 10-12 | 3/12 | queue.admit | valid date or age 0-130 | set quick demographic snapshot | [Phase 1] |
| Unscheduled Encounter | Consultation Objective | select | Select consultation objective | sheet row 3 columns 1-3 | 3/12 | queue.admit | active objective | record care objective | [Phase 1] |
| Unscheduled Encounter | Care Priority | select | Routine / Priority / Urgent | sheet row 3 columns 4-5 | 2/12 | queue.admit | configured priority | set queue priority | [Phase 1] |
| Unscheduled Encounter | Operatory | select | Select operatory | sheet row 3 columns 6-8 | 3/12 | queue.admit | active operatory or unassigned | allocate resource | [Phase 1] |
| Unscheduled Encounter | Coordination Notes | text input | Coordination notes | sheet row 3 columns 9-12 | 4/12 | queue.admit | 0-1000 characters | store encounter note | [Phase 1] |
| Unscheduled Encounter | Admit to Queue | primary button | none | sticky footer position 1 | 116 px | queue.admit | patient and entry fields valid | commit encounter and return to queue | [Phase 1] |
| Unscheduled Encounter | Admit and Open Encounter | command button | none | sticky footer position 2 | 180 px | queue.admit and clinical.edit | patient and entry fields valid | commit and open clinical encounter | [Phase 1] |
| Unscheduled Encounter | Discard | secondary button | none | sticky footer position 3 | 86 px | queue.view | dirty confirmation | close without mutation | [Phase 1] |
| Practice Assets Patient Education | Add Learning Resource | command button | none | toolbar position 1 | 152 px | clinical.edit | none | open learning-resource editor | [Phase 3] |
| Practice Assets Patient Education | Resource Search | search input | Search title or tag | toolbar flexible | min 280 px | clinical.view | 0-100 characters | filter learning resources | [Phase 3] |
| Practice Assets Patient Education | Resource Domain | select | All Domains | toolbar after search | 180 px | clinical.view | active domain or all | filter resource domain | [Phase 3] |
| Practice Assets Patient Education | Resource Status | select | Active / Inactive / All | toolbar after domain | 160 px | clinical.view | one status | filter resource lifecycle | [Phase 3] |
| Patient Communications | Communication Period | date-range input | From - To | communications filter position 1 | 220 px | message.view | from not after to | filter patient communication history | [Phase 3] |
| Patient Communications | Channel | select | All Channels | communications filter position 2 | 150 px | message.view | SMS, WhatsApp, Email, Voice, or all | filter communication channel | [Phase 3] |
| Patient Communications | Delivery State | select | All States | communications filter position 3 | 160 px | message.view | configured delivery state | filter delivery state | [Phase 3] |
| Patient Communications | Refresh | icon button | Refresh communications | communications filter position 4 | 28 px | message.view | none | reload patient communication history | [Phase 3] |
| Comms Center | Conversations | tab | none | secondary navigation position 1 | 104 px | message.view | exact label | open direct conversation history | [Phase 3] |
| Comms Center | Scheduled Care | tab | none | secondary navigation position 2 | 112 px | message.view | exact label | open automated care-message queue | [Phase 3] |
| Comms Center | Campaigns | tab | none | secondary navigation position 3 | 94 px | message.bulk_send | exact label | open campaign registry | [Phase 3] |
| Comms Center | Templates | tab | none | secondary navigation position 4 | 92 px | message.view | exact label | open message-template registry | [Phase 3] |
| Comms Center | Delivery Monitor | tab | none | secondary navigation position 5 | 124 px | message.view | exact label | open provider delivery monitor | [Phase 3] |
| Comms Center | Consent Registry | tab | none | secondary navigation position 6 | 118 px | message.view | exact label | open communication-consent registry | [Phase 3] |
| Comms Center | Campaign Purpose | segmented option | none | campaign row 1 position 1 | 240 px | message.bulk_send | Care, Transactional, or Promotional | set message purpose | [Phase 3] |
| Comms Center | Audience Rules | recipient filter builder | Select audience rules | campaign row 2 columns 1-6 | 6/12 | message.bulk_send | at least one valid rule | build recipient set | [Phase 3] |
| Comms Center | Channel Priority | ordered multi-select | Select channels | campaign row 2 columns 7-9 | 3/12 | message.bulk_send | at least one enabled channel | set channel fallback order | [Phase 3] |
| Comms Center | Protocol Version | select | Select approved template | campaign row 2 columns 10-12 | 3/12 | message.bulk_send | approved purpose-matching template | select immutable template version | [Phase 3] |
| Comms Center | Eligibility Preview | data grid | none | campaign row 3 | 100% | message.bulk_send | deduplicated and consent evaluated | show eligible and suppressed recipients | [Phase 3] |
| Comms Center | Review Campaign | primary button | none | campaign footer position 1 | 126 px | message.bulk_send | preview complete and credits available | open submission confirmation | [Phase 3] |
| Comms Center | Submit Campaign | danger command | none | confirmation footer position 1 | 132 px | message.bulk_send | template, credits, audience, and consent valid | queue eligible outbound messages | [Phase 3] |
| Comms Center | Discard Campaign | secondary button | none | confirmation footer position 2 | 126 px | message.bulk_send | dirty confirmation | close without submission | [Phase 3] |
| Practice Assets | Patient Education | tab | none | primary workspace position 1 | 132 px | clinical.view | exact label | open learning-resource registry | [Phase 3] |
| Practice Assets | Laboratory | tab | none | primary workspace position 2 | 96 px | lab.view | exact label | open laboratory cases | [Phase 3] |
| Practice Assets | Inventory | tab | none | primary workspace position 3 | 92 px | inventory.view | exact label | open stock position | [Phase 3] |
| Practice Assets | Suppliers | tab | none | primary workspace position 4 | 88 px | expense.view | exact label | open supplier registry | [Phase 3] |
| Practice Assets | Operating Expenses | tab | none | primary workspace position 5 | 132 px | expense.view | exact label | open operating-expense worklist | [Phase 3] |
| Practice Assets | Expense Period | date-range input | From - To | expense filter position 1 | 220 px | expense.view | from not after to | filter expense accounting date | [Phase 3] |
| Practice Assets | Expense Domain | select | All Expense Domains | expense filter position 2 | 190 px | expense.view | active or historical domain | filter expense domain | [Phase 3] |
| Practice Assets | Supplier | select | All Suppliers | expense filter position 3 | 180 px | expense.view | active or historical supplier | filter supplier | [Phase 3] |
| Practice Assets | Collection Method | select | All Methods | expense filter position 4 | 170 px | expense.view | configured method | filter settlement method | [Phase 3] |
| Practice Assets | Record Expense | command button | none | expense toolbar right | 108 px | expense.create | none | open expense entry | [Phase 3] |
| Practice Assets | Stock Position | tab | none | inventory view position 1 | 104 px | inventory.view | exact label | show stock by item, batch, and location | [Phase 3] |
| Practice Assets | Inbound | tab | none | inventory view position 2 | 82 px | inventory.view | exact label | show inbound stock documents | [Phase 3] |
| Practice Assets | Outbound | tab | none | inventory view position 3 | 88 px | inventory.view | exact label | show outbound stock documents | [Phase 3] |
| Practice Assets | Adjustments | tab | none | inventory view position 4 | 104 px | inventory.view | exact label | show stock adjustment documents | [Phase 3] |
| Practice Assets | Reorder Queue | tab | none | inventory view position 5 | 112 px | inventory.view | exact label | show reorder candidates | [Phase 3] |
| Practice Assets | Save Asset Draft | secondary button | none | stock document footer position 1 | 122 px | inventory.post | valid draft header | save editable stock document | [Phase 3] |
| Practice Assets | Post Asset Movement | primary button | none | stock document footer position 2 | 154 px | inventory.post | header and lines valid | post immutable stock movement | [Phase 3] |
| Practice Assets | Item Search | search input | Search inventory item | stock line column 1 | min 210 px | inventory.post | active item | select inventory item | [Phase 3] |
| Practice Assets | Batch | text input | Batch identifier | stock line column 2 | 120 px | inventory.post | 0-80 characters | set batch | [Phase 3] |
| Practice Assets | Expiry | date input | DD-MMM-YYYY | stock line column 3 | 132 px | inventory.post | not before document date when policy applies | set expiry | [Phase 3] |
| Practice Assets | Quantity | numeric input | 0.000 | stock line column 4 | 100 px | inventory.post | greater than zero | set quantity | [Phase 3] |
| Practice Assets | Unit Cost | money input | 0.00 | stock line column 5 | 100 px | inventory.post | nonnegative | set unit cost | [Phase 3] |
| Practice Assets | Line Value | read-only money | 0.00 | stock line column 6 | 110 px | inventory.view | quantity times unit cost | display line value | [Phase 3] |
| Practice Assets | Remove Asset Line | icon button | Remove line | stock line last column | 28 px | inventory.post | draft line | remove draft stock line | [Phase 3] |
| Deep Analytics | Report Tree Search | search input | Search Reports | left pane sticky top | 100% minus 12 px | one report view permission | 0-100 characters | filter report leaves | [Phase 1] |
| Deep Analytics | Clinic Branch | multi-select | Select Clinics | filter toolbar position 1 | 190 px | matching report permission | authorized memberships only | set clinic scope | [Phase 1] |
| Deep Analytics | From Date | date input | DD-MMM-YYYY | filter toolbar position 2 | 132 px | matching report permission | not after To Date | set period start | [Phase 1] |
| Deep Analytics | To Date | date input | DD-MMM-YYYY | filter toolbar position 3 | 132 px | matching report permission | not before From Date | set period end | [Phase 1] |
| Deep Analytics | As-of Date | date input | DD-MMM-YYYY | Open Fee Exposure filter position 2 | 132 px | analytics.financial.view | valid cut-off date | set dated receivable cut-off | [Phase 2] |
| Deep Analytics | Patient Category | multi-select | All Categories | report filter row | 190 px | matching report permission | active or historical category | filter category | [Phase 1] |
| Deep Analytics | Category Basis | segmented control | Snapshot / Current | report filter row | 190 px | matching report permission | one basis selected | choose document snapshot or current master | [Phase 1] |
| Deep Analytics | Report Clinician | multi-select | All Clinicians | report filter row | 190 px | matching report permission | authorized staff | filter clinician attribution | [Phase 1] |
| Deep Analytics | Clinician Split | toggle | none | Open Fee Exposure filter row | 94 px | analytics.financial.view | boolean | switch fee statement to clinician-line grain | [Phase 2] |
| Deep Analytics | Aging Bucket | multi-select | All Buckets | Open Fee Exposure filter row | 170 px | analytics.financial.view | 0-30, 31-60, 61-90, 90+ | filter aging bucket | [Phase 2] |
| Deep Analytics | Minimum Due | money input | 0.01 | Open Fee Exposure filter row | 110 px | analytics.financial.view | non-negative | filter due amount | [Phase 2] |
| Deep Analytics | Include Unassigned | checkbox | none | Collections filter row | 126 px | analytics.financial.view | boolean | include null clinician attribution | [Phase 2] |
| Deep Analytics | Cashier/User | multi-select | All Users | Collections filter row | 180 px | analytics.financial.view | authorized users | filter collection cashier | [Phase 2] |
| Deep Analytics | Report Collection Method | multi-select | All Collection Methods | Collections filter row | 180 px | analytics.financial.view | stable mode codes | filter collection method | [Phase 2] |
| Deep Analytics | Collections | segmented option | none | fact selector position 1 | 110 px | analytics.financial.view | one fact selected | show collection receipt-date cashier facts | [Phase 2] |
| Deep Analytics | Fee Allocations | segmented option | none | fact selector position 2 | 142 px | analytics.financial.view | one fact selected | show application-date applier/clinician facts | [Phase 2] |
| Deep Analytics | Conversion Intelligence | report tree group | none | report tree after Priority Views | full tree width | analytics.conversion.view | exact label | expand six conversion report leaves | [Phase 2] |
| Deep Analytics | Monthly Total Category Consultations | report tree leaf | none | Conversion Intelligence child position 1 | full tree width | analytics.conversion.view | exact report key | open monthly category consultation report | [Phase 2] |
| Deep Analytics | High-Intent Pipeline Bottleneck | report tree leaf | none | Conversion Intelligence child position 2 | full tree width | analytics.conversion.view | exact report key | open fixed 3 Star Not Started pipeline | [Phase 2] |
| Deep Analytics | Doctor-Wise Clinical Conversion Ratios | report tree leaf | none | Conversion Intelligence child position 3 | full tree width | analytics.conversion.view | exact report key | open doctor attribution conversion report | [Phase 2] |
| Deep Analytics | High-Value Category Conversions | report tree leaf | none | Conversion Intelligence child position 4 | full tree width | analytics.conversion.view | exact report key | open high-value domain conversion report | [Phase 2] |
| Deep Analytics | Cross-Tier Matrix Generator | report tree leaf | none | Conversion Intelligence child position 5 | full tree width | analytics.conversion.view | exact report key | open intent-tier pivot report | [Phase 2] |
| Deep Analytics | Pending Priority Treatment Registers | report tree leaf | none | Conversion Intelligence child position 6 | full tree width | analytics.conversion.view | exact report key | open primary or secondary pending-bundle register | [Phase 2] |
| Deep Analytics | Reporting Interval | segmented control | Month / Quarter / Year | conversion filter row | 224 px | analytics.conversion.view | one interval selected | set date_trunc grain | [Phase 2] |
| Deep Analytics | Doctor Role | segmented control | Primary / Secondary | conversion filter row | 184 px | analytics.conversion.view | one role selected | select consultation attribution axis | [Phase 2] |
| Deep Analytics | Primary Consult Doctor | multi-select | All Primary Doctors | conversion filter row | 190 px | analytics.conversion.view | authorized clinician snapshots | filter primary consultation doctor | [Phase 2] |
| Deep Analytics | Secondary Review Doctor | multi-select | All Secondary Doctors | conversion filter row | 190 px | analytics.conversion.view | authorized clinician snapshots | filter secondary review doctor | [Phase 2] |
| Deep Analytics | Intent Tier | multi-select | 1 Star / 2 Star / 3 Star | conversion filter row | 210 px | analytics.conversion.view | one or more tier snapshots | filter historical consultation cohort | [Phase 2] |
| Deep Analytics | Service Domain | multi-select | All Service Domains | conversion filter row | 190 px | analytics.conversion.view | active or historical domains | filter proposed treatment domain | [Phase 2] |
| Deep Analytics | Minimum Proposed Value | money input | 0.00 | bottleneck filter row | 130 px | analytics.conversion.view | nonnegative amount | filter total proposed case value | [Phase 2] |
| Deep Analytics | High-Value Domain | multi-select | All High-Value Domains | high-value filter row | 210 px | analytics.conversion.view | service domain high_value true | filter high-value conversion population | [Phase 2] |
| Deep Analytics | Priority Register | segmented control | Primary / Secondary | pending-priority filter row | 184 px | analytics.conversion.view | one register selected | restrict bundle tier to selected register | [Phase 2] |
| Deep Analytics | Group Dimensions | multi-select | Treatment Category / Intent Tier / Execution Status | cross-tier filter row | 300 px | analytics.conversion.view | one or more permitted dimensions | define dynamic matrix grouping columns | [Phase 2] |
| Deep Analytics | Intent Tier Basis | segmented control | Current / Case Snapshot | conversion filter row | 198 px | analytics.conversion.view | one basis selected | select current or case-creation tier attribution | [Phase 2] |
| Deep Analytics | Month Basis | segmented control | Target Start / Advised | pending-priority filter row | 198 px | analytics.conversion.view | one basis selected | choose authoritative pending-register month field | [Phase 2] |
| Deep Analytics | Bundle State | multi-select | Advised / Accepted / Scheduled / In Progress | pending-priority filter row | 240 px | analytics.conversion.view | one or more pending-capable states | filter bundle decision state | [Phase 2] |
| Deep Analytics | Execution State | multi-select | All Execution States | pending-priority filter row | 190 px | analytics.conversion.view | one or more exact case states | filter clinical case state | [Phase 2] |
| Deep Analytics | Assign Follow-Up | command button | none | result toolbar after Run/Refresh | 132 px | clinical.edit | one or more authorized pending rows | open continuity-task batch editor for selected cases | [Phase 3] |
| Deep Analytics | Run/Refresh | primary button | none | filter toolbar right position 1 | 98 px | matching report permission | required filters valid | execute registry SQL | [Phase 1] |
| Deep Analytics | Print Report | icon button | Print | filter toolbar right position 2 | 28 px | analytics.print | result available | print exact result | [Phase 1] |
| Deep Analytics | Export Report | icon button | Export | filter toolbar right position 3 | 28 px | analytics.export | result available | export exact result | [Phase 2] |
| Serials | Save Serials | primary button | none | serial toolbar position 1 | 78 px | configuration.numbering.edit | all edited rows valid | save versioned serial settings | [Phase 2] |
| Serials | Reset Serials | secondary button | none | serial toolbar position 2 | 78 px | configuration.numbering.edit | dirty confirmation | reload effective settings | [Phase 2] |
| Serials | Type | grid column/select | none | serial grid column 1 | 160 px | configuration.numbering.edit | one declared document type | identify series | [Phase 2] |
| Serials | Generate | grid column/select | Select Generation | serial grid column 2 | 190 px | configuration.numbering.edit | Manual Serial Number, Year based Serial, Year Month based Serial | set generation rule | [Phase 2] |
| Serials | Prefix | grid column/text input | Prefix | serial grid column 3 | 130 px | configuration.numbering.edit | 0-20 safe characters | set prefix | [Phase 2] |
| Serials | Start From | grid column/integer input | 1 | serial grid column 4 | 110 px | configuration.numbering.edit | positive and collision-free | set next counter baseline | [Phase 2] |
| Serials | Edit | row command | none | serial grid column 5 | 58 px | configuration.numbering.edit | selected row | enable row edit | [Phase 2] |
| Serials | Patient Code | serial row | none | serial row 1 | 28 px height | configuration.numbering.edit | exact type | configure patient numbering | [Phase 2] |
| Serials | Collection Reference | serial row | none | serial row 2 | 28 px height | configuration.numbering.edit | exact type | configure Collection numbering | [Phase 2] |
| Serials | Statement Reference | serial row | none | serial row 3 | 28 px height | configuration.numbering.edit | exact type | configure Fee Statement numbering | [Phase 2] |
| Serials | Lab Order No. | serial row | none | serial row 4 | 28 px height | configuration.numbering.edit | exact type | configure lab numbering | [Phase 2] |
| Serials | Exp. Voucher | serial row | none | serial row 5 | 28 px height | configuration.numbering.edit | exact type | configure expense numbering | [Phase 2] |
| Serials | Goods In | serial row | none | serial row 6 | 28 px height | configuration.numbering.edit | exact type | configure inward numbering | [Phase 2] |
| Serials | Goods Out | serial row | none | serial row 7 | 28 px height | configuration.numbering.edit | exact type | configure outward numbering | [Phase 2] |
| Document Output editor | Fee Statement | document selector | none | document type position 1 | 86 px | configuration.practice.edit | exact type | load Fee Statement print template | [Phase 3] |
| Document Output editor | Collection Receipt | document selector | none | document type position 2 | 86 px | configuration.practice.edit | exact type | load Collection Receipt print template | [Phase 3] |
| Document Output editor | Clinical Summary | document selector | none | document type position 3 | 102 px | configuration.practice.edit | exact type | load Clinical Summary print template | [Phase 3] |
| Document Output editor | Medication Order | document selector | none | document type position 4 | 112 px | configuration.practice.edit | exact type | load Medication Order print template | [Phase 3] |
| Document Output editor | Care Plan | document selector | none | document type position 5 | 86 px | configuration.practice.edit | exact type | load Care Plan print template | [Phase 3] |
| Document Output editor | Page Size | select | Select Page Size | property row 1 | 180 px | configuration.practice.edit | A3, A4, A5, B5, Ledger, Legal, Letter, Custom | set page size | [Phase 3] |
| Document Output editor | Orientation | select | Select Orientation | property row 2 | 180 px | configuration.practice.edit | Potrait or Landscape | set orientation | [Phase 3] |
| Document Output editor | Logo placement | select | Select Logo Placement | property row 3 | 180 px | configuration.practice.edit | configured placement | set logo position | [Phase 3] |
| Document Output editor | Barcode Type | select | Select Barcode | property row 4 | 180 px | configuration.practice.edit | None, QR Code, Code39, Code128 | set barcode type | [Phase 3] |
| Document Output editor | Barcode Size | numeric inputs | Width / Height | property row 5 | 180 px | configuration.practice.edit | positive dimensions | set barcode size | [Phase 3] |
| Document Output editor | Barcode Show Text | checkbox | none | property row 6 | auto | configuration.practice.edit | boolean | show or hide barcode text | [Phase 3] |
| Document Output editor | Barcode Placement | select | Select Placement | property row 7 | 180 px | configuration.practice.edit | configured placement | set barcode position | [Phase 3] |
| Document Output editor | Page Header | textarea | Page Header | property row 8 | 100% | configuration.practice.edit | template variable whitelist | set header template | [Phase 3] |
| Document Output editor | Footer | textarea | Footer | property row 9 | 100% | configuration.practice.edit | template variable whitelist | set footer template | [Phase 3] |
| Document Output editor | Margins | four numeric inputs | Top / Right / Bottom / Left | property row 10 | 100% | configuration.practice.edit | non-negative and printable | set margins | [Phase 3] |
| Document Output editor | Spacings | numeric property grid | Header / Body / Footer | property row 11 | 100% | configuration.practice.edit | non-negative | set section spacing | [Phase 3] |
| Document Output editor | Font | font property grid | Family / Size / Weight | property row 12 | 100% | configuration.practice.edit | approved fonts and 7-24 pt | set typography | [Phase 3] |
| Document Output editor | Options | checkbox property grid | none | property row 13 | 100% | configuration.practice.edit | document-type schema | set print options | [Phase 3] |
| Document Output editor | Save Document Output | primary button | none | sticky footer position 1 | 88 px | configuration.practice.edit | template valid | save new template version | [Phase 3] |
| Document Output editor | Reset Document Output | secondary button | none | sticky footer position 2 | 88 px | configuration.practice.edit | dirty confirmation | restore effective default | [Phase 3] |
| Clinical Queue | Operational Date | date input | DD-MMM-YYYY | filter bar position 1 | 132 px | queue.view | valid clinic-local date | load queue date | [Phase 1] |
| Clinical Queue | Queue State | multi-select | Active States | filter bar position 2 | 170 px | queue.view | configured state set | filter operational state | [Phase 1] |
| Clinical Queue | Lead Clinician | select | All Lead Clinicians | filter bar position 3 | 190 px | queue.view | authorized clinicians | filter queue clinician | [Phase 1] |
| Clinical Queue | Patient Lookup | search input | Name / Patient ID / Mobile | filter bar flexible | min 280 px | queue.view | 0-100 characters | filter queue patient | [Phase 1] |
| Clinical Queue | Care Stream | select | All Care Streams | filter bar position 5 | 160 px | queue.view | configured care stream | filter care stream | [Phase 1] |
| Clinical Queue | Refresh | icon button | Refresh queue | filter bar position 6 | 28 px | queue.view | none | reload queue | [Phase 1] |
| Clinical Queue | Add Unscheduled Encounter | command button | none | action bar position 1 | 184 px | queue.admit | none | open queue-first encounter sheet | [Phase 1] |
| Clinical Queue | Admit Existing Booking | command button | none | action bar position 2 | 170 px | queue.admit | active booking selected | create or recover linked encounter | [Phase 1] |
| Clinical Queue | Open Patient | command button | none | action bar position 3 | 108 px | patient.view | selected patient | open Care Overview | [Phase 1] |
| Clinical Queue | Edit Queue Entry | row command | none | actions column position 1 | 104 px | scheduler.edit | Arriving or Admitted | edit queue-controlled fields | [Phase 1] |
| Clinical Queue | Admit | row command | none | actions column position 2 | 68 px | queue.admit | Arriving state | admit exactly once | [Phase 1] |
| Clinical Queue | Begin Care | row command | none | actions column position 3 | 92 px | queue.engage | Arriving under direct policy or Admitted | start care encounter | [Phase 1] |
| Clinical Queue | Release Encounter | row command | none | actions column position 4 | 132 px | queue.release | In Care and requirements pass | release encounter | [Phase 1] |
| Clinical Queue | Reopen Encounter | row command | none | actions column position 5 | 124 px | queue.reopen | Released and objective supplied | reopen encounter | [Phase 1] |
| Practice Identity split | Practice Identity | pane heading | none | left pane x=0, sticky top | min 340 px, 5fr | configuration.practice.view | exact heading | identify practice configuration pane | [Phase 3] |
| Practice Identity split | Workforce and Access | pane heading | none | right pane after 1 px divider | min 560 px, 7fr | configuration.workforce.view | exact heading | identify workforce and access pane | [Phase 1] |
| Practice Identity split | Active Clinic Selector | select | Select Active Clinic | left pane row 1 columns 1-8 | 8/12 | configuration.practice.view | authorized clinic | load both panes after dirty check | [Phase 3] |
| Practice Identity split | Add Clinic | command button | none | left pane row 1 columns 9-12 | 4/12 | configuration.practice.edit | organization policy | open clinic creation | [Phase 3] |
| Practice Identity split | Legal Name | text input | Legal practice name | left pane row 2 columns 1-7 | 7/12 | configuration.practice.edit | required | set legal name | [Phase 3] |
| Practice Identity split | Clinic Code | text input | Clinic code | left pane row 2 columns 8-12 | 5/12 | configuration.practice.edit | required and unique | set clinic code | [Phase 3] |
| Practice Identity split | Timezone | select | Asia/Calcutta | left pane row 3 columns 1-5 | 5/12 | configuration.practice.edit | IANA timezone | set operational timezone | [Phase 3] |
| Practice Identity split | GSTIN | text input | GSTIN | left pane row 3 columns 6-12 | 7/12 | configuration.practice.edit | valid GSTIN or blank | set GST registration | [Phase 3] |
| Practice Identity split | Practice Address | textarea | Practice address | left pane row 4 | 100% | configuration.practice.edit | 0-500 characters | set clinic address | [Phase 3] |
| Practice Identity split | Contact Phone | tel input | Contact phone | left pane row 5 columns 1-6 | 6/12 | configuration.practice.edit | normalized phone | set clinic phone | [Phase 3] |
| Practice Identity split | Contact Email | email input | Contact email | left pane row 5 columns 7-12 | 6/12 | configuration.practice.edit | valid email | set clinic email | [Phase 3] |
| Practice Identity split | Save Practice | primary button | none | left pane sticky footer position 1 | 108 px | configuration.practice.edit | left pane valid | save only practice pane | [Phase 3] |
| Practice Identity split | Revert Practice | secondary button | none | left pane sticky footer position 2 | 112 px | configuration.practice.edit | dirty confirmation | reload practice pane | [Phase 3] |
| Practice Identity split | Search Workforce | search input | Search team member | right pane toolbar flexible | min 240 px | configuration.workforce.view | 0-100 characters | filter workforce grid | [Phase 1] |
| Practice Identity split | Add Team Member | command button | none | right pane toolbar right | 132 px | configuration.workforce.edit | none | open workforce editor | [Phase 1] |
| Practice Identity split | Workforce Function | select | Select function | right editor row 1 columns 1-4 | 4/12 | configuration.workforce.edit | clinician, reception, assistant, cashier, administrator, or support | set workforce function | [Phase 1] |
| Practice Identity split | Display Name | text input | Display name | right editor row 1 columns 5-9 | 5/12 | configuration.workforce.edit | required | set display name | [Phase 1] |
| Practice Identity split | Assigned Clinics | multi-select | Select clinics | right editor row 1 columns 10-12 | 3/12 | configuration.workforce.edit | at least one clinic for active clinician | set clinic scope | [Phase 1] |
| Practice Identity split | Registration Number | text input | Registration number | right editor row 2 columns 1-4 | 4/12 | configuration.workforce.edit | required for clinician under clinic policy | set professional registration | [Phase 1] |
| Practice Identity split | Specialization | text input | Specialization | right editor row 2 columns 5-8 | 4/12 | configuration.workforce.edit | 0-120 characters | set specialization | [Phase 1] |
| Practice Identity split | Calendar Color | color input | none | right editor row 2 columns 9-10 | 2/12 | configuration.workforce.edit | valid hex color | set scheduler color | [Phase 1] |
| Practice Identity split | Display Order | integer input | 0 | right editor row 2 columns 11-12 | 2/12 | configuration.workforce.edit | 0-9999 | set workforce ordering | [Phase 1] |
| Practice Identity split | Active Member | toggle | none | right editor row 3 | 96 px | configuration.workforce.edit | historical references retained | activate or deactivate member | [Phase 1] |
| Practice Identity split | Create Account | command button | none | selected member security bar position 1 | 118 px | security.user.create | member has no active account link | open authentication section | [Phase 1] |
| Practice Identity split | Link Existing Account | command button | none | selected member security bar position 2 | 162 px | security.user.edit | member has no active account link | open organization account selector | [Phase 1] |
| Practice Identity split | Account ID | text input | Account ID | authentication row 1 columns 1-4 | 4/12 | security.user.create | organization-unique case-insensitive | set login identifier | [Phase 1] |
| Practice Identity split | Work Email | email input | Work email | authentication row 1 columns 5-8 | 4/12 | security.user.create | valid and unique under policy | set account email | [Phase 1] |
| Practice Identity split | Account Mobile | tel input | Mobile | authentication row 1 columns 9-12 | 4/12 | security.user.create | normalized mobile | set account mobile | [Phase 1] |
| Practice Identity split | Temporary Secret | password input | Temporary secret | authentication row 2 columns 1-5 | 5/12 | security.user.create | credential policy | set one-time credential | [Phase 1] |
| Practice Identity split | Confirm Secret | password input | Confirm secret | authentication row 2 columns 6-10 | 5/12 | security.user.create | must match | confirm one-time credential | [Phase 1] |
| Practice Identity split | Send Activation | checkbox | none | authentication row 2 column 11 | 1/12 | security.user.create | email or mobile channel valid | queue activation after commit | [Phase 1] |
| Practice Identity split | Force Secret Rotation | checkbox | none | authentication row 2 column 12 | 1/12 | security.user.create | boolean | force next-login credential change | [Phase 1] |
| Practice Identity split | Account State | select | Invited / Active / Locked / Suspended | authentication row 3 columns 1-4 | 4/12 | security.user.edit | configured account transition | set account lifecycle | [Phase 1] |
| Practice Identity split | Clinic Scope | checkbox grid | none | clinic scope section row 1 | 100% | security.user.edit | only delegable clinics | create memberships | [Phase 1] |
| Practice Identity split | Default Clinic | select | Select default clinic | clinic scope section row 2 | 220 px | security.user.edit | selected active membership | set default membership | [Phase 1] |
| Practice Identity split | Assigned Roles | multi-select | Select roles | access policy row 1 | 100% | security.role.manage | delegation ceiling | assign membership roles | [Phase 1] |
| Practice Identity split | Reset Credential | command button | none | right pane footer position 1 | 128 px | security.user.edit | active linked account | issue single-use reset | [Phase 1] |
| Practice Identity split | Unlock Account | command button | none | right pane footer position 2 | 118 px | security.user.edit | locked account | clear lock and failure counter | [Phase 1] |
| Practice Identity split | Suspend Account | danger command | none | right pane footer position 3 | 126 px | security.user.disable | not final security administrator | suspend and revoke sessions | [Phase 1] |
| Practice Identity split | Save Member | primary button | none | right pane footer position 4 | 108 px | configuration.workforce.edit plus required security permissions | right pane valid | save only workforce pane | [Phase 1] |
| Practice Identity split | Discard Member Changes | secondary button | none | right pane footer position 5 | 166 px | configuration.workforce.view | dirty confirmation | reload workforce pane | [Phase 1] |
| System Configuration navigator | Practice Identity | tree group | none | group position 1 | tree row 28 px | authenticated user with a visible child | exact label | expand Practice Identity children | [Phase 1] |
| System Configuration navigator | Clinics | tree leaf | none | Practice Identity child position 1 | tree row 28 px | configuration.practice.view | exact label | open clinic identity configuration | [Phase 3] |
| System Configuration navigator | Workforce | tree leaf | none | Practice Identity child position 2 | tree row 28 px | configuration.workforce.view | exact label | open workforce and account configuration | [Phase 1] |
| System Configuration navigator | Chairs and Resources | tree leaf | none | Practice Identity child position 3 | tree row 28 px | scheduler.view | exact label | open chair and resource configuration | [Phase 1] |
| System Configuration navigator | Working Calendar | tree leaf | none | Practice Identity child position 4 | tree row 28 px | scheduler.view | exact label | open working calendar configuration | [Phase 1] |
| System Configuration navigator | Visual Theme | tree leaf | none | Practice Identity child position 5 | tree row 28 px | configuration.practice.view | exact label | open visual theme configuration | [Phase 3] |
| System Configuration navigator | Care Delivery Masters | tree group | none | group position 2 | tree row 28 px | authenticated user with a visible child | exact label | expand care delivery children | [Phase 1] |
| System Configuration navigator | Consultation Objectives | tree leaf | none | Care Delivery Masters child position 1 | tree row 28 px | scheduler.view | exact label | open consultation-objective registry | [Phase 1] |
| System Configuration navigator | Care Priorities | tree leaf | none | Care Delivery Masters child position 2 | tree row 28 px | clinical.view | exact label | open care-priority registry | [Phase 3] |
| System Configuration navigator | Service Domains | tree leaf | none | Care Delivery Masters child position 3 | tree row 28 px | clinical.view | exact label | open service-domain registry | [Phase 1] |
| Service Domain Registry | High Value | toggle | none | domain editor row 3 columns 1-3 | 3/12 | configuration.practice.edit | boolean | mark domain eligible for high-value conversion reporting | [Phase 1] |
| Service Domain Registry | High-Value Floor | money input | 0.00 | domain editor row 3 columns 4-6 | 3/12 | configuration.practice.edit | nonnegative; zero when High Value is off | set minimum proposed domain value for high-value reports | [Phase 1] |
| System Configuration navigator | Service Catalog | tree leaf | none | Care Delivery Masters child position 4 | tree row 28 px | clinical.view | exact label | open service catalog | [Phase 1] |
| System Configuration navigator | Materials | tree leaf | none | Care Delivery Masters child position 5 | tree row 28 px | clinical.view | exact label | open clinical-material registry | [Phase 3] |
| System Configuration navigator | Bridges | tree leaf | none | Care Delivery Masters child position 6 | tree row 28 px | clinical.view | exact label | open bridge-definition registry | [Phase 3] |
| System Configuration navigator | Patient Data Masters | tree group | none | group position 3 | tree row 28 px | authenticated user with a visible child | exact label | expand patient master children | [Phase 1] |
| System Configuration navigator | Acquisition Channels | tree leaf | none | Patient Data Masters child position 1 | tree row 28 px | patient.view | exact label | open acquisition-channel registry | [Phase 1] |
| System Configuration navigator | Honorifics | tree leaf | none | Patient Data Masters child position 2 | tree row 28 px | patient.view | exact label | open honorific registry | [Phase 1] |
| System Configuration navigator | Patient Segments | tree leaf | none | Patient Data Masters child position 3 | tree row 28 px | patient.view | exact label | open patient-segment registry | [Phase 1] |
| System Configuration navigator | Flags | tree leaf | none | Patient Data Masters child position 4 | tree row 28 px | patient.view | exact label | open patient-flag registry | [Phase 1] |
| System Configuration navigator | Occupations | tree leaf | none | Patient Data Masters child position 5 | tree row 28 px | patient.view | exact label | open occupation registry | [Phase 1] |
| System Configuration navigator | Custom Attributes | tree leaf | none | Patient Data Masters child position 6 | tree row 28 px | patient.view | exact label | open custom-attribute registry | [Phase 1] |
| System Configuration navigator | Clinical Safety | tree group | none | group position 4 | tree row 28 px | authenticated user with a visible child | exact label | expand clinical safety children | [Phase 1] |
| System Configuration navigator | Allergies | tree leaf | none | Clinical Safety child position 1 | tree row 28 px | clinical.view | exact label | open allergy registry | [Phase 1] |
| System Configuration navigator | Risk Factors | tree leaf | none | Clinical Safety child position 2 | tree row 28 px | clinical.view | exact label | open risk-factor registry | [Phase 3] |
| System Configuration navigator | Alert Rules | tree leaf | none | Clinical Safety child position 3 | tree row 28 px | clinical.view | exact label | open structured alert rules | [Phase 3] |
| System Configuration navigator | Treatment Priorities | tree leaf | none | Clinical Safety child position 4 | tree row 28 px | clinical.view | exact label | open treatment-priority registry | [Phase 3] |
| System Configuration navigator | Document Domains | tree leaf | none | Clinical Safety child position 5 | tree row 28 px | document.view | exact label | open clinical-document domains | [Phase 3] |
| System Configuration navigator | Medication Studio | tree group | none | group position 5 | tree row 28 px | configuration.practice.view | exact label | expand medication studio children | [Phase 3] |
| System Configuration navigator | Medication Domains | tree leaf | none | Medication Studio child position 1 | tree row 28 px | configuration.practice.view | exact label | open medication-domain registry | [Phase 3] |
| System Configuration navigator | Active Ingredients | tree leaf | none | Medication Studio child position 2 | tree row 28 px | configuration.practice.view | exact label | open active-ingredient registry | [Phase 3] |
| System Configuration navigator | Medication Catalog | tree leaf | none | Medication Studio child position 3 | tree row 28 px | configuration.practice.view | exact label | open medication catalog | [Phase 3] |
| System Configuration navigator | Administration Patterns | tree leaf | none | Medication Studio child position 4 | tree row 28 px | configuration.practice.view | exact label | open administration-pattern registry | [Phase 3] |
| System Configuration navigator | Medication Protocols | tree leaf | none | Medication Studio child position 5 | tree row 28 px | configuration.practice.view | exact label | open medication-protocol registry | [Phase 3] |
| System Configuration navigator | Clinical Documentation | tree group | none | group position 6 | tree row 28 px | authenticated user with a visible child | exact label | expand clinical documentation children | [Phase 3] |
| System Configuration navigator | Note Protocols | tree leaf | none | Clinical Documentation child position 1 | tree row 28 px | clinical_note.create | exact label | open note-protocol registry | [Phase 3] |
| System Configuration navigator | Custom Forms | tree leaf | none | Clinical Documentation child position 2 | tree row 28 px | clinical.view | exact label | open custom-form registry | [Phase 3] |
| System Configuration navigator | Clinical Note Policies | tree leaf | none | Clinical Documentation child position 3 | tree row 28 px | clinical.view | exact label | open note policy configuration | [Phase 3] |
| System Configuration navigator | Feedback Forms | tree leaf | none | Clinical Documentation child position 4 | tree row 28 px | clinical.view | exact label | open feedback-form registry | [Phase 3] |
| System Configuration navigator | Communications | tree group | none | group position 7 | tree row 28 px | message.view | exact label | expand communication configuration children | [Phase 3] |
| System Configuration navigator | Sender Identities | tree leaf | none | Communications child position 1 | tree row 28 px | message.view | exact label | open sender identity configuration | [Phase 3] |
| System Configuration navigator | SMS Providers | tree leaf | none | Communications child position 2 | tree row 28 px | message.view | exact label | open SMS provider configuration | [Phase 3] |
| System Configuration navigator | WhatsApp Providers | tree leaf | none | Communications child position 3 | tree row 28 px | message.view | exact label | open WhatsApp provider configuration | [Phase 3] |
| System Configuration navigator | Consent Policies | tree leaf | none | Communications child position 4 | tree row 28 px | message.view | exact label | open consent policy configuration | [Phase 3] |
| System Configuration navigator | Message Templates | tree leaf | none | Communications child position 5 | tree row 28 px | message.view | exact label | open message-template registry | [Phase 3] |
| System Configuration navigator | Financial Masters | tree group | none | group position 8 | tree row 28 px | configuration.practice.view | exact label | expand financial master children | [Phase 1] |
| System Configuration navigator | Collection Methods | tree leaf | none | Financial Masters child position 1 | tree row 28 px | configuration.practice.view | exact label | open collection method registry | [Phase 2] |
| System Configuration navigator | Ledger Accounts | tree leaf | none | Financial Masters child position 2 | tree row 28 px | configuration.practice.view | exact label | open ledger-account registry | [Phase 1] |
| System Configuration navigator | Fee Profiles | tree leaf | none | Financial Masters child position 3 | tree row 28 px | configuration.practice.view | exact label | open fee-profile registry | [Phase 1] |
| System Configuration navigator | Tax Definitions | tree leaf | none | Financial Masters child position 4 | tree row 28 px | configuration.practice.view | exact label | open tax-definition registry | [Phase 1] |
| System Configuration navigator | Fee Statement Domains | tree leaf | none | Financial Masters child position 5 | tree row 28 px | configuration.practice.view | exact label | open statement-domain registry | [Phase 1] |
| System Configuration navigator | Practice Assets | tree group | none | group position 9 | tree row 28 px | inventory.view or lab.view or expense.view | exact label | expand practice asset children | [Phase 3] |
| System Configuration navigator | Stock Domains | tree leaf | none | Practice Assets child position 1 | tree row 28 px | inventory.view | exact label | open stock-domain registry | [Phase 3] |
| System Configuration navigator | Inventory Items | tree leaf | none | Practice Assets child position 2 | tree row 28 px | inventory.view | exact label | open inventory-item registry | [Phase 3] |
| System Configuration navigator | Suppliers | tree leaf | none | Practice Assets child position 3 | tree row 28 px | expense.view | exact label | open supplier registry | [Phase 3] |
| System Configuration navigator | Lab Partners | tree leaf | none | Practice Assets child position 4 | tree row 28 px | lab.view | exact label | open lab-partner registry | [Phase 3] |
| System Configuration navigator | Lab Work Definitions | tree leaf | none | Practice Assets child position 5 | tree row 28 px | lab.view | exact label | open lab-work registry | [Phase 3] |
| System Configuration navigator | Quality Gates | tree leaf | none | Practice Assets child position 6 | tree row 28 px | lab.view | exact label | open laboratory quality gates | [Phase 3] |
| System Configuration navigator | Document Output | tree group | none | group position 10 | tree row 28 px | configuration.practice.view | exact label | expand document output children | [Phase 3] |
| System Configuration navigator | Fee Statement Output | tree leaf | none | Document Output child position 1 | tree row 28 px | configuration.practice.view | exact label | open fee-statement output design | [Phase 3] |
| System Configuration navigator | Collection Receipt Output | tree leaf | none | Document Output child position 2 | tree row 28 px | configuration.practice.view | exact label | open Collection Receipt output design | [Phase 3] |
| System Configuration navigator | Clinical Summary Output | tree leaf | none | Document Output child position 3 | tree row 28 px | configuration.practice.view | exact label | open clinical-summary output design | [Phase 3] |
| System Configuration navigator | Medication Order Output | tree leaf | none | Document Output child position 4 | tree row 28 px | configuration.practice.view | exact label | open medication-order output design | [Phase 3] |
| System Configuration navigator | Care Plan Output | tree leaf | none | Document Output child position 5 | tree row 28 px | configuration.practice.view | exact label | open care-plan output design | [Phase 3] |
| System Configuration navigator | Security and Governance | tree group | none | group position 11 | tree row 28 px | security.role.manage or audit.view | exact label | expand security children | [Phase 1] |
| System Configuration navigator | Users | tree leaf | none | Security and Governance child position 1 | tree row 28 px | security.user.edit | exact label | open account registry | [Phase 1] |
| System Configuration navigator | Roles | tree leaf | none | Security and Governance child position 2 | tree row 28 px | security.role.manage | exact label | open role registry | [Phase 1] |
| System Configuration navigator | Permission Matrix | tree leaf | none | Security and Governance child position 3 | tree row 28 px | security.role.manage | exact label | open permission matrix | [Phase 1] |
| System Configuration navigator | Sessions | tree leaf | none | Security and Governance child position 4 | tree row 28 px | security.user.edit | exact label | open active session registry | [Phase 1] |
| System Configuration navigator | Audit Retention | tree leaf | none | Security and Governance child position 5 | tree row 28 px | audit.view | exact label | open audit retention policy | [Phase 3] |
| System Configuration navigator | Backup Policies | tree leaf | none | Security and Governance child position 6 | tree row 28 px | backup.run | exact label | open backup policy configuration | [Phase 3] |
| System Configuration navigator | Numbering Policies | tree group | none | group position 12 | tree row 28 px | configuration.numbering.edit | exact label | expand numbering policy children | [Phase 2] |
| System Configuration navigator | Patient ID Series | tree leaf | none | Numbering Policies child position 1 | tree row 28 px | configuration.numbering.edit | exact label | configure patient identifiers | [Phase 2] |
| System Configuration navigator | Collection Reference Series | tree leaf | none | Numbering Policies child position 2 | tree row 28 px | configuration.numbering.edit | exact label | configure collection references | [Phase 2] |
| System Configuration navigator | Statement Reference Series | tree leaf | none | Numbering Policies child position 3 | tree row 28 px | configuration.numbering.edit | exact label | configure statement references | [Phase 2] |
| System Configuration navigator | Lab Case Series | tree leaf | none | Numbering Policies child position 4 | tree row 28 px | configuration.numbering.edit | exact label | configure laboratory case references | [Phase 2] |
| System Configuration navigator | Expense Voucher Series | tree leaf | none | Numbering Policies child position 5 | tree row 28 px | configuration.numbering.edit | exact label | configure expense vouchers | [Phase 2] |
| System Configuration navigator | Stock In Series | tree leaf | none | Numbering Policies child position 6 | tree row 28 px | configuration.numbering.edit | exact label | configure inbound stock references | [Phase 2] |
| System Configuration navigator | Stock Out Series | tree leaf | none | Numbering Policies child position 7 | tree row 28 px | configuration.numbering.edit | exact label | configure outbound stock references | [Phase 2] |
| System Configuration navigator | Data Operations | tree group | none | group position 13 | tree row 28 px | backup.run or patient.merge or analytics.export | exact label | expand data operation children | [Phase 3] |
| System Configuration navigator | Backup Run | tree leaf | none | Data Operations child position 1 | tree row 28 px | backup.run | exact label | open backup execution workspace | [Phase 3] |
| System Configuration navigator | Restore Drill | tree leaf | none | Data Operations child position 2 | tree row 28 px | backup.run | exact label | open restore verification workspace | [Phase 3] |
| System Configuration navigator | Duplicate Patient Resolution | tree leaf | none | Data Operations child position 3 | tree row 28 px | patient.merge | exact label | open duplicate-resolution workspace | [Phase 3] |
| System Configuration navigator | Import Queue | tree leaf | none | Data Operations child position 4 | tree row 28 px | configuration.practice.edit | exact label | open controlled import queue | [Phase 3] |
| System Configuration navigator | Export Queue | tree leaf | none | Data Operations child position 5 | tree row 28 px | analytics.export | exact label | open governed export queue | [Phase 3] |
## 19. Explicit Permission Matrix Rows

| Permission code | Group | Resource | Action column | UI control | Inherit state | Allow state | Deny state |
|---|---|---|---|---|---|---|---|
| `patient.view` | patient_registry | patient | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.create` | patient_registry | patient | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.edit` | patient_registry | patient | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.archive` | patient_registry | patient | archive | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.merge` | patient_registry | patient | merge | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.export` | patient_registry | patient | export | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.kyc.view` | patient_registry | patient_kyc | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.intent_tier.view` | patient_registry | patient_intent_tier | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `patient.intent_tier.edit` | patient_registry | patient_intent_tier | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `scheduler.view` | scheduler | care_booking | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `scheduler.create` | scheduler | care_booking | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `scheduler.edit` | scheduler | care_booking | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `scheduler.cancel` | scheduler | care_booking | cancel | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `scheduler.override` | scheduler | care_booking | override | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `queue.view` | clinical_queue | care_encounter | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `queue.admit` | clinical_queue | care_encounter | admit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `queue.engage` | clinical_queue | care_encounter | engage | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `queue.release` | clinical_queue | care_encounter | release | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `queue.reopen` | clinical_queue | care_encounter | reopen | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical.view` | care_workspace | care_record | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical.edit` | care_workspace | care_record | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical.delete_draft` | care_workspace | care_record | delete_draft | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `odontogram.edit` | care_workspace | odontogram | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `care_plan.create` | care_workspace | care_plan | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `care_plan.edit` | care_workspace | care_plan | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `care_delivery.complete` | care_workspace | care_delivery | complete | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical_case.view` | care_workspace | clinical_case | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical_case.create` | care_workspace | clinical_case | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical_case.edit_state` | care_workspace | clinical_case | edit_state | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical_case.correct_state` | care_workspace | clinical_case | correct_state | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `case_consultation.finalize` | care_workspace | case_consultation | finalize | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `treatment_bundle.manage` | care_workspace | treatment_bundle | manage | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical_note.create` | care_workspace | clinical_note | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical_note.edit_own` | care_workspace | clinical_note | edit_own | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `clinical_note.delete_draft` | care_workspace | clinical_note | delete_draft | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `medication_order.view` | medication_orders | medication_order | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `medication_order.create` | medication_orders | medication_order | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `medication_order.edit_draft` | medication_orders | medication_order | edit_draft | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `medication_order.void` | medication_orders | medication_order | void | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `medication_order.sign` | medication_orders | medication_order | sign | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_statement.view` | financial_operations | fee_statement | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_statement.create` | financial_operations | fee_statement | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_statement.edit_draft` | financial_operations | fee_statement | edit_draft | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_statement.issue` | financial_operations | fee_statement | issue | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_statement.discount` | financial_operations | fee_statement | discount | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_statement.void` | financial_operations | fee_statement | void | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_statement.print` | financial_operations | fee_statement | print | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `collection.view` | financial_operations | collection_receipt | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `collection.create` | financial_operations | collection_receipt | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `collection.edit_reference` | financial_operations | collection_receipt | edit_reference | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_allocation.create` | financial_operations | fee_allocation | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `fee_allocation.reverse` | financial_operations | fee_allocation | reverse | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `collection.refund` | financial_operations | collection_receipt | refund | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `collection.void` | financial_operations | collection_receipt | void | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `collection.print` | financial_operations | collection_receipt | print | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `analytics.operational.view` | deep_analytics | operational | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `analytics.clinical.view` | deep_analytics | clinical | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `analytics.financial.view` | deep_analytics | financial | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `analytics.inventory.view` | deep_analytics | inventory | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `analytics.export` | deep_analytics | report | export | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `analytics.print` | deep_analytics | report | print | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `analytics.conversion.view` | deep_analytics | conversion_intelligence | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `message.view` | comms_center | message | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `message.send` | comms_center | message | send | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `message.bulk_send` | comms_center | message | bulk_send | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `document.view` | patient_files | document | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `document.upload` | patient_files | document | upload | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `document.delete_draft` | patient_files | document | delete_draft | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `expense.view` | practice_assets | expense | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `expense.create` | practice_assets | expense | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `expense.void` | practice_assets | expense | void | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `lab.view` | laboratory_operations | lab_case | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `lab.edit` | laboratory_operations | lab_case | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `inventory.view` | inventory_control | stock | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `inventory.post` | inventory_control | stock | post | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `inventory.negative_override` | inventory_control | stock | negative_override | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `configuration.practice.view` | system_configuration | practice | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `configuration.practice.edit` | system_configuration | practice | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `configuration.workforce.view` | system_configuration | workforce | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `configuration.workforce.edit` | system_configuration | workforce | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `security.user.create` | security | user | create | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `security.user.edit` | security | user | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `security.user.disable` | security | user | disable | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `security.role.manage` | security | role | manage | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `security.permission.override` | security | permission | override | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `configuration.numbering.edit` | system_configuration | numbering_policy | edit | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `backup.run` | data_operations | backup | run | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |
| `audit.view` | security | audit | view | three-state matrix cell | role result shown read-only | explicit override allows within delegation ceiling | explicit override denies and wins over all grants |

## 20. System Configuration Split Geometry

```css
.clinic-security-workspace {
  display: grid;
  grid-template-columns: minmax(340px, 5fr) minmax(560px, 7fr);
  grid-template-rows: minmax(0, 1fr);
  height: calc(100dvh - 106px);
  min-width: 1024px;
  border-top: 1px solid var(--grid-border);
}
.clinic-setting-pane {
  grid-column: 1;
  min-width: 340px;
  overflow: auto;
  border-right: 1px solid var(--grid-border);
}
.clinician-staff-setting-pane {
  grid-column: 2;
  min-width: 560px;
  overflow: auto;
}
.settings-pane-heading {
  position: sticky;
  top: 0;
  height: 34px;
  z-index: 3;
}
.settings-pane-footer {
  position: sticky;
  bottom: 0;
  min-height: 38px;
  z-index: 3;
}
@media (max-width: 1023px) {
  .clinic-security-workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    min-width: 0;
    height: auto;
  }
  .clinic-setting-pane { grid-column: 1; grid-row: 1; min-width: 0; border-right: 0; }
  .clinician-staff-setting-pane { grid-column: 1; grid-row: 2; min-width: 0; }
}
```
