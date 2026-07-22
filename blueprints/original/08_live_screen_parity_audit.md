<!-- LEGAL REVIEW: confirm original wording throughout this file is not derived from any protected material before shipping -->

# 08 Project DentOS Functional Workflow and Design Independence Audit

## Scope and Basis

This document describes required functionality and functional parity with the observed workflow. It does not license, reproduce, or authorize copying any third-party text, visual design, source code, private API, database identifier, asset, or tenant data. In this document, `the reference product` means only the prior system whose externally observable behavior informed clean-room requirements. Every Project DentOS navigation label, field label, command label, screen composition, route, class name, and implementation identifier must be original and approved through legal and product review before shipping.

Evidence labels are stable release metadata:

| Label | Meaning | Release treatment |
|---|---|---|
| `CONFIRMED` | Functionality reproduced with an authorized synthetic fixture or verified against a first-party DentOS acceptance artifact. | May ship when its implementation and UAT pass. |
| `TARGET` | Original DentOS product behavior selected for implementation but not yet proven by a release artifact. | May be implemented, but cannot be called verified until its named UAT passes. |
| `REQUIRED` | Mandatory behavior imposed by clinical safety, financial integrity, security, privacy, or product policy. | Release fails when absent or bypassable. |
| `EXTENSION` | Optional original DentOS capability outside the currently selected phase. | Disabled by default until its feature flag and UAT pass. |
| `UNRESOLVED` | A decision whose observed behavior or business policy is not yet sufficiently validated. | Its dependent production path is blocked; documented assumptions remain provisional only. |

## 1. Purpose

This document certifies that the Project DentOS blueprint is governed by first-party requirements, DentOS-owned terminology, independent interaction design, and independently specified data contracts. It is a release-control document for architecture, product design, security, clinical safety, financial integrity, analytics, and quality assurance.

The authoritative inputs are:

1. The PostgreSQL contract in document 01.
2. The command and worker contracts in document 02.
3. The financial invariants in document 03.
4. The report catalog and SQL definitions in document 04.
5. The application and deployment boundaries in document 05.
6. The DentOS interaction specification and atomic control registry in document 06.
7. The synthetic-fixture acceptance suite in document 07.

No external product name, host name, route, controller, selector, asset, screenshot, database identifier, source fragment, or private implementation detail is an implementation input to Project DentOS. Authorized observations may establish behavior only; original DentOS wording and presentation remain mandatory.

## 2. Ownership Boundary

| Artifact family | Project DentOS authority | Required evidence |
|---|---|---|
| Product terms | Domain glossary in this document | terminology scan with zero prohibited results |
| Navigation | document 06 global navigation contract | route snapshot and keyboard traversal test |
| Form composition | document 06 form geometry and control registry | desktop and laptop design captures |
| Database model | document 01 DDL | migration test against empty PostgreSQL database |
| Domain behavior | document 02 transitions and conditional programs | command integration tests and audit rows |
| Financial behavior | document 03 formulas and posting rules | cent-level reconciliation fixture |
| Analytics | document 04 report SQL and parameter contracts | source-to-grid-to-export reconciliation |
| Security | documents 01, 05, 06, and 07 | denied-route, denied-field, and audit tests |
| Clinical safety | documents 01, 02, 05, and 07 | allergy, interaction, signature, and immutable-history tests |
| Operations | documents 02 and 05 | idempotent worker and recovery tests |

## 3. DentOS Domain Glossary

The following terms are canonical in user interfaces, APIs, events, documentation, logs, and exported metadata.

| Concept | DentOS term | Database aggregate | Primary UI location |
|---|---|---|---|
| Operational overview | Dashboard | read projections | `Dashboard` |
| Arrival and chair flow | Clinical Queue | `care_encounters` | `Clinical Queue` |
| Future reserved care | Care Booking | `care_bookings` | `Scheduler` |
| Patient directory | Patient Registry | `patients` | `Patient Registry` |
| Clinic resources | Practice Assets | inventory, laboratory, suppliers, expenses | `Practice Assets` |
| Patient outreach | Comms Center | messages, templates, consent, delivery attempts | `Comms Center` |
| Assessed clinical value | Fee Statement | `fee_statements` | `Financial Operations` |
| Money received | Collection Receipt | `collection_receipts` | `Financial Operations` |
| Settlement against assessed value | Fee Allocation | `fee_allocations` | `Financial Operations` |
| Proposed staged care | Care Plan | `care_plans` | patient `Care Plan` |
| Consultation intent classification | Intent Tier | `patients`, `patient_intent_tier_events` | patient `Patient Details` |
| Advised decision cohort | Clinical Case | `clinical_cases`, `case_consultations` | patient `Active Cases` |
| Main consultation ownership | Primary Consult Doctor | `case_consultations.primary_consult_clinician_id` | clinical-case consultation header |
| Independent specialist review | Secondary Review Doctor | `case_consultations.secondary_review_clinician_id` | clinical-case consultation header |
| Prioritized care presentation | Treatment Bundle | `treatment_bundles`, `treatment_bundle_services` | patient `Care Plan` treatment presentation |
| Delivered clinical service | Care Delivery | `care_deliveries` | patient `Delivered Care` |
| Medication instruction record | Medication Order | `medication_orders` | patient `Medication Orders` |
| Reusable medication composition | Medication Protocol | `medication_protocols` | `Medication Studio` |
| Recall or post-care action | Continuity Task | `continuity_tasks` | patient `Care Overview` |
| Reports and analysis | Deep Analytics | `dentos_analytics` views | `Deep Analytics` |
| Administrative masters | System Configuration | typed master tables | `System Configuration` |

## 4. Navigation Fingerprint

The first-level navigation sequence is fixed:

```text
Dashboard | Clinical Queue | Scheduler | Patient Registry | Practice Assets |
Comms Center | Financial Operations | Deep Analytics | System Configuration
```

The route sequence is fixed:

```text
/dashboard
/clinical-queue
/scheduler
/patient-registry
/practice-assets
/comms-center
/financial-operations
/deep-analytics
/system-configuration
```

The navigation implementation passes only when all conditions below are true:

1. The visible order equals the declared order.
2. The active route has a text, icon, and focus-state treatment that does not rely on color alone.
3. Permission removal hides inaccessible destinations and direct navigation returns HTTP 403.
4. Clinic context and operational date survive route changes.
5. Browser back and forward restore filters, selected row, patient context, and scroll position.
6. At 1024 pixels wide the two navigation rows remain legible without text collision.
7. At 1440 pixels wide the primary content begins below the shell and no heading overlaps the toolbar.

## 5. Form Composition Fingerprints

### 5.1 Patient registration

The registration grid uses this sequence:

| Row | Position 1 | Position 2 | Position 3 | Position 4 | Position 5 |
|---|---|---|---|---|---|
| 1 | Mobile Number | Given Name | Family Name | Patient ID | unused |
| 2 | Intent Tier | Intent Reason | Intent Note | unused | unused |
| 3 | Preferred Name | Honorific | Birth Date | Gender Identity | Lead Clinician |
| 4 | Email | Alternate Phone | Communication Language | Welcome Consent | unused |
| 5 | Postal Code | City | Locality | Street Address | unused |
| 6 | Identity Type | Identity Number | Acquisition Channel | Referred By | unused |
| 7 | Patient Segment | Fee Profile | Occupation | Emergency Contact | unused |
| 8 | Registration Notes spanning full width | unused | unused | unused | unused |

Footer order is `Save Profile`, `Save and Create Booking`, `Save and Start Encounter`, `Discard`.

### 5.2 Care booking

The resource-first booking grid uses this sequence:

| Row | Position 1 | Position 2 | Position 3 | Position 4 | Position 5 |
|---|---|---|---|---|---|
| 1 | Scheduled Date | Start Time | Duration | Operatory | Lead Clinician |
| 2 | Consultation Objective | Care Priority | Booking Source | Coordination Notes | unused |
| 3 | Patient Mode | Patient Lookup | Mobile Preview | Consent State | unused |
| 4 | Patient SMS | Patient WhatsApp | Clinician Alert | unused | unused |

New-patient mode inserts `Mobile Number`, `Given Name`, `Family Name`, `Birth Date`, `Gender Identity`, and `Email` between rows 3 and 4. Footer order is `Save Booking`, `Save and Add to Clinical Queue`, `Discard`.

### 5.3 Clinical Queue unscheduled encounter

The queue-first encounter sheet uses this sequence:

| Row | Position 1 | Position 2 | Position 3 | Position 4 |
|---|---|---|---|---|
| 1 | Operational Date | Queue State | Care Stream | Lead Clinician |
| 2 | Patient Mode | Patient Lookup | Mobile Preview | Alert Summary |
| 3 | Consultation Objective | Care Priority | Operatory | Coordination Notes |

Footer order is `Admit to Queue`, `Admit and Open Encounter`, `Discard`.

### 5.4 Medication order

The medication-order workspace contains one encounter-scoped record with:

1. Diagnosis selection from `diagnosis_catalog`.
2. Suggested service selection from `service_catalog` joined to `service_domains`.
3. Protocol recommendations from diagnosis and service mappings.
4. Medication lines from `medication_catalog` and `administration_patterns`.
5. Allergy and ingredient checks before save.
6. `Save Order` for the base workflow.
7. `Save and Sign` only when signing is enabled and the actor has `medication_order.sign`.

The measured fast path is diagnosis selection, recommended protocol selection, medication review, instruction review, and save. Type-ahead response time must remain below 300 milliseconds at the 95th percentile for a 50,000-row medication catalog.

## 6. Patient Workspace Fingerprint

Patient tabs use this exact sequence:

```text
Care Overview | Activity Stream | Odontogram | Diagnostics | Care Plan |
Delivered Care | Clinical Notes | Medication Orders | Fee Statements |
Collections | Lab Cases | Files | Communications
```

Each route carries the stable patient identifier. Switching tabs does not issue a patient search, alter the active patient, reset the clinic, or discard a valid unsaved draft without confirmation.

## 7. System Configuration Fingerprint

The desktop workspace uses a 40 percent left pane and a 60 percent right pane.

| Left pane | Right pane |
|---|---|
| Practice Identity | Workforce and Access |
| organization identity | staff registry |
| clinic locations | clinician profiles |
| hours and holidays | account creation and linkage |
| operatories | clinic memberships |
| contact channels | role assignment |
| tax registrations | permission overrides |
| locale and timezone | account disable, unlock, and credential reset |

The System Configuration navigator uses this group order:

1. Practice Identity.
2. Care Delivery Masters.
3. Patient Data Masters.
4. Clinical Safety.
5. Medication Studio.
6. Clinical Documentation.
7. Communications.
8. Financial Masters.
9. Practice Assets.
10. Document Output.
11. Security and Governance.
12. Numbering Policies.
13. Data Operations.

Each child control is individually named in the atomic control registry in document 06. A group may collapse visually, but no child contract may be omitted from implementation, authorization, keyboard traversal, or acceptance coverage.

## 8. Data-Naming Independence

### 8.1 PostgreSQL namespaces

| Namespace | Ownership |
|---|---|
| `dentos_data` | transactional and master data |
| `dentos_runtime` | trigger functions, audit helpers, session context, invariant functions |
| `dentos_analytics` | governed facts and report views |

### 8.2 Proprietary lifecycle types

| Type | Allowed values |
|---|---|
| `care_booking_state` | scheduled, confirmed, arrived, completed, cancelled, no_show |
| `encounter_flow_state` | waiting, checked_in, engaged, checked_out, cancelled |
| `care_delivery_state` | planned, in_progress, completed, cancelled |
| `continuity_task_state` | scheduled, due, contacted, booked, completed, snoozed, cancelled |
| `medication_protocol_state` | draft, active, retired |
| `medication_order_state` | draft, saved, signed, void |
| `fee_statement_state` | draft, issued, part_paid, paid, void |
| `collection_receipt_state` | active, part_refunded, refunded, void |
| `fee_allocation_state` | active, reversed |
| `intent_tier` | one_star_do_not_treat, two_star_budget_friction, three_star_high_intent_friction |
| `case_execution_state` | not_started, minor_issue_treated_same_day, no_treatment_needed, treatment_started |
| `treatment_bundle_tier` | primary, secondary, tertiary |
| `treatment_bundle_state` | advised, accepted, declined, scheduled, in_progress, completed, cancelled |

### 8.3 Governed analytic views

| View | Grain | Purpose |
|---|---|---|
| `dentos_analytics.v_clinical_value_line_fact` | one issued fee statement line | clinician production and service-domain value |
| `dentos_analytics.v_allocated_collection_line_fact` | one allocation-line-tender intersection | clinician and service-domain settled collection |
| `dentos_analytics.v_booking_outcome_fact` | one care booking in its final current state | cancellation and no-show analysis |
| `dentos_analytics.v_orthodontic_adherence_fact` | one orthodontic program enrollment | monthly adherence and reliability analysis |
| `dentos_analytics.v_case_conversion_fact` | one clinical case with finalized initial-consultation ownership | intent pipeline and doctor conversion denominators |
| `dentos_analytics.v_case_bundle_domain_fact` | one case, treatment bundle tier, and service domain | category consultation, high-value conversion, cross-tier, and pending-priority analysis |

## 9. API and Event Independence

API resources use hyphenated DentOS nouns:

```text
/api/care-bookings
/api/care-encounters
/api/care-deliveries
/api/care-plans
/api/clinical-cases
/api/treatment-bundles
/api/medication-orders
/api/fee-statements
/api/collection-receipts
/api/fee-allocations
/api/collection-refunds
/api/deep-analytics
/api/system-configuration
```

Event families use stable DentOS identifiers:

```text
care_booking.created
care_booking.rescheduled
care_booking.cancelled
care_booking.no_show_recorded
care_encounter.created
care_encounter.state_changed
care_delivery.completed
continuity_task.created
medication_order.saved
medication_order.signed
fee_statement.issued
collection_receipt.created
fee_allocation.created
fee_allocation.reversed
patient.intent_tier.changed
clinical_case.created
case_consultation.finalized
treatment_bundle.changed
clinical_case.state_changed
collection_refund.posted
communication.delivery_updated
security.capabilities_changed
```

Every event includes `event_id`, `occurred_at`, `organization_id`, `clinic_id`, `actor_user_id`, `aggregate_type`, `aggregate_id`, `aggregate_version`, `correlation_id`, and a schema-versioned payload. Sensitive identity values, medication free text, message bodies, credentials, and authentication secrets are excluded from observability payloads.

## 10. Financial Independence and Reconciliation

The financial model has three non-interchangeable facts:

```text
assessed_value = sum(issued fee_statement_lines.line_total)
money_received = sum(active collection_tenders.amount)
settled_value = sum(active fee_allocations.amount)
```

The following identities must hold:

```text
fee_statement_due = issued_total - active_allocations - active_credits - active_reliefs
collection_available = tender_total - posted_refunds
collection_unallocated = collection_available - active_allocations
patient_net_position = total_fee_statement_due - total_collection_unallocated
```

An unallocated collection never reduces a specific fee statement. A fee allocation cannot exceed both the source collection’s available amount and the destination fee statement’s outstanding amount. Reversal retains the original allocation and restores both balances on the reversal date.

## 10A. Unresolved Financial Decisions

Each row below is `UNRESOLVED`. The stated assumption exists only to keep schemas, algorithms, and fixtures concrete; it is not approved production behavior. Dependent code must remain disabled until the named decision test passes against the synthetic fixture in document 07 and the approved result is recorded in a versioned decision record.

| Stable ID | Decision requiring validation | Provisional assumption retained in the specifications | Blocked production surface | Resolving test |
|---|---|---|---|---|
| `UNRESOLVED-01` | Automatic fee-allocation policy | New Collections remain unapplied unless an authorized user explicitly allocates them; if automation is later enabled, its eligible Fee Statements, priority order, partial-allocation rule, and retry behavior are clinic-versioned. | automatic settlement command, checkout automation, unsettled-register classification | `FIN-DEC-01` |
| `UNRESOLVED-02` | Document-number scope and rollover | A number series is clinic- and document-type-scoped; period modes use clinic-local calendar boundaries; issued or reserved numbers are never reused after reset, rollback, or void. | patient, case, Fee Statement, Collection, refund, laboratory, expense, and stock serial allocation | `FIN-DEC-02` |
| `UNRESOLVED-03` | Open Fee Exposure aging policy | Aging starts at `coalesce(due_date, statement_date)`; as-of effects use event dates; buckets are `0-30`, `31-60`, `61-90`, and `90+`, where `90+` means more than 90 days. | Due Fee Statements, patient-balance aging, clinician-split aging, exports | `FIN-DEC-03` |
| `UNRESOLVED-04` | Applied-collection attribution on multi-clinician Fee Statements | An application is distributed across outstanding Fee Statement lines proportionally, rounded by largest remainder, then attributed to each line's immutable clinician and service-domain snapshots. | clinician allocation, service-domain allocation, clinician share, conversion matrices | `FIN-DEC-04` |
| `UNRESOLVED-05` | Refund treatment when Collections are already allocated | Refundable value excludes active allocations; staff must reverse or reallocate settlement before refund unless a separately approved negative-receivable adjustment policy is selected. | refund command, refund journal, net-collection reporting, open exposure restoration | `FIN-DEC-05` |
| `UNRESOLVED-06` | Single-method versus split-tender Collection entry | Core entry creates one Collection per method; the split-tender extension remains disabled until tender allocation, mode reporting, and refund lineage are validated. | Collection entry, tender allocation, cashier/mode pivots, refund tender selection | `FIN-DEC-06` |

No `UNRESOLVED` row may be closed by merely retaining its provisional assumption. Closure requires the named test, finance and product approval, decision-record version, effective date, migration impact assessment, and removal or update of every matching blocker marker in documents 02, 03, and 04.

## 11. Analytics Independence

Every report leaf in document 04 has its own:

1. Stable report key.
2. Menu domain and display title.
3. Permission code.
4. Parameter schema.
5. Authoritative business date.
6. Source grain.
7. Explicit joins.
8. SQL query.
9. Ordered grid columns.
10. Footer formulas.
11. Drill-down identifiers.
12. Export behavior.
13. Acceptance case in document 07.

The report service rejects unregistered query text, unknown columns, unbounded exports, unauthorized clinics, stale materialized projections, and mismatched query versions. Grid, print, PDF, and spreadsheet renderers consume the same result contract.

The `Conversion Intelligence` category is a DentOS-owned analytic fingerprint with six contracts: Monthly Total Category Consultations, High-Intent Pipeline Bottleneck, Doctor-Wise Clinical Conversion Ratios, High-Value Category Conversions, Cross-Tier Matrix Generator, and Pending Priority Treatment Registers. Their source grains, role attribution, intent-tier basis, treatment-bundle hierarchy, applied-payment evidence, dynamic grouping behavior, and selected-month behavior are declared in document 04 and tested in document 07.

## 12. Security Independence

Authorization uses stable granular permission codes. Effective access is resolved in this order:

```text
explicit deny
explicit allow within delegation ceiling
role grant
default deny
```

Every request performs authentication, active-account validation, active clinic-membership validation, route-permission validation, row-scope validation, state-transition validation, row-version validation, and audit emission. Hiding a control is a usability behavior; the server guard is the security boundary.

Credential secrets are hashed with Argon2id. Government identity values and provider secrets are encrypted with independently rotated keys. Signed medication orders, issued fee statements, posted collection receipts, fee allocations, refunds, finalized consultations, patient intent-tier events, clinical-case state events, and audit events are immutable; corrections use a named superseding, reversal, or authorized state-correction command.

## 13. Independence Scan Rules

The release scan checks every Markdown line and fails on:

1. Any external product name or host name.
2. Any captured foreign controller, route, selector, model, or framework identifier.
3. Any prohibited shorthand phrase configured in the validator.
4. An ASCII ellipsis.
5. A missing or unbalanced fenced code block.
6. A legacy top-navigation sequence.
7. A legacy screen label declared as a primary DentOS destination.
8. A schema relation referenced without a declaration or governed analytic-view exemption.
9. A foreign key whose source column is absent.
10. A mutable domain table without its audit trigger.
11. A report leaf without SQL and a matching acceptance case.
12. An atomic control without a matching acceptance case.
13. A permission without a matching denied-route test.
14. A worker without idempotency, retry, dead-letter, and acceptance coverage.

## 14. Release Certificate

The suite may be marked `DESIGN-INDEPENDENT` only when all rows below pass.

| Gate | Pass condition | Evidence owner |
|---|---|---|
| DI-001 terminology | prohibited-reference scan returns zero matches | architecture |
| DI-002 navigation | nine destinations and routes match sections 4 and 9 | product design |
| DI-003 forms | registration, booking, queue, and medication-order fingerprints pass | product design |
| DI-004 schema | DDL parser validates tables, columns, foreign keys, indexes, and triggers | data engineering |
| DI-005 lifecycle | command tests validate every declared state edge | backend engineering |
| DI-006 finance | financial fixture reconciles to INR 0.00 | finance QA |
| DI-007 analytics | all registered report leaves reconcile across output formats | analytics QA |
| DI-008 security | every permission has allow and deny evidence | security QA |
| DI-009 workers | every worker passes idempotency, retry, and dead-letter tests | platform engineering |
| DI-010 controls | every atomic control has geometry, permission, validation, action, and UAT | frontend QA |
| DI-011 privacy | logs, exports, and audit payloads pass sensitive-data scans | security and privacy |
| DI-012 desktop package | workspace and Desktop copies have identical SHA-256 hashes | release engineering |
| DI-013 financial decisions | all six `UNRESOLVED-01` through `UNRESOLVED-06` items have passing `FIN-DEC-01` through `FIN-DEC-06` evidence and approved decision records before dependent Phase 2 code is enabled | finance, product, architecture, and quality |

## 15. Audit Result Recording

Record one row for each release candidate:

| Field | Required value |
|---|---|
| Release identifier | immutable build or commit identifier |
| Audit started at | UTC timestamp |
| Audit completed at | UTC timestamp |
| Schema validation | pass or fail with artifact link |
| Workflow validation | pass or fail with artifact link |
| Financial reconciliation | exact variance and artifact link |
| Report validation | passed count, failed count, artifact link |
| UI-control validation | passed count, failed count, artifact link |
| Permission validation | passed count, failed count, artifact link |
| Worker validation | passed count, failed count, artifact link |
| Terminology scan | match count and scan artifact link |
| Desktop hash verification | pass or fail with manifest link |
| Exceptions | approved exception identifiers; empty when none |
| Decision | DESIGN-INDEPENDENT, REJECTED, or CONDITIONAL |
| Approvers | product, architecture, security, clinical, finance, quality |

A `CONDITIONAL` decision cannot enter production. It exists only to permit a corrected release candidate to be assembled and retested.
