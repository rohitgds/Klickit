# 03 Project DentOS Financial Operations and Ledger Mathematics

## Purpose

Project DentOS defines four non-interchangeable financial facts:

1. `Assessed value`: issued fee statement value.
2. `Collection`: money recorded on active collection_receipts.
3. `Allocated value`: collected money settled against fee statement lines.
4. `Open exposure`: issued fee statement value not settled by allocations, credits, or relief.

<!-- BLOCKED BY UNRESOLVED-01: explicit settlement with optional clinic-versioned automation is assumed here for spec completeness; do not implement automatic settlement until FIN-DEC-01 passes per 07. -->
`Fee Statements` and `Collections` are separate patient tabs. `Record Collection` contains one amount and one collection method and does not select a fee statement. Settlement is performed only through the Fee Allocation command. Automatic allocation, when enabled, uses a versioned clinic policy and the same transaction, locking, audit, and reversal rules as a manual allocation.

## Financial Authorization Gate

Every read and mutation is checked server-side for the active clinic; hidden buttons are not a security boundary.

| Operation | Required permission |
|---|---|
| View Fee Statement/collection tabs | `fee_statement.view` / `collection.view` |
| Create or edit draft Fee Statement | `fee_statement.create` / `fee_statement.edit_draft` |
| Add discount / issue / void / print Fee Statement | `fee_statement.discount` / `fee_statement.issue` / `fee_statement.void` / `fee_statement.print` |
| Create or edit Collection reference | `collection.create` / `collection.edit_reference` |
| Apply or reverse application | `fee_allocation.create` / `fee_allocation.reverse` |
| Refund / void / print Collection | `collection.refund` / `collection.void` / `collection.print` |
| View/export financial reports | `analytics.financial.view` / `analytics.export` |

Posted Fee Statements, Collections, applications, collection_refunds, and journals are never hard-deleted, even by administrators. A role checkbox labeled Delete maps only to draft deletion where the resource supports it; posted entries use permissioned void/reversal and retain immutable history.

## 1. Monetary Precision and Rounding

- Store money as `numeric(14,2)`; never binary floating point.
- Store tax/discount rates as `numeric(7,4)`.
- Calculate line components at high precision and round each legally reportable component to 2 decimals using the configured half-up/half-even policy.
- Fee Statement `round_off` is explicit and included in grand total.
- A single rounding policy is versioned in fee-statement policy; old documents retain calculated snapshots.

## 2. Fee Statement Math

For fee statement line `i`:

```text
gross_i = round(quantity_i * unit_fee_i, 2)
discount_i = round(line_discount_i + allocated_header_discount_i, 2)
taxable_i = max(0, gross_i - discount_i)

cgst_i = round(taxable_i * cgst_rate_i / 100, 2)
sgst_i = round(taxable_i * sgst_rate_i / 100, 2)
igst_i = round(taxable_i * igst_rate_i / 100, 2)

line_total_i = taxable_i + cgst_i + sgst_i + igst_i
```

Fee Statement:

```text
subtotal = sum(gross_i)
discount_total = sum(discount_i)
taxable_total = sum(taxable_i)
tax_total = sum(cgst_i + sgst_i + igst_i)
pre_round_total = taxable_total + tax_total
grand_total = pre_round_total + round_off
```

Header discount allocation uses largest-remainder allocation so allocated cents sum exactly to the requested header discount. Zero-value/non-discountable lines are excluded.

### Fee Statement states

```text
draft -> issued -> part_paid -> paid
draft -> void
issued/part_paid/paid -> void only after active settlements are reversed or reallocated
```

`Production` includes issued, part-paid, and paid fee_statements, excludes draft and void, and uses `statement_date`.

The DentOS interface calls this record a `Fee Statement`. `New Fee Statement` exposes `Statement Date`, `Fee Statement No`, `Comments`, `Amount`, `Paid`, service Search/Category, line `Rate`, line `Notes`, and a discount toggle. `Paid` is derived from settlement; saving a fee statement creates production but not collection.

## 3. Collection Receipt and Collection Math

A collection receipt records money received, not revenue settlement.

<!-- BLOCKED BY UNRESOLVED-06: one Collection per method is assumed here for spec completeness; do not implement the entry model until FIN-DEC-06 passes per 07. -->
Specified entry fields are `Amount`, `Collection Method`, `Collection Reference`/`Collection Reference`, `Collection Date`, optional `Cheque/Ref #`, and `Notes`. DentOS core mode stores one tender per collection_receipt. A patient paying by Cash and UPI is entered as two collection receipt records unless the optional split-tender extension is enabled.

For collection receipt `r`:

```text
gross_collected_r = sum(active collection_tenders.amount)
refunded_total_r = sum(posted collection_refunds.amount)
available_total_r = gross_collected_r - refunded_total_r
applied_total_r = sum(active fee_allocations.amount)
unapplied_total_r = available_total_r - applied_total_r
```

Required checks:

```text
gross_collected >= 0
0 <= refunded_total <= gross_collected
0 <= applied_total <= available_total
unapplied_total >= 0
```

`Collection` for a period:

```text
gross_collection = sum(active collection_tenders.amount by collection_date)
collection_refunds = sum(signed refund effects by refund/reversal date)
net_collection = gross_collection - collection_refunds
```

An original refund contributes positive refund amount on `refund_date`; a later reversal contributes the same amount as a negative refund effect on `reversal_date`. Reports labelled collection/collection receipt must state whether they show gross collection_receipts, collection_refunds separately, or net collection. Default Project DentOS operational operational collection is active collection receipt value; refund-aware exports show both gross and net.

### Collection Receipt states

```text
active + unapplied_total = available_total -> unapplied
active + 0 < unapplied_total < available_total -> partially_applied
active + unapplied_total = 0 -> fully_applied
active -> part_refunded -> refunded
active -> void only when applications are reversed and no external settlement prevents void
```

The three application labels may be derived rather than stored. The persisted status remains active/void/refund lifecycle.

## 4. Collection Applications

A fee allocation bridges one collection receipt to one fee_statement.

```text
max_application = min(collection_receipt.unapplied_total, fee_statement.outstanding_total)
application_amount > 0
application.patient_id = collection_receipt.patient_id = fee_statement.patient_id
```

### Transaction algorithm

1. Start transaction at `READ COMMITTED` or stronger.
2. Lock collection receipt and fee statement rows `FOR UPDATE` in deterministic ID order.
3. Recalculate collection receipt unapplied and fee statement outstanding from active source rows.
4. Validate patient/clinic policy and requested amount.
5. Insert fee allocation.
6. Allocate the application across the collection receipt's unconsumed tender balances.
7. Confirm sum of tender allocations equals application amount.
8. Recalculate collection receipt, fee statement, and patient balances.
9. Create balanced journal entry, audit event, and outbox event.
10. Commit.

Repeated submission uses an idempotency key and returns the original application.

## 5. Collection-Mode Attribution

<!-- BLOCKED BY UNRESOLVED-06: the single-method core model and optional tender-allocation policies below are provisional; do not implement until FIN-DEC-06 passes per 07. -->
### DentOS core mode

One collection/collection receipt has one collection method, so mode attribution is direct:

```text
collection receipt collection mode = collection_tender.collection_mode
application mode = source collection receipt collection method
```

If one encounter is paid INR 400 Cash and INR 600 UPI, create two collection/collection receipt entries in DentOS core mode. Reports sum both without flattening them into one collection row.

### Optional split-tender extension

Consider a collection receipt of INR 1,000:

```text
Cash tender = 400
UPI tender = 600
```

If INR 700 is applied to Fee Statement A, joining the application directly to both tenders would falsely report INR 700 cash plus INR 700 UPI. The application must be split:

```text
Application A = 700
  Cash allocation = 400
  UPI allocation = 300

Remaining collection receipt credit = 300 UPI
```

Allowed allocation policies:

- Explicit cashier allocation, preferred when collection-mode settlement must be exact.
- FIFO tender order, deterministic fallback.
- Proportional allocation, only when explicitly configured and rounded with largest remainder.

The chosen policy is stored with the application. Extension-mode reports by collection method sum `allocation_tender_splits.amount`, never multiply application amounts by joined tender rows.

### Date-wise collection aggregation contract

The collection fact grain is exactly one active `collection_tenders` row. Never join that grain directly to `fee_allocations`, fee statement lines, roles, or patient category history; all one-to-many dimensions must be pre-aggregated or represented by snapshots.

For date `d`, clinic `c`, cashier `u`, and collection-mode code `m`:

```text
gross_collection(d,c,u,m)
  = sum(collection_tenders.amount)
    where collection_receipt.collection_date = d
      and collection_receipt.clinic_id = c
      and collection_receipt.collection_operator_id = u
      and collection_mode.code = m
      and collection_receipt.status <> 'void'

refund(d,c,u,m)
  = sum(collection_refund_tenders.amount)
    where refund.refund_date = d
      and original collection receipt cashier = u
      and refund_tender.collection_mode = m
      and refund.status = 'posted'

net_collection(d,c,u,m) = gross_collection(d,c,u,m) - refund(d,c,u,m)
```

Required pivot columns are `CASH`, `UPI`, `CARD`, and `NET_BANKING`; configured additional modes appear after them. Sum of mode columns equals gross collection for the same filter. Grouping by cashier uses `collection_receipts.collection_operator_id`, not creator/modifier and not `fee_allocations.applied_by`.

Fee allocation is a different fact and date:

```text
allocated_collection(d,c,applier,mode,clinician)
  = sum(clinician_value_allocations.amount)
    where fee_allocation.allocation_date = d
      and fee_allocation.status = 'active'
```

If DentOS core has one tender and clinician detail is not requested, `allocation_tender_splits` is sufficient. A dashboard may display gross collection and fee allocation side by side, but it must calculate them in separate CTEs/views and label their different date/user semantics.

## 6. Fee Statement Outstanding and Patient Balance

For fee statement `i`:

```text
applied_i = sum(active fee allocations)
credits_i = sum(active credit-note applications)
fee_reliefs_i = sum(active approved write-offs)
outstanding_i = grand_total_i - applied_i - credits_i - fee_reliefs_i
```

Fee Statement state derivation:

```text
outstanding = grand_total -> issued
0 < outstanding < grand_total -> part_paid
outstanding = 0 -> paid
```

For patient `p`:

```text
receivable_p = sum(positive outstanding on non-void fee_statements)
advance_p = sum(unapplied_total on active/part-refunded collection_receipts) + opening_advance
net_balance_p = receivable_p - advance_p
```

Interpretation:

- `net_balance > 0`: patient owes clinic.
- `net_balance = 0`: settled.
- `net_balance < 0`: clinic holds patient advance/credit.

Patient `Balance above` filters must document whether they use receivable or net balance. Recommended behavior is net balance, with separate advance filter in advanced dentos_analytics.

## 7. Due Fee Statements / Open Fee Exposure Aging

<!-- BLOCKED BY UNRESOLVED-03: due-date fallback, as-of event treatment, and bucket boundaries are assumed here for spec completeness; do not implement until FIN-DEC-03 passes per 07. -->
Open Fee Exposure is fee statement receivable, never patient net balance. Unapplied collection receipt advances remain in the advance/unsettled register and do not reduce a specific Fee Statement until an active fee allocation exists.

For as-of date `A` and fee statement `i`:

```text
applied_as_of_i
  = sum(application.amount where allocation_date <= A
        and (reversal_date is null or reversal_date > A))

credits_as_of_i
  = sum(credit application amount where allocation_date <= A
        and (reversal_date is null or reversal_date > A))

fee_reliefs_as_of_i
  = sum(writeoff amount where writeoff_date <= A
        and (reversal_date is null or reversal_date > A))

due_as_of_i
  = max(0, grand_total_i - applied_as_of_i - credits_as_of_i - fee_reliefs_as_of_i)

age_start_i = coalesce(due_date_i, statement_date_i)
age_days_i = max(0, A - age_start_i)
```

Only issued Fee Statements with `statement_date <= A`, `age_start <= A`, and no void effective on/before `A` participate. Current Due Fee Statements may use the reconciled `outstanding_total` cache; historical/as-of reports must recompute from dated source events.

Non-overlapping bucket formula:

```text
0-30  : 0 <= age_days <= 30
31-60 : 31 <= age_days <= 60
61-90 : 61 <= age_days <= 90
90+   : age_days > 90
```

The visible product-contract label `90+` means strictly over 90 days in this contract so day 90 is counted once in `61-90`. If reference testing proves a `>= 90` last bucket, the preceding bucket becomes `61-89` through one shared bucket function; overlapping conditions are forbidden.

Filter semantics:

- Clinic Branch: `fee_statements.clinic_id = any(:clinic_ids)` after membership/RBAC scope intersection.
- Date Range: optional Fee Statement-date filter in addition to mandatory `statement_date <= :as_of_date`; aging always uses `:as_of_date`.
- Patient Category: default `fee_statements.patient_category_id_snapshot`; optional explicitly labelled Current Category uses `patients.category_id`.
- Lead Clinician filter: `exists` matching `fee_statement_lines.lead_clinician_id`; do not join lines into fee statement totals.
- Clinician Split output: sum line-level due after dated application, credit-note, and write-off line allocations; clinician splits must sum exactly to fee statement due.

Report totals must provide Fee Statement count, patient count, grand total, applied, credits, write-offs, total due, and one amount/count per aging bucket.

## 8. Unsettled Collections Register

Project DentOS report: `Patients with collections not settled against fees`.

Canonical condition:

```sql
select
  r.patient_id,
  sum(r.unapplied_total) as unsettled_amount,
  min(r.collection_date) filter (where r.unapplied_total > 0) as oldest_unsettled_date
from collection_receipts r
where r.status in ('active','part_refunded')
  and r.unapplied_total > 0
group by r.patient_id
having sum(r.unapplied_total) > 0;
```

The drill-down must show collection receipt number/date, each tender, original collection, collection_refunds, applications, and remaining unapplied amount. This register updates on collection receipt create, application, application reversal, refund, or collection receipt void.

An unapplied collection receipt is not an error by itself; it may be a legitimate advance. The UI distinguishes `Advance` from `Needs allocation` using an optional collection receipt purpose plus age/clinic rules.

## 9. Applied-Collection Reports

<!-- BLOCKED BY UNRESOLVED-04: proportional line-level attribution with largest-remainder rounding is assumed here for spec completeness; do not implement clinician allocation reports until FIN-DEC-04 passes per 07. -->
`Lead Clinician wise fee allocations` must use settlement data, not collection receipt total and not fee statement total.

### Line attribution

If an fee statement contains lines for multiple clinicians, application amount is allocated across eligible fee statement lines by outstanding line balance at application time:

```text
line_weight_i = line_outstanding_before / fee_statement_outstanding_before
line_application_i = application_amount * line_weight_i
```

Use largest-remainder rounding so line allocations sum exactly to the application.

Persist line-level allocation when clinician reports or later reversals require stable historical attribution:

```text
allocation_fee_line_splits(fee_allocation_id, fee_statement_line_id, amount)
```

### Clinician and collection method

For clinician `d`, mode `m`, date `x`:

```text
clinician_mode_applied =
sum(application_line_allocation.amount
    * tender_share_within_application)
```

Prefer a persisted cross-allocation when exact tender/line combinations are needed:

```text
clinician_value_allocations(
  fee_allocation_id,
  fee_statement_line_id,
  collection_tender_id,
  amount
)
```

Invariant: sum of distribution by application = application amount; by fee statement line = line allocation; by tender = tender allocation.

## 10. Credit Notes, Write-Offs, Voids, and Refunds

### Credit note

- Reduces fee statement receivable/production adjustment according to report policy.
- Has its own serial/date/status and does not modify original fee statement total.
- Application to fee statement is explicit.

### Write-off

- Requires permission, reason, and optional approval threshold.
- Reduces operational due but is not collection or fee allocation.
- Posts to bad-debt/discount adjustment account.

### Application reversal

1. Lock collection receipt, fee statement, and application.
2. Mark original application reversed; do not delete it.
3. Reverse line/tender distributions and journal entry.
4. Increase collection receipt unapplied and fee statement due.
5. Reverse related clinician-share accruals.

### Collection Receipt void

- Reject while active applications exist.
- Reverse applications first or atomically as an explicitly authorized void workflow.
- Reverse collection receipt journal, exclude from active collection reports, retain collection receipt number.

### Refund

<!-- BLOCKED BY UNRESOLVED-05: reverse-or-reallocate settlement before refund is assumed here for spec completeness; do not implement until FIN-DEC-05 passes per 07. -->
- Refund is a new numbered document linked to original collection receipt and tender where possible.
- Reject amount greater than unrefunded available collection.
- If funds are already applied, reverse/reallocate settlement before refund unless clinic policy supports refund against negative receivable with explicit adjustment.
- Refund date drives refund reporting; original collection receipt date does not change.

## 11. GST and Fee Statement Tax Rules

- Snapshot patient/clinic place-of-supply and GST values on the fee_statement.
- Intra-state: CGST + SGST; inter-state: IGST, according to configured tax rules.
- Discounts reduce taxable value before tax unless law/configuration specifies otherwise.
- GST report totals use fee statement and credit-note tax snapshots, not current master rates.
- Voided drafts are excluded; issued document corrections use credit notes/revised documents as legally required.
- Validate HSN/SAC and tax code where enabled.

## 12. Double-Entry Posting

Suggested accounts:

- Patient Receivable
- Patient Advances / Unallocated Collections
- Dental Service Revenue
- Output CGST, SGST, IGST
- Cash, Bank, Card Clearing, UPI Clearing
- Refund Payable/Settlement
- Discounts/Bad Debt
- Expense accounts and input tax
- Clinician Share Payable

### Fee Statement issued

```text
Dr Patient Receivable                 grand_total
Cr Dental Service Revenue             taxable_total
Cr Output CGST/SGST/IGST              tax_total
Cr/Dr Round-off                       round_off
```

### Collection Receipt collected but unapplied

```text
Dr Cash/Bank/Card/UPI Clearing         gross_collected
Cr Patient Advances/Unapplied          gross_collected
```

### Collection Receipt applied to fee statement

```text
Dr Patient Advances/Unapplied          application_amount
Cr Patient Receivable                  application_amount
```

### Immediate collection receipt plus application

The system may present one screen but posts both collection receipt and application records. Net accounting may combine, but report-level source records remain separate.

### Refund of unapplied amount

```text
Dr Patient Advances/Unapplied          refund_amount
Cr Cash/Bank/Card/UPI                  refund_amount
```

### Write-off

```text
Dr Bad Debt / Approved Adjustment      writeoff_amount
Cr Patient Receivable                  writeoff_amount
```

Every posted journal entry balances exactly. Financial reports can be rebuilt from source documents and reconciled to the ledger.

## 13. Clinician Share Math

Each clinician contract states its basis.

### Production basis

```text
share_base = eligible fee statement-line net production
share = share_base * percentage / 100
```

### Applied-collection basis

```text
share_base = clinician-attributed active fee allocations
share = share_base * percentage / 100
```

### Service basis

```text
share = sum(service-specific fixed amount or percentage rule)
```

Advanced net:

```text
gross_share = base_share + approved_additions
net_share_payable = gross_share - deductions - prior_advances - payouts
```

Contract version is selected by fee statement/application date as configured and saved on each accrual. Reversals create negative accruals. A later contract edit never rewrites historical share.

## 14. Expense, Lab, and Stock Math

```text
expense_total = base + input_tax - discount + round_off
lab_closing = opening + posted_lab_charges - lab_disbursements - lab_credits
stock_on_hand = sum(posted quantity_delta)
stock_value_moving_average = on_hand * moving_average_cost
reorder = on_hand <= reorder_level
```

Negative stock is either transactionally blocked or allowed only with permission and alert. Posted stock edits use reversal movements.

## 15. Reconciliation Controls

Daily controls:

```text
collection receipt header total = sum collection receipt tenders
collection receipt applied + unapplied = available after collection_refunds
application total = sum tender allocations = sum fee statement-line allocations
fee statement total = applied + credit + writeoff + outstanding
patient cached balance = recomputed source balance
journal debits = journal credits
cashier-mode collection = collection receipt tender totals
aging 0-30 + 31-60 + 61-90 + 90+ = total due
clinician-split due = unsplit fee statement due
```

Nightly reconciliation reports any mismatch without silently changing posted documents. Authorized repair rebuilds caches/projections from immutable sources and records an audit event.

## 16. Worked Isolation Scenario

1. Fee Statement A is saved for INR 1,200. Production = 1,200; due = 1,200; collection = 0.
2. Collection R1 is entered for INR 400 Cash and Collection R2 for INR 600 UPI. Collection = 1,000; unapplied = 1,000; due remains 1,200.
3. Apply all INR 400 from R1 and INR 300 from R2 to Fee Statement A. Fee allocation = 700; due = 500; R2 retains INR 300 unapplied UPI.
4. Unsettled collection register shows INR 300. Collection reports still show INR 1,000.
5. Apply remaining INR 300 to Fee Statement A. Applied = 1,000; due = 200; unsettled register clears.
6. Void the second application. Due returns to 500; unsettled register returns with INR 300; collection stays 1,000.
7. Refund INR 300 UPI. Gross collection remains auditable at 1,000, refund = 300, net collection = 700, unapplied = 0, due = 500.

Any implementation that changes production when a collection is created, changes collection when an application is reversed, or duplicates applied amounts across collection methods fails conformance.

## 17. Non-Negotiable Rules

1. Collection Receipt date, application date, fee statement date, refund date, and last-modified date remain independent.
2. Collection Receipts/collections and applications/collections are never aliases.
3. DentOS core mode stores one mode per collection entry. Optional split tenders are never flattened into one mode.
4. Applications cannot be hard-deleted.
5. Voids and collection_refunds have reason, actor, time, and reversal posting.
6. Report totals are traceable to document IDs and drill-down rows.
7. Caches may accelerate totals but are never the sole accounting source.
8. Concurrent cashiers cannot over-apply or duplicate a collection_receipt.
9. Unapplied advances never reduce Open Fee Exposure unless an active application links them to a Fee Statement.
10. Collection-mode and cashier collection pivots sum collection receipt tenders once and never use application amounts.
11. Every outstanding Fee Statement appears in exactly one non-overlapping aging bucket.

<!-- ZERO_SHORTCUT_EXPANSION -->

## 18. Posting Command Algorithms

### ISSUE_BILL

<!-- BLOCKED BY UNRESOLVED-02: serial scope, rollover boundary, reset behavior, and non-reuse are assumed here for spec completeness; do not implement issuance numbering until FIN-DEC-02 passes per 07. -->
```text
IF draft Fee Statement exists; every line has positive quantity and non-negative rate; discounts are authorized; serial is available
THEN subtotal = sum(quantity * rate); line_discount = sum(allocated line and header discount); taxable = sum(max(0, gross - discount) for taxable lines); tax = sum(round(taxable * applicable rate, 2)); grand_total = subtotal - discount_total + tax_total + round_off
THEN Debit Patient Receivable for grand_total; Credit Service Revenue for taxable and non-taxable net revenue; Credit CGST Payable, SGST Payable, or IGST Payable for tax; post signed round-off to Round-off account
THEN set Fee Statement issued; freeze snapshots; set outstanding to grand_total; emit fee_statement.issued
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### POST_PAYMENT

<!-- BLOCKED BY UNRESOLVED-06: a single active Collection Method per core-mode entry is assumed here for spec completeness; do not implement until FIN-DEC-06 passes per 07. -->
```text
IF amount > 0; one active Collection Method is selected in DentOS core mode; collection receipt number is unique; accounting date is open
THEN collection_receipt_total = tender_total = entered amount; unapplied = amount; applied = 0; refunded = 0
THEN Debit Cash, UPI Clearing, Card Clearing, Net Banking Clearing, Cheque Clearing, or configured mode account; Credit Patient Advance for amount
THEN set Collection active; do not change Fee Statement due; emit collection_receipt.created
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### APPLY_PAYMENT

<!-- BLOCKED BY UNRESOLVED-01: manual selection is the documented default and any automatic eligibility/order rule remains blocked until FIN-DEC-01 passes per 07. -->
```text
IF Collection available amount > 0; Fee Statement outstanding > 0; application amount <= both; patient and clinic match
THEN application amount = sum tender allocations = sum fee statement-line allocations = sum distribution cells
THEN Debit Patient Advance; Credit Patient Receivable for application amount
THEN set application active; reduce collection receipt unapplied and Fee Statement due; emit fee_allocation.created
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### REVERSE_APPLICATION

```text
IF active application exists; reversal reason and permission are present; application has not already been reversed
THEN reversal amount equals original application amount; original collection remains unchanged
THEN Debit Patient Receivable; Credit Patient Advance for original application amount
THEN set application reversed with reversal date/actor; restore collection receipt unapplied and Fee Statement due; emit fee_allocation.reversed
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### POST_REFUND

<!-- BLOCKED BY UNRESOLVED-05: refundable value excludes active applications here; do not implement until FIN-DEC-05 passes per 07. -->
```text
IF refundable amount is positive and does not exceed collection receipt amount minus active applications minus prior active collection_refunds
THEN refund amount = sum refund tenders; collection receipt available decreases by refund amount; Fee Statement due does not change
THEN Debit Patient Advance; Credit selected cash or clearing account for refund amount
THEN set refund posted; retain original collection receipt and mode lineage; emit refund.posted
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### REVERSE_REFUND

```text
IF posted refund exists and reversal permission/reason are present
THEN reversal amount equals original refund amount; original refund date remains in history
THEN Debit selected cash or clearing account; Credit Patient Advance for refund amount
THEN set refund reversed and store reversal date; emit refund.reversed
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### POST_CREDIT_NOTE

```text
IF issued Fee Statement exists; credit amount is positive and allocated lines do not exceed line receivable
THEN credit total equals sum line allocations; Fee Statement due decreases; cash collection and fee allocation remain unchanged
THEN Debit Sales Return and reverse applicable tax payable; Credit Patient Receivable
THEN set credit note active; emit credit_note.posted
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### REVERSE_CREDIT_NOTE

```text
IF active credit note exists and reversal reason is present
THEN reversal restores exactly the dated credit effect
THEN Debit Patient Receivable; Credit Sales Return and reinstate applicable tax payable
THEN set credit note reversed with reversal date; emit credit_note.reversed
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### POST_WRITEOFF

```text
IF Fee Statement due is positive; finance approval is present; write-off does not exceed dated receivable
THEN write-off total equals line allocations; Fee Statement due decreases; collection and applied remain unchanged
THEN Debit Bad Debt Expense; Credit Patient Receivable
THEN set write-off active; emit writeoff.posted
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### VOID_BILL

```text
IF Fee Statement is issued and has no active applications, credits, write-offs, or downstream share payout; reason and permission are present
THEN void amount equals original Fee Statement grand total; number remains reserved; source lines remain immutable
THEN post exact reversal of original Fee Statement journal
THEN set Fee Statement void; emit fee_statement.voided
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

### VOID_PAYMENT

```text
IF Collection has no active application and no active refund; reason and permission are present
THEN void amount equals original collection receipt total; number remains reserved
THEN Debit Patient Advance; Credit original cash or clearing account
THEN set Collection void; emit collection_receipt.voided
ELSE reject the entire command; keep every source balance and journal unchanged
END IF
```

## 19. Exact Balance Equations

| Name | Exact equation |
|---|---|
| Fee Statement gross | `sum(fee_statement_lines.quantity * fee_statement_lines.unit_rate)` |
| Fee Statement discount | `sum(fee_statement_lines.discount_amount) with header discount allocated by largest remainder` |
| Fee Statement taxable base | `sum(fee_statement_lines.taxable_amount)` |
| Fee Statement tax | `sum(fee_statement_lines.cgst_amount + fee_statement_lines.sgst_amount + fee_statement_lines.igst_amount)` |
| Fee Statement total | `subtotal - discount_total + tax_total + round_off` |
| Fee Statement applied as of D | `sum(active application amount with allocation_date <= D) minus sum(reversal amount with reversal_date <= D)` |
| Fee Statement credited as of D | `sum(active credit effects dated <= D) minus dated reversal effects <= D` |
| Fee Statement written off as of D | `sum(active write-off effects dated <= D) minus dated reversal effects <= D` |
| Fee Statement due as of D | `greatest(0, Fee Statement total - Fee Statement applied as of D - Fee Statement credited as of D - Fee Statement written off as of D)` |
| Collection gross | `sum(collection_tenders.amount) for active, part-refunded, or refunded Collection source rows` |
| Collection applied | `sum(active allocation_tender_splits.amount)` |
| Collection refunded | `sum(posted collection_refund_tenders.amount) minus sum(reversed refund effects)` |
| Collection unapplied | `greatest(0, Collection gross - Collection applied - Collection refunded)` |
| Patient receivable | `sum Fee Statement due plus opening receivable balance` |
| Patient advance | `sum Collection unapplied plus opening advance balance` |
| Patient net balance | `Patient receivable - Patient advance` |
| Gross collection | `sum active collection receipt tender amounts by collection_date` |
| Refund | `sum signed refund tender effects by refund_date or reversal_date` |
| Net collection | `Gross collection - Refund` |
| Fee allocation | `sum active application distribution by allocation_date` |
| Clinician share payable | `sum active accrual + approved signed adjustment - posted payout` |
| Journal control | `sum(debit) - sum(credit) = 0 for each journal_entry_id` |

## 20. Reconciliation SQL

```sql
SELECT r.id AS collection_receipt_id,
       r.gross_collected AS recorded_total,
       COALESCE(SUM(rt.amount), 0)::numeric(14,2) AS tender_total,
       r.gross_collected - COALESCE(SUM(rt.amount), 0) AS variance
FROM collection_receipts r
LEFT JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
GROUP BY r.id, r.gross_collected
HAVING r.gross_collected <> COALESCE(SUM(rt.amount), 0);

SELECT pa.id AS fee_allocation_id,
       pa.amount,
       COALESCE(ta.tender_amount, 0) AS tender_amount,
       COALESCE(la.line_amount, 0) AS line_amount,
       COALESCE(dd.distribution_amount, 0) AS distribution_amount
FROM fee_allocations pa
LEFT JOIN (SELECT fee_allocation_id, SUM(amount) tender_amount FROM allocation_tender_splits GROUP BY fee_allocation_id) ta ON ta.fee_allocation_id = pa.id
LEFT JOIN (SELECT fee_allocation_id, SUM(amount) line_amount FROM allocation_fee_line_splits GROUP BY fee_allocation_id) la ON la.fee_allocation_id = pa.id
LEFT JOIN (SELECT fee_allocation_id, SUM(amount) distribution_amount FROM clinician_value_allocations GROUP BY fee_allocation_id) dd ON dd.fee_allocation_id = pa.id
WHERE pa.amount <> COALESCE(ta.tender_amount, 0)
   OR pa.amount <> COALESCE(la.line_amount, 0)
   OR pa.amount <> COALESCE(dd.distribution_amount, 0);

SELECT je.id AS journal_entry_id,
       SUM(jl.debit) AS total_debit,
       SUM(jl.credit) AS total_credit,
       SUM(jl.debit) - SUM(jl.credit) AS variance
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
WHERE je.status = 'posted'
GROUP BY je.id
HAVING SUM(jl.debit) <> SUM(jl.credit);
```

## 21. Clinician Production and Applied-Collection Attribution

<!-- BLOCKED BY UNRESOLVED-04: the persisted clinician distribution algorithm below is provisional pending FIN-DEC-04; production code must remain disabled until that test passes per 07. -->
This section is the mandatory accounting contract for the `Clinician Value and Allocation Matrix` matrix. It is a clean-room implementation requirement. A gross Collection is not clinician collection merely because a clinician appears on the encounter, Collection, patient, or Fee Statement header. Money becomes attributable to a clinician only when an active Collection application is distributed to a Fee Statement line owned by that clinician.

### Authoritative fact grains

| Metric | One fact row | Amount column | Business date | Clinician column |
|---|---|---|---|---|
| Assessed production | `fee_statement_lines.id` on a non-void issued Fee Statement | `fee_statement_lines.line_total` | `fee_statements.statement_date` | `fee_statement_lines.lead_clinician_id` |
| Fee allocation | `clinician_value_allocations.id` whose application is active | `clinician_value_allocations.amount` | `fee_allocations.allocation_date` | `fee_statement_lines.lead_clinician_id` reached through `clinician_value_allocations.fee_statement_line_id` |
| Gross collection | `collection_tenders.id` on a non-void Collection | `collection_tenders.amount` | `collection_receipts.collection_date` | No line-level clinician exists until application distribution |

For clinic `c`, clinician `d`, and bucket `b`:

```text
assessed_clinical_value(c,d,b)
  = sum(fee_statement_lines.line_total)
    where fee_statements.clinic_id = c
      and fee_statement_lines.lead_clinician_id = d
      and fee_statements.statement_date belongs to b
      and fee_statements.status in ('issued','part_paid','paid')

clinician_allocated_collection(c,d,b)
  = sum(clinician_value_allocations.amount)
    where fee_allocations.clinic_id = c
      and fee_statement_lines.lead_clinician_id = d
      and fee_allocations.allocation_date belongs to b
      and fee_allocations.status = 'active'

activity_difference(c,d,b)
  = assessed_clinical_value(c,d,b) - clinician_allocated_collection(c,d,b)

applied_to_production_percent(c,d,b)
  = case
      when assessed_clinical_value(c,d,b) = 0 then null
      else clinician_allocated_collection(c,d,b) * 100 / assessed_clinical_value(c,d,b)
    end
```

`activity_difference` is not Fee Statement outstanding. Production is grouped by Fee Statement date while fee allocation is grouped by application date, so a Collection applied this month may settle a Fee Statement from an earlier month. Due is calculated only by the dated Fee Statement-level equation in section 7.

### Exact bucket boundaries

The API accepts `bucket_interval` only as `month`, `quarter`, or `year`; every other value is rejected with `REPORT_INTERVAL_INVALID` before SQL execution.

```text
month bucket start   = date_trunc('month', business_date)::date
month bucket end     = (month bucket start + interval '1 month')::date
quarter bucket start = date_trunc('quarter', business_date)::date
quarter bucket end   = (quarter bucket start + interval '3 months')::date
year bucket start    = date_trunc('year', business_date)::date
year bucket end      = (year bucket start + interval '1 year')::date
```

The report input range remains inclusive. SQL implements it as `business_date >= :from_date` and `business_date < :to_date + 1`, preventing a timestamp boundary from being counted twice if the fact view later exposes timestamps.

### Multi-clinician Fee Statement allocation

Let application `A` have amount `a`, eligible Fee Statement lines `i = 1..n`, and line outstanding before this application `d_i`. Eligibility requires `d_i > 0`. The allocation engine executes inside the same serializable transaction that posts `fee_allocations`.

```text
fee_statement_due_before = sum(d_i)

IF a <= 0
THEN reject with APPLICATION_AMOUNT_INVALID
ELSE continue
END IF

IF a > fee_statement_due_before
THEN reject with APPLICATION_EXCEEDS_BILL_DUE
ELSE continue
END IF

raw_line_share_i = a * d_i / fee_statement_due_before
floor_line_share_i = floor(raw_line_share_i * 100) / 100
line_fraction_i = raw_line_share_i - floor_line_share_i
residual_cents = round((a - sum(floor_line_share_i)) * 100)
```

Assign one cent to the first `residual_cents` lines ordered by `line_fraction_i DESC, fee_statement_lines.sequence_no ASC, fee_statement_lines.id ASC`. The resulting `line_application_i` values are inserted into `allocation_fee_line_splits` and satisfy both invariants:

```text
sum(line_application_i) = fee_allocations.amount
0 <= line_application_i <= line_outstanding_before_i
```

Allocate the same application across available collection receipt tenders with the identical largest-remainder rule, replacing `d_i` with each tender's available amount. Persist the result in `allocation_tender_splits`.

Create the exact tender-by-line matrix in `clinician_value_allocations` from the two marginal allocations:

```text
line_remaining_i = allocation_fee_line_splits.amount for line i
tender_remaining_j = allocation_tender_splits.amount for tender j

Sort lines by fee_statement_lines.sequence_no ASC, fee_statement_lines.id ASC.
Sort tenders by collection_tenders.created_at ASC, collection_tenders.id ASC.

At current line i and tender j:
  cell_amount = least(line_remaining_i, tender_remaining_j)
  insert one clinician_value_allocations row when cell_amount > 0
  line_remaining_i = line_remaining_i - cell_amount
  tender_remaining_j = tender_remaining_j - cell_amount
  advance i when line_remaining_i = 0
  advance j when tender_remaining_j = 0
```

The transaction must reject unless every one of these equations is true to the paisa:

```text
sum(clinician_value_allocations.amount grouped by fee_allocation_id)
  = fee_allocations.amount

sum(clinician_value_allocations.amount grouped by fee_allocation_id, fee_statement_line_id)
  = allocation_fee_line_splits.amount

sum(clinician_value_allocations.amount grouped by fee_allocation_id, collection_tender_id)
  = allocation_tender_splits.amount
```

Example: a Fee Statement contains a `600.00` Endodontics line for clinician A and a `400.00` Implantology line for clinician B. A `500.00` application allocates `300.00` to clinician A and `200.00` to clinician B. Joining the `500.00` header application to both Fee Statement lines would incorrectly report `1,000.00` and is forbidden.

### Reversal behavior

```text
IF fee_allocations.status changes from active to reversed
THEN retain every clinician_value_allocations row as immutable history
THEN exclude its amount from current clinician and treatment-category applied-collection reports
THEN use reversal_date for an explicitly requested reversal-activity report
ELSE continue using allocation_date and the active distribution
END IF
```

A reversal never changes the original Fee Statement-line clinician, service, tender, Collection date, or application date.

## 22. Treatment-Category Applied-Collection Attribution

The exact join path is:

```text
fee_allocations.id
  -> clinician_value_allocations.fee_allocation_id
  -> clinician_value_allocations.fee_statement_line_id
  -> fee_statement_lines.id
  -> fee_statement_lines.service_id
  -> service_catalog.id
  -> service_catalog.service_domain_id
  -> service_domains.id
```

For category `k` and selected calendar month `m`:

```text
category_allocated_collection(k,m)
  = sum(clinician_value_allocations.amount)
    where service_catalog.service_domain_id = k
      and fee_allocations.status = 'active'
      and fee_allocations.allocation_date >= date_trunc('month', m)::date
      and fee_allocations.allocation_date < (date_trunc('month', m) + interval '1 month')::date
```

The category is the category of the assessed service line receiving the application. It is not the patient's category, care booking reason, treatment-plan heading, collection receipt clinician snapshot, or free-text Fee Statement description.

### Historical category stability

`service_catalog.service_domain_id` becomes immutable after the first `fee_statement_lines` row references that service. If a service must move to another category, the system performs these exact actions:

```text
IF no fee_statement_lines row references service_catalog.id
THEN allow category_id update and write the before/after audit event
ELSE reject category_id update with SERVICE_DOMAIN_IMMUTABLE_AFTER_ASSESSMENT
THEN create a new service_catalog.id with the new category_id
THEN set the former service row active = false only after open plans and fee schedules are migrated explicitly
END IF
```

This rule makes the join through `fee_statement_lines.service_id` historically stable without relying on the service's current editable category. A Fee Statement line with `service_id IS NULL` is reported under `category_id = NULL` and display label `Uncategorized`; it is included only when `:include_uncategorized = true`.

### Category and clinician reconciliation

For one identical applied-collection filter set:

```text
sum(fee allocation across all clinicians)
  = sum(clinician_value_allocations.amount for that filter)

sum(fee allocation across all treatment categories plus Uncategorized)
  = sum(clinician_value_allocations.amount for that filter)

sum(fee allocation across all collection methods)
  = sum(clinician_value_allocations.amount for that filter)
```

Unallocated Collection money has no `clinician_value_allocations` row. It remains in the unsettled collections register and contributes `0.00` to clinician and treatment-category applied-collection totals.

## 23. Follow-Up and Orthodontic Financial Isolation

Clinical completion, continuity scheduling, orthodontic enrollment, monthly encounter compliance, cancellation churn, and message delivery are operational events. None is a financial posting by itself.

```text
service completion financial effect = 0.00 until a Fee Statement line is issued
continuity task creation financial effect = 0.00
orthodontic tracking enrollment financial effect = 0.00
orthodontic next-adjustment date change financial effect = 0.00
care booking cancellation financial effect = 0.00 unless a separately authorized cancellation-fee Fee Statement line is issued
care booking no-show financial effect = 0.00 unless a separately authorized no-show-fee Fee Statement line is issued
SMS or WhatsApp reminder financial effect on patient ledger = 0.00
```

Completing a chargeable `care_deliveries` row may create one draft `fee_statement_lines` candidate through its service catalog and fee scheduler. The candidate is not production, patient due, collection, fee allocation, or clinician share until the containing Fee Statement changes to an issued state.

For an orthodontic adjustment encounter:

```text
clinical adjustment completed
  -> optional draft Fee Statement line candidate
  -> issued Fee Statement line creates assessed clinical value
  -> Collection receipt creates gross collection
  -> active clinician_value_allocations creates clinician/category fee allocation
```

The Monthly Encounter Delta and Churn/Defaulter reports do not join collection_receipts, Collection applications, Fee Statement totals, patient balances, or clinician-share ledgers. Adding a financial filter to those clinical compliance cohorts requires a separately labelled report because joining one-to-many Fee Statement or Collection rows would multiply patients and care_bookings.

Provider SMS/WhatsApp charges, when tracked, post as clinic communication expense through a supplier expense document. They never create a patient collection receipt, reduce Fee Statement due, or count as fee allocation. A clinic may separately issue a patient communication fee only through an explicit Fee Statement line; the message event itself cannot generate that fee.

## 24. Applied-Payment Case Progression Accounting Contract

### Financial facts remain separate

The case conversion subsystem consumes financial evidence without changing financial definitions.

```text
gross_collection(receipt)
  = sum(active collection_tenders.amount)

active_fee_allocation(allocation)
  = fee_allocations.amount when fee_allocations.status = active

line_applied_amount(allocation, fee_statement_line)
  = allocation_fee_line_splits.amount

case_progression_amount(case, allocation)
  = sum(allocation_fee_line_splits.amount)
    only for fee statement lines whose care_plan_service_id is frozen in that case's treatment_bundle_services
```

An unapplied advance has `gross_collection > 0` and `active_fee_allocation = 0`; therefore `case_progression_amount = 0` and the case remains unchanged. Recording a collection receipt, tender, cash drawer movement, bank reference, patient advance, refund, credit note, relief, or write-off cannot by itself satisfy the case progression condition.

### Exact qualifying evidence relation

For clinical case `c` and fee allocation `a`, define:

```text
qualifying_applied_payment(c,a) = true only when all conditions are true:
  c.execution_state = not_started
  a.status = active
  a.amount > 0.00
  at least one allocation_fee_line_splits row belongs to a and has amount > 0.00
  each qualifying split resolves to one fee_statement_lines row
  fee statement state is issued, part_paid, or paid
  fee statement line care_plan_service_id, or linked care delivery care_plan_service_id, equals a treatment_bundle_services.care_plan_service_id
  treatment bundle belongs to c
  treatment bundle state is advised, accepted, scheduled, in_progress, or completed
  fee statement patient equals c.patient_id
  fee statement encounter exists
  fee statement encounter patient equals c.patient_id
  fee statement encounter clinic equals c.clinic_id
  fee statement encounter is not the initial consultation encounter
  fee statement encounter clinical timestamp is later than initial consultation consulted_at
```

The proof query is:

```sql
SELECT
  cc.id AS clinical_case_id,
  fa.id AS fee_allocation_id,
  fs.care_encounter_id AS future_encounter_id,
  SUM(afls.amount)::numeric(14,2) AS qualifying_applied_amount
FROM clinical_cases cc
JOIN case_consultations ci
  ON ci.id = cc.initial_consultation_id
JOIN care_encounters initial_encounter
  ON initial_encounter.id = ci.care_encounter_id
JOIN treatment_bundles tb
  ON tb.clinical_case_id = cc.id
 AND tb.status IN ('advised','accepted','scheduled','in_progress','completed')
JOIN treatment_bundle_services tbs
  ON tbs.treatment_bundle_id = tb.id
JOIN fee_statement_lines fsl
  ON fsl.care_plan_service_id = tbs.care_plan_service_id
LEFT JOIN care_deliveries cd
  ON cd.id = fsl.care_delivery_id
JOIN fee_statements fs
  ON fs.id = fsl.fee_statement_id
 AND fs.status IN ('issued','part_paid','paid')
JOIN care_encounters future_encounter
  ON future_encounter.id = fs.care_encounter_id
JOIN clinics cl
  ON cl.id = future_encounter.clinic_id
JOIN allocation_fee_line_splits afls
  ON afls.fee_statement_line_id = fsl.id
 AND afls.amount > 0
JOIN fee_allocations fa
  ON fa.id = afls.fee_allocation_id
 AND fa.status = 'active'
 AND fa.amount > 0
WHERE cc.id = :clinical_case_id
  AND fa.id = :fee_allocation_id
  AND cc.execution_state = 'not_started'
  AND fs.patient_id = cc.patient_id
  AND future_encounter.patient_id = cc.patient_id
  AND future_encounter.clinic_id = cc.clinic_id
  AND future_encounter.id <> initial_encounter.id
  AND COALESCE(
        future_encounter.engaged_at,
        future_encounter.checked_in_at,
        future_encounter.arrival_at,
        future_encounter.encounter_date::timestamp AT TIME ZONE cl.timezone
      ) > ci.consulted_at
GROUP BY cc.id, fa.id, fs.care_encounter_id
HAVING SUM(afls.amount) > 0;
```

The join to `treatment_bundle_services.care_plan_service_id` is mandatory. A match on `service_id`, service-domain name, line description, tooth code, proposed fee, clinician, or patient alone is insufficient.

### State-change mathematics

```text
case_started_indicator(c, as_of)
  = 1 when c.execution_state = treatment_started
      and c.treatment_started_at <= as_of
  = 0 otherwise

payment_progressed_indicator(c, a)
  = 1 when qualifying_applied_payment(c,a) is true
      and c.state_change_source in (applied_payment_future_encounter, eod_reconciliation)
      and c.triggering_fee_allocation_id = a.id
  = 0 otherwise

progression_count_for_allocation(a)
  = count(distinct clinical_case_id)
    where payment_progressed_indicator(case,a) = 1
```

A clinical case can progress once from `not_started` without an authorized correction. Multiple positive splits from the same allocation or later allocations against other bundled lines do not create additional state events after the case has reached `treatment_started`.

### Posting lifecycle

```text
BEGIN allocation transaction
  lock collection receipt
  lock fee statement
  lock affected fee statement lines
  validate available collection amount
  validate outstanding fee amount
  insert fee_allocations
  insert allocation_tender_splits
  insert allocation_fee_line_splits
  insert clinician_value_allocations
  insert balanced journal entry and lines
  update cached applied and outstanding totals
  at deferred-trigger time evaluate case progression evidence
  when evidence qualifies, lock clinical case and update execution state
  insert clinical case state event, audit event, and outbox event
COMMIT all financial and case rows together
```

If the case state update fails a constraint, the complete allocation transaction rolls back. No financial posting may remain committed while its qualifying case update is missing from the same transaction. The nightly reconciliation exists for historical imports, disabled-trigger migrations, and previously committed allocations; it is not a substitute for normal atomic posting.

### Allocation reversal

For active allocation `a` reversed by reversal `r`:

```text
allocation_financial_effect_after_reversal(a) = 0.00
collection_receipt_unapplied_increase = a.amount less any simultaneous refund restriction
fee_statement_outstanding_increase = a.amount allocated to that fee statement
case_execution_state_effect = 0 automatic state change
```

The original `clinical_case_state_events` row remains. The case projection exposes:

```text
triggering_allocation_reversed(c)
  = true when c.triggering_fee_allocation_id references fee_allocations.status = reversed
  = false otherwise

started_delivery_exists(c)
  = true when at least one bundled care delivery is in_progress or completed
  = false otherwise

conversion_review_required(c)
  = triggering_allocation_reversed(c) and not started_delivery_exists(c)
```

`conversion_review_required = true` creates an operational review item. It does not rewrite the state. A user with `clinical_case.correct_state` can perform an audited correction with a nonblank reason and note; the correction appends a new event and leaves financial reversal rows untouched.

### Dual-clinician financial isolation

Primary Consult Doctor and Secondary Review Doctor are conversion-attribution dimensions, not automatic revenue splits.

```text
primary_doctor_conversion_credit = one converted case in primary-role analytics
secondary_doctor_review_credit = one converted case in secondary-role analytics
clinician_applied_collection = sum(clinician_value_allocations.amount)
clinician_share_accrual = amount calculated from clinician_share_contracts
```

Assigning either consultation role does not create `clinician_value_allocations`, change the fee statement line's `lead_clinician_id`, or create a clinician share. Revenue and collection reporting continues to use assessed line ownership and application distributions. Conversion reporting uses consultation-role ownership.

### Bundle-tier financial isolation

Primary, Secondary, and Tertiary are advised-treatment priorities. They do not change tax, discounts, price, collection method, or application order.

```text
bundle_estimated_value = sum(treatment_bundle_services.proposed_amount_snapshot)
bundle_applied_amount = sum(active allocation_fee_line_splits.amount linked by care_plan_service_id)
bundle_open_advised_value = max(0, bundle_estimated_value - bundle_applied_amount)
```

`bundle_applied_amount` is an operational conversion measure. It does not replace fee statement outstanding math because a care-plan service can be adjusted before issue and the fee statement remains the accounting authority.
