# 10 — KlickIt Offline-First Delivery Roadmap and Architecture Addendum

**Status:** Scope frozen for implementation  
**Product name:** KlickIt  
**Initial pilot:** Rohini clinic  
**Expansion:** Shalimar Bagh after pilot acceptance  
**Target users:** Ganpati Dental Clinic initially; reusable multi-clinic foundation for other dental practices later

---

## 1. Purpose and authority

This document completes the remaining roadmap for KlickIt and extends the uploaded specifications `01` through `09`.

The earlier documents remain authoritative for the detailed database, workflows, ledger rules, analytics contracts, interface behavior, security controls and acceptance tests except where this document records a newer KlickIt decision. When a conflict exists, the explicit decision in this addendum takes precedence and the affected earlier document must be updated before implementation.

This is an **offline-first, multi-clinic patient-management system**, not merely a web application placed inside a Windows wrapper.

The development team must not copy the UI, source code, private APIs, database identifiers or protected assets of `drklick.in`. Existing data may be imported only through authorised exports or authorised access. KlickIt must retain its own terminology, routes, code, layouts and data model.

---

## 2. Frozen first-release scope

### 2.1 Included in the Rohini pilot

1. Patient registration, duplicate detection and patient search
2. Shared patient identity across clinics
3. Medical history, allergies, alerts and active medicines
4. Appointments and Clinical Queue
5. Clinical notes and tooth-wise treatment records
6. Treatment plans with phases and alternatives
7. Estimates and treatment-plan acceptance
8. Prescriptions, medicine templates and safety warnings
9. Billing, payments, advances, allocations and balances
10. Recall and follow-up management
11. Clinical images and PDF files
12. Pabbly Chatflow integration and WhatsApp automation
13. Windows desktop application
14. Browser application for computers, tablets and phones
15. Clinic LAN operation during internet failure
16. Cloud synchronization between clinics
17. User roles, permissions, audit history and security
18. Printing for prescriptions, plans, invoices, receipts, consent forms, labels, appointment slips and CGHS/corporate documents
19. DrKlick patient-demographic migration before pilot
20. Encrypted local and cloud backups

### 2.2 Explicitly excluded from the first pilot

1. Inventory management
2. Laboratory management
3. Advanced analytics catalog
4. Full CGHS claim-submission workflow
5. Patient portal
6. Native Android or iOS application
7. A complete WhatsApp helpdesk rebuilt inside KlickIt
8. Automatic payment-gateway confirmation
9. Heavy business-intelligence exports
10. Automatic high-availability failover between two live clinic servers

These excluded modules remain later roadmap items and must not silently expand the pilot.

---

## 3. Non-negotiable operating model

### 3.1 Clinic topology

Each clinic has:

- One dedicated, always-on Windows mini-PC acting as the **KlickIt Clinic Gateway**
- One encrypted external backup device
- A UPS for the gateway and network equipment
- A preconfigured spare gateway that can be manually activated if the main gateway fails
- Windows workstations running the KlickIt desktop application
- Browser access as a backup
- Local Wi-Fi/LAN access for authorised tablets and phones

### 3.2 Offline behavior

During an internet outage:

- Clinic computers continue working together through the local gateway.
- Phones and tablets connected to clinic Wi-Fi may use KlickIt according to normal permissions.
- WhatsApp sending, WhatsApp inbox synchronization and cloud reports remain unavailable or queued.
- Local clinical, scheduling and billing work continues for up to 72 hours from the last successful cloud synchronization.
- After 72 hours without a successful cloud synchronization, KlickIt becomes **read-only** at that clinic.
- There is no routine administrator bypass after the 72-hour limit.
- The interface must show:
  - last successful cloud sync
  - pending records
  - pending files
  - failed records
  - unresolved conflicts
  - current offline-duration status

### 3.3 Online behavior

When internet returns:

- Synchronization starts automatically.
- Staff are not required to start it manually.
- Failed records remain visible and retryable.
- Cloud and local records are reconciled through idempotent commands, not blind table copying.
- One failed item must not block unrelated items from synchronizing.

---

## 4. Final system architecture

```text
                           INTERNET / CLOUD
+---------------------------------------------------------------------+
| GitHub repository and Actions                                       |
|   - source control, tests, builds, releases                          |
|                                                                     |
| Vercel                                                              |
|   - production web frontend                                         |
|   - preview deployments                                             |
|   - lightweight cloud API adapters where appropriate                |
|                                                                     |
| Supabase                                                            |
|   - cloud PostgreSQL database                                       |
|   - cloud authentication/session support where selected             |
|   - object storage                                                  |
|   - database functions, webhooks and lightweight Edge Functions     |
|   - backup/PITR according to the selected plan                       |
|                                                                     |
| Pabbly Chatflow / Pabbly Connect                                    |
|   - primary WhatsApp inbox                                          |
|   - templates, broadcasts, chat flows and approved automations      |
|   - message webhooks and API calls                                  |
+------------------------------+--------------------------------------+
                               |
                    encrypted HTTPS synchronization
                               |
          +--------------------+--------------------+
          |                                         |
+---------v----------------+             +----------v---------------+
| ROHINI CLINIC GATEWAY    |             | SHALIMAR CLINIC GATEWAY  |
| Windows mini-PC          |             | Windows mini-PC           |
|                          |             |                           |
| Local PostgreSQL         |             | Local PostgreSQL          |
| Local Fastify API        |             | Local Fastify API         |
| Sync Engine              |             | Sync Engine               |
| Local file store         |             | Local file store          |
| Local job runner         |             | Local job runner          |
| Backup service           |             | Backup service            |
| Health/watchdog service  |             | Health/watchdog service   |
| Local web build          |             | Local web build           |
+-----------+--------------+             +------------+--------------+
            | LAN / Wi-Fi                                 | LAN / Wi-Fi
      +-----+------+                                +-----+------+
      | Windows app |                               | Windows app |
      | Browser     |                               | Browser     |
      | Phone/tablet|                               | Phone/tablet|
      +-------------+                               +-------------+
```

### 4.1 Technology choices

#### Shared frontend

- React + TypeScript + Vite
- React Router
- TanStack Query
- React Hook Form and Zod
- TanStack Table and TanStack Virtual
- FullCalendar plus the custom dense resource scheduler
- A single UI codebase built for:
  - Vercel web deployment
  - local clinic web deployment
  - Windows desktop shell

#### Windows application

Preferred approach:

- Tauri-based Windows shell using the same React frontend
- Automatic signed updater
- Local gateway discovery
- Cloud fallback when outside the clinic network
- Clear mode indicator:
  - Local Online
  - Local Offline
  - Cloud Online
  - Read-only Offline Limit

A different Windows shell may be used only if it preserves the same security, update, local-discovery and footprint requirements.

#### Clinic gateway

- Windows service installation
- PostgreSQL 16 or later
- Node.js LTS + TypeScript
- Fastify API
- Typed SQL through Drizzle or Kysely
- Explicit SQL for:
  - row locking
  - numbering
  - financial posting
  - reconciliation
  - sync application
- Local job queue backed by PostgreSQL
- Encrypted local file directory
- Service watchdog and health endpoint

#### Cloud

- Vercel serves the public web build and preview builds.
- Supabase PostgreSQL is the cross-clinic cloud system of record.
- Supabase Storage holds cloud clinical files and generated documents.
- Supabase Edge Functions are used for lightweight webhooks, signed integration endpoints and short-running orchestration.
- Heavy or persistent background work must not be placed in a short-lived serverless function.
- Pabbly Chatflow remains the primary WhatsApp agent inbox for the pilot.

---

## 5. Responsibility of each named tool

| Tool | Approved responsibility | Must not become |
|---|---|---|
| Cursor | AI-assisted coding, refactoring, tests and documentation | An authority allowed to change requirements or deploy unreviewed financial/security code |
| GitHub | Source control, pull requests, issue tracking, Actions, release tags and build artifacts | A storage location for patient data, secrets or production exports |
| Vercel | Web frontend, previews and selected lightweight API adapters | The local offline database, a long-running sync worker or the financial source of truth |
| Supabase | Cloud PostgreSQL, Storage, selected auth, database functions, webhooks and Edge Functions | A substitute for the clinic LAN server |
| Pabbly Connect | Workflow orchestration between approved systems | The master patient database |
| Pabbly Chatflow | WhatsApp inbox, templates, broadcasts, flows and agent operations | The permanent clinical record or financial record |
| Clinic Gateway | Local transactional authority during offline clinic operation | A separate permanent patient universe disconnected from cloud reconciliation |

---

## 6. Recommended repository structure

```text
klickit/
  apps/
    web/                       # React/Vite web application
    desktop/                   # Windows shell and updater
  services/
    local-api/                 # Fastify clinic gateway API
    local-worker/              # local jobs, backups, file processing
    sync-engine/               # push, pull, conflict and cursor logic
    cloud-api/                 # cloud command adapters
  packages/
    domain/                    # shared business rules and state transitions
    permissions/               # role and permission evaluation
    sync-contracts/            # event schemas and idempotency contracts
    ui/                        # reusable dense UI controls
    printing/                  # A4, thermal and label templates
    validation/                # Zod/OpenAPI request contracts
    test-fixtures/             # synthetic clinic fixtures
  supabase/
    migrations/
    functions/
    seed/
  infrastructure/
    local-installer/
    backup/
    monitoring/
  docs/
    blueprint/
      01_database_schema.md
      02_core_workflows_logic.md
      03_billing_and_ledger_math.md
      04_reporting_analytics_queries.md
      05_system_architecture_stack.md
      06_ui_and_menu_hierarchy.md
      07_acceptance_criteria.md
      08_live_screen_parity_audit.md
      09_zero_shortcut_expansion_log.md
      10_klickit_offline_first_roadmap.md
    decisions/
    runbooks/
  tests/
    unit/
    integration/
    sync/
    security/
    financial/
    e2e/
```

### Branch policy

- `main`: production-ready only
- `develop`: integrated test environment
- `feature/*`: one scoped feature
- `release/*`: pilot release candidate
- `hotfix/*`: urgent production corrections

No direct production deployment from an unreviewed Cursor session.

---

## 7. Data ownership and replication

### 7.1 Shared patient identity

One human patient has one global internal UUID.

Visible patient codes use a clinic prefix and calendar-year sequence, for example:

- `ROH-26-000123`
- `SHB-26-000081`

The first registration code remains a visible identifier, but the global UUID is the permanent identity.

### 7.2 Branch-labelled records

The following retain their originating clinic:

- appointments
- encounters
- clinical notes
- treatment plans
- delivered treatment
- prescriptions
- estimates
- bills
- payments
- allocations
- files
- recalls
- messages
- audit entries

### 7.3 Data cached at each clinic

Every clinic gateway stores:

#### Global identity subset

- patient UUID
- patient codes
- name
- date of birth or age data
- gender
- normalized phones
- email
- duplicate-match tokens
- consent summary

#### Cross-clinic safety summary

- allergies
- major medical alerts
- active medicines
- active treatment summary
- last clinical note summary
- date and clinic of last update

This summary is read-only outside the originating clinic when the full record is not available locally.

#### Full local branch data

The clinic stores the complete detailed clinical and financial data originating from that clinic and the files belonging to that clinic.

### 7.4 Online cross-clinic access

When online:

- authorised doctors may view full clinical history across branches;
- financial data from another branch requires the relevant financial permission;
- every cross-branch access is audited.

---

## 8. Synchronization contract

### 8.1 Core principle

Synchronization uses an **application-level transactional outbox/inbox protocol**. It must not use unsupervised “last write wins” replication.

Every locally committed mutation produces:

- immutable event ID
- organization ID
- clinic ID
- device ID
- user ID
- aggregate type and ID
- command name
- idempotency key
- base row version
- resulting row version
- local committed timestamp
- payload schema version
- payload hash
- audit correlation ID
- sync state

### 8.2 Push cycle

1. Local gateway selects unsent outbox items in sequence.
2. Items are sent in bounded batches.
3. Cloud verifies:
   - approved clinic device
   - user and permission snapshot
   - schema version
   - idempotency key
   - aggregate version
   - clinic scope
4. Cloud applies the command in a transaction.
5. Cloud returns one status per item:
   - accepted
   - already applied
   - rejected
   - validation failed
   - permission failed
   - conflict
6. Local gateway records the exact result.
7. Failed items remain visible and retryable.

### 8.3 Pull cycle

1. Gateway sends its last cloud cursor.
2. Cloud returns authorised changes after that cursor.
3. Local gateway applies changes through an inbox table.
4. Duplicate events are ignored by event ID.
5. Cursor advances only after the batch commits.

### 8.4 Conflict policy

- Different fields changed independently: automatically merge.
- Same field changed from the same base version: create a conflict.
- Clinical and financial posted records are never silently overwritten.
- Clinic Admin resolves local conflicts.
- Cross-clinic conflicts may be escalated to Central Super Admin.
- The conflict screen must show:
  - original value
  - Rohini value
  - Shalimar value
  - users
  - devices
  - timestamps
  - related audit history
  - permitted resolution actions

### 8.5 Duplicate patients created while offline

- Never auto-delete either record.
- Detect probable matches using normalized mobile, email, name and date-of-birth signals.
- Place candidates in a duplicate-resolution queue.
- Authorised administrator chooses survivor and merge actions.
- Original IDs remain in immutable merge history.

### 8.6 Appointment collisions

If both clinics create appointments for the same patient while offline:

- preserve both;
- show a warning after sync;
- do not cancel automatically.

### 8.7 Files

- File metadata synchronizes separately from file bytes.
- Upload/download retries are resumable.
- A failed file transfer must not roll back a saved clinical note.
- File hashes verify transfer integrity.
- Local files are encrypted at rest.
- Only the originating clinic’s detailed files are downloaded automatically.

---

## 9. Authentication, devices and permissions

### 9.1 Online login

Online login must verify:

- active user
- active organization
- active clinic membership
- approved role and overrides
- approved device where device approval is required
- current authorization version

### 9.2 Offline login

Offline access is available only when:

- the user has previously authenticated online on that approved clinic device;
- the local credential verifier is still valid;
- the user’s cached permission snapshot is valid;
- the local gateway has not exceeded the 72-hour synchronization limit.

Passwords are never stored in plaintext.

### 9.3 Roles in the pilot

1. Central Super Admin
2. Clinic Admin
3. Doctor
4. Reception
5. Accountant/Cashier
6. Dental Assistant
7. Read-only Auditor

One person may hold multiple roles, but permissions are still evaluated separately.

### 9.4 Discount ceilings

Initial maximum discount:

| Role | Maximum |
|---|---:|
| Reception | 5% |
| Doctor | 10% |
| Clinic Admin | 10% |
| Central Super Admin | 25% |

These values are configuration records, not hard-coded constants.

### 9.5 Remote support

- No permanent support account.
- Central Super Admin creates time-limited access.
- Access has a start time, expiry time and reason.
- Every remote-support action is audited.
- Access is revoked automatically at expiry.

---

## 10. Clinical records

### 10.1 Tooth notation

- FDI two-digit notation is the default.
- Optional alternatives may be enabled later.
- Data must store a canonical tooth identity independent of display notation.

### 10.2 Tooth-wise record

Each tooth entry supports:

- findings
- diagnosis
- advised treatment
- treatment-plan linkage
- treatment status
- clinician
- important dates
- related images
- related estimate/bill lines
- revision and audit history

The first release uses text notes plus tooth-wise entries. A full graphical odontogram is deferred unless separately approved.

### 10.3 Clinical notes

After encounter completion:

- the original note is locked;
- later correction is a signed amendment;
- the earlier note remains visible;
- no administrator can silently rewrite completed clinical history.

### 10.4 Treatment plans

A patient may have multiple plans with:

- phases
- primary alternative
- secondary alternative
- tertiary alternative
- tooth/service lines
- estimated fees
- acceptance status
- acceptance method
- acceptance evidence
- revision history

Acceptance methods:

- staff confirmation
- OTP
- handwritten digital signature
- uploaded signed document

The chosen method is audited.

---

## 11. Prescription contract

### 11.1 Required features

- medicine master
- dosage
- route
- frequency
- duration
- instructions
- reusable templates
- diagnosis links
- allergy warnings
- drug-interaction warnings
- doctor snapshot
- printable A4 prescription

### 11.2 Signing

- Doctor has an uploaded signature image.
- Doctor signs with a separate 4–6 digit signing PIN.
- Only the logged-in doctor linked to the prescription may sign.
- The signature image cannot be applied by reception or admin.
- Signed prescription includes a canonical payload hash.

### 11.3 Corrections

- A signed prescription locks immediately.
- Correction creates a new revision linked to the replaced prescription.
- The earlier prescription remains immutable.
- Printing and WhatsApp sharing use the currently valid revision while preserving history.

---

## 12. Files and compression

### 12.1 Images

Locked decision:

- Images are compressed to an approximate working range of 300–800 KB.
- Only the compressed image is retained after successful validation.
- The uploaded original is deleted after:
  - compression succeeds;
  - output opens successfully;
  - dimensions and orientation are validated;
  - a file hash and compression metadata are stored.

Because originals are intentionally deleted, the pilot must test compression using real categories of dental images before release:

- intraoral photographs
- extraoral photographs
- scanned radiographs
- exported digital radiographs
- consent photographs
- referral images

A warning must be displayed when compression causes dimensions or quality to fall below configured clinical thresholds.

### 12.2 PDFs

- Normal target: 2 MB.
- If a readable PDF cannot remain within 2 MB, store the larger original after warning.
- Do not split or rasterize a document automatically without user confirmation.
- PDFs are scanned for file type and size validity before storage.

### 12.3 Offline availability

- The originating clinic’s images and PDFs are downloaded to its gateway.
- Other clinics receive only authorised summaries unless a user explicitly opens the online record.
- Local file cache is encrypted.

---

## 13. Financial contract for the pilot

### 13.1 Separate financial facts

KlickIt continues to separate:

- issued bill value
- collected money
- money allocated to bill lines
- outstanding balance
- patient advance
- refund
- reversal

### 13.2 Applying payments

Staff may:

- select one or more bills; or
- leave money as unallocated patient advance.

No payment is silently applied without the selected policy.

### 13.3 Numbering

- Separate sequences per clinic
- Separate document type sequences
- Reset every January 1
- Visible example:
  - `ROH/INV/2026/00001`
  - `ROH/RCPT/2026/00001`
  - `SHB/INV/2026/00001`

Internal UUIDs remain permanent.

### 13.4 Offline invoice versus offline payment

#### Bills/invoices

- The clinic gateway may issue a final clinic-specific bill number while offline.
- The local gateway is the only allocator for that clinic/year/type namespace.

#### Payments

- An offline payment is captured as a local pending payment.
- KlickIt prints or shares:
  - **Payment received — final receipt pending synchronization**
- Final receipt posting and final receipt number occur after successful cloud synchronization.
- This prevents the payment acknowledgement from being mistaken for the final posted receipt.

### 13.5 Mixed tenders

One payment may contain multiple methods:

- cash
- UPI
- card
- bank transfer
- cheque
- credit/advance adjustment

Tender components must total the payment exactly.

### 13.6 Multi-doctor allocation

Partial payment is distributed proportionally according to each treatment line’s outstanding value, with authorised manual adjustment.

### 13.7 Refunds

If the requested refund exceeds unallocated value:

- block the refund;
- require sufficient allocation reversal first;
- preserve immutable allocation and reversal history;
- never allow a negative source balance.

### 13.8 Aging

- Use due date when available.
- Otherwise use bill date.
- Default buckets:
  - 0–30
  - 31–60
  - 61–90
  - 91+
- Clinics may configure alternate buckets.

### 13.9 Invoice/receipt layouts

Support separate templates for:

- private patient
- CGHS
- corporate/TPA
- custom fee schedule

Full claim submission remains deferred.

### 13.10 Payment integration

The first pilot records staff-entered payments only.

No payment-gateway confirmation is included.

---

## 14. Printing and document output

The first pilot includes:

- A4 prescription
- A4 estimate
- A4 treatment plan
- A4 invoice
- A4 receipt
- thermal receipt
- consent form
- patient label/sticker
- appointment slip
- CGHS/corporate document layouts

Every printed document records:

- template version
- source record version
- generated time
- generated by
- clinic
- document number where applicable

Posted documents are regenerated from immutable source snapshots.

---

## 15. WhatsApp and Pabbly design

### 15.1 Pilot inbox

- Pabbly Chatflow is the primary staff inbox.
- KlickIt does not rebuild the entire helpdesk in the first release.
- KlickIt may provide:
  - Open in Pabbly action
  - patient-linked communication timeline
  - automation status
  - message metadata and text
  - selected attachment-to-clinical-file action

### 15.2 Data retained in KlickIt

For three years, KlickIt stores:

- patient link
- direction
- message text
- template ID/version
- sender
- assigned agent when available
- timestamps
- provider message ID
- queued/sent/delivered/read/failed status
- consent basis
- automation rule
- audit correlation ID

Media remains in Pabbly unless staff explicitly attaches selected media to the patient’s clinical file.

### 15.3 Automations required

1. New-patient welcome
2. Appointment confirmation
3. Appointment reminder
4. Missed-appointment follow-up
5. Treatment follow-up
6. Recall reminder
7. Payment reminder
8. Birthday message
9. Review request
10. Marketing campaign

### 15.4 Approval and consent

- Approval mode is configurable separately for each automation.
- Consent is tracked by:
  - channel
  - transactional purpose
  - marketing purpose
- Marketing requires separate WhatsApp marketing consent.
- Opt-out suppresses future marketing automatically.
- Transactional communication follows the configured legal/operational consent policy.

### 15.5 Webhook rules

- Verify provider authenticity.
- Deduplicate by provider event ID.
- Never treat a webhook retry as a new message.
- Keep provider failures and retries visible.
- WhatsApp downtime never blocks local clinical work.

---

## 16. Migration from DrKlick

### 16.1 Authorised discovery

Before migration:

1. Request complete export options from DrKlick.
2. Permit time-limited authorised inspection of export functions.
3. Record:
   - available tables/files
   - formats
   - date fields
   - identifiers
   - attachment availability
   - balance calculation
   - missing data
4. Do not use unauthorised private APIs or copy protected implementation details.

### 16.2 Migration stages

#### Stage M1 — required before Rohini pilot

- patient demographics
- mobile numbers
- emails
- patient codes where available
- address
- date of birth/age
- basic categories
- source-system reference

#### Stage M2 — controlled opening data

- manually verified outstanding balances only
- active treatment plans where practical
- source reference and verification user
- imported data marked read-only

#### Stage M3 — later historical import

- treatment plans
- bills and payments
- images/PDFs
- other available history

Imported historical records are read-only. Corrections are entered as new KlickIt adjustments or notes.

### 16.3 If structured export is incomplete

- Import available demographics and files.
- Keep DrKlick available as a read-only historical reference.
- Do not delay all KlickIt development while trying to reconstruct unavailable history manually.

### 16.4 Migration acceptance

- source count
- imported count
- rejected count
- duplicate count
- verified opening-balance total
- file count and hash checks
- random sample verification
- signed migration report

---

## 17. Backup and recovery

### 17.1 Clinic backup

Each gateway creates:

- encrypted daily backup to an external USB/SSD/HDD/NAS device;
- local backup manifest;
- checksum verification;
- retention rotation;
- restore-test record.

An external SSD is preferred, but the design remains device-agnostic.

### 17.2 Cloud backup

Use the selected Supabase plan’s backup and recovery features. Confirm the actual retention and PITR terms before production purchase.

### 17.3 Spare gateway activation

The spare device contains:

- approved installer
- matching KlickIt version
- database restore tools
- encrypted configuration bundle
- activation runbook

Manual activation requires Central Super Admin approval and creates an incident record.

### 17.4 Required recovery drills

- gateway database restore
- file restore
- external backup failure
- accidental user deletion/reversal
- interrupted synchronization
- lost device
- corrupted local cache
- cloud unavailable while clinic remains operational

---

## 18. Development roadmap

No phase is complete because screens “look finished.” Each phase closes only after its database, API, permissions, audit, offline behavior, tests and evidence pass.

### Phase 0 — Contract consolidation and product rename

Deliver:

- replace shipping product terminology with KlickIt;
- keep first-party clean-room wording;
- incorporate decisions from this addendum into documents 01–09;
- close the six provisional financial policies for the pilot;
- create decision records;
- freeze scope.

Gate:

- no unresolved pilot financial rule;
- no contradictory route, schema or UAT contract;
- terminology scan passes.

### Phase 1 — Repository, environments and CI

Deliver:

- monorepo
- TypeScript configuration
- linting and formatting
- unit-test runner
- integration-test environment
- migration runner
- synthetic data seed
- GitHub Actions
- Vercel preview deployment
- Supabase development project
- secret-management rules

Gate:

- clean clone builds;
- migrations apply to empty databases;
- tests run automatically;
- no secret committed.

### Phase 2 — Cloud foundation

Deliver:

- organizations and clinics
- staff/users/roles/permissions
- audit
- idempotency
- cloud PostgreSQL
- storage buckets and RLS
- cloud command API
- webhook endpoints
- number-policy configuration

Gate:

- allow/deny tests;
- cross-clinic scope tests;
- audit evidence;
- backup configuration documented.

### Phase 3 — Local gateway and desktop foundation

Deliver:

- Windows gateway installer
- local PostgreSQL
- local Fastify API
- local frontend
- desktop shell
- LAN discovery
- service watchdog
- automatic updater
- gateway/device registration
- health dashboard

Gate:

- clinic works with internet disconnected;
- two workstations share live LAN data;
- phone/tablet works through clinic Wi-Fi;
- gateway restart does not lose committed data.

### Phase 4 — Synchronization skeleton

Deliver:

- outbox
- inbox
- cursor
- push/pull endpoints
- idempotency
- retries
- event signatures/hashes
- sync dashboard
- 72-hour read-only enforcement
- schema-version compatibility

Gate:

- replay same batch without duplication;
- interrupted batch resumes;
- rejected item does not block unrelated items;
- two clinics synchronize synthetic records.

### Phase 5 — Identity, offline login and permissions

Deliver:

- approved devices
- cached offline verifier
- cached permission snapshot
- role screens
- clinic switching
- signing PIN
- remote-support access
- authorization-version invalidation

Gate:

- disabled user denied after sync;
- unapproved device denied;
- offline login works for previously approved user;
- high-risk route denied by direct request.

### Phase 6 — Patient registry and migration foundation

Deliver:

- patient registration
- search
- duplicate warning
- global UUID
- visible patient code
- medical data
- consent
- import staging
- merge queue
- cross-clinic safety summary

Gate:

- duplicate registration tests;
- offline dual-clinic duplicate test;
- 5,000-patient migration performance fixture;
- sensitive fields excluded from logs.

### Phase 7 — Scheduler and Clinical Queue

Deliver:

- clinician/chair availability
- appointment creation
- status history
- reschedule/cancel
- walk-in
- queue state machine
- same-clinic live refresh
- offline appointment collision warning

Gate:

- chair/doctor conflict tests;
- offline LAN simultaneous use;
- cross-clinic collision preserved and warned.

### Phase 8 — Clinical notes and tooth-wise records

Deliver:

- encounter workspace
- tooth notation
- findings/diagnosis
- treatment entry
- clinical note
- completed-note lock
- signed amendments
- related images

Gate:

- completed note cannot be overwritten;
- amendment preserves earlier content;
- cross-clinic read permissions pass.

### Phase 9 — Treatment plans, estimates and acceptance

Deliver:

- plan phases
- alternatives
- tooth/service lines
- estimates
- acceptance methods
- signature/OTP/staff confirmation
- audit trail
- treatment-to-billing suggestions

Gate:

- plan revision history;
- acceptance evidence;
- no silent replacement of accepted plan.

### Phase 10 — Prescription module

Deliver:

- medicine master
- templates
- allergy/interaction checks
- doctor-only signing
- signature image
- signing PIN
- immutable signed prescription
- revision workflow
- A4 print

Gate:

- staff cannot use doctor signature;
- signed prescription cannot be edited;
- revision links and hashes pass.

### Phase 11 — Files and compression

Deliver:

- image upload
- 300–800 KB processing policy
- output validation
- original deletion after validation
- PDF target/warning policy
- encrypted local cache
- storage upload/download queue
- integrity hashes

Gate:

- dental-image quality sample accepted;
- failed processing retains recoverable upload until transaction resolves;
- file sync retries safely.

### Phase 12 — Financial operations

Deliver:

- estimate/bill linkage
- invoice issue
- January 1 clinic sequences
- local offline invoice allocation
- payments
- split tenders
- patient advance
- allocation
- proportional clinician distribution
- discounts
- refunds/reversals
- aging
- opening balances
- document layouts

Gate:

- all monetary totals reconcile to INR 0.00;
- duplicate command replay creates one result;
- offline invoice sequence remains unique;
- offline payment creates temporary acknowledgement only;
- final receipt appears once after sync.

### Phase 13 — Recall and WhatsApp integration

Deliver:

- recall rules
- follow-up tasks
- consent
- all ten automation events
- per-automation approval
- Pabbly webhook integration
- message timeline
- three-year retention
- attach selected media to patient file

Gate:

- opt-out suppression;
- webhook deduplication;
- provider downtime does not block clinic;
- retries do not duplicate messages.

### Phase 14 — Printing and hardware workflows

Deliver:

- A4 templates
- thermal receipt
- labels
- appointment slip
- consent
- CGHS/corporate layouts
- printer settings
- template versioning

Gate:

- source values match print;
- reprint retains original number/version;
- permission and audit tests pass.

### Phase 15 — Rohini pilot readiness

Deliver:

- DrKlick demographic import
- manually verified opening balances where available
- hardware installation
- external backup
- staff accounts
- training fixture
- pilot runbook
- downtime runbook
- issue logging
- rollback plan

Gate:

- full UAT with synthetic data;
- restore drill;
- 72-hour offline simulation;
- sync conflict drill;
- no Severity 1 or 2 defect;
- user sign-off.

### Phase 16 — Rohini controlled go-live

Operate:

- KlickIt for new activity
- DrKlick as historical reference
- daily reconciliation
- daily backup verification
- sync dashboard review
- issue triage
- migration exceptions log

Exit gate:

- stable financial reconciliation;
- no unresolved data-loss defect;
- staff completes core workflow without developer intervention;
- approved pilot report.

### Phase 17 — Shalimar deployment

Deliver:

- second gateway
- clinic configuration
- staff/device registration
- branch-specific numbering
- safety-summary replication
- cross-clinic conflict UAT
- backup and restore drill

Gate:

- both clinics operate concurrently;
- offline changes synchronize;
- patient identity remains single;
- branch financial segregation passes.

### Phase 18 — Post-pilot roadmap

Only after the two-clinic core is stable:

1. inventory
2. laboratory
3. advanced analytics
4. full CGHS claims
5. patient portal
6. richer built-in communications
7. native mobile application
8. sale to external clinics
9. tenant onboarding and subscription billing
10. automatic local failover

---

## 19. Minimum acceptance scenarios

The complete acceptance suite in document 07 remains required. Add these KlickIt-specific scenarios.

### OFF-001 — Two-computer offline clinic

- Disconnect internet.
- Register a patient on workstation 1.
- Open patient immediately on workstation 2.
- Create appointment and clinical note.
- Verify one shared local state.

### OFF-002 — Mobile on local Wi-Fi

- Disconnect internet.
- Open KlickIt from approved tablet on clinic Wi-Fi.
- Verify permissions and local data.
- Verify no cloud-only function falsely appears successful.

### OFF-003 — 72-hour limit

- Move synthetic clock beyond 72 hours from last successful sync.
- Verify every mutation is blocked.
- Verify read-only clinical access remains.
- Restore connectivity and verify access reopens only after successful sync.

### SYNC-001 — Idempotent replay

- Submit identical event batch repeatedly.
- Verify one domain mutation, one document number and one audit result.

### SYNC-002 — Same-field conflict

- Both clinics edit the same patient field from the same base version.
- Verify conflict queue and no silent overwrite.

### SYNC-003 — Different-field merge

- One clinic edits email and the other edits address.
- Verify automatic merge and complete history.

### SYNC-004 — Offline duplicate patient

- Register matching patient at both clinics offline.
- Verify candidate queue and authorised merge.

### FIN-OFF-001 — Offline invoice

- Issue multiple invoices concurrently on two clinic workstations.
- Verify unique monotonic clinic/year numbers.

### FIN-OFF-002 — Offline payment

- Record payment offline.
- Verify temporary acknowledgement.
- Synchronize.
- Verify one posted payment and one final receipt.

### FILE-001 — Image compression

- Test each approved dental-image category.
- Verify output size policy, orientation, readable dimensions, hash and deletion of original only after validation.

### BCP-001 — Gateway replacement

- Stop primary gateway.
- Restore latest approved backup to spare.
- Activate spare using runbook.
- Verify data and audit continuity.

---

## 20. Required edits to documents 01–09

### Document 01 — Database schema

Add or update:

- clinic gateways
- approved devices
- offline credential snapshots
- sync events/outbox/inbox
- sync cursors
- sync conflicts
- conflict resolutions
- source device and source clinic fields
- cross-clinic safety summary
- file-transfer state
- local pending payments
- temporary payment acknowledgements
- signing PIN metadata
- remote-support grants
- migration batches and source references
- January-reset clinic number policies

### Document 02 — Core workflows

Add:

- local/online mode resolution
- offline login
- 72-hour read-only transition
- sync push/pull
- conflict resolution
- gateway replacement
- offline payment workflow
- automatic reconnection
- Pabbly inbound/outbound workflow
- image compression/deletion workflow
- migration workflow

### Document 03 — Financial mathematics

Close pilot decisions:

- manual allocation or leave as advance
- clinic/type/calendar-year numbering
- due-date aging fallback to bill date
- proportional multi-doctor distribution
- refund blocked until sufficient deallocation
- split-tender receipt model

Also separate offline final invoice behavior from offline temporary payment acknowledgement.

### Document 04 — Analytics

For the pilot:

- keep advanced report leaves disabled;
- add only operational reports needed for reconciliation:
  - daily patients
  - appointments
  - encounters
  - issued invoices
  - pending payments
  - posted receipts
  - patient advances
  - outstanding balances
  - sync failures
  - unresolved conflicts
  - message failures

### Document 05 — Architecture

Replace the cloud-only topology with the cloud-plus-clinic-gateway topology in this document.

Add:

- local deployment
- desktop shell
- local API
- sync engine
- local backup
- device approval
- gateway health
- read-only timeout
- spare activation

### Document 06 — UI

Add persistent indicators:

- active clinic
- Local/Cloud mode
- online/offline state
- last sync
- pending count
- failed count
- conflict count
- read-only timeout
- Open in Pabbly
- gateway health

### Document 07 — Acceptance criteria

Add all `OFF-*`, `SYNC-*`, `FIN-OFF-*`, `FILE-*` and `BCP-*` tests above.

### Document 08 — Independence audit

Add:

- no copied DrKlick UI/code/private API;
- authorised migration evidence;
- offline package hash;
- local/cloud schema compatibility;
- gateway release certificate.

### Document 09 — Coverage log

Extend the coverage matrix for:

- gateway routes
- sync commands
- device permissions
- offline controls
- conflict workflows
- file-processing jobs
- migration jobs
- backup/restore evidence

---

## 21. Hardware baseline

Recommended per active clinic:

- Windows 11 Pro mini-PC
- modern 4-core or better processor
- 16 GB RAM
- 512 GB SSD minimum
- Gigabit Ethernet
- reliable Wi-Fi/LAN router
- UPS
- encrypted external backup device

Also maintain one preconfigured spare gateway.

Hardware is outside the under-₹50,000 development/software budget.

---

## 22. Paid-service policy

- Compare alternatives before adding any paid subscription.
- Obtain user approval before purchase.
- Free tier is not automatically preferred if it weakens reliability or recovery.
- Record:
  - purpose
  - monthly cost
  - data stored
  - exit/export method
  - backup responsibility
  - effect if subscription stops

---

## 23. Cursor implementation rules

1. Give Cursor one phase or one bounded module at a time.
2. Every prompt must name:
   - source contract
   - allowed files
   - prohibited scope
   - database migration
   - API contract
   - permissions
   - audit
   - tests
   - acceptance evidence
3. Cursor must not:
   - invent financial behavior;
   - remove a test to make a build pass;
   - store secrets in code;
   - bypass server permission checks;
   - use browser-only validation as security;
   - implement last-write-wins clinical sync;
   - silently compress/delete files before validation;
   - directly edit signed prescriptions or completed clinical notes.
4. A phase is merged only after:
   - tests pass;
   - migrations are reviewed;
   - security checks pass;
   - synthetic UAT evidence is recorded.
5. Keep a human-readable change log after every phase.

---

## 24. Definition of pilot success

The Rohini pilot is successful only when:

- clinic remains operational through a simulated internet outage;
- two computers share the same local data;
- the system becomes read-only after 72 hours without sync;
- synchronization resumes without duplicates;
- patient identity remains unique;
- clinical history is immutable where required;
- signed prescriptions are revision-controlled;
- invoices, payments, advances, refunds and balances reconcile;
- offline payments create temporary acknowledgements and one final receipt after sync;
- Pabbly automations respect consent and do not duplicate;
- backup restoration is proven;
- no unresolved Severity 1 or Severity 2 defect remains;
- staff can complete daily workflows without developer assistance.

---

## 25. Final architectural conclusion

KlickIt must be built as three coordinated products sharing one domain contract:

1. **KlickIt Web** — Vercel-hosted browser application
2. **KlickIt Desktop** — installed Windows application
3. **KlickIt Clinic Gateway** — local database, API, file store and sync engine

Supabase is the cross-clinic cloud system of record, but the clinic gateway is the operational authority while a clinic is offline. Pabbly is the WhatsApp communication platform, not the patient or financial source of truth.

This architecture satisfies the frozen requirement for:

- multiple clinics;
- full clinic LAN operation during internet failure;
- Windows and browser access;
- branch-labelled clinical and financial records;
- automated synchronization;
- auditable conflict resolution;
- a Rohini-first pilot;
- later reuse by other dental practices.
