# 04 Project DentOS Deep Analytics Query Contracts

## Query Authority

Every report leaf below is a first-party DentOS product contract. Its parameter schema, authoritative date, source grain, joins, formulas, ordered output columns, drill-down identifiers, and export behavior are explicit. Acceptance uses the synthetic fixtures in this file and document 07.

## Integrity Rules

- Prevents split-tender multiplication in fee-allocation reports.
- Defines the authoritative date for every report family.
- Defines gross collection, collection refunds, net collection, fee allocations, assessed value, and open exposure separately.
- Adds drill-down, totals, void/reversal, timezone, and export behavior.
- Replaces generic analytics with reproducible numerator/denominator/cohort definitions.

## 1. Universal Report Contract

<!-- BLOCKED BY UNRESOLVED-02: document references are treated as immutable opaque identifiers here; numbering scope and rollover semantics must not be inferred or implemented until FIN-DEC-02 passes per 07. -->
Every report request includes:

```text
organization_id (from session, never trusted from client)
clinic_scope: current clinic or authorized clinics
from_date, to_date inclusive in clinic local timezone
optional clinician, patient, category, user, collection method, status, supplier, lab
sort, page, page_size
```

Every response includes:

```text
report_key, report_label, generated_at, clinic_timezone
effective_filters
columns with stable keys and display labels
rows, page totals, grand totals, row_count
source_as_of timestamp
```

Rules:

- Resolve the report registry entry before query execution and require its permission: `analytics.operational.view`, `analytics.clinical.view`, `analytics.financial.view`, or `analytics.inventory.view`.
- Require `analytics.export` for spreadsheet/PDF export and `analytics.print` for printable output in addition to the report-family view permission.
- Derive clinic scope from active `clinic_memberships`; ignore or reject unauthorized clinic IDs supplied in a URL, filter, saved priority_pinned, or export request.
- Hiding a report leaf in the UI is convenience only. The report endpoint and asynchronous export worker repeat the same permission and clinic-scope checks.
- Use half-open UTC ranges derived from local dates: `[local from 00:00, local to + 1 day 00:00)`.
- Default excludes void/reversed source rows but offers explicit audit status where appropriate.
- Grand totals are calculated over the full filtered result, not the current page.
- Grid, print, PDF, and spreadsheet export use the same query contract.
- Every allowed or denied sensitive report/export logs report key, filters (with sensitive values redacted), row count where applicable, requester, clinic scope, and timestamp.
- Each financial total drills down to source document number and record ID.

### Shared financial filter contract

<!-- BLOCKED BY UNRESOLVED-03: `as_of_date`, age anchor, and aging-bucket behavior below are provisional until FIN-DEC-03 passes per 07. -->
All financial report SQL uses these typed parameters; unsupported filters are rejected rather than silently ignored.

| Parameter | Type | Meaning |
|---|---|---|
| `:clinic_ids` | `uuid[]` required | Intersection of requested branches and authorized clinic memberships |
| `:from_date`, `:to_date` | `date` | Inclusive business-date range for the report's authoritative date |
| `:as_of_date` | `date` | Cut-off for outstanding/aging; independent of export generation time |
| `:patient_category_ids` | `uuid[]` nullable | Fee Statement/collection receipt snapshot category by default |
| `:category_basis` | `snapshot` or `current` | Must be shown in output; default `snapshot` |
| `:clinician_ids` | `uuid[]` nullable | Fee Statement-line clinician for production/due; collection receipt clinician snapshot for gross collections; allocation clinician for fee allocations |
| `:cashier_user_ids` | `uuid[]` nullable | `collection_receipts.collection_operator_id` for gross collections |
| `:applied_by_user_ids` | `uuid[]` nullable | `fee_allocations.applied_by`, never treated as cashier |
| `:collection_mode_codes` | `text[]` nullable | Stable codes such as CASH/UPI/CARD/NET_BANKING, not editable labels |
| `:include_unassigned_clinician` | `boolean` | Includes patient-level collections with no encounter/clinician snapshot |

Clinic filtering is mandatory in every CTE, view query, drill-down, total, print, and asynchronous export. Date Range never replaces `:as_of_date`: Due Fee Statements may optionally limit Fee Statement dates with `:from_date/:to_date`, while aging is always calculated against `:as_of_date`.

## 2. Authoritative Date Dictionary

| Metric/report family | Date column |
|---|---|
| Care Bookings | `care_bookings.starts_at` converted to clinic date |
| Patient encounters/footfall | `care_encounters.encounter_date` |
| Production/fee_statements | `fee_statements.statement_date` |
| Collections/collection_receipts | `collection_receipts.collection_date` |
| Fee allocations | `fee_allocations.allocation_date` |
| Collection Receipt modification | `collection_receipts.last_modified_at` converted to clinic date |
| Refunds | `collection_refunds.refund_date` |
| Expenses | `expenses.expense_date` |
| Lab requested/expected/received | matching `lab_jobs` date column |
| Inventory | `stock_documents.document_date` or `stock_movements.movement_at` as labelled |
| Messages | `outbound_messages.sent_at` |

Created/updated timestamps never replace the labelled business date.

## 3. Required Complex Financial Matrix Views

<!-- BLOCKED BY UNRESOLVED-04: line-level clinician and service-domain attribution is assumed here for spec completeness; do not implement these matrices until FIN-DEC-04 passes per 07. -->
<!-- BLOCKED BY UNRESOLVED-06: tender lineage and collection-method attribution assume the documented entry model; do not implement method pivots until FIN-DEC-06 passes per 07. -->
The following PostgreSQL views are the required source contracts for the clinician production/applied-collection matrix and the treatment-category applied-collection matrix. Row-level clinic authorization is still applied by the report service; neither view is an authorization boundary.

### `dentos_analytics.v_clinical_value_line_fact`

```sql
CREATE SCHEMA IF NOT EXISTS dentos_analytics;

CREATE OR REPLACE VIEW dentos_analytics.v_clinical_value_line_fact AS
SELECT
  il.id AS fee_statement_line_id,
  i.id AS fee_statement_id,
  i.organization_id,
  i.clinic_id,
  i.patient_id,
  i.patient_category_id_snapshot,
  p.category_id AS patient_category_id_current,
  i.statement_reference,
  i.statement_date,
  i.status AS fee_statement_status,
  il.lead_clinician_id AS clinician_id,
  ds.display_name AS clinician_name,
  il.service_id,
  pr.code AS service_code,
  pr.description AS service_name,
  pr.category_id AS service_domain_id,
  pcat.name AS service_category_name,
  il.quantity,
  il.gross_amount,
  il.discount_amount,
  il.taxable_amount,
  il.cgst_amount,
  il.sgst_amount,
  il.igst_amount,
  il.line_total AS assessed_clinical_value_amount
FROM fee_statements i
JOIN fee_statement_lines il
  ON il.fee_statement_id = i.id
JOIN patients p
  ON p.id = i.patient_id
JOIN staff ds
  ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr
  ON pr.id = il.service_id
LEFT JOIN service_domains pcat
  ON pcat.id = pr.category_id;
```

One row equals one Fee Statement line. `assessed_clinical_value_amount` is included only when `fee_statement_status IN ('issued','part_paid','paid')`. Draft and void Fee Statements are excluded by consuming queries. A service domain remains historically stable because section 22 of `03_billing_and_ledger_math.md` prohibits changing `service_catalog.service_domain_id` after the service has been assessed.

### `dentos_analytics.v_allocated_collection_line_fact`

```sql
CREATE OR REPLACE VIEW dentos_analytics.v_allocated_collection_line_fact AS
SELECT
  ad.id AS distribution_id,
  pa.id AS fee_allocation_id,
  pa.clinic_id,
  i.organization_id,
  pa.patient_id,
  i.patient_category_id_snapshot,
  p.category_id AS patient_category_id_current,
  pa.collection_receipt_id,
  r.collection_reference,
  r.collection_date,
  r.status AS collection_receipt_status,
  pa.fee_statement_id,
  i.statement_reference,
  i.statement_date,
  ad.fee_statement_line_id,
  il.lead_clinician_id AS clinician_id,
  ds.display_name AS clinician_name,
  il.service_id,
  pr.code AS service_code,
  pr.description AS service_name,
  pr.category_id AS service_domain_id,
  pcat.name AS service_category_name,
  ad.collection_tender_id,
  rt.collection_method_id,
  pm.code AS collection_mode_code,
  pm.name AS collection_mode_name,
  pa.allocation_date,
  pa.status AS application_status,
  pa.applied_by,
  pa.reversal_date,
  ad.amount AS applied_amount
FROM clinician_value_allocations ad
JOIN fee_allocations pa
  ON pa.id = ad.fee_allocation_id
JOIN fee_statement_lines il
  ON il.id = ad.fee_statement_line_id
 AND il.fee_statement_id = pa.fee_statement_id
JOIN fee_statements i
  ON i.id = pa.fee_statement_id
 AND i.id = il.fee_statement_id
 AND i.clinic_id = pa.clinic_id
 AND i.patient_id = pa.patient_id
JOIN collection_receipts r
  ON r.id = pa.collection_receipt_id
 AND r.clinic_id = pa.clinic_id
 AND r.patient_id = pa.patient_id
JOIN collection_tenders rt
  ON rt.id = ad.collection_tender_id
 AND rt.collection_receipt_id = pa.collection_receipt_id
JOIN patients p
  ON p.id = pa.patient_id
JOIN staff ds
  ON ds.id = il.lead_clinician_id
JOIN collection_methods pm
  ON pm.id = rt.collection_method_id
LEFT JOIN service_catalog pr
  ON pr.id = il.service_id
LEFT JOIN service_domains pcat
  ON pcat.id = pr.category_id;
```

One row equals one exact intersection of active-or-reversed Collection application, Fee Statement line, and collection receipt tender. Consuming queries include only `application_status = 'active'`. They do not multiply `fee_allocations.amount` by the number of clinicians, Fee Statement lines, tenders, services, or categories. The joins require the distributed Fee Statement line to belong to `fee_allocations.fee_statement_id` and the distributed tender to belong to `fee_allocations.collection_receipt_id`.

## 4. Clinician Value and Allocation Matrix

<!-- BLOCKED BY UNRESOLVED-04: proportional distribution and immutable line-clinician attribution are assumed here; do not implement until FIN-DEC-04 passes per 07. -->
### Exact report contract

- Report key: `financial.attending_clinician_production_vs_collection_split`.
- Permission: `analytics.financial.view`.
- Required parameters: `:clinic_ids uuid[]`, `:from_date date`, `:to_date date`, `:bucket_interval text`, `:category_basis text`.
- Optional parameters: `:clinician_ids uuid[]`, `:patient_category_ids uuid[]`.
- Allowed `:bucket_interval`: `month`, `quarter`, `year`.
- Allowed `:category_basis`: `snapshot`, `current`.
- Production date: `fee_statements.statement_date`.
- Applied-collection date: `fee_allocations.allocation_date`.
- Clinician attribution: `clinician_value_allocations.fee_statement_line_id -> fee_statement_lines.lead_clinician_id`.
- Output order: `bucket_start`, `clinic_id`, `clinician_name`, `clinician_id`.
- Footer: sum `assessed_clinical_value`, `allocated_collection`, and `activity_difference` across the complete filtered result; recompute the percentage from footer sums.

The report service rejects `:from_date > :to_date`, an empty authorized clinic intersection, an invalid interval, or an invalid category basis before executing SQL.

### Complete monthly, quarterly, and yearly SQL

```sql
WITH parameter_guard AS (
  SELECT
    :from_date::date AS from_date,
    :to_date::date AS to_date,
    :bucket_interval::text AS bucket_interval,
    :category_basis::text AS category_basis
  WHERE :from_date::date <= :to_date::date
    AND :bucket_interval::text IN ('month','quarter','year')
    AND :category_basis::text IN ('snapshot','current')
),
production AS (
  SELECT
    CASE pg.bucket_interval
      WHEN 'month' THEN date_trunc('month', f.statement_date)::date
      WHEN 'quarter' THEN date_trunc('quarter', f.statement_date)::date
      WHEN 'year' THEN date_trunc('year', f.statement_date)::date
    END AS bucket_start,
    f.clinic_id,
    f.clinician_id,
    COUNT(DISTINCT f.fee_statement_id) AS production_fee_statement_count,
    COUNT(DISTINCT f.fee_statement_line_id) AS production_line_count,
    SUM(f.assessed_clinical_value_amount)::numeric(14,2) AS assessed_clinical_value
  FROM dentos_analytics.v_clinical_value_line_fact f
  CROSS JOIN parameter_guard pg
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND f.statement_date >= pg.from_date
    AND f.statement_date < pg.to_date + 1
    AND f.fee_statement_status IN ('issued','part_paid','paid')
    AND (:clinician_ids::uuid[] IS NULL OR f.clinician_id = ANY(:clinician_ids::uuid[]))
    AND (
      :patient_category_ids::uuid[] IS NULL
      OR CASE pg.category_basis
           WHEN 'snapshot' THEN f.patient_category_id_snapshot
           WHEN 'current' THEN f.patient_category_id_current
         END = ANY(:patient_category_ids::uuid[])
    )
  GROUP BY
    CASE pg.bucket_interval
      WHEN 'month' THEN date_trunc('month', f.statement_date)::date
      WHEN 'quarter' THEN date_trunc('quarter', f.statement_date)::date
      WHEN 'year' THEN date_trunc('year', f.statement_date)::date
    END,
    f.clinic_id,
    f.clinician_id
),
applied AS (
  SELECT
    CASE pg.bucket_interval
      WHEN 'month' THEN date_trunc('month', f.allocation_date)::date
      WHEN 'quarter' THEN date_trunc('quarter', f.allocation_date)::date
      WHEN 'year' THEN date_trunc('year', f.allocation_date)::date
    END AS bucket_start,
    f.clinic_id,
    f.clinician_id,
    COUNT(DISTINCT f.fee_allocation_id) AS application_count,
    COUNT(DISTINCT f.collection_receipt_id) AS applied_collection_receipt_count,
    COUNT(DISTINCT f.fee_statement_id) AS settled_fee_statement_count,
    SUM(f.applied_amount)::numeric(14,2) AS allocated_collection
  FROM dentos_analytics.v_allocated_collection_line_fact f
  CROSS JOIN parameter_guard pg
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND f.allocation_date >= pg.from_date
    AND f.allocation_date < pg.to_date + 1
    AND f.application_status = 'active'
    AND f.collection_receipt_status IN ('active','part_refunded','refunded')
    AND (:clinician_ids::uuid[] IS NULL OR f.clinician_id = ANY(:clinician_ids::uuid[]))
    AND (
      :patient_category_ids::uuid[] IS NULL
      OR CASE pg.category_basis
           WHEN 'snapshot' THEN f.patient_category_id_snapshot
           WHEN 'current' THEN f.patient_category_id_current
         END = ANY(:patient_category_ids::uuid[])
    )
  GROUP BY
    CASE pg.bucket_interval
      WHEN 'month' THEN date_trunc('month', f.allocation_date)::date
      WHEN 'quarter' THEN date_trunc('quarter', f.allocation_date)::date
      WHEN 'year' THEN date_trunc('year', f.allocation_date)::date
    END,
    f.clinic_id,
    f.clinician_id
),
matrix AS (
  SELECT
    COALESCE(pr.bucket_start, ap.bucket_start) AS bucket_start,
    COALESCE(pr.clinic_id, ap.clinic_id) AS clinic_id,
    COALESCE(pr.clinician_id, ap.clinician_id) AS clinician_id,
    COALESCE(pr.production_fee_statement_count, 0) AS production_fee_statement_count,
    COALESCE(pr.production_line_count, 0) AS production_line_count,
    COALESCE(pr.assessed_clinical_value, 0.00)::numeric(14,2) AS assessed_clinical_value,
    COALESCE(ap.application_count, 0) AS application_count,
    COALESCE(ap.applied_collection_receipt_count, 0) AS applied_collection_receipt_count,
    COALESCE(ap.settled_fee_statement_count, 0) AS settled_fee_statement_count,
    COALESCE(ap.allocated_collection, 0.00)::numeric(14,2) AS allocated_collection
  FROM production pr
  FULL OUTER JOIN applied ap
    ON ap.bucket_start = pr.bucket_start
   AND ap.clinic_id = pr.clinic_id
   AND ap.clinician_id = pr.clinician_id
)
SELECT
  m.bucket_start,
  CASE :bucket_interval::text
    WHEN 'month' THEN (m.bucket_start + interval '1 month')::date
    WHEN 'quarter' THEN (m.bucket_start + interval '3 months')::date
    WHEN 'year' THEN (m.bucket_start + interval '1 year')::date
  END AS bucket_end_exclusive,
  :bucket_interval::text AS bucket_interval,
  m.clinic_id,
  m.clinician_id,
  s.display_name AS clinician_name,
  m.production_fee_statement_count,
  m.production_line_count,
  m.assessed_clinical_value,
  m.application_count,
  m.applied_collection_receipt_count,
  m.settled_fee_statement_count,
  m.allocated_collection,
  (m.assessed_clinical_value - m.allocated_collection)::numeric(14,2) AS activity_difference,
  CASE
    WHEN m.assessed_clinical_value = 0 THEN NULL
    ELSE ROUND(m.allocated_collection * 100.00 / m.assessed_clinical_value, 2)
  END AS applied_to_production_percent
FROM matrix m
JOIN staff s
  ON s.id = m.clinician_id
ORDER BY m.bucket_start, m.clinic_id, s.display_name, m.clinician_id;
```

The `FULL OUTER JOIN` is mandatory. It retains a clinician who has production with no fee allocation and a clinician who receives an application during the selected bucket for an older Fee Statement but has no new production in that bucket.

### Exact attribution example

| Fee Statement line | Lead clinician | Service category | Line total | Outstanding before Collection | Distributed applied amount |
|---|---|---|---:|---:|---:|
| Line 1 | Clinician A | Endodontics | 600.00 | 600.00 | 300.00 |
| Line 2 | Clinician B | Implantology | 400.00 | 400.00 | 200.00 |

For a `500.00` application, clinician A receives `500.00 * 600.00 / 1,000.00 = 300.00`; clinician B receives `500.00 * 400.00 / 1,000.00 = 200.00`. The persisted `clinician_value_allocations.amount` rows, not a calculation repeated at report time, are the final accounting values.

If the Fee Statement is dated `2026-01-31` and the application is dated `2026-04-01`, monthly output shows production in `2026-01-01` and fee allocation in `2026-04-01`; quarterly output shows production in `2026-01-01` and fee allocation in `2026-04-01`; yearly output shows both in `2026-01-01`. This is an activity matrix and must not be labelled outstanding or settlement of current-period production.

## 5. Service Domain Allocation Matrix

### Exact report contract

- Report key: `financial.service_domain_applied_collection_breakdown`.
- Permission: `analytics.financial.view`.
- Required parameters: `:clinic_ids uuid[]`, `:selected_month date`, `:category_basis text`, `:include_uncategorized boolean`.
- Optional parameters: `:service_domain_ids uuid[]`, `:clinician_ids uuid[]`, `:patient_category_ids uuid[]`, `:collection_mode_codes text[]`.
- Authoritative date: `fee_allocations.allocation_date`.
- Category attribution: `clinician_value_allocations.fee_statement_line_id -> fee_statement_lines.service_id -> service_catalog.service_domain_id -> service_domains.id`.
- Treatment category examples are catalog data such as Endodontics, Implantology, and Orthodontics; report SQL never identifies them by editable display text.
- Output order: `clinic_id`, `service_category_name`, `service_domain_id`.
- Footer: sum each collection-mode column and `total_allocated_collection` across the complete filtered result.

### Complete selected-month SQL

```sql
WITH month_bounds AS (
  SELECT
    date_trunc('month', :selected_month::date)::date AS month_start,
    (date_trunc('month', :selected_month::date) + interval '1 month')::date AS month_end_exclusive,
    :category_basis::text AS category_basis
  WHERE :category_basis::text IN ('snapshot','current')
),
filtered_distribution AS (
  SELECT
    f.distribution_id,
    f.fee_allocation_id,
    f.collection_receipt_id,
    f.fee_statement_id,
    f.fee_statement_line_id,
    f.clinic_id,
    f.patient_id,
    f.clinician_id,
    f.service_id,
    f.service_domain_id,
    COALESCE(f.service_category_name, 'Uncategorized') AS service_category_name,
    f.collection_mode_code,
    f.applied_amount
  FROM dentos_analytics.v_allocated_collection_line_fact f
  CROSS JOIN month_bounds mb
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND f.allocation_date >= mb.month_start
    AND f.allocation_date < mb.month_end_exclusive
    AND f.application_status = 'active'
    AND f.collection_receipt_status IN ('active','part_refunded','refunded')
    AND (:clinician_ids::uuid[] IS NULL OR f.clinician_id = ANY(:clinician_ids::uuid[]))
    AND (
      :patient_category_ids::uuid[] IS NULL
      OR CASE mb.category_basis
           WHEN 'snapshot' THEN f.patient_category_id_snapshot
           WHEN 'current' THEN f.patient_category_id_current
         END = ANY(:patient_category_ids::uuid[])
    )
    AND (
      :service_domain_ids::uuid[] IS NULL
      OR f.service_domain_id = ANY(:service_domain_ids::uuid[])
    )
    AND (
      f.service_domain_id IS NOT NULL
      OR :include_uncategorized::boolean
    )
    AND (
      :collection_mode_codes::text[] IS NULL
      OR f.collection_mode_code = ANY(:collection_mode_codes::text[])
    )
)
SELECT
  mb.month_start,
  mb.month_end_exclusive,
  fd.clinic_id,
  fd.service_domain_id,
  fd.service_category_name,
  COUNT(DISTINCT fd.patient_id) AS patient_count,
  COUNT(DISTINCT fd.fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT fd.fee_statement_line_id) AS assessed_line_count,
  COUNT(DISTINCT fd.collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT fd.fee_allocation_id) AS application_count,
  COALESCE(SUM(fd.applied_amount) FILTER (WHERE fd.collection_mode_code = 'CASH'), 0.00)::numeric(14,2) AS cash_applied,
  COALESCE(SUM(fd.applied_amount) FILTER (WHERE fd.collection_mode_code = 'UPI'), 0.00)::numeric(14,2) AS upi_applied,
  COALESCE(SUM(fd.applied_amount) FILTER (WHERE fd.collection_mode_code = 'CARD'), 0.00)::numeric(14,2) AS card_applied,
  COALESCE(SUM(fd.applied_amount) FILTER (WHERE fd.collection_mode_code = 'NET_BANKING'), 0.00)::numeric(14,2) AS net_banking_applied,
  COALESCE(SUM(fd.applied_amount) FILTER (
    WHERE COALESCE(fd.collection_mode_code, 'UNSPECIFIED') NOT IN ('CASH','UPI','CARD','NET_BANKING')
  ), 0.00)::numeric(14,2) AS other_mode_applied,
  SUM(fd.applied_amount)::numeric(14,2) AS total_allocated_collection
FROM filtered_distribution fd
CROSS JOIN month_bounds mb
GROUP BY
  mb.month_start,
  mb.month_end_exclusive,
  fd.clinic_id,
  fd.service_domain_id,
  fd.service_category_name
ORDER BY fd.clinic_id, fd.service_category_name, fd.service_domain_id NULLS LAST;
```

Each collection-mode expression uses `COALESCE` so a category with no value for that mode returns numeric `0.00` in the grid and export. The grand total is recomputed with `COALESCE(SUM(column), 0.00)` and is never copied from the visible page.

### Collection vocabulary boundary

This matrix reports applied Collection by service domain. It does not report gross Collection receipts by service domain because an unapplied advance has no Fee Statement line and therefore no truthful service domain. The following identities are mandatory:

```text
gross collection = sum(collection_tenders.amount on non-void Collections by collection_date)
applied Collection by category = sum(clinician_value_allocations.amount on active applications by allocation_date)
unapplied advance = collection_receipts.gross_collected - collection_receipts.refunded_total - collection_receipts.applied_total
```

An unapplied advance appears only in gross collections, patient advance, and the unsettled collections register. It contributes `0.00` to Endodontics, Implantology, Orthodontics, and every other service domain until an application distribution is posted.

## 6. Matrix Reconciliation Queries

### Clinician split control

The first query must return zero rows for every posted application.

```sql
SELECT
  pa.id AS fee_allocation_id,
  pa.amount AS application_amount,
  COALESCE(SUM(ad.amount), 0.00)::numeric(14,2) AS distributed_amount,
  (pa.amount - COALESCE(SUM(ad.amount), 0.00))::numeric(14,2) AS variance
FROM fee_allocations pa
LEFT JOIN clinician_value_allocations ad
  ON ad.fee_allocation_id = pa.id
WHERE pa.status = 'active'
GROUP BY pa.id, pa.amount
HAVING pa.amount <> COALESCE(SUM(ad.amount), 0.00);
```

### Tender and Fee Statement-line ownership control

The second query must return zero rows. It detects a distribution row linked to a tender from another Collection or a line from another Fee Statement.

```sql
SELECT
  ad.id AS distribution_id,
  pa.id AS fee_allocation_id,
  pa.collection_receipt_id AS expected_collection_receipt_id,
  rt.collection_receipt_id AS actual_collection_receipt_id,
  pa.fee_statement_id AS expected_fee_statement_id,
  il.fee_statement_id AS actual_fee_statement_id
FROM clinician_value_allocations ad
JOIN fee_allocations pa
  ON pa.id = ad.fee_allocation_id
JOIN collection_tenders rt
  ON rt.id = ad.collection_tender_id
JOIN fee_statement_lines il
  ON il.id = ad.fee_statement_line_id
WHERE rt.collection_receipt_id <> pa.collection_receipt_id
   OR il.fee_statement_id <> pa.fee_statement_id;
```

### Clinician/category total equality control

For a selected application-date range, each of the following three totals must be equal after applying identical clinic, patient-category, clinician, and collection-mode filters.

```sql
WITH filtered AS (
  SELECT
    f.distribution_id,
    f.clinician_id,
    f.service_domain_id,
    f.collection_mode_code,
    f.applied_amount
  FROM dentos_analytics.v_allocated_collection_line_fact f
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND f.allocation_date >= :from_date::date
    AND f.allocation_date < :to_date::date + 1
    AND f.application_status = 'active'
    AND (:clinician_ids::uuid[] IS NULL OR f.clinician_id = ANY(:clinician_ids::uuid[]))
    AND (
      :service_domain_ids::uuid[] IS NULL
      OR f.service_domain_id = ANY(:service_domain_ids::uuid[])
    )
    AND (
      :collection_mode_codes::text[] IS NULL
      OR f.collection_mode_code = ANY(:collection_mode_codes::text[])
    )
),
base_total AS (
  SELECT COALESCE(SUM(applied_amount), 0.00)::numeric(14,2) AS amount
  FROM filtered
),
clinician_total AS (
  SELECT COALESCE(SUM(amount), 0.00)::numeric(14,2) AS amount
  FROM (
    SELECT clinician_id, SUM(applied_amount) AS amount
    FROM filtered
    GROUP BY clinician_id
  ) d
),
category_total AS (
  SELECT COALESCE(SUM(amount), 0.00)::numeric(14,2) AS amount
  FROM (
    SELECT service_domain_id, SUM(applied_amount) AS amount
    FROM filtered
    GROUP BY service_domain_id
  ) c
)
SELECT
  b.amount AS base_distribution_total,
  d.amount AS clinician_total,
  c.amount AS service_domain_total,
  (b.amount - d.amount)::numeric(14,2) AS clinician_variance,
  (b.amount - c.amount)::numeric(14,2) AS category_variance
FROM base_total b
CROSS JOIN clinician_total d
CROSS JOIN category_total c
WHERE b.amount <> d.amount
   OR b.amount <> c.amount;
```

The equality query must return zero rows. A nonzero result blocks financial report publication and creates a `report_reconciliation_failed` audit event containing the report key, clinic scope, date range, and variance without patient identifiers.

## 7. Required Reporting Indexes

```sql
CREATE INDEX ix_fee_statements_clinic_date_status_report
  ON fee_statements (clinic_id, statement_date, status, id)
  INCLUDE (patient_id, patient_category_id_snapshot);

CREATE INDEX ix_fee_statement_lines_clinician_fee_statement_report
  ON fee_statement_lines (lead_clinician_id, fee_statement_id, id)
  INCLUDE (service_id, line_total);

CREATE INDEX ix_fee_allocations_active_clinic_date_report
  ON fee_allocations (clinic_id, allocation_date, fee_statement_id, id)
  INCLUDE (collection_receipt_id, patient_id, applied_by, amount)
  WHERE status = 'active';

CREATE INDEX ix_clinician_value_allocations_application_line_tender_report
  ON clinician_value_allocations (fee_allocation_id, fee_statement_line_id, collection_tender_id)
  INCLUDE (amount);

CREATE INDEX ix_service_catalog_category_report
  ON service_catalog (category_id, id)
  INCLUDE (code, description);
```

Index migrations use `CREATE INDEX CONCURRENTLY` in production deployment tooling. The SQL above omits `CONCURRENTLY` so it remains valid inside a controlled schema migration transaction.

## 8. Mandatory Matrix Acceptance Fixtures

### Fixture A: multi-clinician and multi-category application

1. Create one issued Fee Statement dated `2026-01-15` with Endodontics line `600.00` assigned to clinician A and Implantology line `400.00` assigned to clinician B.
2. Create a `500.00` Collection dated `2026-01-20` with one CASH tender.
3. Apply `500.00` on `2026-01-20`; persist distributions `300.00` to the Endodontics line and `200.00` to the Implantology line.
4. Run the clinician matrix for January with `bucket_interval = 'month'`; expect clinician A production `600.00`, applied `300.00`, percentage `50.00`, and clinician B production `400.00`, applied `200.00`, percentage `50.00`.
5. Run the treatment-category breakdown for January; expect Endodontics CASH `300.00`, Implantology CASH `200.00`, and grand total `500.00`.
6. Verify the clinician, category, and base distribution totals each equal `500.00`.

### Fixture B: cross-quarter application timing

1. Create an issued Orthodontics Fee Statement line dated `2026-03-31` for clinician A with line total `1,200.00`.
2. Create and apply a `300.00` Collection on `2026-04-01` to that line.
3. Run monthly output from `2026-03-01` through `2026-04-30`; expect March production `1,200.00` and April fee allocation `300.00`.
4. Run quarterly output from `2026-01-01` through `2026-06-30`; expect Q1 bucket start `2026-01-01` production `1,200.00` and Q2 bucket start `2026-04-01` fee allocation `300.00`.
5. Run yearly output from `2026-01-01` through `2026-12-31`; expect bucket start `2026-01-01`, production `1,200.00`, and fee allocation `300.00`.
6. Run the April treatment-category breakdown; expect Orthodontics fee allocation `300.00` and March treatment-category fee allocation `0.00`.

### Fixture C: unapplied advance isolation

1. Create a `700.00` UPI Collection in the selected month and leave the full amount unapplied.
2. Verify gross collection increases by `700.00`.
3. Verify the unsettled collections register increases by `700.00`.
4. Verify the clinician applied-collection matrix does not increase.
5. Verify the treatment-category applied-collection breakdown does not increase.
6. Apply `280.00` of the Collection to a Fee Statement line owned by clinician B in Implantology.
7. Verify clinician B fee allocation increases by `280.00`, Implantology UPI increases by `280.00`, and unsettled collection decreases to `420.00`.

### Fixture D: reversal exclusion

1. Reverse the `280.00` application from fixture C with reversal date inside the selected month.
2. Verify the original application and distribution rows remain stored.
3. Verify the clinician matrix excludes the reversed `280.00` from active fee allocation.
4. Verify the treatment-category matrix excludes the reversed `280.00`.
5. Verify the Collection's unapplied amount returns to `700.00` unless a refund or another active application changes it.
6. Verify the financial audit report shows the original application, reversal user, reversal date, and reversal reason.

## 9. Monthly Clinician Booking Attrition

This is the required clean-room contract for the care booking attrition matrix. It reports care_bookings whose current final state is `cancelled` or `no_show`; it does not count every historical cancellation event. A terminal state that was later corrected back to `scheduled` remains visible in the status-event audit report but is excluded from this current-final-state matrix.

### Authoritative row and history view

```sql
CREATE OR REPLACE VIEW dentos_analytics.v_booking_outcome_fact AS
SELECT
  a.id AS care_booking_id,
  a.organization_id,
  a.clinic_id,
  c.name AS clinic_name,
  c.timezone AS clinic_timezone,
  a.care_booking_no,
  a.patient_id,
  COALESCE(p.patient_no, '') AS patient_code,
  COALESCE(p.display_name, CONCAT_WS(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
  a.patient_kind,
  a.lead_clinician_id AS clinician_id,
  ds.display_name AS clinician_name,
  a.reason_id AS care_booking_reason_id,
  ar.name AS care_booking_reason_name,
  a.starts_at,
  a.ends_at,
  (a.starts_at AT TIME ZONE c.timezone)::date AS scheduled_business_date,
  a.status AS terminal_status,
  latest_history.sequence_no AS terminal_sequence_no,
  latest_history.from_status,
  latest_history.to_status,
  latest_history.changed_at AS terminal_changed_at,
  (latest_history.changed_at AT TIME ZONE c.timezone)::date AS terminal_business_date,
  latest_history.changed_by AS terminal_actor_user_id,
  u.display_name AS terminal_actor_name,
  latest_history.reason AS terminal_reason,
  a.cancelled_at,
  a.cancelled_by,
  a.cancellation_reason,
  a.no_show_marked_at,
  a.no_show_marked_by,
  a.no_show_reason
FROM care_bookings a
JOIN clinics c
  ON c.id = a.clinic_id
JOIN staff ds
  ON ds.id = a.lead_clinician_id
JOIN care_booking_reasons ar
  ON ar.id = a.reason_id
LEFT JOIN patients p
  ON p.id = a.patient_id
JOIN LATERAL (
  SELECT
    h.id,
    h.sequence_no,
    h.from_status,
    h.to_status,
    h.changed_at,
    h.changed_by,
    h.reason
  FROM care_booking_state_events h
  WHERE h.care_booking_id = a.id
  ORDER BY h.sequence_no DESC
  LIMIT 1
) latest_history
  ON latest_history.to_status = a.status
JOIN users u
  ON u.id = latest_history.changed_by
WHERE a.status IN ('cancelled','no_show')
  AND (
    (a.status = 'cancelled'
      AND latest_history.changed_at = a.cancelled_at
      AND latest_history.changed_by = a.cancelled_by
      AND latest_history.reason = a.cancellation_reason)
    OR
    (a.status = 'no_show'
      AND latest_history.changed_at = a.no_show_marked_at
      AND latest_history.changed_by = a.no_show_marked_by
      AND latest_history.reason = a.no_show_reason)
  );
```

The lateral query returns exactly one latest history row per care booking by descending care booking-scoped `sequence_no`. Repeated history transitions therefore cannot multiply an care_booking. The final predicates require `care_bookings.status`, the latest `care_booking_state_events.to_status`, actor, timestamp, and reason to agree before the row can enter the analytics.

### Date-basis contract

The interface exposes a required `Date Basis` control with these two values:

| Value | Bucket source | Meaning |
|---|---|---|
| `scheduled_date` | `(care_bookings.starts_at AT TIME ZONE clinics.timezone)::date` | Default; attributes attrition to the month in which the encounter was scheduled to occur |
| `transition_date` | `(care_booking_state_events.changed_at AT TIME ZONE clinics.timezone)::date` | Attributes attrition to the month in which the user or service identity marked the final status |

The selected value appears in the grid subtitle, print header, spreadsheet metadata sheet, saved report definition, and asynchronous export filter snapshot. The service rejects every other value with `CARE_BOOKING_ATTRITION_DATE_BASIS_INVALID`.

### Interface parameters

| Control | Parameter | Type and default | Behavior |
|---|---|---|---|
| Clinic Branch | `:clinic_ids` | required `uuid[]` | Intersect with the requester's authorized clinic memberships |
| From Date | `:from_date` | required `date` | Inclusive date under the selected date basis |
| To Date | `:to_date` | required `date` | Inclusive date under the selected date basis |
| Date Basis | `:date_basis` | required `text`, default `scheduled_date` | Accepts `scheduled_date` or `transition_date` |
| Lead Clinician | `:clinician_ids` | nullable `uuid[]` | Filters `care_bookings.lead_clinician_id` |
| Final Status | `:terminal_statuses` | nullable `text[]`, default both values | Each member must be `cancelled` or `no_show` |
| Marked By | `:terminal_actor_user_ids` | nullable `uuid[]` | Filters `care_booking_state_events.changed_by` |
| Care Booking Reason | `:care_booking_reason_ids` | nullable `uuid[]` | Filters `care_bookings.reason_id` |
| Patient Kind | `:patient_kinds` | nullable `text[]` | Each member must be `new` or `established` |

The toolbar contains `Apply`, `Reset`, `Print`, and `Export`. The grid has fixed columns `Month`, `Clinic`, `Lead Clinician`, `Cancelled`, `No-Show`, `Total Attrition`, `Cancellation Actors`, and `No-Show Actors`. Selecting any numeric cell opens the drill-down with the identical filter snapshot.

### Complete zero-filled monthly clinician grid SQL

```sql
WITH parameter_guard AS (
  SELECT
    :from_date::date AS from_date,
    :to_date::date AS to_date,
    :date_basis::text AS date_basis
  WHERE :from_date::date <= :to_date::date
    AND :date_basis::text IN ('scheduled_date','transition_date')
    AND (
      :terminal_statuses::text[] IS NULL
      OR :terminal_statuses::text[] <@ ARRAY['cancelled','no_show']::text[]
    )
    AND (
      :patient_kinds::text[] IS NULL
      OR :patient_kinds::text[] <@ ARRAY['new','established']::text[]
    )
),
month_axis AS (
  SELECT GENERATE_SERIES(
           date_trunc('month', pg.from_date)::date,
           date_trunc('month', pg.to_date)::date,
           interval '1 month'
         )::date AS month_start
  FROM parameter_guard pg
),
configured_clinicians AS (
  SELECT
    sc.clinic_id,
    s.id AS clinician_id,
    s.display_name AS clinician_name
  FROM staff_clinics sc
  JOIN staff s
    ON s.id = sc.staff_id
  WHERE sc.clinic_id = ANY(:clinic_ids::uuid[])
    AND sc.active = true
    AND s.active = true
    AND s.staff_type = 'clinician'
    AND (:clinician_ids::uuid[] IS NULL OR s.id = ANY(:clinician_ids::uuid[]))
),
historical_clinicians AS (
  SELECT DISTINCT
    f.clinic_id,
    f.clinician_id,
    f.clinician_name
  FROM dentos_analytics.v_booking_outcome_fact f
  CROSS JOIN parameter_guard pg
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND CASE pg.date_basis
          WHEN 'scheduled_date' THEN f.scheduled_business_date
          WHEN 'transition_date' THEN f.terminal_business_date
        END >= pg.from_date
    AND CASE pg.date_basis
          WHEN 'scheduled_date' THEN f.scheduled_business_date
          WHEN 'transition_date' THEN f.terminal_business_date
        END < pg.to_date + 1
    AND (:clinician_ids::uuid[] IS NULL OR f.clinician_id = ANY(:clinician_ids::uuid[]))
),
clinician_axis AS (
  SELECT clinic_id, clinician_id, clinician_name FROM configured_clinicians
  UNION
  SELECT clinic_id, clinician_id, clinician_name FROM historical_clinicians
),
filtered_attrition AS (
  SELECT
    f.care_booking_id,
    f.clinic_id,
    f.clinician_id,
    f.terminal_status,
    f.terminal_actor_user_id,
    date_trunc(
      'month',
      CASE pg.date_basis
        WHEN 'scheduled_date' THEN f.scheduled_business_date
        WHEN 'transition_date' THEN f.terminal_business_date
      END
    )::date AS month_start
  FROM dentos_analytics.v_booking_outcome_fact f
  CROSS JOIN parameter_guard pg
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND CASE pg.date_basis
          WHEN 'scheduled_date' THEN f.scheduled_business_date
          WHEN 'transition_date' THEN f.terminal_business_date
        END >= pg.from_date
    AND CASE pg.date_basis
          WHEN 'scheduled_date' THEN f.scheduled_business_date
          WHEN 'transition_date' THEN f.terminal_business_date
        END < pg.to_date + 1
    AND (:clinician_ids::uuid[] IS NULL OR f.clinician_id = ANY(:clinician_ids::uuid[]))
    AND (:terminal_statuses::text[] IS NULL OR f.terminal_status = ANY(:terminal_statuses::text[]))
    AND (:terminal_actor_user_ids::uuid[] IS NULL OR f.terminal_actor_user_id = ANY(:terminal_actor_user_ids::uuid[]))
    AND (:care_booking_reason_ids::uuid[] IS NULL OR f.care_booking_reason_id = ANY(:care_booking_reason_ids::uuid[]))
    AND (:patient_kinds::text[] IS NULL OR f.patient_kind = ANY(:patient_kinds::text[]))
),
monthly_counts AS (
  SELECT
    f.month_start,
    f.clinic_id,
    f.clinician_id,
    COUNT(DISTINCT f.care_booking_id) FILTER (WHERE f.terminal_status = 'cancelled') AS cancelled_count,
    COUNT(DISTINCT f.care_booking_id) FILTER (WHERE f.terminal_status = 'no_show') AS no_show_count,
    COUNT(DISTINCT f.care_booking_id) AS total_attrition_count,
    COUNT(DISTINCT f.terminal_actor_user_id) FILTER (WHERE f.terminal_status = 'cancelled') AS cancellation_actor_count,
    COUNT(DISTINCT f.terminal_actor_user_id) FILTER (WHERE f.terminal_status = 'no_show') AS no_show_actor_count
  FROM filtered_attrition f
  GROUP BY f.month_start, f.clinic_id, f.clinician_id
)
SELECT
  ma.month_start,
  (ma.month_start + interval '1 month')::date AS month_end_exclusive,
  da.clinic_id,
  c.name AS clinic_name,
  da.clinician_id,
  da.clinician_name,
  COALESCE(mc.cancelled_count, 0) AS cancelled_count,
  COALESCE(mc.no_show_count, 0) AS no_show_count,
  COALESCE(mc.total_attrition_count, 0) AS total_attrition_count,
  COALESCE(mc.cancellation_actor_count, 0) AS cancellation_actor_count,
  COALESCE(mc.no_show_actor_count, 0) AS no_show_actor_count,
  :date_basis::text AS date_basis
FROM month_axis ma
CROSS JOIN clinician_axis da
JOIN clinics c
  ON c.id = da.clinic_id
LEFT JOIN monthly_counts mc
  ON mc.month_start = ma.month_start
 AND mc.clinic_id = da.clinic_id
 AND mc.clinician_id = da.clinician_id
ORDER BY ma.month_start, c.name, da.clinician_name, da.clinician_id;
```

`month_axis CROSS JOIN clinician_axis` deliberately emits zero rows as numeric zero cells for months in which a selected clinician has no final cancellation or no-show. The `COUNT(DISTINCT care_booking_id)` expressions are defensive; the fact view already guarantees one row per care_booking.

### Complete drill-down SQL

```sql
WITH parameter_guard AS (
  SELECT
    :from_date::date AS from_date,
    :to_date::date AS to_date,
    :date_basis::text AS date_basis
  WHERE :from_date::date <= :to_date::date
    AND :date_basis::text IN ('scheduled_date','transition_date')
)
SELECT
  f.care_booking_id,
  f.care_booking_no,
  f.clinic_id,
  f.clinic_name,
  f.scheduled_business_date,
  f.starts_at,
  f.ends_at,
  f.patient_code,
  f.patient_name,
  f.patient_kind,
  f.clinician_id,
  f.clinician_name,
  f.care_booking_reason_id,
  f.care_booking_reason_name,
  f.from_status,
  f.terminal_status,
  f.terminal_changed_at,
  f.terminal_business_date,
  f.terminal_actor_user_id,
  f.terminal_actor_name,
  f.terminal_reason,
  :date_basis::text AS date_basis
FROM dentos_analytics.v_booking_outcome_fact f
CROSS JOIN parameter_guard pg
WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
  AND CASE pg.date_basis
        WHEN 'scheduled_date' THEN f.scheduled_business_date
        WHEN 'transition_date' THEN f.terminal_business_date
      END >= pg.from_date
  AND CASE pg.date_basis
        WHEN 'scheduled_date' THEN f.scheduled_business_date
        WHEN 'transition_date' THEN f.terminal_business_date
      END < pg.to_date + 1
  AND (:clinician_ids::uuid[] IS NULL OR f.clinician_id = ANY(:clinician_ids::uuid[]))
  AND (:terminal_statuses::text[] IS NULL OR f.terminal_status = ANY(:terminal_statuses::text[]))
  AND (:terminal_actor_user_ids::uuid[] IS NULL OR f.terminal_actor_user_id = ANY(:terminal_actor_user_ids::uuid[]))
  AND (:care_booking_reason_ids::uuid[] IS NULL OR f.care_booking_reason_id = ANY(:care_booking_reason_ids::uuid[]))
  AND (:patient_kinds::text[] IS NULL OR f.patient_kind = ANY(:patient_kinds::text[]))
ORDER BY
  CASE pg.date_basis
    WHEN 'scheduled_date' THEN f.scheduled_business_date
    WHEN 'transition_date' THEN f.terminal_business_date
  END,
  f.clinician_name,
  f.starts_at,
  f.care_booking_id;
```

### Required indexes

```sql
CREATE INDEX IF NOT EXISTS ix_care_bookings_terminal_month_clinician
  ON care_bookings (clinic_id, starts_at, lead_clinician_id, status, id)
  INCLUDE (cancelled_at, cancelled_by, no_show_marked_at, no_show_marked_by)
  WHERE status IN ('cancelled','no_show');

CREATE INDEX IF NOT EXISTS ix_care_booking_state_events_latest
  ON care_booking_state_events (care_booking_id, sequence_no DESC)
  INCLUDE (from_status, to_status, changed_at, changed_by, reason);

CREATE INDEX IF NOT EXISTS ix_care_booking_state_events_terminal_changed
  ON care_booking_state_events (to_status, changed_at, care_booking_id, changed_by)
  INCLUDE (from_status, reason)
  WHERE to_status IN ('cancelled','no_show');
```

The first index accelerates scheduled-month and clinician filtering. The second supports the one-row lateral latest-history lookup. The third accelerates transition-month and actor filtering.

### Reconciliation controls

The first query must return zero rows; it finds final care booking rows whose latest history event does not match the denormalized terminal state.

```sql
SELECT
  a.id AS care_booking_id,
  a.status AS care_booking_status,
  h.to_status AS latest_history_status,
  CASE a.status
    WHEN 'cancelled' THEN a.cancelled_at
    WHEN 'no_show' THEN a.no_show_marked_at
  END AS care_booking_terminal_at,
  h.changed_at AS history_terminal_at,
  CASE a.status
    WHEN 'cancelled' THEN a.cancelled_by
    WHEN 'no_show' THEN a.no_show_marked_by
  END AS care_booking_terminal_by,
  h.changed_by AS history_terminal_by
FROM care_bookings a
LEFT JOIN LATERAL (
  SELECT sh.to_status, sh.changed_at, sh.changed_by
  FROM care_booking_state_events sh
  WHERE sh.care_booking_id = a.id
  ORDER BY sh.sequence_no DESC
  LIMIT 1
) h ON true
WHERE a.status IN ('cancelled','no_show')
  AND (
    h.to_status IS DISTINCT FROM a.status
    OR h.changed_at IS DISTINCT FROM CASE a.status
         WHEN 'cancelled' THEN a.cancelled_at
         WHEN 'no_show' THEN a.no_show_marked_at
       END
    OR h.changed_by IS DISTINCT FROM CASE a.status
         WHEN 'cancelled' THEN a.cancelled_by
         WHEN 'no_show' THEN a.no_show_marked_by
       END
  );
```

For every monthly clinician row:

```text
total_attrition_count = cancelled_count + no_show_count
cancelled_count = count of distinct current-final care_bookings where status = 'cancelled'
no_show_count = count of distinct current-final care_bookings where status = 'no_show'
```

Grand totals are calculated from `filtered_attrition`, not by adding paginated grid rows. The sum of clinician totals for one clinic/month equals the clinic/month total because `care_bookings.lead_clinician_id` is required and each final care booking has exactly one current lead clinician.

### Mandatory acceptance fixture

1. Create care booking A for clinician 1 at `2026-01-10 10:00` clinic time; transition it from scheduled to cancelled on `2025-12-30` by user X with reason `PATIENT_REQUEST`.
2. Create care booking B for clinician 1 at `2026-01-11 11:00` clinic time; transition it from confirmed to no_show after its end and grace interval by the service user with reason `AUTO_END_PASSED`.
3. Create care booking C for clinician 2 at `2026-01-12 12:00` clinic time; cancel it by user Y and then perform an authorized correction back to scheduled before its start.
4. Run January with `date_basis = 'scheduled_date'`; expect clinician 1 cancelled `1`, no-show `1`, total attrition `2`; expect clinician 2 all three values `0`.
5. Run December 2025 with `date_basis = 'transition_date'`; expect care booking A under clinician 1 cancelled `1`.
6. Run January 2026 with `date_basis = 'transition_date'`; expect care booking B under clinician 1 no-show `1`; care booking A is absent from January transition-month output.
7. Verify care booking C is excluded because its current status and latest history state are scheduled, while its former cancelled event remains in the audit history.
8. Append multiple nonterminal history rows before the final event and rerun; verify each final care booking is counted once.
9. Open the cancelled cell drill-down; verify user X, the exact cancellation timestamp, reason, scheduled timestamp, clinician, and care booking number are displayed.
10. Filter `Marked By = user X`; verify care booking A remains and care booking B is excluded.
11. Filter `Final Status = no_show`; verify cancelled count `0`, no-show count `1`, and total attrition `1` for clinician 1 under the January scheduled-date basis.
12. Verify an unauthorized clinic ID supplied to grid, print, drill-down, or export returns no data and records a denied report-access audit event.

## 10. Orthodontic Tracking Source View

Orthodontic report membership comes only from the stable `ORTHODONTIC_ACTIVE` flag and typed `orthodontic_monthly` tracking assignment. Service descriptions, patient category labels, care booking comments, and editable display names are not membership predicates.

```sql
CREATE OR REPLACE VIEW dentos_analytics.v_orthodontic_adherence_fact AS
SELECT
  pfa.id AS tracking_assignment_id,
  pfa.patient_id,
  p.organization_id,
  pfa.clinic_id,
  c.name AS clinic_name,
  c.timezone AS clinic_timezone,
  p.patient_no AS patient_code,
  p.display_name AS patient_name,
  p.active AS patient_active,
  pf.id AS flag_id,
  pf.code AS flag_code,
  pfa.tracking_program,
  pfa.program_status,
  pfa.active AS assignment_active,
  pfa.enrolled_on,
  pfa.treating_clinician_id,
  ds.display_name AS treating_clinician_name,
  pfa.source_care_plan_id,
  pfa.source_care_plan_service_id,
  pfa.expected_encounter_interval_months,
  pfa.preferred_day_of_month,
  pfa.next_adjustment_due_date,
  pfa.appliance_type,
  pfa.orthodontic_stage,
  pfa.current_wire,
  pfa.default_adjustment_service_id,
  pr.code AS default_adjustment_service_code,
  pr.description AS default_adjustment_service_name,
  pfa.last_adjustment_care_encounter_id,
  pfa.ended_on,
  pfa.end_reason
FROM patient_flag_assignments pfa
JOIN patient_flags pf
  ON pf.id = pfa.flag_id
 AND pf.organization_id = (SELECT p_scope.organization_id FROM patients p_scope WHERE p_scope.id = pfa.patient_id)
JOIN patients p
  ON p.id = pfa.patient_id
JOIN clinics c
  ON c.id = pfa.clinic_id
 AND c.organization_id = p.organization_id
JOIN staff ds
  ON ds.id = pfa.treating_clinician_id
 AND ds.organization_id = p.organization_id
JOIN service_catalog pr
  ON pr.id = pfa.default_adjustment_service_id
 AND pr.organization_id = p.organization_id
WHERE pf.code = 'ORTHODONTIC_ACTIVE'
  AND pfa.tracking_program = 'orthodontic_monthly';
```

The scalar organization guard on `patient_flags` is redundant with the database validation trigger but intentionally visible in the report view. One row equals one orthodontic tracking assignment, including ended assignments needed for audit-period reports.

## 11. Orthodontic Monthly Adherence Delta

### Report and interface contract

- Report key: `clinical.orthodontic_monthly_encounter_delta`.
- Menu location: `Reports -> Clinical -> Orthodontic Monthly Encounter Delta`.
- Permission: `analytics.clinical.view`.
- Required parameters: `:clinic_ids uuid[]`, `:selected_month date`, `:include_paused boolean`, `:require_completed_adjustment boolean`.
- Optional parameters: `:clinician_ids uuid[]`, `:encounter_delta_states text[]`.
- Allowed encounter-delta states: `ENCOUNTERED`, `NOT_ENCOUNTERED`.
- Default selected month: current calendar month in the selected clinic's timezone.
- Default program cohort: active assignments; paused assignments appear only when `:include_paused = true`.
- Encounter success: at least one `care_encounters` row in the clinic/month with `checked_in_at IS NOT NULL` and status `checked_in`, `engaged`, or `checked_out`.
- Adjustment completion: at least one completed `care_deliveries` row linked to the tracking assignment and completed in the clinic/month.

The grid columns are `Encounter State`, `Clinic`, `Patient Code`, `Patient`, `Treating Clinician`, `Program Status`, `Appliance`, `Stage`, `Current Wire`, `Expected Interval`, `Next Adjustment Due`, `Encounter Count`, `Last Encounter Date`, `Adjustment Completed`, `Completed Adjustment Count`, `Next Linked Care Booking`, and `Days Overdue`. Fixed summary counters show `Active Orthodontic Patients`, `Visited`, `Not Visited`, `Adjustment Completed`, and `Encounter Without Completed Adjustment`.

### Complete monthly delta SQL

```sql
WITH parameter_guard AS (
  SELECT
    date_trunc('month', :selected_month::date)::date AS month_start,
    (date_trunc('month', :selected_month::date) + interval '1 month')::date AS month_end_exclusive
  WHERE :encounter_delta_states::text[] IS NULL
     OR :encounter_delta_states::text[] <@ ARRAY['ENCOUNTERED','NOT_ENCOUNTERED']::text[]
),
eligible_profiles AS (
  SELECT f.*
  FROM dentos_analytics.v_orthodontic_adherence_fact f
  CROSS JOIN parameter_guard pg
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND f.patient_active = true
    AND f.assignment_active = true
    AND f.enrolled_on < pg.month_end_exclusive
    AND (f.ended_on IS NULL OR f.ended_on >= pg.month_start)
    AND (
      f.program_status = 'active'
      OR (:include_paused::boolean AND f.program_status = 'paused')
    )
    AND (:clinician_ids::uuid[] IS NULL OR f.treating_clinician_id = ANY(:clinician_ids::uuid[]))
),
monthly_visits AS (
  SELECT
    ep.tracking_assignment_id,
    COUNT(DISTINCT v.id) AS encounter_count,
    MAX(v.encounter_date) AS last_encounter_date,
    (ARRAY_AGG(v.id ORDER BY v.encounter_date DESC, v.checked_in_at DESC, v.id DESC))[1] AS last_care_encounter_id
  FROM eligible_profiles ep
  CROSS JOIN parameter_guard pg
  JOIN care_encounters v
    ON v.patient_id = ep.patient_id
   AND v.clinic_id = ep.clinic_id
   AND v.encounter_date >= pg.month_start
   AND v.encounter_date < pg.month_end_exclusive
   AND v.checked_in_at IS NOT NULL
   AND v.status IN ('checked_in','engaged','checked_out')
  GROUP BY ep.tracking_assignment_id
),
monthly_adjustments AS (
  SELECT
    ep.tracking_assignment_id,
    COUNT(DISTINCT cp.id) AS completed_adjustment_count,
    MAX((cp.completed_at AT TIME ZONE ep.clinic_timezone)::date) AS last_adjustment_date
  FROM eligible_profiles ep
  CROSS JOIN parameter_guard pg
  JOIN care_deliveries cp
    ON cp.orthodontic_program_enrollment_id = ep.tracking_assignment_id
   AND cp.patient_id = ep.patient_id
   AND cp.status = 'completed'
   AND (cp.completed_at AT TIME ZONE ep.clinic_timezone)::date >= pg.month_start
   AND (cp.completed_at AT TIME ZONE ep.clinic_timezone)::date < pg.month_end_exclusive
  GROUP BY ep.tracking_assignment_id
),
next_linked_care_booking AS (
  SELECT
    ep.tracking_assignment_id,
    MIN(a.starts_at) AS next_care_booking_at
  FROM eligible_profiles ep
  JOIN care_bookings a
    ON a.orthodontic_program_enrollment_id = ep.tracking_assignment_id
   AND a.patient_id = ep.patient_id
   AND a.clinic_id = ep.clinic_id
   AND a.starts_at >= clock_timestamp()
   AND a.status IN ('scheduled','confirmed')
  GROUP BY ep.tracking_assignment_id
),
classified AS (
  SELECT
    ep.tracking_assignment_id,
    ep.clinic_id,
    ep.clinic_name,
    ep.patient_id,
    ep.patient_code,
    ep.patient_name,
    ep.treating_clinician_id,
    ep.treating_clinician_name,
    ep.program_status,
    ep.appliance_type,
    ep.orthodontic_stage,
    ep.current_wire,
    ep.expected_encounter_interval_months,
    ep.next_adjustment_due_date,
    COALESCE(mv.encounter_count, 0) AS encounter_count,
    mv.last_care_encounter_id,
    mv.last_encounter_date,
    COALESCE(ma.completed_adjustment_count, 0) AS completed_adjustment_count,
    ma.last_adjustment_date,
    nla.next_care_booking_at,
    CASE WHEN COALESCE(mv.encounter_count, 0) > 0 THEN 'ENCOUNTERED' ELSE 'NOT_ENCOUNTERED' END AS encounter_delta_state,
    CASE WHEN COALESCE(ma.completed_adjustment_count, 0) > 0 THEN true ELSE false END AS adjustment_completed,
    GREATEST(0, pg.month_end_exclusive - 1 - ep.next_adjustment_due_date) AS days_overdue
  FROM eligible_profiles ep
  CROSS JOIN parameter_guard pg
  LEFT JOIN monthly_visits mv ON mv.tracking_assignment_id = ep.tracking_assignment_id
  LEFT JOIN monthly_adjustments ma ON ma.tracking_assignment_id = ep.tracking_assignment_id
  LEFT JOIN next_linked_care_booking nla ON nla.tracking_assignment_id = ep.tracking_assignment_id
)
SELECT
  c.encounter_delta_state,
  c.clinic_id,
  c.clinic_name,
  c.patient_id,
  c.patient_code,
  c.patient_name,
  c.treating_clinician_id,
  c.treating_clinician_name,
  c.program_status,
  c.appliance_type,
  c.orthodontic_stage,
  c.current_wire,
  c.expected_encounter_interval_months,
  c.next_adjustment_due_date,
  c.encounter_count,
  c.last_care_encounter_id,
  c.last_encounter_date,
  c.adjustment_completed,
  c.completed_adjustment_count,
  c.last_adjustment_date,
  c.next_care_booking_at,
  c.days_overdue,
  COUNT(*) OVER () AS active_orthodontic_patient_count,
  COUNT(*) FILTER (WHERE c.encounter_delta_state = 'ENCOUNTERED') OVER () AS visited_patient_count,
  COUNT(*) FILTER (WHERE c.encounter_delta_state = 'NOT_ENCOUNTERED') OVER () AS not_visited_patient_count,
  COUNT(*) FILTER (WHERE c.adjustment_completed) OVER () AS adjustment_completed_patient_count,
  COUNT(*) FILTER (WHERE c.encounter_delta_state = 'ENCOUNTERED' AND NOT c.adjustment_completed) OVER () AS encounter_without_adjustment_count
FROM classified c
WHERE (:encounter_delta_states::text[] IS NULL OR c.encounter_delta_state = ANY(:encounter_delta_states::text[]))
  AND (NOT :require_completed_adjustment::boolean OR c.adjustment_completed)
ORDER BY
  CASE c.encounter_delta_state WHEN 'NOT_ENCOUNTERED' THEN 0 ELSE 1 END,
  c.days_overdue DESC,
  c.clinic_name,
  c.treating_clinician_name,
  c.patient_name,
  c.patient_id;
```

`ENCOUNTERED` and `NOT_ENCOUNTERED` are mutually exclusive and collectively exhaustive for the eligible profile cohort. The two counts must sum to `active_orthodontic_patient_count`. A checked-in encounter without a linked completed adjustment remains `ENCOUNTERED` and is separately visible through `adjustment_completed = false`.

## 12. Orthodontic Care Booking Churn and Defaulter Report

### Report and interface contract

- Report key: `clinical.orthodontic_care_booking_churn_defaulter`.
- Menu location: `Reports -> Clinical -> Orthodontic Care Booking Churn/Defaulter`.
- Permission: `analytics.clinical.view`.
- Required parameters: `:clinic_ids uuid[]`, `:as_of_at timestamptz`, `:lookback_months integer`, `:include_paused boolean`, `:min_no_show_count integer`, `:min_churn_count integer`, `:min_consecutive_missed integer`, `:min_churn_rate_percent numeric(7,2)`.
- Optional parameters: `:clinician_ids uuid[]`, `:defaulter_states text[]`.
- Allowed lookback: 1 through 36 calendar months; default 6.
- Default thresholds: no-shows `2`, churn events `3`, consecutive missed slots `2`, churn rate `50.00` percent.
- Allowed output states: `FREQUENT_DEFAULTER`, `WATCHLIST`, `COMPLIANT`, `NO_SCHEDULED_ADJUSTMENT`.
- Denominator: adjustment care_bookings explicitly linked by `care_bookings.orthodontic_program_enrollment_id`, scheduled inside the lookback and resolved by `:as_of_at`.

Outcome assignment is exact:

```text
cancelled = care_bookings.status = cancelled
no_show = care_bookings.status = no_show
attended = care_bookings.status = completed OR a non-cancelled linked encounter has checked_in_at
overdue_unattended = care booking end is before as_of_at, status is scheduled or confirmed, and no checked-in linked encounter exists
pending = care booking has not reached a final or overdue outcome; excluded from denominator
churn event = cancelled OR no_show OR overdue_unattended
```

### Complete churn and defaulter SQL

```sql
WITH parameter_guard AS (
  SELECT
    :as_of_at::timestamptz AS as_of_at,
    :lookback_months::integer AS lookback_months,
    :min_no_show_count::integer AS min_no_show_count,
    :min_churn_count::integer AS min_churn_count,
    :min_consecutive_missed::integer AS min_consecutive_missed,
    :min_churn_rate_percent::numeric(7,2) AS min_churn_rate_percent
  WHERE :lookback_months::integer BETWEEN 1 AND 36
    AND :min_no_show_count::integer >= 0
    AND :min_churn_count::integer >= 0
    AND :min_consecutive_missed::integer >= 0
    AND :min_churn_rate_percent::numeric(7,2) BETWEEN 0 AND 100
    AND (
      :defaulter_states::text[] IS NULL
      OR :defaulter_states::text[] <@ ARRAY['FREQUENT_DEFAULTER','WATCHLIST','COMPLIANT','NO_SCHEDULED_ADJUSTMENT']::text[]
    )
),
eligible_profiles AS (
  SELECT f.*
  FROM dentos_analytics.v_orthodontic_adherence_fact f
  WHERE f.clinic_id = ANY(:clinic_ids::uuid[])
    AND f.patient_active = true
    AND f.assignment_active = true
    AND (
      f.program_status = 'active'
      OR (:include_paused::boolean AND f.program_status = 'paused')
    )
    AND (:clinician_ids::uuid[] IS NULL OR f.treating_clinician_id = ANY(:clinician_ids::uuid[]))
),
care_booking_base AS (
  SELECT
    ep.tracking_assignment_id,
    ep.patient_id,
    ep.clinic_id,
    ep.clinic_timezone,
    a.id AS care_booking_id,
    a.care_booking_no,
    a.starts_at,
    a.ends_at,
    (a.starts_at AT TIME ZONE ep.clinic_timezone)::date AS scheduled_local_date,
    a.status,
    EXISTS (
      SELECT 1
      FROM care_encounters v
      WHERE v.care_booking_id = a.id
        AND v.patient_id = ep.patient_id
        AND v.clinic_id = ep.clinic_id
        AND v.checked_in_at IS NOT NULL
        AND v.status IN ('checked_in','engaged','checked_out')
    ) AS has_attended_visit
  FROM eligible_profiles ep
  CROSS JOIN parameter_guard pg
  JOIN care_bookings a
    ON a.orthodontic_program_enrollment_id = ep.tracking_assignment_id
   AND a.patient_id = ep.patient_id
   AND a.clinic_id = ep.clinic_id
  WHERE (a.starts_at AT TIME ZONE ep.clinic_timezone)::date >=
        (date_trunc('month', pg.as_of_at AT TIME ZONE ep.clinic_timezone)::date - make_interval(months => pg.lookback_months - 1))::date
    AND a.starts_at <= pg.as_of_at
),
resolved_outcomes AS (
  SELECT
    ab.*,
    CASE
      WHEN ab.status = 'cancelled' THEN 'cancelled'
      WHEN ab.status = 'no_show' THEN 'no_show'
      WHEN ab.status = 'completed' OR ab.has_attended_visit THEN 'attended'
      WHEN ab.status IN ('scheduled','confirmed') AND ab.ends_at < pg.as_of_at THEN 'overdue_unattended'
      ELSE 'pending'
    END AS outcome
  FROM care_booking_base ab
  CROSS JOIN parameter_guard pg
),
denominator_outcomes AS (
  SELECT *
  FROM resolved_outcomes
  WHERE outcome <> 'pending'
),
ordered_outcomes AS (
  SELECT
    d.*,
    SUM(CASE WHEN d.outcome = 'attended' THEN 1 ELSE 0 END) OVER (
      PARTITION BY d.tracking_assignment_id
      ORDER BY d.starts_at DESC, d.care_booking_id DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS attended_seen_from_latest
  FROM denominator_outcomes d
),
metrics AS (
  SELECT
    ep.tracking_assignment_id,
    COUNT(oo.care_booking_id) AS eligible_adjustment_care_booking_count,
    COUNT(oo.care_booking_id) FILTER (WHERE oo.outcome = 'attended') AS attended_count,
    COUNT(oo.care_booking_id) FILTER (WHERE oo.outcome = 'cancelled') AS cancelled_count,
    COUNT(oo.care_booking_id) FILTER (WHERE oo.outcome = 'no_show') AS no_show_count,
    COUNT(oo.care_booking_id) FILTER (WHERE oo.outcome = 'overdue_unattended') AS overdue_unattended_count,
    COUNT(oo.care_booking_id) FILTER (WHERE oo.outcome IN ('cancelled','no_show','overdue_unattended')) AS churn_event_count,
    COUNT(oo.care_booking_id) FILTER (
      WHERE oo.outcome IN ('cancelled','no_show','overdue_unattended')
        AND oo.attended_seen_from_latest = 0
    ) AS consecutive_missed_count,
    MAX(oo.scheduled_local_date) FILTER (WHERE oo.outcome = 'attended') AS last_attended_date,
    MAX(oo.scheduled_local_date) FILTER (WHERE oo.outcome IN ('cancelled','no_show','overdue_unattended')) AS last_churn_date
  FROM eligible_profiles ep
  LEFT JOIN ordered_outcomes oo ON oo.tracking_assignment_id = ep.tracking_assignment_id
  GROUP BY ep.tracking_assignment_id
),
classified AS (
  SELECT
    ep.*,
    m.eligible_adjustment_care_booking_count,
    m.attended_count,
    m.cancelled_count,
    m.no_show_count,
    m.overdue_unattended_count,
    m.churn_event_count,
    m.consecutive_missed_count,
    m.last_attended_date,
    m.last_churn_date,
    ROUND(100.00 * m.churn_event_count / NULLIF(m.eligible_adjustment_care_booking_count, 0), 2) AS churn_rate_percent,
    CASE
      WHEN m.eligible_adjustment_care_booking_count = 0 THEN 'NO_SCHEDULED_ADJUSTMENT'
      WHEN (pg.min_no_show_count > 0 AND m.no_show_count >= pg.min_no_show_count)
        OR (pg.min_churn_count > 0 AND m.churn_event_count >= pg.min_churn_count)
        OR (pg.min_consecutive_missed > 0 AND m.consecutive_missed_count >= pg.min_consecutive_missed)
        OR (pg.min_churn_rate_percent > 0 AND ROUND(100.00 * m.churn_event_count / NULLIF(m.eligible_adjustment_care_booking_count, 0), 2) >= pg.min_churn_rate_percent)
        THEN 'FREQUENT_DEFAULTER'
      WHEN m.churn_event_count > 0 THEN 'WATCHLIST'
      ELSE 'COMPLIANT'
    END AS defaulter_state
  FROM eligible_profiles ep
  JOIN metrics m ON m.tracking_assignment_id = ep.tracking_assignment_id
  CROSS JOIN parameter_guard pg
)
SELECT
  c.defaulter_state,
  c.clinic_id,
  c.clinic_name,
  c.patient_id,
  c.patient_code,
  c.patient_name,
  c.treating_clinician_id,
  c.treating_clinician_name,
  c.program_status,
  c.appliance_type,
  c.orthodontic_stage,
  c.current_wire,
  c.next_adjustment_due_date,
  c.eligible_adjustment_care_booking_count,
  c.attended_count,
  c.cancelled_count,
  c.no_show_count,
  c.overdue_unattended_count,
  c.churn_event_count,
  c.consecutive_missed_count,
  c.churn_rate_percent,
  c.last_attended_date,
  c.last_churn_date
FROM classified c
WHERE :defaulter_states::text[] IS NULL OR c.defaulter_state = ANY(:defaulter_states::text[])
ORDER BY
  CASE c.defaulter_state
    WHEN 'FREQUENT_DEFAULTER' THEN 0
    WHEN 'WATCHLIST' THEN 1
    WHEN 'NO_SCHEDULED_ADJUSTMENT' THEN 2
    WHEN 'COMPLIANT' THEN 3
  END,
  c.churn_rate_percent DESC NULLS LAST,
  c.consecutive_missed_count DESC,
  c.clinic_name,
  c.treating_clinician_name,
  c.patient_name,
  c.patient_id;
```

The grid displays `FREQUENT_DEFAULTER` when any enabled threshold is met. A threshold value of zero disables that one condition; the displayed defaults enable all four conditions.

### Required report indexes

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_flag_assignments_active_ortho_program
  ON patient_flag_assignments (patient_id, clinic_id, tracking_program)
  WHERE tracking_program = 'orthodontic_monthly'
    AND program_status IN ('active','paused')
    AND active = true;

CREATE INDEX IF NOT EXISTS ix_patient_flag_assignments_ortho_due
  ON patient_flag_assignments (clinic_id, program_status, next_adjustment_due_date, treating_clinician_id, patient_id)
  WHERE tracking_program = 'orthodontic_monthly' AND active = true;

CREATE INDEX IF NOT EXISTS ix_care_bookings_ortho_tracking_start
  ON care_bookings (orthodontic_program_enrollment_id, starts_at, status, id)
  WHERE orthodontic_program_enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_care_deliveries_ortho_tracking_visit
  ON care_deliveries (orthodontic_program_enrollment_id, care_encounter_id, status, completed_at)
  WHERE orthodontic_program_enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_care_encounters_patient_clinic_date
  ON care_encounters (patient_id, clinic_id, encounter_date, status, id)
  INCLUDE (checked_in_at, lead_clinician_id);
```

### Reconciliation queries

The first query must return zero rows. It detects an orthodontic care booking whose patient or clinic differs from its program assignment.

```sql
SELECT
  a.id AS care_booking_id,
  a.patient_id AS care_booking_patient_id,
  pfa.patient_id AS tracking_patient_id,
  a.clinic_id AS care_booking_clinic_id,
  pfa.clinic_id AS tracking_clinic_id
FROM care_bookings a
JOIN patient_flag_assignments pfa ON pfa.id = a.orthodontic_program_enrollment_id
WHERE a.patient_id IS DISTINCT FROM pfa.patient_id
   OR a.clinic_id IS DISTINCT FROM pfa.clinic_id
   OR pfa.tracking_program <> 'orthodontic_monthly';
```

The second query must return zero rows. It detects a linked orthodontic service whose encounter belongs to another patient or clinic.

```sql
SELECT
  cp.id AS care_delivery_id,
  cp.patient_id AS service_patient_id,
  v.patient_id AS encounter_patient_id,
  v.clinic_id AS encounter_clinic_id,
  pfa.patient_id AS tracking_patient_id,
  pfa.clinic_id AS tracking_clinic_id
FROM care_deliveries cp
JOIN care_encounters v ON v.id = cp.care_encounter_id
JOIN patient_flag_assignments pfa ON pfa.id = cp.orthodontic_program_enrollment_id
WHERE cp.patient_id IS DISTINCT FROM v.patient_id
   OR cp.patient_id IS DISTINCT FROM pfa.patient_id
   OR v.clinic_id IS DISTINCT FROM pfa.clinic_id
   OR pfa.tracking_program <> 'orthodontic_monthly';
```

### Mandatory orthodontic report fixture

1. Enroll patients A, B, C, and D in active `ORTHODONTIC_ACTIVE` monthly tracking for clinic 1 and clinician 1, using interval 1 month.
2. In the selected month, check patient A into one encounter and complete one linked wire-change service.
3. Check patient B into one encounter but complete no linked orthodontic adjustment service.
4. Give patient C no encounter in the selected month.
5. Pause patient D before the selected month.
6. Run Monthly Encounter Delta with `include_paused = false`; expect A `ENCOUNTERED` with adjustment complete, B `ENCOUNTERED` without adjustment complete, C `NOT_ENCOUNTERED`, and D absent.
7. Verify summary totals: active patients `3`, visited `2`, not visited `1`, adjustment completed `1`, encounter without adjustment `1`.
8. Run with `include_paused = true`; expect patient D and recomputed totals.
9. Create six linked adjustment care_bookings for patient A in the churn lookback: three attended, one cancelled, and two no-show.
10. Create four linked adjustment care_bookings for patient B: three attended and one cancelled.
11. Create no linked adjustment care booking for patient C.
12. Use defaults `min_no_show_count = 2`, `min_churn_count = 3`, `min_consecutive_missed = 2`, and `min_churn_rate_percent = 50.00`.
13. Expect patient A `FREQUENT_DEFAULTER`, patient B `WATCHLIST`, and patient C `NO_SCHEDULED_ADJUSTMENT`.
14. Verify patient A denominator `6`, attended `3`, cancelled `1`, no-show `2`, churn events `3`, and churn rate `50.00`.
15. Add an unrelated emergency care booking for patient A with null `orthodontic_program_enrollment_id`; verify every churn metric remains unchanged.
16. Correct one no-show care booking to scheduled before its start; verify it becomes pending and leaves the denominator until resolved.
17. Verify clinic, clinician, state, lookback, threshold, print, export, and drill-down filters use the same query version and authorized clinic intersection.

<!-- ZERO_SHORTCUT_REPORT_CATALOG -->

## 13. Complete Per-Report Query Registry

Every visible report leaf has its own key, parameter contract, output columns, SQL text, permission, and total rule below. The SQL repeats its joins intentionally so a developer does not need to infer a source from a category summary.

## 13.1 Priority Views - Explicit Report Contracts

### Patient Encounters Register

- Internal key: `favourites.care_encounters_register`
- Category: `Favourites`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_id, queue_sequence, patient_code, patient_name, clinician_name, reason_name, encounter_type, status, arrival_at, checked_in_at, engaged_at, checked_out_at, waiting_minutes, service_minutes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT v.id AS record_id, v.clinic_id, v.encounter_date AS business_date, v.queue_sequence,
       v.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       p.category_id, pc.name AS category_name, v.lead_clinician_id AS clinician_id,
       ds.display_name AS clinician_name, v.reason_id, ar.name AS reason_name,
       v.encounter_type, v.status, v.arrival_at, v.checked_in_at, v.engaged_at, v.checked_out_at,
       EXTRACT(epoch FROM (v.engaged_at - COALESCE(v.checked_in_at, v.arrival_at))) / 60.0 AS waiting_minutes,
       EXTRACT(epoch FROM (v.checked_out_at - v.engaged_at)) / 60.0 AS service_minutes,
       1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_encounters v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
LEFT JOIN staff ds ON ds.id = v.lead_clinician_id
LEFT JOIN care_booking_reasons ar ON ar.id = v.reason_id
)
SELECT
  business_date,
  record_id,
  queue_sequence,
  patient_code,
  patient_name,
  clinician_name,
  reason_name,
  encounter_type,
  status,
  arrival_at,
  checked_in_at,
  engaged_at,
  checked_out_at,
  waiting_minutes,
  service_minutes
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
ORDER BY business_date;
```

## 13.2 Expense Control - Explicit Report Contracts

### Daily Expense

- Internal key: `expenses.daily_expense`
- Category: `Expenses`
- Source fact: `expense`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Collection Method `text[]` optional where the fact contains a mode.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT record_id) AS expense_count, SUM(gross_amount) AS gross_expense, SUM(tax_amount) AS tax_amount, SUM(amount) AS total_expense.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT e.id AS record_id, e.clinic_id, e.expense_date AS business_date, e.voucher_no AS record_no,
       e.expense_head_id, eh.name AS expense_head_name, e.supplier_id, s.name AS supplier_name,
       e.collection_method_id, pm.code AS mode_code, pm.name AS mode_name,
       e.gross_amount, e.tax_amount, e.total_amount AS amount, e.status, e.created_by AS user_id
FROM expenses e
JOIN expense_heads eh ON eh.id = e.expense_head_id
LEFT JOIN suppliers s ON s.id = e.supplier_id
LEFT JOIN collection_methods pm ON pm.id = e.collection_method_id
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT record_id) AS expense_count,
  SUM(gross_amount) AS gross_expense,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS total_expense
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND status = 'posted'
GROUP BY business_date
ORDER BY business_date;
```

### Dental Lab wise Collections

- Internal key: `expenses.dental_lab_wise_payments`
- Category: `Expenses`
- Source fact: `lab_payment`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Collection Method `text[]` optional where the fact contains a mode.
- Output columns: lab_name AS dimension_1_dental_lab, COUNT(DISTINCT record_id) AS collection_count, SUM(amount) AS paid_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lp.id AS record_id, lp.clinic_id, lp.collection_date AS business_date,
       lp.lab_id, dl.name AS lab_name, lp.collection_method_id, pm.code AS mode_code,
       pm.name AS mode_name, lp.amount, lp.reference_no AS record_no, lp.status
FROM lab_disbursements lp
JOIN dental_labs dl ON dl.id = lp.lab_id
LEFT JOIN collection_methods pm ON pm.id = lp.collection_method_id
)
SELECT
  lab_name AS dimension_1_dental_lab,
  COUNT(DISTINCT record_id) AS collection_count,
  SUM(amount) AS paid_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND status = 'posted'
GROUP BY lab_name
ORDER BY lab_name;
```

### Expense Head wise expenses

- Internal key: `expenses.expense_head_wise_expenses`
- Category: `Expenses`
- Source fact: `expense`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Collection Method `text[]` optional where the fact contains a mode.
- Output columns: expense_head_name AS dimension_1_expense_head, COUNT(DISTINCT record_id) AS expense_count, SUM(gross_amount) AS gross_expense, SUM(tax_amount) AS tax_amount, SUM(amount) AS total_expense.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT e.id AS record_id, e.clinic_id, e.expense_date AS business_date, e.voucher_no AS record_no,
       e.expense_head_id, eh.name AS expense_head_name, e.supplier_id, s.name AS supplier_name,
       e.collection_method_id, pm.code AS mode_code, pm.name AS mode_name,
       e.gross_amount, e.tax_amount, e.total_amount AS amount, e.status, e.created_by AS user_id
FROM expenses e
JOIN expense_heads eh ON eh.id = e.expense_head_id
LEFT JOIN suppliers s ON s.id = e.supplier_id
LEFT JOIN collection_methods pm ON pm.id = e.collection_method_id
)
SELECT
  expense_head_name AS dimension_1_expense_head,
  COUNT(DISTINCT record_id) AS expense_count,
  SUM(gross_amount) AS gross_expense,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS total_expense
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND status = 'posted'
GROUP BY expense_head_name
ORDER BY expense_head_name;
```

### Mailing Labels for Account Heads

- Internal key: `expenses.mailing_labels_for_account_heads`
- Category: `Expenses`
- Source fact: `account_label`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required.
- Output columns: Account Head ID, Account Name, Address Line 1, Address Line 2, City, State, Postal Code, Phone, GSTIN.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT s.id AS account_head_id, s.name AS account_name,
       s.address_json ->> 'line1' AS address_line_1,
       s.address_json ->> 'line2' AS address_line_2,
       s.address_json ->> 'city' AS city,
       s.address_json ->> 'state' AS state,
       s.address_json ->> 'postal_code' AS postal_code,
       s.phone, s.gstin
FROM suppliers s
WHERE s.organization_id = :organization_id::uuid AND s.active = true
ORDER BY s.name, s.id;
```

### Monthly Expense

- Internal key: `expenses.monthly_expense`
- Category: `Expenses`
- Source fact: `expense`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Collection Method `text[]` optional where the fact contains a mode.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT record_id) AS expense_count, SUM(gross_amount) AS gross_expense, SUM(tax_amount) AS tax_amount, SUM(amount) AS total_expense.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT e.id AS record_id, e.clinic_id, e.expense_date AS business_date, e.voucher_no AS record_no,
       e.expense_head_id, eh.name AS expense_head_name, e.supplier_id, s.name AS supplier_name,
       e.collection_method_id, pm.code AS mode_code, pm.name AS mode_name,
       e.gross_amount, e.tax_amount, e.total_amount AS amount, e.status, e.created_by AS user_id
FROM expenses e
JOIN expense_heads eh ON eh.id = e.expense_head_id
LEFT JOIN suppliers s ON s.id = e.supplier_id
LEFT JOIN collection_methods pm ON pm.id = e.collection_method_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT record_id) AS expense_count,
  SUM(gross_amount) AS gross_expense,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS total_expense
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND status = 'posted'
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Supplier wise Collections

- Internal key: `expenses.supplier_wise_payments`
- Category: `Expenses`
- Source fact: `expense`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Collection Method `text[]` optional where the fact contains a mode.
- Output columns: supplier_name AS dimension_1_supplier_account, COUNT(DISTINCT record_id) AS expense_count, SUM(gross_amount) AS gross_expense, SUM(tax_amount) AS tax_amount, SUM(amount) AS total_expense.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT e.id AS record_id, e.clinic_id, e.expense_date AS business_date, e.voucher_no AS record_no,
       e.expense_head_id, eh.name AS expense_head_name, e.supplier_id, s.name AS supplier_name,
       e.collection_method_id, pm.code AS mode_code, pm.name AS mode_name,
       e.gross_amount, e.tax_amount, e.total_amount AS amount, e.status, e.created_by AS user_id
FROM expenses e
JOIN expense_heads eh ON eh.id = e.expense_head_id
LEFT JOIN suppliers s ON s.id = e.supplier_id
LEFT JOIN collection_methods pm ON pm.id = e.collection_method_id
)
SELECT
  supplier_name AS dimension_1_supplier_account,
  COUNT(DISTINCT record_id) AS expense_count,
  SUM(gross_amount) AS gross_expense,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS total_expense
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND status = 'posted'
GROUP BY supplier_name
ORDER BY supplier_name;
```

## 13.3 Clinician Performance - Explicit Report Contracts

### Lead Clinician wise fee allocations

- Internal key: `clinicians.attending_clinician_wise_allocated_collections`
- Category: `Clinicians`
- Source fact: `application`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Applied By User `uuid[]` optional.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT fee_allocation_id) AS application_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) AS applied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ad.id AS record_id, r.clinic_id, pa.allocation_date AS business_date,
       pa.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       pa.applied_by AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, ad.amount,
       pa.id AS fee_allocation_id, pa.collection_receipt_id, pa.fee_statement_id, pa.status
FROM clinician_value_allocations ad
JOIN fee_allocations pa ON pa.id = ad.fee_allocation_id
JOIN collection_receipts r ON r.id = pa.collection_receipt_id
JOIN patients p ON p.id = pa.patient_id
JOIN fee_statement_lines il ON il.id = ad.fee_statement_line_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
JOIN collection_tenders rt ON rt.id = ad.collection_tender_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
JOIN users u ON u.id = pa.applied_by
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT fee_allocation_id) AS application_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) AS applied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status = 'active'
  AND (:applied_by_user_ids::uuid[] IS NULL OR user_id = ANY(:applied_by_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Lead Clinician wise fee allocations summary

- Internal key: `clinicians.attending_clinician_wise_allocated_collections_summary`
- Category: `Clinicians`
- Source fact: `application`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Applied By User `uuid[]` optional.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT fee_allocation_id) AS application_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) AS applied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ad.id AS record_id, r.clinic_id, pa.allocation_date AS business_date,
       pa.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       pa.applied_by AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, ad.amount,
       pa.id AS fee_allocation_id, pa.collection_receipt_id, pa.fee_statement_id, pa.status
FROM clinician_value_allocations ad
JOIN fee_allocations pa ON pa.id = ad.fee_allocation_id
JOIN collection_receipts r ON r.id = pa.collection_receipt_id
JOIN patients p ON p.id = pa.patient_id
JOIN fee_statement_lines il ON il.id = ad.fee_statement_line_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
JOIN collection_tenders rt ON rt.id = ad.collection_tender_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
JOIN users u ON u.id = pa.applied_by
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT fee_allocation_id) AS application_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) AS applied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status = 'active'
  AND (:applied_by_user_ids::uuid[] IS NULL OR user_id = ANY(:applied_by_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Lead Clinician wise Care Bookings

- Internal key: `clinicians.attending_clinician_wise_care_bookings`
- Category: `Clinicians`
- Source fact: `care booking`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT record_id) AS care_booking_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count, COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT a.id AS record_id, a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
       a.care_booking_no AS record_no, a.patient_id, COALESCE(p.patient_no, '') AS patient_code,
       COALESCE(p.display_name, concat_ws(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
       a.patient_kind, a.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       a.chair_id, ch.name AS chair_name, a.reason_id, ar.name AS reason_name,
       a.starts_at, a.ends_at, a.status, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_bookings a
JOIN clinics c ON c.id = a.clinic_id
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN staff ds ON ds.id = a.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = a.chair_id
LEFT JOIN care_booking_reasons ar ON ar.id = a.reason_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT record_id) AS care_booking_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count,
  COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Lead Clinician wise Fees summary

- Internal key: `clinicians.attending_clinician_wise_fees_summary`
- Category: `Clinicians`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Lead Clinician wise Assessed Clinical Value

- Internal key: `clinicians.attending_clinician_wise_assessed_clinical_value`
- Category: `Clinicians`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Lead Clinician wise Production Summary

- Internal key: `clinicians.attending_clinician_wise_production_summary`
- Category: `Clinicians`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Date,Lead Clinician,Collection mode wise fee allocations summary

- Internal key: `clinicians.date_attending_clinician_collection_mode_wise_allocated_collections_summary`
- Category: `Clinicians`
- Source fact: `application`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Applied By User `uuid[]` optional.
- Output columns: business_date AS dimension_1_date, clinician_name AS dimension_2_attending_clinician, mode_code AS dimension_3_collection_mode, COUNT(DISTINCT fee_allocation_id) AS application_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) AS applied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ad.id AS record_id, r.clinic_id, pa.allocation_date AS business_date,
       pa.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       pa.applied_by AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, ad.amount,
       pa.id AS fee_allocation_id, pa.collection_receipt_id, pa.fee_statement_id, pa.status
FROM clinician_value_allocations ad
JOIN fee_allocations pa ON pa.id = ad.fee_allocation_id
JOIN collection_receipts r ON r.id = pa.collection_receipt_id
JOIN patients p ON p.id = pa.patient_id
JOIN fee_statement_lines il ON il.id = ad.fee_statement_line_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
JOIN collection_tenders rt ON rt.id = ad.collection_tender_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
JOIN users u ON u.id = pa.applied_by
)
SELECT
  business_date AS dimension_1_date,
  clinician_name AS dimension_2_attending_clinician,
  mode_code AS dimension_3_collection_mode,
  COUNT(DISTINCT fee_allocation_id) AS application_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) AS applied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status = 'active'
  AND (:applied_by_user_ids::uuid[] IS NULL OR user_id = ANY(:applied_by_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY business_date, clinician_name, mode_code
ORDER BY business_date, clinician_name, mode_code;
```

### Clinician Fee Share Details

- Internal key: `clinicians.clinician_fee_share_details`
- Category: `Clinicians`
- Source fact: `clinician_share`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Collection Method `text[]` optional where the fact contains a mode.
- Output columns: business_date, record_id, clinician_name, basis, basis_amount, amount, status, fee_statement_line_id, fee_allocation_id, contract_id.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT dsa.id AS record_id, dsc.clinic_id, COALESCE(pa.allocation_date, i.statement_date) AS business_date,
       dsa.clinician_id, ds.display_name AS clinician_name, dsa.basis_amount,
       dsa.share_amount AS amount, dsc.basis, dsa.status,
       dsa.fee_statement_line_id, dsa.fee_allocation_id, dsa.contract_id
FROM clinician_share_accruals dsa
JOIN clinician_share_contracts dsc ON dsc.id = dsa.contract_id
JOIN staff ds ON ds.id = dsa.clinician_id
LEFT JOIN fee_statement_lines il ON il.id = dsa.fee_statement_line_id
LEFT JOIN fee_statements i ON i.id = il.fee_statement_id
LEFT JOIN fee_allocations pa ON pa.id = dsa.fee_allocation_id
)
SELECT
  business_date,
  record_id,
  clinician_name,
  basis,
  basis_amount,
  amount,
  status,
  fee_statement_line_id,
  fee_allocation_id,
  contract_id
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
ORDER BY business_date;
```

### Clinician Share Advanced

- Internal key: `clinicians.clinician_share_advanced`
- Category: `Clinicians`
- Source fact: `clinician_share`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Collection Method `text[]` optional where the fact contains a mode.
- Output columns: Clinic, Clinician, Date, Entry Type, Source ID, Basis Amount, Credit, Debit, Running Payable, Status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH share_ledger AS (
  SELECT dsc.clinic_id,dsa.clinician_id,COALESCE(pa.allocation_date,i.statement_date) AS business_date,
         'ACCRUAL'::text AS entry_type,dsa.id AS source_id,dsa.basis_amount,
         dsa.share_amount AS credit,0::numeric(14,2) AS debit,dsa.status
  FROM clinician_share_accruals dsa JOIN clinician_share_contracts dsc ON dsc.id=dsa.contract_id
  LEFT JOIN fee_statement_lines il ON il.id=dsa.fee_statement_line_id LEFT JOIN fee_statements i ON i.id=il.fee_statement_id
  LEFT JOIN fee_allocations pa ON pa.id=dsa.fee_allocation_id
  UNION ALL
  SELECT dsc.clinic_id,dadj.clinician_id,dadj.adjustment_date,'ADJUSTMENT',dadj.id,0,
         GREATEST(dadj.amount,0),GREATEST(-dadj.amount,0),'approved'
  FROM clinician_share_adjustments dadj JOIN clinician_share_contracts dsc ON dsc.clinician_id=dadj.clinician_id AND dadj.adjustment_date BETWEEN dsc.effective_from AND COALESCE(dsc.effective_to,'infinity'::date)
  UNION ALL
  SELECT dsc.clinic_id,dsp.clinician_id,dsp.payout_date,'PAYOUT',dsp.id,0,0,dsp.amount,dsp.status
  FROM clinician_share_payouts dsp JOIN clinician_share_contracts dsc ON dsc.clinician_id=dsp.clinician_id AND dsp.payout_date BETWEEN dsc.effective_from AND COALESCE(dsc.effective_to,'infinity'::date)
)
SELECT sl.clinic_id,ds.display_name AS clinician,sl.business_date,sl.entry_type,sl.source_id,
       sl.basis_amount,sl.credit,sl.debit,
       SUM(sl.credit-sl.debit) OVER(PARTITION BY sl.clinic_id,sl.clinician_id ORDER BY sl.business_date,sl.entry_type,sl.source_id) AS running_payable,
       sl.status
FROM share_ledger sl JOIN staff ds ON ds.id=sl.clinician_id
WHERE sl.clinic_id=ANY(:clinic_ids::uuid[]) AND sl.business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR sl.clinician_id=ANY(:clinician_ids::uuid[]))
ORDER BY ds.display_name,sl.business_date,sl.entry_type,sl.source_id;
```

## 13.4 Collection Operations - Explicit Report Contracts

<!-- BLOCKED BY UNRESOLVED-05: refund eligibility, deallocation, and signed refund-date effects are assumed here for spec completeness; do not implement refund-aware totals until FIN-DEC-05 passes per 07. -->
<!-- BLOCKED BY UNRESOLVED-06: single-method versus split-tender source grain and mode pivots are assumed here for spec completeness; do not implement until FIN-DEC-06 passes per 07. -->
### Daily Collection Amount

- Internal key: `collection.daily_collection_amount`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY business_date
ORDER BY business_date;
```

### Date , Collection mode wise collection summary

- Internal key: `collection.date_collection_mode_wise_collection_summary`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: business_date AS dimension_1_date, mode_code AS dimension_2_collection_mode, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  business_date AS dimension_1_date,
  mode_code AS dimension_2_collection_mode,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY business_date, mode_code
ORDER BY business_date, mode_code;
```

### Date wise Collection at a glance

- Internal key: `collection.date_wise_collection_at_a_glance`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY business_date
ORDER BY business_date;
```

### Date wise Collections

- Internal key: `collection.date_wise_collections`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY business_date
ORDER BY business_date;
```

### Date wise Patient Collection summary

- Internal key: `collection.date_wise_patient_collection_summary`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: business_date AS dimension_1_date, patient_code AS dimension_2_patient_code, patient_name AS dimension_3_patient, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  business_date AS dimension_1_date,
  patient_code AS dimension_2_patient_code,
  patient_name AS dimension_3_patient,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY business_date, patient_code, patient_name
ORDER BY business_date, patient_code, patient_name;
```

### Last Modified Date wise Collection Receipts

- Internal key: `collection.last_modified_date_wise_collection_receipts`
- Category: `Collection`
- Source fact: `collection_receipt_detail`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: Clinic, Modified Date, Collection Date, Collection Reference, Patient Code, Patient, Collected By, Collection Method, Amount, Status, Updated By, Last Modified At.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT r.clinic_id, (r.last_modified_at AT TIME ZONE c.timezone)::date AS modified_date,
       r.collection_date, r.collection_reference, p.patient_no, p.display_name,
       u.display_name AS collection_operator_id, pm.code AS collection_mode,
       rt.amount, r.status, r.updated_by, r.last_modified_at
FROM collection_receipts r
JOIN clinics c ON c.id = r.clinic_id
JOIN patients p ON p.id = r.patient_id
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
WHERE r.clinic_id = ANY(:clinic_ids::uuid[])
  AND (r.last_modified_at AT TIME ZONE c.timezone)::date BETWEEN :from_date::date AND :to_date::date
ORDER BY modified_date, r.last_modified_at, r.collection_reference;
```

### Monthly Collection Amount

- Internal key: `collection.monthly_collection_amount`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Patient Category wise Collections

- Internal key: `collection.patient_category_wise_collections`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: category_name AS dimension_1_patient_category, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  category_name AS dimension_1_patient_category,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY category_name
ORDER BY category_name;
```

### Patient Collection Receipts pivot on Collection mode

- Internal key: `collection.patient_collection_receipts_pivot_on_collection_mode`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: Clinic, Patient Code, Patient, Cash, UPI, Card, Net Banking, Other, Gross Collection, Refund, Net Collection.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH gross AS (
  SELECT r.clinic_id, r.patient_id, pm.code AS mode_code, SUM(rt.amount) AS amount
  FROM collection_receipts r JOIN collection_tenders rt ON rt.collection_receipt_id=r.id JOIN collection_methods pm ON pm.id=rt.collection_method_id
  WHERE r.clinic_id=ANY(:clinic_ids::uuid[]) AND r.collection_date BETWEEN :from_date::date AND :to_date::date
    AND r.status IN ('active','part_refunded','refunded')
  GROUP BY r.clinic_id,r.patient_id,pm.code
), collection_refunds_by_patient AS (
  SELECT rf.clinic_id,rf.patient_id,SUM(CASE WHEN rf.status='reversed' THEN 0 ELSE rft.amount END) AS refund_amount
  FROM collection_refunds rf JOIN collection_refund_tenders rft ON rft.collection_refund_id=rf.id
  WHERE rf.clinic_id=ANY(:clinic_ids::uuid[]) AND rf.refund_date BETWEEN :from_date::date AND :to_date::date
  GROUP BY rf.clinic_id,rf.patient_id
)
SELECT g.clinic_id,p.patient_no,p.display_name,
       SUM(g.amount) FILTER (WHERE g.mode_code='CASH') AS cash,
       SUM(g.amount) FILTER (WHERE g.mode_code='UPI') AS upi,
       SUM(g.amount) FILTER (WHERE g.mode_code='CARD') AS card,
       SUM(g.amount) FILTER (WHERE g.mode_code='NET_BANKING') AS net_banking,
       SUM(g.amount) FILTER (WHERE g.mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other,
       SUM(g.amount) AS gross_collection,COALESCE(MAX(rbp.refund_amount),0) AS refund_amount,
       SUM(g.amount)-COALESCE(MAX(rbp.refund_amount),0) AS net_collection
FROM gross g JOIN patients p ON p.id=g.patient_id
LEFT JOIN collection_refunds_by_patient rbp ON rbp.clinic_id=g.clinic_id AND rbp.patient_id=g.patient_id
GROUP BY g.clinic_id,p.id,p.patient_no,p.display_name
ORDER BY p.patient_no;
```

### Patient wise collection summary

- Internal key: `collection.patient_wise_collection_summary`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY patient_code, patient_name
ORDER BY patient_code, patient_name;
```

### Patients with collections not settled against fees

<!-- BLOCKED BY UNRESOLVED-01: Collections remain unapplied absent an explicit application under the provisional policy; do not implement automatic-settlement classifications until FIN-DEC-01 passes per 07. -->
- Internal key: `collection.patients_with_collections_not_settled_against_fees`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional; Minimum Unapplied `numeric(14,2)` required default 0.01.
- Output columns: Patient Code, Patient, Oldest Collection Date, Collection Count, Unapplied Amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH tender_balance AS (
  SELECT r.clinic_id, r.patient_id, r.id AS collection_receipt_id, r.collection_reference, r.collection_date,
         rt.id AS tender_id, pm.code AS collection_mode_code, rt.amount,
         COALESCE((SELECT SUM(ata.amount) FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id WHERE ata.collection_tender_id = rt.id AND pa.status = 'active'),0) AS applied,
         COALESCE((SELECT SUM(rft.amount) FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id WHERE rft.original_tender_id = rt.id AND rf.status = 'posted'),0) AS refunded
  FROM collection_receipts r JOIN collection_tenders rt ON rt.collection_receipt_id = r.id JOIN collection_methods pm ON pm.id = rt.collection_method_id
  WHERE r.clinic_id = ANY(:clinic_ids::uuid[]) AND r.collection_date BETWEEN :from_date::date AND :to_date::date
    AND r.status IN ('active','part_refunded','refunded')
)
SELECT p.patient_no, p.display_name, MIN(tb.collection_date) AS oldest_collection_date,
       COUNT(DISTINCT tb.collection_receipt_id) AS collection_count,
       SUM(tb.amount - tb.applied - tb.refunded) AS unapplied_amount
FROM tender_balance tb JOIN patients p ON p.id = tb.patient_id
GROUP BY p.id, p.patient_no, p.display_name
HAVING SUM(tb.amount - tb.applied - tb.refunded) >= :minimum_unapplied::numeric
ORDER BY unapplied_amount DESC, p.patient_no;
```

### Collection Date wise Patient Collections

- Internal key: `collection.collection_date_wise_patient_payments`
- Category: `Collection`
- Source fact: `application`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Applied By User `uuid[]` optional.
- Output columns: business_date AS dimension_1_date, patient_code AS dimension_2_patient_code, patient_name AS dimension_3_patient, COUNT(DISTINCT fee_allocation_id) AS application_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) AS applied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ad.id AS record_id, r.clinic_id, pa.allocation_date AS business_date,
       pa.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       pa.applied_by AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, ad.amount,
       pa.id AS fee_allocation_id, pa.collection_receipt_id, pa.fee_statement_id, pa.status
FROM clinician_value_allocations ad
JOIN fee_allocations pa ON pa.id = ad.fee_allocation_id
JOIN collection_receipts r ON r.id = pa.collection_receipt_id
JOIN patients p ON p.id = pa.patient_id
JOIN fee_statement_lines il ON il.id = ad.fee_statement_line_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
JOIN collection_tenders rt ON rt.id = ad.collection_tender_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
JOIN users u ON u.id = pa.applied_by
)
SELECT
  business_date AS dimension_1_date,
  patient_code AS dimension_2_patient_code,
  patient_name AS dimension_3_patient,
  COUNT(DISTINCT fee_allocation_id) AS application_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) AS applied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status = 'active'
  AND (:applied_by_user_ids::uuid[] IS NULL OR user_id = ANY(:applied_by_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY business_date, patient_code, patient_name
ORDER BY business_date, patient_code, patient_name;
```

### Collection mode wise Patient Collections

- Internal key: `collection.collection_mode_wise_patient_payments`
- Category: `Collection`
- Source fact: `application`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Applied By User `uuid[]` optional.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, mode_code AS dimension_3_collection_mode, COUNT(DISTINCT fee_allocation_id) AS application_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) AS applied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ad.id AS record_id, r.clinic_id, pa.allocation_date AS business_date,
       pa.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       pa.applied_by AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, ad.amount,
       pa.id AS fee_allocation_id, pa.collection_receipt_id, pa.fee_statement_id, pa.status
FROM clinician_value_allocations ad
JOIN fee_allocations pa ON pa.id = ad.fee_allocation_id
JOIN collection_receipts r ON r.id = pa.collection_receipt_id
JOIN patients p ON p.id = pa.patient_id
JOIN fee_statement_lines il ON il.id = ad.fee_statement_line_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
JOIN collection_tenders rt ON rt.id = ad.collection_tender_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
JOIN users u ON u.id = pa.applied_by
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  mode_code AS dimension_3_collection_mode,
  COUNT(DISTINCT fee_allocation_id) AS application_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) AS applied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status = 'active'
  AND (:applied_by_user_ids::uuid[] IS NULL OR user_id = ANY(:applied_by_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY patient_code, patient_name, mode_code
ORDER BY patient_code, patient_name, mode_code;
```

### Collection mode wise collections

- Internal key: `collection.collection_mode_wise_collections`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: mode_code AS dimension_1_collection_mode, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  mode_code AS dimension_1_collection_mode,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY mode_code
ORDER BY mode_code;
```

### User wise Collection summary

- Internal key: `collection.user_wise_collection_summary`
- Category: `Collection`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: user_name AS dimension_1_user_cashier, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  user_name AS dimension_1_user_cashier,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY user_name
ORDER BY user_name;
```

### User wise Collection Receipts

- Internal key: `collection.user_wise_collection_receipts`
- Category: `Collection`
- Source fact: `collection_receipt_detail`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: business_date, record_no, collection_receipt_id, patient_code, patient_name, category_name, clinician_name, user_name, mode_name, amount, refund_amount, applied_amount, unapplied_amount, last_modified_at, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       COALESCE(rf.refund_amount,0)::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
)
SELECT
  business_date,
  record_no,
  collection_receipt_id,
  patient_code,
  patient_name,
  category_name,
  clinician_name,
  user_name,
  mode_name,
  amount,
  refund_amount,
  applied_amount,
  unapplied_amount,
  last_modified_at,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
ORDER BY business_date;
```

## 13.5 Communication Delivery - Explicit Report Contracts

### Daily SMS sent

- Internal key: `messaging.daily_sms_sent`
- Category: `Messaging`
- Source fact: `message`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required.
- Output columns: business_date AS dimension_1_date, SUM(submitted_count) AS submitted_count, SUM(delivered_count) AS delivered_count, SUM(failed_count) AS failed_count, SUM(segment_count) AS sms_segments, SUM(credit_amount) AS credits_used.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT om.id AS record_id, om.clinic_id, COALESCE(om.sent_at, om.scheduled_at)::date AS business_date,
       om.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       om.channel, om.route_type, om.status, om.attempt_count,
       CASE WHEN om.status IN ('submitted','sent','delivered') THEN 1 ELSE 0 END::numeric AS submitted_count,
       CASE WHEN om.status = 'delivered' THEN 1 ELSE 0 END::numeric AS delivered_count,
       CASE WHEN om.status = 'failed' THEN 1 ELSE 0 END::numeric AS failed_count,
       COALESCE((om.rendered_body IS NOT NULL)::int,0)::numeric AS segment_count,
       0::numeric(14,2) AS credit_amount
FROM outbound_messages om
LEFT JOIN message_batches mb ON mb.id = om.batch_id
LEFT JOIN patients p ON p.id = om.patient_id
)
SELECT
  business_date AS dimension_1_date,
  SUM(submitted_count) AS submitted_count,
  SUM(delivered_count) AS delivered_count,
  SUM(failed_count) AS failed_count,
  SUM(segment_count) AS sms_segments,
  SUM(credit_amount) AS credits_used
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY business_date
ORDER BY business_date;
```

### Monthly SMS sent

- Internal key: `messaging.monthly_sms_sent`
- Category: `Messaging`
- Source fact: `message`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, SUM(submitted_count) AS submitted_count, SUM(delivered_count) AS delivered_count, SUM(failed_count) AS failed_count, SUM(segment_count) AS sms_segments, SUM(credit_amount) AS credits_used.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT om.id AS record_id, om.clinic_id, COALESCE(om.sent_at, om.scheduled_at)::date AS business_date,
       om.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       om.channel, om.route_type, om.status, om.attempt_count,
       CASE WHEN om.status IN ('submitted','sent','delivered') THEN 1 ELSE 0 END::numeric AS submitted_count,
       CASE WHEN om.status = 'delivered' THEN 1 ELSE 0 END::numeric AS delivered_count,
       CASE WHEN om.status = 'failed' THEN 1 ELSE 0 END::numeric AS failed_count,
       COALESCE((om.rendered_body IS NOT NULL)::int,0)::numeric AS segment_count,
       0::numeric(14,2) AS credit_amount
FROM outbound_messages om
LEFT JOIN message_batches mb ON mb.id = om.batch_id
LEFT JOIN patients p ON p.id = om.patient_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  SUM(submitted_count) AS submitted_count,
  SUM(delivered_count) AS delivered_count,
  SUM(failed_count) AS failed_count,
  SUM(segment_count) AS sms_segments,
  SUM(credit_amount) AS credits_used
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

## 13.6 Laboratory Operations - Explicit Report Contracts

### DentalLab Statement Of Acounts

- Internal key: `lab.dentallab_statement_of_acounts`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: Dental Lab, Date, Reference No., Entry Type, Debit, Credit, Running Payable.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH ledger AS (
  SELECT lj.lab_id, lj.request_date AS business_date, lj.ref_no AS reference_no,
         'LAB_CHARGE'::text AS entry_type, lj.amount AS debit, 0::numeric(14,2) AS credit
  FROM lab_jobs lj
  WHERE lj.clinic_id = ANY(:clinic_ids::uuid[]) AND lj.request_date BETWEEN :from_date::date AND :to_date::date
    AND lj.status <> 'cancelled'
  UNION ALL
  SELECT lp.lab_id, lp.collection_date, lp.reference_no, 'LAB_PAYMENT', 0::numeric(14,2), lp.amount
  FROM lab_disbursements lp
  WHERE lp.clinic_id = ANY(:clinic_ids::uuid[]) AND lp.collection_date BETWEEN :from_date::date AND :to_date::date
    AND lp.status = 'posted'
)
SELECT dl.name AS dental_lab, l.business_date, l.reference_no, l.entry_type,
       l.debit, l.credit,
       SUM(l.debit - l.credit) OVER (PARTITION BY l.lab_id ORDER BY l.business_date, l.reference_no, l.entry_type) AS running_payable
FROM ledger l JOIN dental_labs dl ON dl.id = l.lab_id
WHERE (:lab_ids::uuid[] IS NULL OR l.lab_id = ANY(:lab_ids::uuid[]))
ORDER BY dl.name, l.business_date, l.reference_no, l.entry_type;
```

### Expected Date wise Dental Lab Assignments

- Internal key: `lab.expected_date_wise_dental_lab_assignments`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: request_date, expected_date, received_date, record_no, patient_code, patient_name, lab_name, work_type_name, work_step_name, status, overdue, amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lj.id AS record_id, lj.clinic_id, lj.request_date AS business_date,
       lj.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       lj.ref_no AS record_no, lj.lab_id, dl.name AS lab_name,
       lj.work_type_id, lwt.name AS work_type_name, lj.work_step_id, lws.name AS work_step_name,
       lj.request_date, lj.expected_date, lj.received_date, lj.status, lj.amount,
       CASE WHEN lj.expected_date < CURRENT_DATE AND lj.status NOT IN ('received','cancelled','closed') THEN true ELSE false END AS overdue
FROM lab_jobs lj
JOIN patients p ON p.id = lj.patient_id
JOIN dental_labs dl ON dl.id = lj.lab_id
LEFT JOIN lab_work_types lwt ON lwt.id = lj.work_type_id
LEFT JOIN lab_work_steps lws ON lws.id = lj.work_step_id
)
SELECT
  request_date,
  expected_date,
  received_date,
  record_no,
  patient_code,
  patient_name,
  lab_name,
  work_type_name,
  work_step_name,
  status,
  overdue,
  amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND expected_date BETWEEN :from_date::date AND :to_date::date
ORDER BY request_date;
```

### Lab wise Dental Lab Assignments

- Internal key: `lab.lab_wise_dental_lab_assignments`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: request_date, expected_date, received_date, record_no, patient_code, patient_name, lab_name, work_type_name, work_step_name, status, overdue, amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lj.id AS record_id, lj.clinic_id, lj.request_date AS business_date,
       lj.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       lj.ref_no AS record_no, lj.lab_id, dl.name AS lab_name,
       lj.work_type_id, lwt.name AS work_type_name, lj.work_step_id, lws.name AS work_step_name,
       lj.request_date, lj.expected_date, lj.received_date, lj.status, lj.amount,
       CASE WHEN lj.expected_date < CURRENT_DATE AND lj.status NOT IN ('received','cancelled','closed') THEN true ELSE false END AS overdue
FROM lab_jobs lj
JOIN patients p ON p.id = lj.patient_id
JOIN dental_labs dl ON dl.id = lj.lab_id
LEFT JOIN lab_work_types lwt ON lwt.id = lj.work_type_id
LEFT JOIN lab_work_steps lws ON lws.id = lj.work_step_id
)
SELECT
  request_date,
  expected_date,
  received_date,
  record_no,
  patient_code,
  patient_name,
  lab_name,
  work_type_name,
  work_step_name,
  status,
  overdue,
  amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY request_date;
```

### Lab wise Pending Jobs

- Internal key: `lab.lab_wise_pending_jobs`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: request_date, expected_date, received_date, record_no, patient_code, patient_name, lab_name, work_type_name, work_step_name, status, overdue, amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lj.id AS record_id, lj.clinic_id, lj.request_date AS business_date,
       lj.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       lj.ref_no AS record_no, lj.lab_id, dl.name AS lab_name,
       lj.work_type_id, lwt.name AS work_type_name, lj.work_step_id, lws.name AS work_step_name,
       lj.request_date, lj.expected_date, lj.received_date, lj.status, lj.amount,
       CASE WHEN lj.expected_date < CURRENT_DATE AND lj.status NOT IN ('received','cancelled','closed') THEN true ELSE false END AS overdue
FROM lab_jobs lj
JOIN patients p ON p.id = lj.patient_id
JOIN dental_labs dl ON dl.id = lj.lab_id
LEFT JOIN lab_work_types lwt ON lwt.id = lj.work_type_id
LEFT JOIN lab_work_steps lws ON lws.id = lj.work_step_id
)
SELECT
  request_date,
  expected_date,
  received_date,
  record_no,
  patient_code,
  patient_name,
  lab_name,
  work_type_name,
  work_step_name,
  status,
  overdue,
  amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND status NOT IN ('received','cancelled','closed')
ORDER BY request_date;
```

### Lab wise work received

- Internal key: `lab.lab_wise_work_received`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: lab_name AS dimension_1_dental_lab, COUNT(DISTINCT record_id) AS lab_job_count, COUNT(DISTINCT record_id) FILTER (WHERE status NOT IN ('received','cancelled','closed')) AS pending_count, COUNT(DISTINCT record_id) FILTER (WHERE overdue) AS overdue_count, SUM(amount) AS lab_charge_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lj.id AS record_id, lj.clinic_id, lj.request_date AS business_date,
       lj.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       lj.ref_no AS record_no, lj.lab_id, dl.name AS lab_name,
       lj.work_type_id, lwt.name AS work_type_name, lj.work_step_id, lws.name AS work_step_name,
       lj.request_date, lj.expected_date, lj.received_date, lj.status, lj.amount,
       CASE WHEN lj.expected_date < CURRENT_DATE AND lj.status NOT IN ('received','cancelled','closed') THEN true ELSE false END AS overdue
FROM lab_jobs lj
JOIN patients p ON p.id = lj.patient_id
JOIN dental_labs dl ON dl.id = lj.lab_id
LEFT JOIN lab_work_types lwt ON lwt.id = lj.work_type_id
LEFT JOIN lab_work_steps lws ON lws.id = lj.work_step_id
)
SELECT
  lab_name AS dimension_1_dental_lab,
  COUNT(DISTINCT record_id) AS lab_job_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status NOT IN ('received','cancelled','closed')) AS pending_count,
  COUNT(DISTINCT record_id) FILTER (WHERE overdue) AS overdue_count,
  SUM(amount) AS lab_charge_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND received_date BETWEEN :from_date::date AND :to_date::date
  AND status IN ('received','closed')
GROUP BY lab_name
ORDER BY lab_name;
```

### Lab Work wise Dental Lab Assignments

- Internal key: `lab.lab_work_wise_dental_lab_assignments`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: request_date, expected_date, received_date, record_no, patient_code, patient_name, lab_name, work_type_name, work_step_name, status, overdue, amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lj.id AS record_id, lj.clinic_id, lj.request_date AS business_date,
       lj.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       lj.ref_no AS record_no, lj.lab_id, dl.name AS lab_name,
       lj.work_type_id, lwt.name AS work_type_name, lj.work_step_id, lws.name AS work_step_name,
       lj.request_date, lj.expected_date, lj.received_date, lj.status, lj.amount,
       CASE WHEN lj.expected_date < CURRENT_DATE AND lj.status NOT IN ('received','cancelled','closed') THEN true ELSE false END AS overdue
FROM lab_jobs lj
JOIN patients p ON p.id = lj.patient_id
JOIN dental_labs dl ON dl.id = lj.lab_id
LEFT JOIN lab_work_types lwt ON lwt.id = lj.work_type_id
LEFT JOIN lab_work_steps lws ON lws.id = lj.work_step_id
)
SELECT
  request_date,
  expected_date,
  received_date,
  record_no,
  patient_code,
  patient_name,
  lab_name,
  work_type_name,
  work_step_name,
  status,
  overdue,
  amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY request_date;
```

### Request Date wise Dental Lab Assignments

- Internal key: `lab.request_date_wise_dental_lab_assignments`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: request_date, expected_date, received_date, record_no, patient_code, patient_name, lab_name, work_type_name, work_step_name, status, overdue, amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lj.id AS record_id, lj.clinic_id, lj.request_date AS business_date,
       lj.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       lj.ref_no AS record_no, lj.lab_id, dl.name AS lab_name,
       lj.work_type_id, lwt.name AS work_type_name, lj.work_step_id, lws.name AS work_step_name,
       lj.request_date, lj.expected_date, lj.received_date, lj.status, lj.amount,
       CASE WHEN lj.expected_date < CURRENT_DATE AND lj.status NOT IN ('received','cancelled','closed') THEN true ELSE false END AS overdue
FROM lab_jobs lj
JOIN patients p ON p.id = lj.patient_id
JOIN dental_labs dl ON dl.id = lj.lab_id
LEFT JOIN lab_work_types lwt ON lwt.id = lj.work_type_id
LEFT JOIN lab_work_steps lws ON lws.id = lj.work_step_id
)
SELECT
  request_date,
  expected_date,
  received_date,
  record_no,
  patient_code,
  patient_name,
  lab_name,
  work_type_name,
  work_step_name,
  status,
  overdue,
  amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND request_date BETWEEN :from_date::date AND :to_date::date
ORDER BY request_date;
```

### Status wise Lab Assignments

- Internal key: `lab.status_wise_lab_assignments`
- Category: `Lab`
- Source fact: `lab`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Dental Lab `uuid[]` optional; Lab Work `uuid[]` optional; Lab Status `text[]` optional.
- Output columns: request_date, expected_date, received_date, record_no, patient_code, patient_name, lab_name, work_type_name, work_step_name, status, overdue, amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT lj.id AS record_id, lj.clinic_id, lj.request_date AS business_date,
       lj.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       lj.ref_no AS record_no, lj.lab_id, dl.name AS lab_name,
       lj.work_type_id, lwt.name AS work_type_name, lj.work_step_id, lws.name AS work_step_name,
       lj.request_date, lj.expected_date, lj.received_date, lj.status, lj.amount,
       CASE WHEN lj.expected_date < CURRENT_DATE AND lj.status NOT IN ('received','cancelled','closed') THEN true ELSE false END AS overdue
FROM lab_jobs lj
JOIN patients p ON p.id = lj.patient_id
JOIN dental_labs dl ON dl.id = lj.lab_id
LEFT JOIN lab_work_types lwt ON lwt.id = lj.work_type_id
LEFT JOIN lab_work_steps lws ON lws.id = lj.work_step_id
)
SELECT
  request_date,
  expected_date,
  received_date,
  record_no,
  patient_code,
  patient_name,
  lab_name,
  work_type_name,
  work_step_name,
  status,
  overdue,
  amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY request_date;
```

## 13.7 Clinical Value - Explicit Report Contracts

### Lead Clinician wise Production Details

- Internal key: `production.attending_clinician_wise_production_details`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_no, fee_statement_id, patient_code, patient_name, category_name, fee_schedule_name, clinician_name, service_name, quantity, gross_amount, discount_amount, tax_amount, amount, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date,
  record_no,
  fee_statement_id,
  patient_code,
  patient_name,
  category_name,
  fee_schedule_name,
  clinician_name,
  service_name,
  quantity,
  gross_amount,
  discount_amount,
  tax_amount,
  amount,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
ORDER BY business_date;
```

### Attn. Clinician,Patient wise Production summary

- Internal key: `production.attn_clinician_patient_wise_production_summary`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, patient_code AS dimension_2_patient_code, patient_name AS dimension_3_patient, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  patient_code AS dimension_2_patient_code,
  patient_name AS dimension_3_patient,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name, patient_code, patient_name
ORDER BY clinician_name, patient_code, patient_name;
```

### Fee Statement Register

- Internal key: `production.fee_statement_register`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Clinic, Statement Date, Statement Reference, Patient Code, Patient, Fee Schedule, Patient Category, Lead Clinicians, Line Count, Service Quantity, Subtotal, Discount, Tax, Round Off, Fee Statement Total, Applied, Credit, Write-off, Outstanding, Status, Created By.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH line_totals AS (
  SELECT il.fee_statement_id,
         string_agg(DISTINCT COALESCE(ds.display_name,'Unassigned'), ', ' ORDER BY COALESCE(ds.display_name,'Unassigned')) AS attending_clinicians,
         COUNT(*) AS line_count, SUM(il.quantity) AS service_quantity,
         SUM(il.gross_amount) AS line_gross, SUM(il.discount_amount) AS line_discount,
         SUM(il.cgst_amount + il.sgst_amount + il.igst_amount) AS line_tax,
         SUM(il.line_total) AS line_total
  FROM fee_statement_lines il LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
  GROUP BY il.fee_statement_id
)
SELECT i.clinic_id, i.statement_date, i.statement_reference, p.patient_no, p.display_name,
       fs.name AS fee_schedule, pc.name AS patient_category, lt.attending_clinicians,
       lt.line_count, lt.service_quantity, i.subtotal, i.discount_total,
       i.tax_total, i.round_off, i.grand_total, i.applied_total,
       i.credit_total, i.writeoff_total, i.outstanding_total, i.status,
       u.display_name AS created_by
FROM fee_statements i
JOIN patients p ON p.id = i.patient_id
JOIN line_totals lt ON lt.fee_statement_id = i.id
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN users u ON u.id = i.created_by
WHERE i.clinic_id = ANY(:clinic_ids::uuid[])
  AND i.statement_date BETWEEN :from_date::date AND :to_date::date
  AND i.status IN ('issued','part_paid','paid')
  AND (:patient_category_ids::uuid[] IS NULL OR i.patient_category_id_snapshot = ANY(:patient_category_ids::uuid[]))
  AND (:clinician_ids::uuid[] IS NULL OR EXISTS (SELECT 1 FROM fee_statement_lines il2 WHERE il2.fee_statement_id=i.id AND il2.lead_clinician_id=ANY(:clinician_ids::uuid[])))
ORDER BY i.statement_date, i.statement_reference, i.id;
```

### Daily Assessed Summary

- Internal key: `production.daily_assessed_summary`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY business_date
ORDER BY business_date;
```

### Daily Fee Statement Amount

- Internal key: `production.daily_fee_statement_amount`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY business_date
ORDER BY business_date;
```

### Date wise Patient Fee Statements

- Internal key: `production.date_wise_patient_fee_statements`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Clinic, Statement Date, Statement Reference, Patient Code, Patient, Fee Schedule, Patient Category, Lead Clinicians, Line Count, Service Quantity, Subtotal, Discount, Tax, Round Off, Fee Statement Total, Applied, Credit, Write-off, Outstanding, Status, Created By.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH line_totals AS (
  SELECT il.fee_statement_id,
         string_agg(DISTINCT COALESCE(ds.display_name,'Unassigned'), ', ' ORDER BY COALESCE(ds.display_name,'Unassigned')) AS attending_clinicians,
         COUNT(*) AS line_count, SUM(il.quantity) AS service_quantity,
         SUM(il.gross_amount) AS line_gross, SUM(il.discount_amount) AS line_discount,
         SUM(il.cgst_amount + il.sgst_amount + il.igst_amount) AS line_tax,
         SUM(il.line_total) AS line_total
  FROM fee_statement_lines il LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
  GROUP BY il.fee_statement_id
)
SELECT i.clinic_id, i.statement_date, i.statement_reference, p.patient_no, p.display_name,
       fs.name AS fee_schedule, pc.name AS patient_category, lt.attending_clinicians,
       lt.line_count, lt.service_quantity, i.subtotal, i.discount_total,
       i.tax_total, i.round_off, i.grand_total, i.applied_total,
       i.credit_total, i.writeoff_total, i.outstanding_total, i.status,
       u.display_name AS created_by
FROM fee_statements i
JOIN patients p ON p.id = i.patient_id
JOIN line_totals lt ON lt.fee_statement_id = i.id
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN users u ON u.id = i.created_by
WHERE i.clinic_id = ANY(:clinic_ids::uuid[])
  AND i.statement_date BETWEEN :from_date::date AND :to_date::date
  AND i.status IN ('issued','part_paid','paid')
  AND (:patient_category_ids::uuid[] IS NULL OR i.patient_category_id_snapshot = ANY(:patient_category_ids::uuid[]))
  AND (:clinician_ids::uuid[] IS NULL OR EXISTS (SELECT 1 FROM fee_statement_lines il2 WHERE il2.fee_statement_id=i.id AND il2.lead_clinician_id=ANY(:clinician_ids::uuid[])))
ORDER BY i.statement_date, i.statement_reference, i.id;
```

### Due Fee Statements

<!-- BLOCKED BY UNRESOLVED-03: `coalesce(due_date, statement_date)`, event-date as-of math, and non-overlapping bucket edges are assumed here; do not implement until FIN-DEC-03 passes per 07. -->
- Internal key: `production.due_fee_statements`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; As-of Date `date` required; Minimum Due `numeric(14,2)` required default 0.01; Aging Bucket `text[]` optional.
- Output columns: Clinic, Patient Code, Patient, Patient Category, Statement Reference, Statement Date, Age Start Date, Lead Clinician or Clinicians, Fee Statement Total or Line Total, Applied, Credited, Written Off, Due Amount, Age Days, Aging Bucket.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fee_statement_effect AS (
  SELECT i.id AS fee_statement_id, i.clinic_id, i.patient_id, i.statement_reference, i.statement_date,
         COALESCE(i.due_date, i.statement_date) AS age_start_date, i.grand_total,
         i.patient_category_id_snapshot,
         COALESCE((SELECT SUM(pa.amount) FROM fee_allocations pa WHERE pa.fee_statement_id = i.id AND pa.allocation_date <= :as_of_date::date AND (pa.status = 'active' OR pa.reversal_date > :as_of_date::date)),0) AS applied,
         COALESCE((SELECT SUM(cna.amount) FROM fee_credit_allocations cna WHERE cna.fee_statement_id = i.id AND cna.allocation_date <= :as_of_date::date AND (cna.status = 'active' OR cna.reversal_date > :as_of_date::date)),0) AS credited,
         COALESCE((SELECT SUM(w.amount) FROM fee_reliefs w WHERE w.fee_statement_id = i.id AND w.writeoff_date <= :as_of_date::date AND (w.status = 'active' OR w.reversal_date > :as_of_date::date)),0) AS written_off
  FROM fee_statements i
  JOIN patients p0 ON p0.id = i.patient_id
  WHERE i.clinic_id = ANY(:clinic_ids::uuid[])
    AND i.statement_date <= :as_of_date::date
    AND (:fee_statement_date_from::date IS NULL OR i.statement_date >= :fee_statement_date_from::date)
    AND (:fee_statement_date_to::date IS NULL OR i.statement_date <= :fee_statement_date_to::date)
    AND i.status IN ('issued','part_paid','paid')
    AND (:patient_category_ids::uuid[] IS NULL OR
         (CASE WHEN :category_basis::text = 'current' THEN p0.category_id ELSE i.patient_category_id_snapshot END) = ANY(:patient_category_ids::uuid[]))
    AND (:clinician_ids::uuid[] IS NULL OR EXISTS (
      SELECT 1 FROM fee_statement_lines ilf
      WHERE ilf.fee_statement_id = i.id AND ilf.lead_clinician_id = ANY(:clinician_ids::uuid[])
    ))
), due AS (
  SELECT be.*, p.patient_no, p.display_name,
         CASE WHEN :category_basis::text = 'current' THEN p.category_id ELSE be.patient_category_id_snapshot END AS category_id,
         (SELECT string_agg(DISTINCT COALESCE(ds.display_name,'Unassigned'), ', ' ORDER BY COALESCE(ds.display_name,'Unassigned'))
          FROM fee_statement_lines ild LEFT JOIN staff ds ON ds.id = ild.lead_clinician_id WHERE ild.fee_statement_id = be.fee_statement_id) AS attending_clinicians,
         GREATEST(0, grand_total - applied - credited - written_off)::numeric(14,2) AS due_amount,
         (:as_of_date::date - age_start_date) AS age_days
  FROM fee_statement_effect be JOIN patients p ON p.id = be.patient_id
), labelled AS (
  SELECT d.*,
       CASE WHEN age_days BETWEEN 0 AND 30 THEN '0-30'
            WHEN age_days BETWEEN 31 AND 60 THEN '31-60'
            WHEN age_days BETWEEN 61 AND 90 THEN '61-90'
            WHEN age_days > 90 THEN '90+'
            ELSE 'Not Due' END AS aging_bucket
  FROM due d
)
SELECT l.clinic_id, l.patient_no, l.display_name, pc.name AS patient_category,
       l.statement_reference, l.statement_date, l.age_start_date, l.attending_clinicians,
       l.grand_total, l.applied, l.credited, l.written_off, l.due_amount,
       l.age_days, l.aging_bucket
FROM labelled l LEFT JOIN patient_categories pc ON pc.id = l.category_id
WHERE l.due_amount >= :minimum_due::numeric
  AND (:aging_buckets::text[] IS NULL OR l.aging_bucket = ANY(:aging_buckets::text[]))
ORDER BY l.age_start_date, l.patient_no, l.statement_reference;

WITH line_effect AS (
  SELECT il.id AS fee_statement_line_id, i.id AS fee_statement_id, i.clinic_id, i.patient_id,
         i.statement_reference, i.statement_date, COALESCE(i.due_date,i.statement_date) AS age_start_date,
         il.lead_clinician_id, il.line_total,
         COALESCE((SELECT SUM(aila.amount) FROM allocation_fee_line_splits aila JOIN fee_allocations pa ON pa.id=aila.fee_allocation_id WHERE aila.fee_statement_line_id=il.id AND pa.allocation_date<=:as_of_date::date AND (pa.status='active' OR pa.reversal_date>:as_of_date::date)),0) AS applied,
         COALESCE((SELECT SUM(cnla.amount) FROM fee_credit_line_splits cnla JOIN fee_credit_allocations cna ON cna.id=cnla.credit_note_fee_allocation_id WHERE cnla.fee_statement_line_id=il.id AND cna.allocation_date<=:as_of_date::date AND (cna.status='active' OR cna.reversal_date>:as_of_date::date)),0) AS credited,
         COALESCE((SELECT SUM(wla.amount) FROM fee_relief_line_splits wla JOIN fee_reliefs w ON w.id=wla.fee_relief_id WHERE wla.fee_statement_line_id=il.id AND w.writeoff_date<=:as_of_date::date AND (w.status='active' OR w.reversal_date>:as_of_date::date)),0) AS written_off
  FROM fee_statements i JOIN patients p0 ON p0.id=i.patient_id JOIN fee_statement_lines il ON il.fee_statement_id=i.id
  WHERE :clinician_split::boolean = true
    AND i.clinic_id=ANY(:clinic_ids::uuid[]) AND i.statement_date<=:as_of_date::date
    AND (:fee_statement_date_from::date IS NULL OR i.statement_date>=:fee_statement_date_from::date)
    AND (:fee_statement_date_to::date IS NULL OR i.statement_date<=:fee_statement_date_to::date)
    AND i.status IN ('issued','part_paid','paid')
    AND (:patient_category_ids::uuid[] IS NULL OR (CASE WHEN :category_basis::text='current' THEN p0.category_id ELSE i.patient_category_id_snapshot END)=ANY(:patient_category_ids::uuid[]))
    AND (:clinician_ids::uuid[] IS NULL OR il.lead_clinician_id=ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND il.lead_clinician_id IS NULL))
)
SELECT le.clinic_id,p.patient_no,p.display_name,le.statement_reference,le.statement_date,
       COALESCE(ds.display_name,'Unassigned') AS attending_clinician,
       SUM(le.line_total) AS line_total,SUM(le.applied) AS applied,
       SUM(le.credited) AS credited,SUM(le.written_off) AS written_off,
       SUM(GREATEST(0,le.line_total-le.applied-le.credited-le.written_off)) AS due_amount,
       (:as_of_date::date-le.age_start_date) AS age_days,
       CASE WHEN (:as_of_date::date-le.age_start_date) BETWEEN 0 AND 30 THEN '0-30'
            WHEN (:as_of_date::date-le.age_start_date) BETWEEN 31 AND 60 THEN '31-60'
            WHEN (:as_of_date::date-le.age_start_date) BETWEEN 61 AND 90 THEN '61-90'
            WHEN (:as_of_date::date-le.age_start_date)>90 THEN '90+' ELSE 'Not Due' END AS aging_bucket
FROM line_effect le JOIN patients p ON p.id=le.patient_id LEFT JOIN staff ds ON ds.id=le.lead_clinician_id
GROUP BY le.clinic_id,p.id,p.patient_no,p.display_name,le.fee_statement_id,le.statement_reference,le.statement_date,le.age_start_date,ds.display_name
HAVING SUM(GREATEST(0,le.line_total-le.applied-le.credited-le.written_off)) >= :minimum_due::numeric
   AND (:aging_buckets::text[] IS NULL OR
        CASE WHEN (:as_of_date::date-le.age_start_date) BETWEEN 0 AND 30 THEN '0-30'
             WHEN (:as_of_date::date-le.age_start_date) BETWEEN 31 AND 60 THEN '31-60'
             WHEN (:as_of_date::date-le.age_start_date) BETWEEN 61 AND 90 THEN '61-90'
             WHEN (:as_of_date::date-le.age_start_date)>90 THEN '90+' ELSE 'Not Due' END = ANY(:aging_buckets::text[]))
ORDER BY le.statement_date,p.patient_no,le.statement_reference,attending_clinician;
```

### Fee Schedule wise Fee Statements

- Internal key: `production.fee_schedule_wise_fee_statements`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: fee_schedule_name AS dimension_1_fee_schedule, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  fee_schedule_name AS dimension_1_fee_schedule,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY fee_schedule_name
ORDER BY fee_schedule_name;
```

### Fee Statement List

- Internal key: `production.fee_statement_list`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Clinic, Statement Date, Statement Reference, Patient Code, Patient, Fee Schedule, Patient Category, Lead Clinicians, Line Count, Service Quantity, Subtotal, Discount, Tax, Round Off, Fee Statement Total, Applied, Credit, Write-off, Outstanding, Status, Created By.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH line_totals AS (
  SELECT il.fee_statement_id,
         string_agg(DISTINCT COALESCE(ds.display_name,'Unassigned'), ', ' ORDER BY COALESCE(ds.display_name,'Unassigned')) AS attending_clinicians,
         COUNT(*) AS line_count, SUM(il.quantity) AS service_quantity,
         SUM(il.gross_amount) AS line_gross, SUM(il.discount_amount) AS line_discount,
         SUM(il.cgst_amount + il.sgst_amount + il.igst_amount) AS line_tax,
         SUM(il.line_total) AS line_total
  FROM fee_statement_lines il LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
  GROUP BY il.fee_statement_id
)
SELECT i.clinic_id, i.statement_date, i.statement_reference, p.patient_no, p.display_name,
       fs.name AS fee_schedule, pc.name AS patient_category, lt.attending_clinicians,
       lt.line_count, lt.service_quantity, i.subtotal, i.discount_total,
       i.tax_total, i.round_off, i.grand_total, i.applied_total,
       i.credit_total, i.writeoff_total, i.outstanding_total, i.status,
       u.display_name AS created_by
FROM fee_statements i
JOIN patients p ON p.id = i.patient_id
JOIN line_totals lt ON lt.fee_statement_id = i.id
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN users u ON u.id = i.created_by
WHERE i.clinic_id = ANY(:clinic_ids::uuid[])
  AND i.statement_date BETWEEN :from_date::date AND :to_date::date
  AND i.status IN ('issued','part_paid','paid')
  AND (:patient_category_ids::uuid[] IS NULL OR i.patient_category_id_snapshot = ANY(:patient_category_ids::uuid[]))
  AND (:clinician_ids::uuid[] IS NULL OR EXISTS (SELECT 1 FROM fee_statement_lines il2 WHERE il2.fee_statement_id=i.id AND il2.lead_clinician_id=ANY(:clinician_ids::uuid[])))
ORDER BY i.statement_date, i.statement_reference, i.id;
```

### Month wise Production - Count

- Internal key: `production.month_wise_production_count`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS service_line_count, SUM(quantity) AS service_quantity.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS service_line_count,
  SUM(quantity) AS service_quantity
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Month wise Production - Fees

- Internal key: `production.month_wise_production_fees`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Monthly Fee Statement Amount

- Internal key: `production.monthly_fee_statement_amount`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Monthly Assessed Summary

- Internal key: `production.monthly_assessed_summary`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Patient Category wise Fee Statements

- Internal key: `production.patient_category_wise_fee_statements`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: category_name AS dimension_1_patient_category, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  category_name AS dimension_1_patient_category,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY category_name
ORDER BY category_name;
```

### Patient Wise Lead Clinician Production Comparision

- Internal key: `production.patient_wise_attending_clinician_production_comparision`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, patient_code AS dimension_2_patient_code, patient_name AS dimension_3_patient, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  patient_code AS dimension_2_patient_code,
  patient_name AS dimension_3_patient,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name, patient_code, patient_name
ORDER BY clinician_name, patient_code, patient_name;
```

### Patient wise Production summary

- Internal key: `production.patient_wise_production_summary`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY patient_code, patient_name
ORDER BY patient_code, patient_name;
```

### Service wise Assessed Clinical Value

- Internal key: `production.service_wise_assessed_clinical_value`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: service_name AS dimension_1_service, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  service_name AS dimension_1_service,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY service_name
ORDER BY service_name;
```

### Service wise Production Details

- Internal key: `production.service_wise_production_details`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_no, fee_statement_id, patient_code, patient_name, category_name, fee_schedule_name, clinician_name, service_name, quantity, gross_amount, discount_amount, tax_amount, amount, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date,
  record_no,
  fee_statement_id,
  patient_code,
  patient_name,
  category_name,
  fee_schedule_name,
  clinician_name,
  service_name,
  quantity,
  gross_amount,
  discount_amount,
  tax_amount,
  amount,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
ORDER BY business_date;
```

### Service, Patient wise Production summary

- Internal key: `production.service_patient_wise_production_summary`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, service_name AS dimension_3_service, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  service_name AS dimension_3_service,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY patient_code, patient_name, service_name
ORDER BY patient_code, patient_name, service_name;
```

### Yearly Assessed Summary

- Internal key: `production.yearly_assessed_summary`
- Category: `Production`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.financial.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('year', business_date)::date AS dimension_1_year, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  date_trunc('year', business_date)::date AS dimension_1_year,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY date_trunc('year', business_date)::date
ORDER BY date_trunc('year', business_date)::date;
```

## 13.8 Patient Intelligence - Explicit Report Contracts

### All Patients with Balance over Fees Charges ( Clinic chain support too)

- Internal key: `patients.all_patients_with_balance_over_fees_charges_clinic_chain_support_too`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; As-of Date `date` required; Minimum Due `numeric(14,2)` required default 0.01; Aging Bucket `text[]` optional.
- Output columns: Patient Code, Patient, Current Category, Receivable Amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fee_statement_due AS (
  SELECT i.patient_id, i.clinic_id,
         GREATEST(0, i.grand_total
           - COALESCE((SELECT SUM(pa.amount) FROM fee_allocations pa WHERE pa.fee_statement_id = i.id AND pa.allocation_date <= :as_of_date::date AND (pa.status = 'active' OR pa.reversal_date > :as_of_date::date)),0)
           - COALESCE((SELECT SUM(cna.amount) FROM fee_credit_allocations cna WHERE cna.fee_statement_id = i.id AND cna.allocation_date <= :as_of_date::date AND (cna.status = 'active' OR cna.reversal_date > :as_of_date::date)),0)
           - COALESCE((SELECT SUM(w.amount) FROM fee_reliefs w WHERE w.fee_statement_id = i.id AND w.writeoff_date <= :as_of_date::date AND (w.status = 'active' OR w.reversal_date > :as_of_date::date)),0))::numeric(14,2) AS due_amount
  FROM fee_statements i
  WHERE i.clinic_id = ANY(:clinic_ids::uuid[]) AND i.statement_date <= :as_of_date::date
    AND i.status IN ('issued','part_paid','paid')
)
SELECT p.patient_no, p.display_name, pc.name AS current_category,
       SUM(bd.due_amount) AS receivable_amount
FROM fee_statement_due bd
JOIN patients p ON p.id = bd.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
GROUP BY p.id, p.patient_no, p.display_name, pc.name
HAVING SUM(bd.due_amount) >= :minimum_due::numeric
ORDER BY receivable_amount DESC, p.patient_no;
```

### All Patients with Unallocated Collections(Advance)

- Internal key: `patients.all_patients_with_unallocated_collections_advance`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Minimum Unapplied `numeric(14,2)` required default 0.01.
- Output columns: Patient Code, Patient, Oldest Collection Date, Collection Count, Unapplied Amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH tender_balance AS (
  SELECT r.clinic_id, r.patient_id, r.id AS collection_receipt_id, r.collection_reference, r.collection_date,
         rt.id AS tender_id, pm.code AS collection_mode_code, rt.amount,
         COALESCE((SELECT SUM(ata.amount) FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id WHERE ata.collection_tender_id = rt.id AND pa.status = 'active'),0) AS applied,
         COALESCE((SELECT SUM(rft.amount) FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id WHERE rft.original_tender_id = rt.id AND rf.status = 'posted'),0) AS refunded
  FROM collection_receipts r JOIN collection_tenders rt ON rt.collection_receipt_id = r.id JOIN collection_methods pm ON pm.id = rt.collection_method_id
  WHERE r.clinic_id = ANY(:clinic_ids::uuid[]) AND r.collection_date BETWEEN :from_date::date AND :to_date::date
    AND r.status IN ('active','part_refunded','refunded')
)
SELECT p.patient_no, p.display_name, MIN(tb.collection_date) AS oldest_collection_date,
       COUNT(DISTINCT tb.collection_receipt_id) AS collection_count,
       SUM(tb.amount - tb.applied - tb.refunded) AS unapplied_amount
FROM tender_balance tb JOIN patients p ON p.id = tb.patient_id
GROUP BY p.id, p.patient_no, p.display_name
HAVING SUM(tb.amount - tb.applied - tb.refunded) >= :minimum_unapplied::numeric
ORDER BY unapplied_amount DESC, p.patient_no;
```

### Category wise Register Patients

- Internal key: `patients.category_wise_new_patients`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, category_name AS dimension_3_patient_category, COUNT(DISTINCT record_id) AS patient_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  category_name AS dimension_3_patient_category,
  COUNT(DISTINCT record_id) AS patient_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY patient_code, patient_name, category_name
ORDER BY patient_code, patient_name, category_name;
```

### Daily Register Patients

- Internal key: `patients.daily_new_patients`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date AS dimension_1_date, patient_code AS dimension_2_patient_code, patient_name AS dimension_3_patient, COUNT(DISTINCT record_id) AS patient_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date AS dimension_1_date,
  patient_code AS dimension_2_patient_code,
  patient_name AS dimension_3_patient,
  COUNT(DISTINCT record_id) AS patient_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY business_date, patient_code, patient_name
ORDER BY business_date, patient_code, patient_name;
```

### Date wise Continuitys

- Internal key: `patients.date_wise_continuitys`
- Category: `Patients`
- Source fact: `continuity`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT record_id) AS continuity_count, COUNT(DISTINCT record_id) FILTER (WHERE status IN ('scheduled','due','contacted','booked','snoozed')) AS open_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'completed') AS completed_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ft.id AS record_id, ft.clinic_id, ft.due_date AS business_date,
       ft.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       ft.task_type AS reason_name, ft.notes, ft.status, ft.assigned_to AS user_id,
       u.display_name AS user_name, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM continuity_tasks ft
JOIN patients p ON p.id = ft.patient_id
LEFT JOIN users u ON u.id = ft.assigned_to
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT record_id) AS continuity_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status IN ('scheduled','due','contacted','booked','snoozed')) AS open_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'completed') AS completed_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY business_date
ORDER BY business_date;
```

### Date wise Patient Encounters with Balances

- Internal key: `patients.date_wise_care_encounters_with_balances`
- Category: `Patients`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; As-of Date `date` required; Minimum Due `numeric(14,2)` required default 0.01; Aging Bucket `text[]` optional.
- Output columns: Encounter Date, Clinic, Queue Sequence, Patient Code, Patient, Lead Clinician, Encounter Type, Status, Receivable Amount, Advance Amount, Net Balance.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH patient_due AS (
  SELECT i.patient_id,i.clinic_id,SUM(i.outstanding_total) AS receivable_amount
  FROM fee_statements i WHERE i.status IN ('issued','part_paid','paid') GROUP BY i.patient_id,i.clinic_id
), patient_advance AS (
  SELECT r.patient_id,r.clinic_id,SUM(r.unapplied_total) AS advance_amount
  FROM collection_receipts r WHERE r.status IN ('active','part_refunded','refunded') GROUP BY r.patient_id,r.clinic_id
)
SELECT v.encounter_date,v.clinic_id,v.queue_sequence,p.patient_no,p.display_name,
       ds.display_name AS attending_clinician,v.encounter_type,v.status,
       COALESCE(pd.receivable_amount,0) AS receivable_amount,
       COALESCE(pa.advance_amount,0) AS advance_amount,
       COALESCE(pd.receivable_amount,0)-COALESCE(pa.advance_amount,0) AS net_balance
FROM care_encounters v JOIN patients p ON p.id=v.patient_id
LEFT JOIN staff ds ON ds.id=v.lead_clinician_id
LEFT JOIN patient_due pd ON pd.patient_id=v.patient_id AND pd.clinic_id=v.clinic_id
LEFT JOIN patient_advance pa ON pa.patient_id=v.patient_id AND pa.clinic_id=v.clinic_id
WHERE v.clinic_id=ANY(:clinic_ids::uuid[]) AND v.encounter_date BETWEEN :from_date::date AND :to_date::date
  AND v.status<>'cancelled'
ORDER BY v.encounter_date,v.queue_sequence,v.id;
```

### Duplicate Patient CellPhones

- Internal key: `patients.duplicate_patient_cellphones`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: cell_phone, COUNT(DISTINCT record_id) AS duplicate_count, string_agg(patient_code || ' ' || patient_name, ', ' ORDER BY patient_code) AS patients.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  cell_phone,
  COUNT(DISTINCT record_id) AS duplicate_count,
  string_agg(patient_code || ' ' || patient_name, ', ' ORDER BY patient_code) AS patients
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY cell_phone
HAVING COUNT(DISTINCT record_id) > 1
ORDER BY cell_phone;
```

### Duplicate Patient Names

- Internal key: `patients.duplicate_patient_names`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: lower(patient_name) AS normalized_name, COUNT(DISTINCT record_id) AS duplicate_count, string_agg(patient_code, ', ' ORDER BY patient_code) AS patient_codes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  lower(patient_name) AS normalized_name,
  COUNT(DISTINCT record_id) AS duplicate_count,
  string_agg(patient_code, ', ' ORDER BY patient_code) AS patient_codes
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY lower(patient_name)
HAVING COUNT(DISTINCT record_id) > 1
ORDER BY lower(patient_name);
```

### Continuitys grouped by reason

- Internal key: `patients.continuitys_grouped_by_reason`
- Category: `Patients`
- Source fact: `continuity`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: reason_name AS dimension_1_reason, COUNT(DISTINCT record_id) AS continuity_count, COUNT(DISTINCT record_id) FILTER (WHERE status IN ('scheduled','due','contacted','booked','snoozed')) AS open_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'completed') AS completed_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ft.id AS record_id, ft.clinic_id, ft.due_date AS business_date,
       ft.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       ft.task_type AS reason_name, ft.notes, ft.status, ft.assigned_to AS user_id,
       u.display_name AS user_name, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM continuity_tasks ft
JOIN patients p ON p.id = ft.patient_id
LEFT JOIN users u ON u.id = ft.assigned_to
)
SELECT
  reason_name AS dimension_1_reason,
  COUNT(DISTINCT record_id) AS continuity_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status IN ('scheduled','due','contacted','booked','snoozed')) AS open_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'completed') AS completed_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY reason_name
ORDER BY reason_name;
```

### Month wise Register Patients List

- Internal key: `patients.month_wise_new_patients_list`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, patient_code, patient_name, category_name, referral_source_name, birth_date, age_years, cell_phone, email, address_json, last_encounter_at, active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date,
  patient_code,
  patient_name,
  category_name,
  referral_source_name,
  birth_date,
  age_years,
  cell_phone,
  email,
  address_json,
  last_encounter_at,
  active
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY business_date;
```

### Monthly Register Patients

- Internal key: `patients.monthly_new_patients`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, patient_code AS dimension_2_patient_code, patient_name AS dimension_3_patient, COUNT(DISTINCT record_id) AS patient_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  patient_code AS dimension_2_patient_code,
  patient_name AS dimension_3_patient,
  COUNT(DISTINCT record_id) AS patient_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY date_trunc('month', business_date)::date, patient_code, patient_name
ORDER BY date_trunc('month', business_date)::date, patient_code, patient_name;
```

### Register Patient emails

- Internal key: `patients.new_patient_emails`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, patient_code, patient_name, category_name, referral_source_name, birth_date, age_years, cell_phone, email, address_json, last_encounter_at, active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date,
  patient_code,
  patient_name,
  category_name,
  referral_source_name,
  birth_date,
  age_years,
  cell_phone,
  email,
  address_json,
  last_encounter_at,
  active
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY business_date;
```

### Register Patients

- Internal key: `patients.new_patients`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, COUNT(DISTINCT record_id) AS patient_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  COUNT(DISTINCT record_id) AS patient_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY patient_code, patient_name
ORDER BY patient_code, patient_name;
```

### Patient age distribution

- Internal key: `patients.patient_age_distribution`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END AS dimension_1_age_group, COUNT(DISTINCT record_id) AS patient_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END AS dimension_1_age_group,
  COUNT(DISTINCT record_id) AS patient_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END
ORDER BY CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END;
```

### Patient CellPhone Numbers

- Internal key: `patients.patient_cellphone_numbers`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, patient_code, patient_name, category_name, referral_source_name, birth_date, age_years, cell_phone, email, address_json, last_encounter_at, active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date,
  patient_code,
  patient_name,
  category_name,
  referral_source_name,
  birth_date,
  age_years,
  cell_phone,
  email,
  address_json,
  last_encounter_at,
  active
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY business_date;
```

### Patient Contacts

- Internal key: `patients.patient_contacts`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, patient_code, patient_name, category_name, referral_source_name, birth_date, age_years, cell_phone, email, address_json, last_encounter_at, active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date,
  patient_code,
  patient_name,
  category_name,
  referral_source_name,
  birth_date,
  age_years,
  cell_phone,
  email,
  address_json,
  last_encounter_at,
  active
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY business_date;
```

### Patient List with Address

- Internal key: `patients.patient_list_with_address`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, patient_code, patient_name, category_name, referral_source_name, birth_date, age_years, cell_phone, email, address_json, last_encounter_at, active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date,
  patient_code,
  patient_name,
  category_name,
  referral_source_name,
  birth_date,
  age_years,
  cell_phone,
  email,
  address_json,
  last_encounter_at,
  active
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY business_date;
```

### Patient List with Custom Data

- Internal key: `patients.patient_list_with_custom_data`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Clinic, Patient Code, Patient, Field Label, Field Type, Text Value, Number Value, Date Value, JSON Value.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT pc.clinic_id, p.patient_no, p.display_name,
       cfd.label AS field_label, cfd.field_type,
       pcv.value_text, pcv.value_number, pcv.value_date, pcv.value_json
FROM patient_custom_field_values pcv
JOIN patients p ON p.id = pcv.patient_id
JOIN patient_clinics pc ON pc.patient_id = p.id
JOIN custom_field_definitions cfd ON cfd.id = pcv.definition_id
WHERE pc.clinic_id = ANY(:clinic_ids::uuid[])
  AND (:custom_field_definition_ids::uuid[] IS NULL OR cfd.id = ANY(:custom_field_definition_ids::uuid[]))
ORDER BY p.patient_no, cfd.label;
```

### Patients List with Last Care Booking and Last Encounter Dates

- Internal key: `patients.patients_list_with_last_care_booking_and_last_encounter_dates`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Clinic, Patient Code, Patient, Last Care Booking Date, Last Encounter Date.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT pc.clinic_id, p.patient_no, p.display_name,
       ap.last_care_booking_date, vs.last_encounter_date
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN LATERAL (SELECT MAX((a.starts_at AT TIME ZONE c.timezone)::date) AS last_care_booking_date FROM care_bookings a JOIN clinics c ON c.id=a.clinic_id WHERE a.patient_id=p.id AND a.clinic_id=pc.clinic_id AND a.status <> 'cancelled') ap ON true
LEFT JOIN LATERAL (SELECT MAX(v.encounter_date) AS last_encounter_date FROM care_encounters v WHERE v.patient_id=p.id AND v.clinic_id=pc.clinic_id AND v.status <> 'cancelled') vs ON true
WHERE pc.clinic_id = ANY(:clinic_ids::uuid[])
ORDER BY p.patient_no;
```

### Patients with Balance over Fees Charges

- Internal key: `patients.patients_with_balance_over_fees_charges`
- Category: `Patients`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; As-of Date `date` required; Minimum Due `numeric(14,2)` required default 0.01; Aging Bucket `text[]` optional.
- Output columns: Patient Code, Patient, Current Category, Receivable Amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fee_statement_due AS (
  SELECT i.patient_id, i.clinic_id,
         GREATEST(0, i.grand_total
           - COALESCE((SELECT SUM(pa.amount) FROM fee_allocations pa WHERE pa.fee_statement_id = i.id AND pa.allocation_date <= :as_of_date::date AND (pa.status = 'active' OR pa.reversal_date > :as_of_date::date)),0)
           - COALESCE((SELECT SUM(cna.amount) FROM fee_credit_allocations cna WHERE cna.fee_statement_id = i.id AND cna.allocation_date <= :as_of_date::date AND (cna.status = 'active' OR cna.reversal_date > :as_of_date::date)),0)
           - COALESCE((SELECT SUM(w.amount) FROM fee_reliefs w WHERE w.fee_statement_id = i.id AND w.writeoff_date <= :as_of_date::date AND (w.status = 'active' OR w.reversal_date > :as_of_date::date)),0))::numeric(14,2) AS due_amount
  FROM fee_statements i
  WHERE i.clinic_id = ANY(:clinic_ids::uuid[]) AND i.statement_date <= :as_of_date::date
    AND i.status IN ('issued','part_paid','paid')
)
SELECT p.patient_no, p.display_name, pc.name AS current_category,
       SUM(bd.due_amount) AS receivable_amount
FROM fee_statement_due bd
JOIN patients p ON p.id = bd.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
GROUP BY p.id, p.patient_no, p.display_name, pc.name
HAVING SUM(bd.due_amount) >= :minimum_due::numeric
ORDER BY receivable_amount DESC, p.patient_no;
```

### Reason wise Continuitys

- Internal key: `patients.reason_wise_continuitys`
- Category: `Patients`
- Source fact: `continuity`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: reason_name AS dimension_1_reason, COUNT(DISTINCT record_id) AS continuity_count, COUNT(DISTINCT record_id) FILTER (WHERE status IN ('scheduled','due','contacted','booked','snoozed')) AS open_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'completed') AS completed_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT ft.id AS record_id, ft.clinic_id, ft.due_date AS business_date,
       ft.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       ft.task_type AS reason_name, ft.notes, ft.status, ft.assigned_to AS user_id,
       u.display_name AS user_name, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM continuity_tasks ft
JOIN patients p ON p.id = ft.patient_id
LEFT JOIN users u ON u.id = ft.assigned_to
)
SELECT
  reason_name AS dimension_1_reason,
  COUNT(DISTINCT record_id) AS continuity_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status IN ('scheduled','due','contacted','booked','snoozed')) AS open_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'completed') AS completed_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY reason_name
ORDER BY reason_name;
```

## 13.9 Booking Operations - Explicit Report Contracts

### Care Booking List

- Internal key: `care_bookings.care_booking_list`
- Category: `Care Bookings`
- Source fact: `care booking`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: business_date, record_no, starts_at, ends_at, patient_kind, patient_code, patient_name, clinician_name, chair_name, reason_name, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT a.id AS record_id, a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
       a.care_booking_no AS record_no, a.patient_id, COALESCE(p.patient_no, '') AS patient_code,
       COALESCE(p.display_name, concat_ws(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
       a.patient_kind, a.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       a.chair_id, ch.name AS chair_name, a.reason_id, ar.name AS reason_name,
       a.starts_at, a.ends_at, a.status, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_bookings a
JOIN clinics c ON c.id = a.clinic_id
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN staff ds ON ds.id = a.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = a.chair_id
LEFT JOIN care_booking_reasons ar ON ar.id = a.reason_id
)
SELECT
  business_date,
  record_no,
  starts_at,
  ends_at,
  patient_kind,
  patient_code,
  patient_name,
  clinician_name,
  chair_name,
  reason_name,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
ORDER BY business_date;
```

### Care Booking Requests

- Internal key: `care_bookings.care_booking_requests`
- Category: `Care Bookings`
- Source fact: `care_booking_request`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: business_date, record_id, patient_kind, patient_code, patient_name, preferred_start_time, preferred_end_time, clinician_name, chair_name, reason_name, request_source, request_notes, status, processed_care_booking_id, processed_at, processed_by.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT arq.id AS record_id, arq.clinic_id, arq.requested_date AS business_date,
       arq.patient_id, COALESCE(p.patient_no,'') AS patient_code,
       COALESCE(p.display_name,concat_ws(' ',arq.first_name_snapshot,arq.last_name_snapshot)) AS patient_name,
       arq.patient_kind, arq.preferred_start_time, arq.preferred_end_time,
       arq.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       arq.chair_id, ch.name AS chair_name, arq.reason_id, apr.name AS reason_name,
       arq.request_source, arq.request_notes, arq.status,
       arq.processed_care_booking_id, arq.processed_at, arq.processed_by,
       1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_booking_requests arq
LEFT JOIN patients p ON p.id = arq.patient_id
LEFT JOIN staff ds ON ds.id = arq.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = arq.chair_id
LEFT JOIN care_booking_reasons apr ON apr.id = arq.reason_id
)
SELECT
  business_date,
  record_id,
  patient_kind,
  patient_code,
  patient_name,
  preferred_start_time,
  preferred_end_time,
  clinician_name,
  chair_name,
  reason_name,
  request_source,
  request_notes,
  status,
  processed_care_booking_id,
  processed_at,
  processed_by
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND (:request_statuses::text[] IS NULL OR status = ANY(:request_statuses::text[]))
  AND (:request_sources::text[] IS NULL OR request_source = ANY(:request_sources::text[]))
ORDER BY business_date;
```

### Care Bookings List - New vs Established Patients

- Internal key: `care_bookings.care_bookings_list_new_vs_established_patients`
- Category: `Care Bookings`
- Source fact: `care booking`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: business_date, record_no, starts_at, ends_at, patient_kind, patient_code, patient_name, clinician_name, chair_name, reason_name, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT a.id AS record_id, a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
       a.care_booking_no AS record_no, a.patient_id, COALESCE(p.patient_no, '') AS patient_code,
       COALESCE(p.display_name, concat_ws(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
       a.patient_kind, a.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       a.chair_id, ch.name AS chair_name, a.reason_id, ar.name AS reason_name,
       a.starts_at, a.ends_at, a.status, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_bookings a
JOIN clinics c ON c.id = a.clinic_id
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN staff ds ON ds.id = a.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = a.chair_id
LEFT JOIN care_booking_reasons ar ON ar.id = a.reason_id
)
SELECT
  business_date,
  record_no,
  starts_at,
  ends_at,
  patient_kind,
  patient_code,
  patient_name,
  clinician_name,
  chair_name,
  reason_name,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
ORDER BY business_date;
```

### Care Bookings Summary

- Internal key: `care_bookings.care_bookings_summary`
- Category: `Care Bookings`
- Source fact: `care booking`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT record_id) AS care_booking_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count, COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT a.id AS record_id, a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
       a.care_booking_no AS record_no, a.patient_id, COALESCE(p.patient_no, '') AS patient_code,
       COALESCE(p.display_name, concat_ws(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
       a.patient_kind, a.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       a.chair_id, ch.name AS chair_name, a.reason_id, ar.name AS reason_name,
       a.starts_at, a.ends_at, a.status, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_bookings a
JOIN clinics c ON c.id = a.clinic_id
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN staff ds ON ds.id = a.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = a.chair_id
LEFT JOIN care_booking_reasons ar ON ar.id = a.reason_id
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT record_id) AS care_booking_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count,
  COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY business_date
ORDER BY business_date;
```

### Daily Care Bookings Count

- Internal key: `care_bookings.daily_care_bookings_count`
- Category: `Care Bookings`
- Source fact: `care booking`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT record_id) AS care_booking_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count, COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT a.id AS record_id, a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
       a.care_booking_no AS record_no, a.patient_id, COALESCE(p.patient_no, '') AS patient_code,
       COALESCE(p.display_name, concat_ws(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
       a.patient_kind, a.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       a.chair_id, ch.name AS chair_name, a.reason_id, ar.name AS reason_name,
       a.starts_at, a.ends_at, a.status, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_bookings a
JOIN clinics c ON c.id = a.clinic_id
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN staff ds ON ds.id = a.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = a.chair_id
LEFT JOIN care_booking_reasons ar ON ar.id = a.reason_id
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT record_id) AS care_booking_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count,
  COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY business_date
ORDER BY business_date;
```

### Clinician wise cancelled care_bookings

- Internal key: `care_bookings.clinician_wise_cancelled_care_bookings`
- Category: `Care Bookings`
- Source fact: current-final care booking joined to its latest immutable status-history row.
- Authoritative date: scheduled clinic-local date from `care_bookings.starts_at`; the month-by-clinician matrix in section 9 also supports terminal transition date explicitly.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT record_id) AS care_booking_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count, COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT f.care_booking_id AS record_id,
       f.clinic_id,
       f.scheduled_business_date AS business_date,
       f.care_booking_no AS record_no,
       f.patient_id,
       f.patient_code,
       f.patient_name,
       f.patient_kind,
       f.clinician_id,
       f.clinician_name,
       f.care_booking_reason_id AS reason_id,
       f.care_booking_reason_name AS reason_name,
       f.starts_at,
       f.ends_at,
       f.terminal_status AS status,
       f.terminal_changed_at,
       f.terminal_actor_user_id,
       f.terminal_actor_name,
       f.terminal_reason
FROM dentos_analytics.v_booking_outcome_fact f
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT record_id) AS care_booking_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count,
  COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('cancelled','no_show')
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Monthly Care Bookings

- Internal key: `care_bookings.monthly_care_bookings`
- Category: `Care Bookings`
- Source fact: `care booking`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT record_id) AS care_booking_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count, COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT a.id AS record_id, a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
       a.care_booking_no AS record_no, a.patient_id, COALESCE(p.patient_no, '') AS patient_code,
       COALESCE(p.display_name, concat_ws(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
       a.patient_kind, a.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       a.chair_id, ch.name AS chair_name, a.reason_id, ar.name AS reason_name,
       a.starts_at, a.ends_at, a.status, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_bookings a
JOIN clinics c ON c.id = a.clinic_id
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN staff ds ON ds.id = a.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = a.chair_id
LEFT JOIN care_booking_reasons ar ON ar.id = a.reason_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT record_id) AS care_booking_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count,
  COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Reason wise Care Bookings

- Internal key: `care_bookings.reason_wise_care_bookings`
- Category: `Care Bookings`
- Source fact: `care booking`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false.
- Output columns: reason_name AS dimension_1_reason, COUNT(DISTINCT record_id) AS care_booking_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count, COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count, COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT a.id AS record_id, a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
       a.care_booking_no AS record_no, a.patient_id, COALESCE(p.patient_no, '') AS patient_code,
       COALESCE(p.display_name, concat_ws(' ', a.first_name_snapshot, a.last_name_snapshot)) AS patient_name,
       a.patient_kind, a.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       a.chair_id, ch.name AS chair_name, a.reason_id, ar.name AS reason_name,
       a.starts_at, a.ends_at, a.status, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_bookings a
JOIN clinics c ON c.id = a.clinic_id
LEFT JOIN patients p ON p.id = a.patient_id
LEFT JOIN staff ds ON ds.id = a.lead_clinician_id
LEFT JOIN chairs ch ON ch.id = a.chair_id
LEFT JOIN care_booking_reasons ar ON ar.id = a.reason_id
)
SELECT
  reason_name AS dimension_1_reason,
  COUNT(DISTINCT record_id) AS care_booking_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COUNT(DISTINCT record_id) FILTER (WHERE status = 'no_show') AS no_show_count,
  COUNT(DISTINCT record_id) FILTER (WHERE patient_kind = 'new') AS new_patient_care_booking_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY reason_name
ORDER BY reason_name;
```

## 13.10 Acquisition Intelligence - Explicit Report Contracts

### Referral Source wise Register Patients,Fees and Paid on Regn. Date

- Internal key: `referrals.referral_source_wise_new_patients_fees_and_paid_on_regn_date`
- Category: `Referrals`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, referral_source_name AS dimension_3_referral_source, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  referral_source_name AS dimension_3_referral_source,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY patient_code, patient_name, referral_source_name
ORDER BY patient_code, patient_name, referral_source_name;
```

### Referral Source wise Patient Collections

- Internal key: `referrals.referral_source_wise_patient_payments`
- Category: `Referrals`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, referral_source_name AS dimension_3_referral_source, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  referral_source_name AS dimension_3_referral_source,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY patient_code, patient_name, referral_source_name
ORDER BY patient_code, patient_name, referral_source_name;
```

### Referral Source wise Patient Collections Summary

- Internal key: `referrals.referral_source_wise_patient_payments_summary`
- Category: `Referrals`
- Source fact: `collection`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; Collection Method `text[]` optional where the fact contains a mode; Cashier/User `uuid[]` optional.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, referral_source_name AS dimension_3_referral_source, COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count, COUNT(DISTINCT patient_id) AS patient_count, SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount, SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount, SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount, SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount, SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount, SUM(amount) AS gross_collection, SUM(refund_amount) AS refund_amount, SUM(amount) - SUM(refund_amount) AS net_collection, SUM(applied_amount) AS applied_amount, SUM(unapplied_amount) AS unapplied_amount.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rt.id AS record_id, r.clinic_id, r.collection_date AS business_date,
       r.id AS collection_receipt_id, r.collection_reference AS record_no, r.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       COALESCE(r.patient_category_id_snapshot, p.category_id) AS category_id,
       pc.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, r.lead_clinician_id_snapshot AS clinician_id,
       ds.display_name AS clinician_name, r.collection_operator_id AS user_id, u.display_name AS user_name,
       pm.code AS mode_code, pm.name AS mode_name, rt.amount,
       COALESCE(ap.applied_amount,0)::numeric(14,2) AS applied_amount,
       GREATEST(0, rt.amount - COALESCE(ap.applied_amount,0) - COALESCE(rf.refund_amount,0))::numeric(14,2) AS unapplied_amount,
       0::numeric(14,2) AS refund_amount,
       r.last_modified_at, r.status
FROM collection_receipts r
JOIN collection_tenders rt ON rt.collection_receipt_id = r.id
JOIN patients p ON p.id = r.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot, p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rt.collection_method_id
LEFT JOIN (SELECT collection_tender_id, SUM(amount) AS applied_amount FROM allocation_tender_splits ata JOIN fee_allocations pa ON pa.id = ata.fee_allocation_id AND pa.status = 'active' GROUP BY collection_tender_id) ap ON ap.collection_tender_id = rt.id
LEFT JOIN (SELECT original_tender_id, SUM(rft.amount) AS refund_amount FROM collection_refund_tenders rft JOIN collection_refunds rf ON rf.id = rft.collection_refund_id AND rf.status = 'posted' GROUP BY original_tender_id) rf ON rf.original_tender_id = rt.id
WHERE r.status IN ('active','part_refunded','refunded')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.refund_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), rft.amount,
       rf.created_at, rf.status
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status IN ('posted','reversed')
UNION ALL
SELECT rft.id, rf.clinic_id, rf.reversal_date, r.id, rf.refund_no, rf.patient_id,
       p.patient_no, p.display_name, COALESCE(r.patient_category_id_snapshot,p.category_id),
       pc.name, p.referral_source_id, rs.name, p.referring_patient_id,
       r.lead_clinician_id_snapshot, ds.display_name,
       r.collection_operator_id, u.display_name, pm.code, pm.name,
       0::numeric(14,2), 0::numeric(14,2), 0::numeric(14,2), -rft.amount,
       rf.updated_at, 'refund_reversal'
FROM collection_refunds rf
JOIN collection_receipts r ON r.id = rf.collection_receipt_id
JOIN collection_refund_tenders rft ON rft.collection_refund_id = rf.id
JOIN patients p ON p.id = rf.patient_id
LEFT JOIN patient_categories pc ON pc.id = COALESCE(r.patient_category_id_snapshot,p.category_id)
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN staff ds ON ds.id = r.lead_clinician_id_snapshot
JOIN users u ON u.id = r.collection_operator_id
JOIN collection_methods pm ON pm.id = rft.collection_method_id
WHERE rf.status = 'reversed' AND rf.reversal_date IS NOT NULL
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  referral_source_name AS dimension_3_referral_source,
  COUNT(DISTINCT collection_receipt_id) AS collection_receipt_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  SUM(amount) FILTER (WHERE mode_code = 'CASH') AS cash_amount,
  SUM(amount) FILTER (WHERE mode_code = 'UPI') AS upi_amount,
  SUM(amount) FILTER (WHERE mode_code = 'CARD') AS card_amount,
  SUM(amount) FILTER (WHERE mode_code = 'NET_BANKING') AS net_banking_amount,
  SUM(amount) FILTER (WHERE mode_code NOT IN ('CASH','UPI','CARD','NET_BANKING')) AS other_amount,
  SUM(amount) AS gross_collection,
  SUM(refund_amount) AS refund_amount,
  SUM(amount) - SUM(refund_amount) AS net_collection,
  SUM(applied_amount) AS applied_amount,
  SUM(unapplied_amount) AS unapplied_amount
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('active','part_refunded','refunded','posted','reversed','refund_reversal')
  AND (:cashier_user_ids::uuid[] IS NULL OR user_id = ANY(:cashier_user_ids::uuid[]))
  AND (:collection_mode_codes::text[] IS NULL OR mode_code = ANY(:collection_mode_codes::text[]))
GROUP BY patient_code, patient_name, referral_source_name
ORDER BY patient_code, patient_name, referral_source_name;
```

### Referral Source wise Production

- Internal key: `referrals.referral_source_wise_production`
- Category: `Referrals`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: referral_source_name AS dimension_1_referral_source, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  referral_source_name AS dimension_1_referral_source,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY referral_source_name
ORDER BY referral_source_name;
```

### Referral Source,Patient wise Production Summary

- Internal key: `referrals.referral_source_patient_wise_production_summary`
- Category: `Referrals`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: patient_code AS dimension_1_patient_code, patient_name AS dimension_2_patient, referral_source_name AS dimension_3_referral_source, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  patient_code AS dimension_1_patient_code,
  patient_name AS dimension_2_patient,
  referral_source_name AS dimension_3_referral_source,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY patient_code, patient_name, referral_source_name
ORDER BY patient_code, patient_name, referral_source_name;
```

### Referral Sources

- Internal key: `referrals.referral_sources`
- Category: `Referrals`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: referral_source_name AS dimension_1_referral_source, COUNT(DISTINCT record_id) AS patient_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  referral_source_name AS dimension_1_referral_source,
  COUNT(DISTINCT record_id) AS patient_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
GROUP BY referral_source_name
ORDER BY referral_source_name;
```

### Refferral Source Wise Patients List

- Internal key: `referrals.refferral_source_wise_patients_list`
- Category: `Referrals`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, patient_code, patient_name, category_name, referral_source_name, birth_date, age_years, cell_phone, email, address_json, last_encounter_at, active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date,
  patient_code,
  patient_name,
  category_name,
  referral_source_name,
  birth_date,
  age_years,
  cell_phone,
  email,
  address_json,
  last_encounter_at,
  active
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY business_date;
```

### Refferral source wise Production Details

- Internal key: `referrals.refferral_source_wise_production_details`
- Category: `Referrals`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_no, fee_statement_id, patient_code, patient_name, category_name, fee_schedule_name, clinician_name, service_name, quantity, gross_amount, discount_amount, tax_amount, amount, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date,
  record_no,
  fee_statement_id,
  patient_code,
  patient_name,
  category_name,
  fee_schedule_name,
  clinician_name,
  service_name,
  quantity,
  gross_amount,
  discount_amount,
  tax_amount,
  amount,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
ORDER BY business_date;
```

### Refferring Patient Wise Patients List

- Internal key: `referrals.refferring_patient_wise_patients_list`
- Category: `Referrals`
- Source fact: `patient`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.clinical.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, patient_code, patient_name, category_name, referral_source_name, birth_date, age_years, cell_phone, email, address_json, last_encounter_at, active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT p.id AS record_id, pc.clinic_id, p.created_at::date AS business_date,
       p.patient_no AS patient_code, p.display_name AS patient_name, p.category_id,
       cat.name AS category_name, p.referral_source_id, rs.name AS referral_source_name,
       p.referring_patient_id, p.birth_date,
       EXTRACT(year FROM age(CURRENT_DATE, p.birth_date))::integer AS age_years,
       mobile.value AS cell_phone, email.value AS email, addr.address_json,
       p.last_encounter_date AS last_encounter_at, p.active, 1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM patients p
JOIN patient_clinics pc ON pc.patient_id = p.id
LEFT JOIN patient_categories cat ON cat.id = p.category_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'mobile' ORDER BY is_primary DESC, created_at LIMIT 1) mobile ON true
LEFT JOIN LATERAL (SELECT value FROM patient_contacts WHERE patient_id = p.id AND type = 'email' ORDER BY is_primary DESC, created_at LIMIT 1) email ON true
LEFT JOIN LATERAL (SELECT address_json FROM patient_addresses WHERE patient_id = p.id AND active = true ORDER BY created_at DESC LIMIT 1) addr ON true
)
SELECT
  business_date,
  patient_code,
  patient_name,
  category_name,
  referral_source_name,
  birth_date,
  age_years,
  cell_phone,
  email,
  address_json,
  last_encounter_at,
  active
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
ORDER BY business_date;
```

## 13.11 Practice Performance - Explicit Report Contracts

### Patient Encounters Register

- Internal key: `clinic.care_encounters_register`
- Category: `Clinic`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_id, queue_sequence, patient_code, patient_name, clinician_name, reason_name, encounter_type, status, arrival_at, checked_in_at, engaged_at, checked_out_at, waiting_minutes, service_minutes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT v.id AS record_id, v.clinic_id, v.encounter_date AS business_date, v.queue_sequence,
       v.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       p.category_id, pc.name AS category_name, v.lead_clinician_id AS clinician_id,
       ds.display_name AS clinician_name, v.reason_id, ar.name AS reason_name,
       v.encounter_type, v.status, v.arrival_at, v.checked_in_at, v.engaged_at, v.checked_out_at,
       EXTRACT(epoch FROM (v.engaged_at - COALESCE(v.checked_in_at, v.arrival_at))) / 60.0 AS waiting_minutes,
       EXTRACT(epoch FROM (v.checked_out_at - v.engaged_at)) / 60.0 AS service_minutes,
       1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_encounters v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
LEFT JOIN staff ds ON ds.id = v.lead_clinician_id
LEFT JOIN care_booking_reasons ar ON ar.id = v.reason_id
)
SELECT
  business_date,
  record_id,
  queue_sequence,
  patient_code,
  patient_name,
  clinician_name,
  reason_name,
  encounter_type,
  status,
  arrival_at,
  checked_in_at,
  engaged_at,
  checked_out_at,
  waiting_minutes,
  service_minutes
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
ORDER BY business_date;
```

### Lead Clinician , Service wise Fees summary Crosstab

- Internal key: `clinic.attending_clinician_service_wise_fees_summary_crosstab`
- Category: `Clinic`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, service_name AS dimension_2_service, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  service_name AS dimension_2_service,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name, service_name
ORDER BY clinician_name, service_name;
```

### Category wise Patient Encounters

- Internal key: `clinic.category_wise_care_encounters`
- Category: `Clinic`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: category_name AS dimension_1_patient_category, COUNT(DISTINCT record_id) AS encounter_count, COUNT(DISTINCT patient_id) AS patient_count, AVG(waiting_minutes) AS average_waiting_minutes, AVG(service_minutes) AS average_service_minutes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT v.id AS record_id, v.clinic_id, v.encounter_date AS business_date, v.queue_sequence,
       v.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       p.category_id, pc.name AS category_name, v.lead_clinician_id AS clinician_id,
       ds.display_name AS clinician_name, v.reason_id, ar.name AS reason_name,
       v.encounter_type, v.status, v.arrival_at, v.checked_in_at, v.engaged_at, v.checked_out_at,
       EXTRACT(epoch FROM (v.engaged_at - COALESCE(v.checked_in_at, v.arrival_at))) / 60.0 AS waiting_minutes,
       EXTRACT(epoch FROM (v.checked_out_at - v.engaged_at)) / 60.0 AS service_minutes,
       1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_encounters v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
LEFT JOIN staff ds ON ds.id = v.lead_clinician_id
LEFT JOIN care_booking_reasons ar ON ar.id = v.reason_id
)
SELECT
  category_name AS dimension_1_patient_category,
  COUNT(DISTINCT record_id) AS encounter_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  AVG(waiting_minutes) AS average_waiting_minutes,
  AVG(service_minutes) AS average_service_minutes
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY category_name
ORDER BY category_name;
```

### Compare Care Bookings , Encounters,Recalls

- Internal key: `clinic.compare_care_bookings_visits_recalls`
- Category: `Clinic`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Date, Care Bookings, Encounters, Recalls, Register Patients, Production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH dates AS (SELECT generate_series(:from_date::date,:to_date::date,interval '1 day')::date AS business_date),
care_bookings_by_day AS (SELECT (a.starts_at AT TIME ZONE c.timezone)::date AS business_date, COUNT(*) FILTER (WHERE a.status <> 'cancelled') AS care_bookings FROM care_bookings a JOIN clinics c ON c.id=a.clinic_id WHERE a.clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
visits_by_day AS (SELECT encounter_date AS business_date, COUNT(*) FILTER (WHERE status <> 'cancelled') AS encounters FROM care_encounters WHERE clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
recalls_by_day AS (SELECT due_date AS business_date, COUNT(*) AS recalls FROM continuity_recall_records WHERE clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
patients_by_day AS (SELECT p.created_at::date AS business_date, COUNT(DISTINCT p.id) AS new_patients FROM patients p JOIN patient_clinics pc ON pc.patient_id=p.id WHERE pc.clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
production_by_day AS (SELECT statement_date AS business_date, SUM(grand_total) AS production FROM fee_statements WHERE clinic_id=ANY(:clinic_ids::uuid[]) AND status IN ('issued','part_paid','paid') GROUP BY 1)
SELECT d.business_date, COALESCE(a.care_bookings,0) AS care_bookings, COALESCE(v.encounters,0) AS encounters,
       COALESCE(r.recalls,0) AS recalls, COALESCE(p.new_patients,0) AS new_patients,
       COALESCE(pr.production,0) AS production
FROM dates d LEFT JOIN care_bookings_by_day a USING(business_date) LEFT JOIN visits_by_day v USING(business_date)
LEFT JOIN recalls_by_day r USING(business_date) LEFT JOIN patients_by_day p USING(business_date)
LEFT JOIN production_by_day pr USING(business_date)
ORDER BY d.business_date;
```

### Compare Care Bookings ,Encounters, Register Patients,Production

- Internal key: `clinic.compare_care_bookings_visits_new_patients_production`
- Category: `Clinic`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Date, Care Bookings, Encounters, Recalls, Register Patients, Production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH dates AS (SELECT generate_series(:from_date::date,:to_date::date,interval '1 day')::date AS business_date),
care_bookings_by_day AS (SELECT (a.starts_at AT TIME ZONE c.timezone)::date AS business_date, COUNT(*) FILTER (WHERE a.status <> 'cancelled') AS care_bookings FROM care_bookings a JOIN clinics c ON c.id=a.clinic_id WHERE a.clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
visits_by_day AS (SELECT encounter_date AS business_date, COUNT(*) FILTER (WHERE status <> 'cancelled') AS encounters FROM care_encounters WHERE clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
recalls_by_day AS (SELECT due_date AS business_date, COUNT(*) AS recalls FROM continuity_recall_records WHERE clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
patients_by_day AS (SELECT p.created_at::date AS business_date, COUNT(DISTINCT p.id) AS new_patients FROM patients p JOIN patient_clinics pc ON pc.patient_id=p.id WHERE pc.clinic_id=ANY(:clinic_ids::uuid[]) GROUP BY 1),
production_by_day AS (SELECT statement_date AS business_date, SUM(grand_total) AS production FROM fee_statements WHERE clinic_id=ANY(:clinic_ids::uuid[]) AND status IN ('issued','part_paid','paid') GROUP BY 1)
SELECT d.business_date, COALESCE(a.care_bookings,0) AS care_bookings, COALESCE(v.encounters,0) AS encounters,
       COALESCE(r.recalls,0) AS recalls, COALESCE(p.new_patients,0) AS new_patients,
       COALESCE(pr.production,0) AS production
FROM dates d LEFT JOIN care_bookings_by_day a USING(business_date) LEFT JOIN visits_by_day v USING(business_date)
LEFT JOIN recalls_by_day r USING(business_date) LEFT JOIN patients_by_day p USING(business_date)
LEFT JOIN production_by_day pr USING(business_date)
ORDER BY d.business_date;
```

### Daily Case Register

- Internal key: `clinic.daily_case_register`
- Category: `Clinic`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_id, queue_sequence, patient_code, patient_name, clinician_name, reason_name, encounter_type, status, arrival_at, checked_in_at, engaged_at, checked_out_at, waiting_minutes, service_minutes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT v.id AS record_id, v.clinic_id, v.encounter_date AS business_date, v.queue_sequence,
       v.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       p.category_id, pc.name AS category_name, v.lead_clinician_id AS clinician_id,
       ds.display_name AS clinician_name, v.reason_id, ar.name AS reason_name,
       v.encounter_type, v.status, v.arrival_at, v.checked_in_at, v.engaged_at, v.checked_out_at,
       EXTRACT(epoch FROM (v.engaged_at - COALESCE(v.checked_in_at, v.arrival_at))) / 60.0 AS waiting_minutes,
       EXTRACT(epoch FROM (v.checked_out_at - v.engaged_at)) / 60.0 AS service_minutes,
       1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_encounters v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
LEFT JOIN staff ds ON ds.id = v.lead_clinician_id
LEFT JOIN care_booking_reasons ar ON ar.id = v.reason_id
)
SELECT
  business_date,
  record_id,
  queue_sequence,
  patient_code,
  patient_name,
  clinician_name,
  reason_name,
  encounter_type,
  status,
  arrival_at,
  checked_in_at,
  engaged_at,
  checked_out_at,
  waiting_minutes,
  service_minutes
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
ORDER BY business_date;
```

### Day wise Medication Orders

- Internal key: `clinic.day_wise_medication_orders`
- Category: `Clinic`
- Source fact: `medication order`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT record_id) AS medication_order_count, SUM(item_count) AS medication_line_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rx.id AS record_id, rx.clinic_id, rx.medication_order_date AS business_date,
       rx.medication_order_no AS record_no, rx.patient_id, p.patient_no AS patient_code,
       p.display_name AS patient_name, rx.clinician_id, ds.display_name AS clinician_name,
       rx.status, COUNT(ri.id)::numeric AS item_count, 0::numeric(14,2) AS amount
FROM medication_orders rx
JOIN patients p ON p.id = rx.patient_id
LEFT JOIN staff ds ON ds.id = rx.clinician_id
LEFT JOIN medication_order_lines ri ON ri.medication_order_id = rx.id
GROUP BY rx.id, p.patient_no, p.display_name, ds.display_name
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT record_id) AS medication_order_count,
  SUM(item_count) AS medication_line_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY business_date
ORDER BY business_date;
```

### Dental Service wise Fees summary

- Internal key: `clinic.dental_service_wise_fees_summary`
- Category: `Clinic`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: service_name AS dimension_1_service, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  service_name AS dimension_1_service,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY service_name
ORDER BY service_name;
```

### Month wise Medication Orders

- Internal key: `clinic.month_wise_medication_orders`
- Category: `Clinic`
- Source fact: `medication order`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT record_id) AS medication_order_count, SUM(item_count) AS medication_line_count.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT rx.id AS record_id, rx.clinic_id, rx.medication_order_date AS business_date,
       rx.medication_order_no AS record_no, rx.patient_id, p.patient_no AS patient_code,
       p.display_name AS patient_name, rx.clinician_id, ds.display_name AS clinician_name,
       rx.status, COUNT(ri.id)::numeric AS item_count, 0::numeric(14,2) AS amount
FROM medication_orders rx
JOIN patients p ON p.id = rx.patient_id
LEFT JOIN staff ds ON ds.id = rx.clinician_id
LEFT JOIN medication_order_lines ri ON ri.medication_order_id = rx.id
GROUP BY rx.id, p.patient_no, p.display_name, ds.display_name
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT record_id) AS medication_order_count,
  SUM(item_count) AS medication_line_count
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Month wise Encounters

- Internal key: `clinic.month_wise_visits`
- Category: `Clinic`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: date_trunc('month', business_date)::date AS dimension_1_month, COUNT(DISTINCT record_id) AS encounter_count, COUNT(DISTINCT patient_id) AS patient_count, AVG(waiting_minutes) AS average_waiting_minutes, AVG(service_minutes) AS average_service_minutes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT v.id AS record_id, v.clinic_id, v.encounter_date AS business_date, v.queue_sequence,
       v.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       p.category_id, pc.name AS category_name, v.lead_clinician_id AS clinician_id,
       ds.display_name AS clinician_name, v.reason_id, ar.name AS reason_name,
       v.encounter_type, v.status, v.arrival_at, v.checked_in_at, v.engaged_at, v.checked_out_at,
       EXTRACT(epoch FROM (v.engaged_at - COALESCE(v.checked_in_at, v.arrival_at))) / 60.0 AS waiting_minutes,
       EXTRACT(epoch FROM (v.checked_out_at - v.engaged_at)) / 60.0 AS service_minutes,
       1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_encounters v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
LEFT JOIN staff ds ON ds.id = v.lead_clinician_id
LEFT JOIN care_booking_reasons ar ON ar.id = v.reason_id
)
SELECT
  date_trunc('month', business_date)::date AS dimension_1_month,
  COUNT(DISTINCT record_id) AS encounter_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  AVG(waiting_minutes) AS average_waiting_minutes,
  AVG(service_minutes) AS average_service_minutes
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY date_trunc('month', business_date)::date
ORDER BY date_trunc('month', business_date)::date;
```

### Service Domain wise production

- Internal key: `clinic.service_category_wise_production`
- Category: `Clinic`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: service_category_name AS dimension_1_service_category, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  service_category_name AS dimension_1_service_category,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY service_category_name
ORDER BY service_category_name;
```

### Standard Service Charges

- Internal key: `clinic.standard_service_charges`
- Category: `Clinic`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Service Code, Service, Service Domain, Service Code Type, Standard Fee, Service Cost, Tax Rate, Treatment Area, Can Be Assessed, Favourite, Active.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT pc.code AS service_code, pc.description AS service_name,
       pcat.name AS service_category, pc.service_code_type,
       pc.standard_fee, pc.service_cost, pc.tax_rate,
       pc.care_area, pc.chargeable, pc.priority_pinned, pc.active
FROM service_catalog pc
JOIN service_domains pcat ON pcat.id = pc.service_domain_id
WHERE pc.organization_id = :organization_id::uuid
  AND (:service_domain_ids::uuid[] IS NULL OR pc.service_domain_id = ANY(:service_domain_ids::uuid[]))
ORDER BY pcat.name, pc.description, pc.code;
```

## 13.12 Clinical Intelligence - Explicit Report Contracts

### Age Group wise Service History

- Internal key: `analytics.age_group_wise_service_history`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: service_name AS dimension_1_service, CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END AS dimension_2_age_group, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  service_name AS dimension_1_service,
  CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END AS dimension_2_age_group,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY service_name, CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END
ORDER BY service_name, CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END;
```

### Age Group,Service wise summary

- Internal key: `analytics.age_group_service_wise_summary`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: service_name AS dimension_1_service, CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END AS dimension_2_age_group, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  service_name AS dimension_1_service,
  CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END AS dimension_2_age_group,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY service_name, CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END
ORDER BY service_name, CASE WHEN age_years < 13 THEN '0-12' WHEN age_years < 20 THEN '13-19' WHEN age_years < 36 THEN '20-35' WHEN age_years < 51 THEN '36-50' WHEN age_years < 66 THEN '51-65' ELSE '66+' END;
```

### Lead Clinician,Service Type wise Production summary

- Internal key: `analytics.attending_clinician_service_type_wise_production_summary`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, service_category_name AS dimension_2_service_category, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  service_category_name AS dimension_2_service_category,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name, service_category_name
ORDER BY clinician_name, service_category_name;
```

### Lead clinician,Service wise Summary

- Internal key: `analytics.attending_clinician_service_wise_summary`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, service_name AS dimension_2_service, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  service_name AS dimension_2_service,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name, service_name
ORDER BY clinician_name, service_name;
```

### Discount Register - Cash and Credit Business

- Internal key: `analytics.discount_register_cash_and_credit_business`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_no, fee_statement_id, patient_code, patient_name, category_name, fee_schedule_name, clinician_name, service_name, quantity, gross_amount, discount_amount, tax_amount, amount, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date,
  record_no,
  fee_statement_id,
  patient_code,
  patient_name,
  category_name,
  fee_schedule_name,
  clinician_name,
  service_name,
  quantity,
  gross_amount,
  discount_amount,
  tax_amount,
  amount,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
ORDER BY business_date;
```

### OPD Efficiency Analysis

- Internal key: `analytics.opd_efficiency_analysis`
- Category: `Analytics`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Clinic, Date, Lead Clinician ID, Eligible Care Bookings, Arrived Care Bookings, No Show Count, Arrival Rate, No Show Rate, Encounter Count, Average Waiting Minutes, Average Service Minutes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH care_booking_base AS (
  SELECT a.clinic_id, (a.starts_at AT TIME ZONE c.timezone)::date AS business_date,
         a.id AS care_booking_id, a.lead_clinician_id, a.status,
         EXISTS (SELECT 1 FROM care_encounters v WHERE v.care_booking_id = a.id AND v.status <> 'cancelled') AS produced_visit
  FROM care_bookings a JOIN clinics c ON c.id = a.clinic_id
  WHERE a.clinic_id = ANY(:clinic_ids::uuid[])
    AND (a.starts_at AT TIME ZONE c.timezone)::date BETWEEN :from_date::date AND :to_date::date
), encounter_base AS (
  SELECT v.clinic_id, v.encounter_date AS business_date, v.lead_clinician_id,
         COUNT(*) FILTER (WHERE v.status <> 'cancelled') AS encounter_count,
         AVG(EXTRACT(epoch FROM (v.engaged_at - COALESCE(v.checked_in_at,v.arrival_at))) / 60.0) AS average_waiting_minutes,
         AVG(EXTRACT(epoch FROM (v.checked_out_at - v.engaged_at)) / 60.0) AS average_service_minutes
  FROM care_encounters v WHERE v.clinic_id = ANY(:clinic_ids::uuid[])
    AND v.encounter_date BETWEEN :from_date::date AND :to_date::date
  GROUP BY v.clinic_id, v.encounter_date, v.lead_clinician_id
)
SELECT ab.clinic_id, ab.business_date, ab.lead_clinician_id,
       COUNT(*) AS eligible_care_bookings,
       COUNT(*) FILTER (WHERE ab.produced_visit) AS arrived_care_bookings,
       COUNT(*) FILTER (WHERE ab.status = 'no_show') AS no_show_count,
       ROUND(100.0 * COUNT(*) FILTER (WHERE ab.produced_visit) / NULLIF(COUNT(*),0),2) AS arrival_rate,
       ROUND(100.0 * COUNT(*) FILTER (WHERE ab.status = 'no_show') / NULLIF(COUNT(*),0),2) AS no_show_rate,
       MAX(vb.encounter_count) AS encounter_count, MAX(vb.average_waiting_minutes) AS average_waiting_minutes,
       MAX(vb.average_service_minutes) AS average_service_minutes
FROM care_booking_base ab
LEFT JOIN encounter_base vb ON vb.clinic_id = ab.clinic_id AND vb.business_date = ab.business_date AND vb.lead_clinician_id = ab.lead_clinician_id
WHERE (:clinician_ids::uuid[] IS NULL OR ab.lead_clinician_id = ANY(:clinician_ids::uuid[]))
GROUP BY ab.clinic_id, ab.business_date, ab.lead_clinician_id
ORDER BY ab.business_date, ab.lead_clinician_id;
```

### Patient Encounter Analysis

- Internal key: `analytics.patient_encounter_analysis`
- Category: `Analytics`
- Source fact: `encounter`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT record_id) AS encounter_count, COUNT(DISTINCT patient_id) AS patient_count, AVG(waiting_minutes) AS average_waiting_minutes, AVG(service_minutes) AS average_service_minutes.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT v.id AS record_id, v.clinic_id, v.encounter_date AS business_date, v.queue_sequence,
       v.patient_id, p.patient_no AS patient_code, p.display_name AS patient_name,
       p.category_id, pc.name AS category_name, v.lead_clinician_id AS clinician_id,
       ds.display_name AS clinician_name, v.reason_id, ar.name AS reason_name,
       v.encounter_type, v.status, v.arrival_at, v.checked_in_at, v.engaged_at, v.checked_out_at,
       EXTRACT(epoch FROM (v.engaged_at - COALESCE(v.checked_in_at, v.arrival_at))) / 60.0 AS waiting_minutes,
       EXTRACT(epoch FROM (v.checked_out_at - v.engaged_at)) / 60.0 AS service_minutes,
       1::numeric AS count_value, 0::numeric(14,2) AS amount
FROM care_encounters v
JOIN patients p ON p.id = v.patient_id
LEFT JOIN patient_categories pc ON pc.id = p.category_id
LEFT JOIN staff ds ON ds.id = v.lead_clinician_id
LEFT JOIN care_booking_reasons ar ON ar.id = v.reason_id
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT record_id) AS encounter_count,
  COUNT(DISTINCT patient_id) AS patient_count,
  AVG(waiting_minutes) AS average_waiting_minutes,
  AVG(service_minutes) AS average_service_minutes
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
GROUP BY business_date
ORDER BY business_date;
```

### Patient Wise OutStanding Fee Statements Summary

- Internal key: `analytics.patient_wise_outstanding_fee_statements_summary`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; As-of Date `date` required; Minimum Due `numeric(14,2)` required default 0.01; Aging Bucket `text[]` optional.
- Output columns: Clinic, Patient Code, Patient, Patient Category, Statement Reference, Statement Date, Age Start Date, Lead Clinician or Clinicians, Fee Statement Total or Line Total, Applied, Credited, Written Off, Due Amount, Age Days, Aging Bucket.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fee_statement_effect AS (
  SELECT i.id AS fee_statement_id, i.clinic_id, i.patient_id, i.statement_reference, i.statement_date,
         COALESCE(i.due_date, i.statement_date) AS age_start_date, i.grand_total,
         i.patient_category_id_snapshot,
         COALESCE((SELECT SUM(pa.amount) FROM fee_allocations pa WHERE pa.fee_statement_id = i.id AND pa.allocation_date <= :as_of_date::date AND (pa.status = 'active' OR pa.reversal_date > :as_of_date::date)),0) AS applied,
         COALESCE((SELECT SUM(cna.amount) FROM fee_credit_allocations cna WHERE cna.fee_statement_id = i.id AND cna.allocation_date <= :as_of_date::date AND (cna.status = 'active' OR cna.reversal_date > :as_of_date::date)),0) AS credited,
         COALESCE((SELECT SUM(w.amount) FROM fee_reliefs w WHERE w.fee_statement_id = i.id AND w.writeoff_date <= :as_of_date::date AND (w.status = 'active' OR w.reversal_date > :as_of_date::date)),0) AS written_off
  FROM fee_statements i
  JOIN patients p0 ON p0.id = i.patient_id
  WHERE i.clinic_id = ANY(:clinic_ids::uuid[])
    AND i.statement_date <= :as_of_date::date
    AND (:fee_statement_date_from::date IS NULL OR i.statement_date >= :fee_statement_date_from::date)
    AND (:fee_statement_date_to::date IS NULL OR i.statement_date <= :fee_statement_date_to::date)
    AND i.status IN ('issued','part_paid','paid')
    AND (:patient_category_ids::uuid[] IS NULL OR
         (CASE WHEN :category_basis::text = 'current' THEN p0.category_id ELSE i.patient_category_id_snapshot END) = ANY(:patient_category_ids::uuid[]))
    AND (:clinician_ids::uuid[] IS NULL OR EXISTS (
      SELECT 1 FROM fee_statement_lines ilf
      WHERE ilf.fee_statement_id = i.id AND ilf.lead_clinician_id = ANY(:clinician_ids::uuid[])
    ))
), due AS (
  SELECT be.*, p.patient_no, p.display_name,
         CASE WHEN :category_basis::text = 'current' THEN p.category_id ELSE be.patient_category_id_snapshot END AS category_id,
         (SELECT string_agg(DISTINCT COALESCE(ds.display_name,'Unassigned'), ', ' ORDER BY COALESCE(ds.display_name,'Unassigned'))
          FROM fee_statement_lines ild LEFT JOIN staff ds ON ds.id = ild.lead_clinician_id WHERE ild.fee_statement_id = be.fee_statement_id) AS attending_clinicians,
         GREATEST(0, grand_total - applied - credited - written_off)::numeric(14,2) AS due_amount,
         (:as_of_date::date - age_start_date) AS age_days
  FROM fee_statement_effect be JOIN patients p ON p.id = be.patient_id
), labelled AS (
  SELECT d.*,
       CASE WHEN age_days BETWEEN 0 AND 30 THEN '0-30'
            WHEN age_days BETWEEN 31 AND 60 THEN '31-60'
            WHEN age_days BETWEEN 61 AND 90 THEN '61-90'
            WHEN age_days > 90 THEN '90+'
            ELSE 'Not Due' END AS aging_bucket
  FROM due d
)
SELECT l.clinic_id, l.patient_no, l.display_name, pc.name AS patient_category,
       l.statement_reference, l.statement_date, l.age_start_date, l.attending_clinicians,
       l.grand_total, l.applied, l.credited, l.written_off, l.due_amount,
       l.age_days, l.aging_bucket
FROM labelled l LEFT JOIN patient_categories pc ON pc.id = l.category_id
WHERE l.due_amount >= :minimum_due::numeric
  AND (:aging_buckets::text[] IS NULL OR l.aging_bucket = ANY(:aging_buckets::text[]))
ORDER BY l.age_start_date, l.patient_no, l.statement_reference;

WITH line_effect AS (
  SELECT il.id AS fee_statement_line_id, i.id AS fee_statement_id, i.clinic_id, i.patient_id,
         i.statement_reference, i.statement_date, COALESCE(i.due_date,i.statement_date) AS age_start_date,
         il.lead_clinician_id, il.line_total,
         COALESCE((SELECT SUM(aila.amount) FROM allocation_fee_line_splits aila JOIN fee_allocations pa ON pa.id=aila.fee_allocation_id WHERE aila.fee_statement_line_id=il.id AND pa.allocation_date<=:as_of_date::date AND (pa.status='active' OR pa.reversal_date>:as_of_date::date)),0) AS applied,
         COALESCE((SELECT SUM(cnla.amount) FROM fee_credit_line_splits cnla JOIN fee_credit_allocations cna ON cna.id=cnla.credit_note_fee_allocation_id WHERE cnla.fee_statement_line_id=il.id AND cna.allocation_date<=:as_of_date::date AND (cna.status='active' OR cna.reversal_date>:as_of_date::date)),0) AS credited,
         COALESCE((SELECT SUM(wla.amount) FROM fee_relief_line_splits wla JOIN fee_reliefs w ON w.id=wla.fee_relief_id WHERE wla.fee_statement_line_id=il.id AND w.writeoff_date<=:as_of_date::date AND (w.status='active' OR w.reversal_date>:as_of_date::date)),0) AS written_off
  FROM fee_statements i JOIN patients p0 ON p0.id=i.patient_id JOIN fee_statement_lines il ON il.fee_statement_id=i.id
  WHERE :clinician_split::boolean = true
    AND i.clinic_id=ANY(:clinic_ids::uuid[]) AND i.statement_date<=:as_of_date::date
    AND (:fee_statement_date_from::date IS NULL OR i.statement_date>=:fee_statement_date_from::date)
    AND (:fee_statement_date_to::date IS NULL OR i.statement_date<=:fee_statement_date_to::date)
    AND i.status IN ('issued','part_paid','paid')
    AND (:patient_category_ids::uuid[] IS NULL OR (CASE WHEN :category_basis::text='current' THEN p0.category_id ELSE i.patient_category_id_snapshot END)=ANY(:patient_category_ids::uuid[]))
    AND (:clinician_ids::uuid[] IS NULL OR il.lead_clinician_id=ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND il.lead_clinician_id IS NULL))
)
SELECT le.clinic_id,p.patient_no,p.display_name,le.statement_reference,le.statement_date,
       COALESCE(ds.display_name,'Unassigned') AS attending_clinician,
       SUM(le.line_total) AS line_total,SUM(le.applied) AS applied,
       SUM(le.credited) AS credited,SUM(le.written_off) AS written_off,
       SUM(GREATEST(0,le.line_total-le.applied-le.credited-le.written_off)) AS due_amount,
       (:as_of_date::date-le.age_start_date) AS age_days,
       CASE WHEN (:as_of_date::date-le.age_start_date) BETWEEN 0 AND 30 THEN '0-30'
            WHEN (:as_of_date::date-le.age_start_date) BETWEEN 31 AND 60 THEN '31-60'
            WHEN (:as_of_date::date-le.age_start_date) BETWEEN 61 AND 90 THEN '61-90'
            WHEN (:as_of_date::date-le.age_start_date)>90 THEN '90+' ELSE 'Not Due' END AS aging_bucket
FROM line_effect le JOIN patients p ON p.id=le.patient_id LEFT JOIN staff ds ON ds.id=le.lead_clinician_id
GROUP BY le.clinic_id,p.id,p.patient_no,p.display_name,le.fee_statement_id,le.statement_reference,le.statement_date,le.age_start_date,ds.display_name
HAVING SUM(GREATEST(0,le.line_total-le.applied-le.credited-le.written_off)) >= :minimum_due::numeric
   AND (:aging_buckets::text[] IS NULL OR
        CASE WHEN (:as_of_date::date-le.age_start_date) BETWEEN 0 AND 30 THEN '0-30'
             WHEN (:as_of_date::date-le.age_start_date) BETWEEN 31 AND 60 THEN '31-60'
             WHEN (:as_of_date::date-le.age_start_date) BETWEEN 61 AND 90 THEN '61-90'
             WHEN (:as_of_date::date-le.age_start_date)>90 THEN '90+' ELSE 'Not Due' END = ANY(:aging_buckets::text[]))
ORDER BY le.statement_date,p.patient_no,le.statement_reference,attending_clinician;
```

### Pending Planned Treatments

- Internal key: `analytics.pending_planned_treatments`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: Clinic, Patient Code, Patient, Plan No., Plan Date, Phase No., Phase, Plan Item ID, Service Code, Service, Tooth, Surfaces, Quantity, Proposed Fee, Discount, Item Status, Plan Status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT tp.clinic_id, p.patient_no, p.display_name, tp.plan_no, tp.plan_date,
       tph.phase_no, tph.name AS phase_name, tpi.id AS care_plan_service_id,
       pr.code AS service_code, pr.description AS service_name,
       tpi.tooth_code, tpi.surface_codes, tpi.quantity, tpi.proposed_fee,
       tpi.discount, tpi.status, tp.status AS plan_status
FROM care_plan_services tpi
JOIN care_plan_stages tph ON tph.id = tpi.care_plan_stage_id
JOIN care_plans tp ON tp.id = tph.care_plan_id
JOIN patients p ON p.id = tp.patient_id
JOIN service_catalog pr ON pr.id = tpi.service_id
WHERE tp.clinic_id = ANY(:clinic_ids::uuid[])
  AND tp.plan_date BETWEEN :from_date::date AND :to_date::date
  AND tp.status NOT IN ('completed','cancelled')
  AND tpi.status NOT IN ('completed','cancelled')
  AND (:clinician_ids::uuid[] IS NULL OR tp.proposed_by = ANY(:clinician_ids::uuid[]))
ORDER BY tp.plan_date, p.patient_no, tph.phase_no, tpi.id;
```

### Service Domain wise Production Details

- Internal key: `analytics.service_category_wise_production_details`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date, record_no, fee_statement_id, patient_code, patient_name, category_name, fee_schedule_name, clinician_name, service_name, quantity, gross_amount, discount_amount, tax_amount, amount, status.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date,
  record_no,
  fee_statement_id,
  patient_code,
  patient_name,
  category_name,
  fee_schedule_name,
  clinician_name,
  service_name,
  quantity,
  gross_amount,
  discount_amount,
  tax_amount,
  amount,
  status
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
ORDER BY business_date;
```

### Service Domain wise Production summary

- Internal key: `analytics.service_category_wise_production_summary`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: service_category_name AS dimension_1_service_category, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  service_category_name AS dimension_1_service_category,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY service_category_name
ORDER BY service_category_name;
```

### Service Domain,Service wise Summary

- Internal key: `analytics.service_category_service_wise_summary`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: service_category_name AS dimension_1_service_category, service_name AS dimension_2_service, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  service_category_name AS dimension_1_service_category,
  service_name AS dimension_2_service,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY service_category_name, service_name
ORDER BY service_category_name, service_name;
```

### Revenue Generation Clinician wise

- Internal key: `analytics.revenue_generation_clinician_wise`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: clinician_name AS dimension_1_attending_clinician, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  clinician_name AS dimension_1_attending_clinician,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY clinician_name
ORDER BY clinician_name;
```

### Summary of Discounts On Services

- Internal key: `analytics.summary_of_discounts_on_services`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists.
- Output columns: business_date AS dimension_1_date, COUNT(DISTINCT fee_statement_id) AS fee_statement_count, COUNT(DISTINCT record_id) AS line_count, SUM(quantity) AS service_quantity, SUM(gross_amount) AS gross_production, SUM(discount_amount) AS discount_amount, SUM(tax_amount) AS tax_amount, SUM(amount) AS net_production.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT il.id AS record_id, i.clinic_id, i.statement_date AS business_date,
       i.id AS fee_statement_id, i.statement_reference AS record_no, i.patient_id,
       p.patient_no AS patient_code, p.display_name AS patient_name,
       p.referral_source_id, rs.name AS referral_source_name, p.referring_patient_id,
       EXTRACT(year FROM age(i.statement_date, p.birth_date))::integer AS age_years,
       i.patient_category_id_snapshot AS category_id, pc.name AS category_name,
       i.fee_schedule_id, fs.name AS fee_schedule_name,
       il.lead_clinician_id AS clinician_id, ds.display_name AS clinician_name,
       il.service_id, pr.description AS service_name, pr.category_id AS service_domain_id,
       pcat.name AS service_category_name, il.quantity, il.gross_amount,
       il.discount_amount, il.cgst_amount + il.sgst_amount + il.igst_amount AS tax_amount,
       il.line_total AS amount, i.status
FROM fee_statements i
JOIN fee_statement_lines il ON il.fee_statement_id = i.id
JOIN patients p ON p.id = i.patient_id
LEFT JOIN referral_sources rs ON rs.id = p.referral_source_id
LEFT JOIN patient_categories pc ON pc.id = i.patient_category_id_snapshot
LEFT JOIN fee_schedules fs ON fs.id = i.fee_schedule_id
LEFT JOIN staff ds ON ds.id = il.lead_clinician_id
LEFT JOIN service_catalog pr ON pr.id = il.service_id
LEFT JOIN service_domains pcat ON pcat.id = pr.category_id
)
SELECT
  business_date AS dimension_1_date,
  COUNT(DISTINCT fee_statement_id) AS fee_statement_count,
  COUNT(DISTINCT record_id) AS line_count,
  SUM(quantity) AS service_quantity,
  SUM(gross_amount) AS gross_production,
  SUM(discount_amount) AS discount_amount,
  SUM(tax_amount) AS tax_amount,
  SUM(amount) AS net_production
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND (:clinician_ids::uuid[] IS NULL OR clinician_id = ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND clinician_id IS NULL))
  AND status IN ('issued','part_paid','paid')
GROUP BY business_date
ORDER BY business_date;
```

### Summary Of Outstanding Claims

- Internal key: `analytics.summary_of_outstanding_claims`
- Category: `Analytics`
- Source fact: `production`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.operational.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Lead Clinician `uuid[]` optional; Include Unassigned Clinician `boolean` required default false; Patient Category `uuid[]` optional; Category Basis `snapshot/current` required where a snapshot exists; As-of Date `date` required; Minimum Due `numeric(14,2)` required default 0.01; Aging Bucket `text[]` optional.
- Output columns: Clinic, Patient Code, Patient, Patient Category, Statement Reference, Statement Date, Age Start Date, Lead Clinician or Clinicians, Fee Statement Total or Line Total, Applied, Credited, Written Off, Due Amount, Age Days, Aging Bucket.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fee_statement_effect AS (
  SELECT i.id AS fee_statement_id, i.clinic_id, i.patient_id, i.statement_reference, i.statement_date,
         COALESCE(i.due_date, i.statement_date) AS age_start_date, i.grand_total,
         i.patient_category_id_snapshot,
         COALESCE((SELECT SUM(pa.amount) FROM fee_allocations pa WHERE pa.fee_statement_id = i.id AND pa.allocation_date <= :as_of_date::date AND (pa.status = 'active' OR pa.reversal_date > :as_of_date::date)),0) AS applied,
         COALESCE((SELECT SUM(cna.amount) FROM fee_credit_allocations cna WHERE cna.fee_statement_id = i.id AND cna.allocation_date <= :as_of_date::date AND (cna.status = 'active' OR cna.reversal_date > :as_of_date::date)),0) AS credited,
         COALESCE((SELECT SUM(w.amount) FROM fee_reliefs w WHERE w.fee_statement_id = i.id AND w.writeoff_date <= :as_of_date::date AND (w.status = 'active' OR w.reversal_date > :as_of_date::date)),0) AS written_off
  FROM fee_statements i
  JOIN patients p0 ON p0.id = i.patient_id
  WHERE i.clinic_id = ANY(:clinic_ids::uuid[])
    AND i.statement_date <= :as_of_date::date
    AND (:fee_statement_date_from::date IS NULL OR i.statement_date >= :fee_statement_date_from::date)
    AND (:fee_statement_date_to::date IS NULL OR i.statement_date <= :fee_statement_date_to::date)
    AND i.status IN ('issued','part_paid','paid')
    AND (:patient_category_ids::uuid[] IS NULL OR
         (CASE WHEN :category_basis::text = 'current' THEN p0.category_id ELSE i.patient_category_id_snapshot END) = ANY(:patient_category_ids::uuid[]))
    AND (:clinician_ids::uuid[] IS NULL OR EXISTS (
      SELECT 1 FROM fee_statement_lines ilf
      WHERE ilf.fee_statement_id = i.id AND ilf.lead_clinician_id = ANY(:clinician_ids::uuid[])
    ))
), due AS (
  SELECT be.*, p.patient_no, p.display_name,
         CASE WHEN :category_basis::text = 'current' THEN p.category_id ELSE be.patient_category_id_snapshot END AS category_id,
         (SELECT string_agg(DISTINCT COALESCE(ds.display_name,'Unassigned'), ', ' ORDER BY COALESCE(ds.display_name,'Unassigned'))
          FROM fee_statement_lines ild LEFT JOIN staff ds ON ds.id = ild.lead_clinician_id WHERE ild.fee_statement_id = be.fee_statement_id) AS attending_clinicians,
         GREATEST(0, grand_total - applied - credited - written_off)::numeric(14,2) AS due_amount,
         (:as_of_date::date - age_start_date) AS age_days
  FROM fee_statement_effect be JOIN patients p ON p.id = be.patient_id
), labelled AS (
  SELECT d.*,
       CASE WHEN age_days BETWEEN 0 AND 30 THEN '0-30'
            WHEN age_days BETWEEN 31 AND 60 THEN '31-60'
            WHEN age_days BETWEEN 61 AND 90 THEN '61-90'
            WHEN age_days > 90 THEN '90+'
            ELSE 'Not Due' END AS aging_bucket
  FROM due d
)
SELECT l.clinic_id, l.patient_no, l.display_name, pc.name AS patient_category,
       l.statement_reference, l.statement_date, l.age_start_date, l.attending_clinicians,
       l.grand_total, l.applied, l.credited, l.written_off, l.due_amount,
       l.age_days, l.aging_bucket
FROM labelled l LEFT JOIN patient_categories pc ON pc.id = l.category_id
WHERE l.due_amount >= :minimum_due::numeric
  AND (:aging_buckets::text[] IS NULL OR l.aging_bucket = ANY(:aging_buckets::text[]))
ORDER BY l.age_start_date, l.patient_no, l.statement_reference;

WITH line_effect AS (
  SELECT il.id AS fee_statement_line_id, i.id AS fee_statement_id, i.clinic_id, i.patient_id,
         i.statement_reference, i.statement_date, COALESCE(i.due_date,i.statement_date) AS age_start_date,
         il.lead_clinician_id, il.line_total,
         COALESCE((SELECT SUM(aila.amount) FROM allocation_fee_line_splits aila JOIN fee_allocations pa ON pa.id=aila.fee_allocation_id WHERE aila.fee_statement_line_id=il.id AND pa.allocation_date<=:as_of_date::date AND (pa.status='active' OR pa.reversal_date>:as_of_date::date)),0) AS applied,
         COALESCE((SELECT SUM(cnla.amount) FROM fee_credit_line_splits cnla JOIN fee_credit_allocations cna ON cna.id=cnla.credit_note_fee_allocation_id WHERE cnla.fee_statement_line_id=il.id AND cna.allocation_date<=:as_of_date::date AND (cna.status='active' OR cna.reversal_date>:as_of_date::date)),0) AS credited,
         COALESCE((SELECT SUM(wla.amount) FROM fee_relief_line_splits wla JOIN fee_reliefs w ON w.id=wla.fee_relief_id WHERE wla.fee_statement_line_id=il.id AND w.writeoff_date<=:as_of_date::date AND (w.status='active' OR w.reversal_date>:as_of_date::date)),0) AS written_off
  FROM fee_statements i JOIN patients p0 ON p0.id=i.patient_id JOIN fee_statement_lines il ON il.fee_statement_id=i.id
  WHERE :clinician_split::boolean = true
    AND i.clinic_id=ANY(:clinic_ids::uuid[]) AND i.statement_date<=:as_of_date::date
    AND (:fee_statement_date_from::date IS NULL OR i.statement_date>=:fee_statement_date_from::date)
    AND (:fee_statement_date_to::date IS NULL OR i.statement_date<=:fee_statement_date_to::date)
    AND i.status IN ('issued','part_paid','paid')
    AND (:patient_category_ids::uuid[] IS NULL OR (CASE WHEN :category_basis::text='current' THEN p0.category_id ELSE i.patient_category_id_snapshot END)=ANY(:patient_category_ids::uuid[]))
    AND (:clinician_ids::uuid[] IS NULL OR il.lead_clinician_id=ANY(:clinician_ids::uuid[]) OR (:include_unassigned_clinician::boolean AND il.lead_clinician_id IS NULL))
)
SELECT le.clinic_id,p.patient_no,p.display_name,le.statement_reference,le.statement_date,
       COALESCE(ds.display_name,'Unassigned') AS attending_clinician,
       SUM(le.line_total) AS line_total,SUM(le.applied) AS applied,
       SUM(le.credited) AS credited,SUM(le.written_off) AS written_off,
       SUM(GREATEST(0,le.line_total-le.applied-le.credited-le.written_off)) AS due_amount,
       (:as_of_date::date-le.age_start_date) AS age_days,
       CASE WHEN (:as_of_date::date-le.age_start_date) BETWEEN 0 AND 30 THEN '0-30'
            WHEN (:as_of_date::date-le.age_start_date) BETWEEN 31 AND 60 THEN '31-60'
            WHEN (:as_of_date::date-le.age_start_date) BETWEEN 61 AND 90 THEN '61-90'
            WHEN (:as_of_date::date-le.age_start_date)>90 THEN '90+' ELSE 'Not Due' END AS aging_bucket
FROM line_effect le JOIN patients p ON p.id=le.patient_id LEFT JOIN staff ds ON ds.id=le.lead_clinician_id
GROUP BY le.clinic_id,p.id,p.patient_no,p.display_name,le.fee_statement_id,le.statement_reference,le.statement_date,le.age_start_date,ds.display_name
HAVING SUM(GREATEST(0,le.line_total-le.applied-le.credited-le.written_off)) >= :minimum_due::numeric
   AND (:aging_buckets::text[] IS NULL OR
        CASE WHEN (:as_of_date::date-le.age_start_date) BETWEEN 0 AND 30 THEN '0-30'
             WHEN (:as_of_date::date-le.age_start_date) BETWEEN 31 AND 60 THEN '31-60'
             WHEN (:as_of_date::date-le.age_start_date) BETWEEN 61 AND 90 THEN '61-90'
             WHEN (:as_of_date::date-le.age_start_date)>90 THEN '90+' ELSE 'Not Due' END = ANY(:aging_buckets::text[]))
ORDER BY le.statement_date,p.patient_no,le.statement_reference,attending_clinician;
```

## 13.13 Asset Intelligence - Explicit Report Contracts

### Account wise Purchases Report

- Internal key: `inventory.account_wise_purchases_report`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: supplier_name AS dimension_1_supplier_account, COUNT(DISTINCT record_id) AS movement_count, SUM(quantity_delta) AS net_quantity, SUM(ABS(quantity_delta)) AS absolute_quantity, SUM(amount) AS movement_value.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT sm.id AS record_id, sm.clinic_id, sm.movement_at::date AS business_date,
       sm.item_id, ii.code AS item_code, ii.name AS item_name, ii.unit,
       sc.id AS stock_category_id, sc.name AS stock_category_name,
       sm.batch_no, sm.quantity_delta, sm.unit_cost,
       sm.quantity_delta * sm.unit_cost AS amount, sd.document_type, sd.document_no AS record_no,
       sd.supplier_id, s.name AS supplier_name
FROM stock_movements sm
JOIN inventory_items ii ON ii.id = sm.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
JOIN stock_document_lines sdl ON sdl.id = sm.source_line_id
JOIN stock_documents sd ON sd.id = sdl.document_id
LEFT JOIN suppliers s ON s.id = sd.supplier_id
)
SELECT
  supplier_name AS dimension_1_supplier_account,
  COUNT(DISTINCT record_id) AS movement_count,
  SUM(quantity_delta) AS net_quantity,
  SUM(ABS(quantity_delta)) AS absolute_quantity,
  SUM(amount) AS movement_value
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND document_type = 'inward'
  AND quantity_delta > 0
GROUP BY supplier_name
ORDER BY supplier_name;
```

### Item Definitions

- Internal key: `inventory.item_definitions`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: Item Code, Item, Stock Category, Unit, Reorder Level, Active, Created At, Updated At.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT ii.code AS item_code, ii.name AS item_name, sc.name AS stock_category,
       ii.unit, ii.reorder_level, ii.active, ii.created_at, ii.updated_at
FROM inventory_items ii
JOIN stock_categories sc ON sc.id = ii.stock_category_id
WHERE ii.organization_id = :organization_id::uuid
  AND (:stock_category_ids::uuid[] IS NULL OR ii.stock_category_id = ANY(:stock_category_ids::uuid[]))
ORDER BY sc.name, ii.name, ii.code;
```

### Item wise inward report

- Internal key: `inventory.item_wise_inward_report`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: item_code AS dimension_1_item_code, item_name AS dimension_2_item, document_type AS dimension_3_movement_type, COUNT(DISTINCT record_id) AS movement_count, SUM(quantity_delta) AS net_quantity, SUM(ABS(quantity_delta)) AS absolute_quantity, SUM(amount) AS movement_value.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT sm.id AS record_id, sm.clinic_id, sm.movement_at::date AS business_date,
       sm.item_id, ii.code AS item_code, ii.name AS item_name, ii.unit,
       sc.id AS stock_category_id, sc.name AS stock_category_name,
       sm.batch_no, sm.quantity_delta, sm.unit_cost,
       sm.quantity_delta * sm.unit_cost AS amount, sd.document_type, sd.document_no AS record_no,
       sd.supplier_id, s.name AS supplier_name
FROM stock_movements sm
JOIN inventory_items ii ON ii.id = sm.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
JOIN stock_document_lines sdl ON sdl.id = sm.source_line_id
JOIN stock_documents sd ON sd.id = sdl.document_id
LEFT JOIN suppliers s ON s.id = sd.supplier_id
)
SELECT
  item_code AS dimension_1_item_code,
  item_name AS dimension_2_item,
  document_type AS dimension_3_movement_type,
  COUNT(DISTINCT record_id) AS movement_count,
  SUM(quantity_delta) AS net_quantity,
  SUM(ABS(quantity_delta)) AS absolute_quantity,
  SUM(amount) AS movement_value
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND document_type = 'inward'
  AND quantity_delta > 0
GROUP BY item_code, item_name, document_type
ORDER BY item_code, item_name, document_type;
```

### Item wise outward report

- Internal key: `inventory.item_wise_outward_report`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: item_code AS dimension_1_item_code, item_name AS dimension_2_item, document_type AS dimension_3_movement_type, COUNT(DISTINCT record_id) AS movement_count, SUM(quantity_delta) AS net_quantity, SUM(ABS(quantity_delta)) AS absolute_quantity, SUM(amount) AS movement_value.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT sm.id AS record_id, sm.clinic_id, sm.movement_at::date AS business_date,
       sm.item_id, ii.code AS item_code, ii.name AS item_name, ii.unit,
       sc.id AS stock_category_id, sc.name AS stock_category_name,
       sm.batch_no, sm.quantity_delta, sm.unit_cost,
       sm.quantity_delta * sm.unit_cost AS amount, sd.document_type, sd.document_no AS record_no,
       sd.supplier_id, s.name AS supplier_name
FROM stock_movements sm
JOIN inventory_items ii ON ii.id = sm.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
JOIN stock_document_lines sdl ON sdl.id = sm.source_line_id
JOIN stock_documents sd ON sd.id = sdl.document_id
LEFT JOIN suppliers s ON s.id = sd.supplier_id
)
SELECT
  item_code AS dimension_1_item_code,
  item_name AS dimension_2_item,
  document_type AS dimension_3_movement_type,
  COUNT(DISTINCT record_id) AS movement_count,
  SUM(quantity_delta) AS net_quantity,
  SUM(ABS(quantity_delta)) AS absolute_quantity,
  SUM(amount) AS movement_value
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND document_type = 'outward'
  AND quantity_delta < 0
GROUP BY item_code, item_name, document_type
ORDER BY item_code, item_name, document_type;
```

### Stock Category wise outward report

- Internal key: `inventory.stock_category_wise_outward_report`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: stock_category_name AS dimension_1_stock_category, document_type AS dimension_2_movement_type, COUNT(DISTINCT record_id) AS movement_count, SUM(quantity_delta) AS net_quantity, SUM(ABS(quantity_delta)) AS absolute_quantity, SUM(amount) AS movement_value.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT sm.id AS record_id, sm.clinic_id, sm.movement_at::date AS business_date,
       sm.item_id, ii.code AS item_code, ii.name AS item_name, ii.unit,
       sc.id AS stock_category_id, sc.name AS stock_category_name,
       sm.batch_no, sm.quantity_delta, sm.unit_cost,
       sm.quantity_delta * sm.unit_cost AS amount, sd.document_type, sd.document_no AS record_no,
       sd.supplier_id, s.name AS supplier_name
FROM stock_movements sm
JOIN inventory_items ii ON ii.id = sm.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
JOIN stock_document_lines sdl ON sdl.id = sm.source_line_id
JOIN stock_documents sd ON sd.id = sdl.document_id
LEFT JOIN suppliers s ON s.id = sd.supplier_id
)
SELECT
  stock_category_name AS dimension_1_stock_category,
  document_type AS dimension_2_movement_type,
  COUNT(DISTINCT record_id) AS movement_count,
  SUM(quantity_delta) AS net_quantity,
  SUM(ABS(quantity_delta)) AS absolute_quantity,
  SUM(amount) AS movement_value
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND document_type = 'outward'
  AND quantity_delta < 0
GROUP BY stock_category_name, document_type
ORDER BY stock_category_name, document_type;
```

### Stock Position - Concise

- Internal key: `inventory.stock_position_concise`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: Clinic, Item Code, Item, Batch, On Hand, Average Cost, Stock Value, Reorder Level, Reorder Required.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT sb.clinic_id, ii.code AS item_code, ii.name AS item_name,
       sb.batch_no, sb.on_hand, sb.average_cost,
       (sb.on_hand * sb.average_cost)::numeric(14,2) AS stock_value,
       ii.reorder_level, (sb.on_hand <= ii.reorder_level) AS reorder_required
FROM stock_balances sb
JOIN inventory_items ii ON ii.id = sb.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
WHERE sb.clinic_id = ANY(:clinic_ids::uuid[])
  AND (:stock_category_ids::uuid[] IS NULL OR sc.id = ANY(:stock_category_ids::uuid[]))
  AND (:item_ids::uuid[] IS NULL OR ii.id = ANY(:item_ids::uuid[]))
ORDER BY ii.name, sb.batch_no;
```

### Stock Position - Concise Format - Stock Category wise

- Internal key: `inventory.stock_position_concise_format_stock_category_wise`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: Clinic, Stock Category, Item Code, Item, Batch, On Hand, Average Cost, Stock Value, Reorder Level, Reorder Required.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT sb.clinic_id, sc.name AS stock_category_name, ii.code AS item_code, ii.name AS item_name,
       sb.batch_no, sb.on_hand, sb.average_cost,
       (sb.on_hand * sb.average_cost)::numeric(14,2) AS stock_value,
       ii.reorder_level, (sb.on_hand <= ii.reorder_level) AS reorder_required
FROM stock_balances sb
JOIN inventory_items ii ON ii.id = sb.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
WHERE sb.clinic_id = ANY(:clinic_ids::uuid[])
  AND (:stock_category_ids::uuid[] IS NULL OR sc.id = ANY(:stock_category_ids::uuid[]))
  AND (:item_ids::uuid[] IS NULL OR ii.id = ANY(:item_ids::uuid[]))
ORDER BY sc.name, ii.name, sb.batch_no;
```

### Stock Position - Concise with barcode

- Internal key: `inventory.stock_position_concise_with_barcode`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: Clinic, Item Code, Item, Barcode Value, Batch, On Hand, Average Cost, Stock Value, Reorder Level, Reorder Required.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
SELECT sb.clinic_id, ii.code AS item_code, ii.name AS item_name, ii.code AS barcode_value,
       sb.batch_no, sb.on_hand, sb.average_cost,
       (sb.on_hand * sb.average_cost)::numeric(14,2) AS stock_value,
       ii.reorder_level, (sb.on_hand <= ii.reorder_level) AS reorder_required
FROM stock_balances sb
JOIN inventory_items ii ON ii.id = sb.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
WHERE sb.clinic_id = ANY(:clinic_ids::uuid[])
  AND (:stock_category_ids::uuid[] IS NULL OR sc.id = ANY(:stock_category_ids::uuid[]))
  AND (:item_ids::uuid[] IS NULL OR ii.id = ANY(:item_ids::uuid[]))
ORDER BY ii.name, sb.batch_no;
```

### Supplier Statement Of Acounts

- Internal key: `inventory.supplier_statement_of_acounts`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: Supplier, Date, Reference No., Entry Type, Debit, Credit, Running Balance.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH ledger AS (
  SELECT sd.supplier_id, sd.document_date AS business_date, sd.document_no AS reference_no,
         'PURCHASE'::text AS entry_type, SUM(sdl.quantity * sdl.unit_cost)::numeric(14,2) AS debit, 0::numeric(14,2) AS credit
  FROM stock_documents sd JOIN stock_document_lines sdl ON sdl.document_id = sd.id
  WHERE sd.clinic_id = ANY(:clinic_ids::uuid[]) AND sd.status = 'posted' AND sd.document_type = 'inward'
    AND sd.document_date BETWEEN :from_date::date AND :to_date::date
  GROUP BY sd.supplier_id, sd.document_date, sd.document_no
  UNION ALL
  SELECT e.supplier_id, e.expense_date, e.voucher_no, 'PAYMENT', 0::numeric(14,2), e.total_amount
  FROM expenses e
  WHERE e.clinic_id = ANY(:clinic_ids::uuid[]) AND e.status = 'posted'
    AND e.expense_date BETWEEN :from_date::date AND :to_date::date AND e.supplier_id IS NOT NULL
)
SELECT s.name AS supplier, l.business_date, l.reference_no, l.entry_type,
       l.debit, l.credit,
       SUM(l.debit - l.credit) OVER (PARTITION BY l.supplier_id ORDER BY l.business_date, l.reference_no, l.entry_type) AS running_balance
FROM ledger l JOIN suppliers s ON s.id = l.supplier_id
WHERE (:supplier_ids::uuid[] IS NULL OR l.supplier_id = ANY(:supplier_ids::uuid[]))
ORDER BY s.name, l.business_date, l.reference_no, l.entry_type;
```

### Supplier wise Purchases Report

- Internal key: `inventory.supplier_wise_purchases_report`
- Category: `Inventory`
- Source fact: `inventory`
- Authoritative date: `business_date` from the source CTE; special as-of reports use `:as_of_date`.
- Permission: `analytics.inventory.view`.
- Parameters: Clinic Branch `uuid[]` required; From Date `date` required; To Date `date` required; Stock Category `uuid[]` optional; Item `uuid[]` optional; Supplier `uuid[]` optional; Batch `text` optional.
- Output columns: supplier_name AS dimension_1_supplier_account, COUNT(DISTINCT record_id) AS movement_count, SUM(quantity_delta) AS net_quantity, SUM(ABS(quantity_delta)) AS absolute_quantity, SUM(amount) AS movement_value.
- Total rule: footer totals are calculated from this filtered result; print, PDF, spreadsheet, and grid use the same query version and filter snapshot.

```sql
WITH fact AS (
SELECT sm.id AS record_id, sm.clinic_id, sm.movement_at::date AS business_date,
       sm.item_id, ii.code AS item_code, ii.name AS item_name, ii.unit,
       sc.id AS stock_category_id, sc.name AS stock_category_name,
       sm.batch_no, sm.quantity_delta, sm.unit_cost,
       sm.quantity_delta * sm.unit_cost AS amount, sd.document_type, sd.document_no AS record_no,
       sd.supplier_id, s.name AS supplier_name
FROM stock_movements sm
JOIN inventory_items ii ON ii.id = sm.item_id
LEFT JOIN stock_categories sc ON sc.id = ii.stock_category_id
JOIN stock_document_lines sdl ON sdl.id = sm.source_line_id
JOIN stock_documents sd ON sd.id = sdl.document_id
LEFT JOIN suppliers s ON s.id = sd.supplier_id
)
SELECT
  supplier_name AS dimension_1_supplier_account,
  COUNT(DISTINCT record_id) AS movement_count,
  SUM(quantity_delta) AS net_quantity,
  SUM(ABS(quantity_delta)) AS absolute_quantity,
  SUM(amount) AS movement_value
FROM fact
WHERE clinic_id = ANY(:clinic_ids::uuid[])
  AND business_date BETWEEN :from_date::date AND :to_date::date
  AND document_type = 'inward'
  AND quantity_delta > 0
GROUP BY supplier_name
ORDER BY supplier_name;
```

## 13.14 Conversion Intelligence - Explicit Report Contracts

#### Conversion source views

`dentos_analytics.v_case_conversion_fact` has one row per clinical case. Its consultation date and clinician roles are frozen by the finalized initial consultation; its current intent tier is read from the patient; its case-opening tier remains the immutable case snapshot.

```sql
CREATE OR REPLACE VIEW dentos_analytics.v_case_conversion_fact AS
SELECT
  cc.id AS clinical_case_id,
  cc.organization_id,
  cc.clinic_id,
  cl.name AS clinic_name,
  cc.case_no,
  cc.patient_id,
  p.patient_no,
  p.display_name AS patient_name,
  p.cell_phone,
  p.intent_tier AS current_intent_tier,
  p.intent_tier_reason_code AS current_intent_reason_code,
  cc.intent_tier_snapshot,
  cc.execution_state,
  cc.state_changed_at,
  cc.state_change_source,
  cc.treatment_started_at,
  cc.triggering_fee_allocation_id,
  cc.triggering_future_encounter_id,
  ci.id AS initial_consultation_id,
  ci.consulted_at,
  (ci.consulted_at AT TIME ZONE cl.timezone)::date AS consultation_date,
  date_trunc('month', ci.consulted_at AT TIME ZONE cl.timezone)::date AS consultation_month,
  ci.primary_consult_clinician_id,
  primary_staff.display_name AS primary_consult_doctor,
  ci.secondary_review_clinician_id,
  secondary_staff.display_name AS secondary_review_doctor,
  ci.consultation_objective,
  ci.status AS consultation_status
FROM clinical_cases cc
JOIN patients p ON p.id = cc.patient_id
JOIN clinics cl ON cl.id = cc.clinic_id
JOIN case_consultations ci
  ON ci.id = cc.initial_consultation_id
 AND ci.consultation_kind = 'initial'
JOIN staff primary_staff ON primary_staff.id = ci.primary_consult_clinician_id
JOIN staff secondary_staff ON secondary_staff.id = ci.secondary_review_clinician_id;
```

`dentos_analytics.v_case_bundle_domain_fact` has one row per clinical case, treatment bundle, and treatment domain. Multiple services in the same bundle and domain remain one category-consultation grain.

```sql
CREATE OR REPLACE VIEW dentos_analytics.v_case_bundle_domain_fact AS
SELECT
  ccf.clinical_case_id,
  ccf.organization_id,
  ccf.clinic_id,
  ccf.clinic_name,
  ccf.case_no,
  ccf.patient_id,
  ccf.patient_no,
  ccf.patient_name,
  ccf.cell_phone,
  ccf.current_intent_tier,
  ccf.current_intent_reason_code,
  ccf.intent_tier_snapshot,
  ccf.execution_state,
  ccf.state_changed_at,
  ccf.state_change_source,
  ccf.treatment_started_at,
  ccf.consulted_at,
  ccf.consultation_date,
  ccf.consultation_month,
  ccf.primary_consult_clinician_id,
  ccf.primary_consult_doctor,
  ccf.secondary_review_clinician_id,
  ccf.secondary_review_doctor,
  ccf.consultation_status,
  tb.id AS treatment_bundle_id,
  tb.bundle_tier,
  tb.sequence_no AS bundle_sequence_no,
  tb.title AS bundle_title,
  tb.status AS bundle_status,
  tb.target_start_date,
  tb.estimated_value,
  tb.accepted_value,
  tbs.service_domain_id_snapshot AS treatment_domain_id,
  sd.code AS treatment_domain_code,
  sd.name AS treatment_domain_name,
  sd.high_value AS treatment_domain_high_value,
  sd.high_value_floor,
  COUNT(DISTINCT tbs.id) AS advised_service_count,
  SUM(tbs.proposed_amount_snapshot)::numeric(14,2) AS domain_advised_value,
  COUNT(DISTINCT tbs.id) FILTER (WHERE tbs.line_state = 'completed') AS completed_service_count
FROM dentos_analytics.v_case_conversion_fact ccf
JOIN treatment_bundles tb ON tb.clinical_case_id = ccf.clinical_case_id
JOIN treatment_bundle_services tbs ON tbs.treatment_bundle_id = tb.id
JOIN service_domains sd ON sd.id = tbs.service_domain_id_snapshot
GROUP BY
  ccf.clinical_case_id, ccf.organization_id, ccf.clinic_id, ccf.clinic_name,
  ccf.case_no, ccf.patient_id, ccf.patient_no, ccf.patient_name, ccf.cell_phone,
  ccf.current_intent_tier, ccf.current_intent_reason_code, ccf.intent_tier_snapshot,
  ccf.execution_state, ccf.state_changed_at, ccf.state_change_source, ccf.treatment_started_at,
  ccf.consulted_at, ccf.consultation_date, ccf.consultation_month,
  ccf.primary_consult_clinician_id, ccf.primary_consult_doctor,
  ccf.secondary_review_clinician_id, ccf.secondary_review_doctor,
  ccf.consultation_status,
  tb.id, tb.bundle_tier, tb.sequence_no, tb.title, tb.status, tb.target_start_date,
  tb.estimated_value, tb.accepted_value,
  tbs.service_domain_id_snapshot, sd.code, sd.name, sd.high_value, sd.high_value_floor;
```

### Monthly Total Category Consultations

- Internal key: `conversion.monthly_total_category_consultations`
- Category: `Conversion Intelligence`
- Source fact: one distinct finalized initial clinical case consultation per treatment domain and consultation month.
- Authoritative date: `case_consultations.consulted_at` converted to the clinic timezone before month truncation.
- Permission: `analytics.conversion.view`.
- Parameters: Clinic Branch `uuid[]` required; From Month `date` required and normalized to month start; To Month `date` required and normalized to month start; Treatment Category `uuid[]` required; Primary Consult Doctor `uuid[]` optional; Secondary Review Doctor `uuid[]` optional; Intent Tier Basis `text` required with `current` or `case_snapshot`; Intent Tier `dentos_data.intent_tier[]` optional; Execution State `dentos_data.case_execution_state[]` optional.
- Output columns: consultation_month, clinic_id, clinic_name, treatment_domain_id, treatment_domain_code, treatment_domain_name, total_category_consultations, one_star_consultations, two_star_consultations, three_star_consultations, not_started_cases, treatment_started_cases, primary_doctor_count, secondary_doctor_count.
- Total rule: month/category counts use `COUNT(DISTINCT clinical_case_id)`; a case advised in two treatment domains contributes once to each selected domain and once to each corresponding category row.

```sql
WITH scoped AS (
  SELECT DISTINCT
    cbdf.clinical_case_id,
    date_trunc('month', cbdf.consulted_at AT TIME ZONE cl.timezone)::date AS consultation_month,
    cbdf.clinic_id,
    cbdf.clinic_name,
    cbdf.treatment_domain_id,
    cbdf.treatment_domain_code,
    cbdf.treatment_domain_name,
    CASE WHEN :intent_tier_basis::text = 'current' THEN cbdf.current_intent_tier ELSE cbdf.intent_tier_snapshot END AS selected_intent_tier,
    cbdf.execution_state,
    cbdf.primary_consult_clinician_id,
    cbdf.secondary_review_clinician_id
  FROM dentos_analytics.v_case_bundle_domain_fact cbdf
  JOIN clinics cl ON cl.id = cbdf.clinic_id
  WHERE cbdf.clinic_id = ANY(:clinic_ids::uuid[])
    AND cbdf.consultation_status = 'finalized'
    AND cbdf.treatment_domain_id = ANY(:treatment_domain_ids::uuid[])
    AND date_trunc('month', cbdf.consulted_at AT TIME ZONE cl.timezone)::date >= date_trunc('month', :from_month::date)::date
    AND date_trunc('month', cbdf.consulted_at AT TIME ZONE cl.timezone)::date <= date_trunc('month', :to_month::date)::date
    AND (:primary_clinician_ids::uuid[] IS NULL OR cbdf.primary_consult_clinician_id = ANY(:primary_clinician_ids::uuid[]))
    AND (:secondary_clinician_ids::uuid[] IS NULL OR cbdf.secondary_review_clinician_id = ANY(:secondary_clinician_ids::uuid[]))
    AND (:execution_states::dentos_data.case_execution_state[] IS NULL OR cbdf.execution_state = ANY(:execution_states::dentos_data.case_execution_state[]))
    AND (
      :intent_tiers::dentos_data.intent_tier[] IS NULL
      OR CASE WHEN :intent_tier_basis::text = 'current' THEN cbdf.current_intent_tier ELSE cbdf.intent_tier_snapshot END = ANY(:intent_tiers::dentos_data.intent_tier[])
    )
)
SELECT
  consultation_month,
  clinic_id,
  clinic_name,
  treatment_domain_id,
  treatment_domain_code,
  treatment_domain_name,
  COUNT(DISTINCT clinical_case_id) AS total_category_consultations,
  COUNT(DISTINCT clinical_case_id) FILTER (WHERE selected_intent_tier = 'one_star_do_not_treat') AS one_star_consultations,
  COUNT(DISTINCT clinical_case_id) FILTER (WHERE selected_intent_tier = 'two_star_budget_friction') AS two_star_consultations,
  COUNT(DISTINCT clinical_case_id) FILTER (WHERE selected_intent_tier = 'three_star_high_intent_friction') AS three_star_consultations,
  COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'not_started') AS not_started_cases,
  COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'treatment_started') AS treatment_started_cases,
  COUNT(DISTINCT primary_consult_clinician_id) AS primary_doctor_count,
  COUNT(DISTINCT secondary_review_clinician_id) AS secondary_doctor_count
FROM scoped
GROUP BY consultation_month, clinic_id, clinic_name, treatment_domain_id, treatment_domain_code, treatment_domain_name
ORDER BY consultation_month, clinic_name, treatment_domain_name;
```

### High-Intent Pipeline Bottleneck

- Internal key: `conversion.high_intent_pipeline_bottleneck`
- Category: `Conversion Intelligence`
- Source fact: one current patient and clinical case row where current intent tier is 3 Star and case execution state is Not Started.
- Authoritative date: `case_consultations.consulted_at` for age in pipeline; report is an as-of operational snapshot.
- Permission: `analytics.conversion.view` plus `patient.intent_tier.view`.
- Parameters: Clinic Branch `uuid[]` required; As-of At `timestamptz` required; Consultation From Date `date` optional; Consultation To Date `date` optional; Treatment Category `uuid[]` optional; Primary Consult Doctor `uuid[]` optional; Secondary Review Doctor `uuid[]` optional; Friction Reason `text[]` optional; Minimum Pipeline Days `integer` required and nonnegative; Bundle Tier `dentos_data.treatment_bundle_tier[]` optional.
- Output columns: clinic_name, patient_no, patient_name, cell_phone, case_no, consultation_date, pipeline_days, intent_tier, intent_reason_code, primary_consult_doctor, secondary_review_doctor, treatment_categories, pending_primary_value, pending_secondary_value, next_target_start_date, latest_case_note, clinical_case_id, patient_id.
- Total rule: one row per clinical case; category and bundle values are pre-aggregated before the case row is selected.

```sql
WITH bundle_rollup AS (
  SELECT
    cbdf.clinical_case_id,
    string_agg(DISTINCT cbdf.treatment_domain_name, ', ' ORDER BY cbdf.treatment_domain_name) AS treatment_categories,
    SUM(cbdf.domain_advised_value) FILTER (WHERE cbdf.bundle_tier = 'primary' AND cbdf.bundle_status IN ('advised','accepted','scheduled','in_progress'))::numeric(14,2) AS pending_primary_value,
    SUM(cbdf.domain_advised_value) FILTER (WHERE cbdf.bundle_tier = 'secondary' AND cbdf.bundle_status IN ('advised','accepted','scheduled','in_progress'))::numeric(14,2) AS pending_secondary_value,
    MIN(cbdf.target_start_date) FILTER (WHERE cbdf.bundle_status IN ('advised','accepted','scheduled','in_progress')) AS next_target_start_date,
    ARRAY_AGG(DISTINCT cbdf.treatment_domain_id) AS treatment_domain_ids,
    ARRAY_AGG(DISTINCT cbdf.bundle_tier) AS bundle_tiers
  FROM dentos_analytics.v_case_bundle_domain_fact cbdf
  GROUP BY cbdf.clinical_case_id
)
SELECT
  ccf.clinic_name,
  ccf.patient_no,
  ccf.patient_name,
  ccf.cell_phone,
  ccf.case_no,
  ccf.consultation_date,
  FLOOR(EXTRACT(EPOCH FROM (:as_of_at::timestamptz - ccf.consulted_at)) / 86400)::integer AS pipeline_days,
  ccf.current_intent_tier AS intent_tier,
  ccf.current_intent_reason_code AS intent_reason_code,
  ccf.primary_consult_doctor,
  ccf.secondary_review_doctor,
  br.treatment_categories,
  COALESCE(br.pending_primary_value, 0)::numeric(14,2) AS pending_primary_value,
  COALESCE(br.pending_secondary_value, 0)::numeric(14,2) AS pending_secondary_value,
  br.next_target_start_date,
  cc.state_note AS latest_case_note,
  ccf.clinical_case_id,
  ccf.patient_id
FROM dentos_analytics.v_case_conversion_fact ccf
JOIN clinical_cases cc ON cc.id = ccf.clinical_case_id
LEFT JOIN bundle_rollup br ON br.clinical_case_id = ccf.clinical_case_id
WHERE ccf.clinic_id = ANY(:clinic_ids::uuid[])
  AND ccf.consultation_status = 'finalized'
  AND ccf.current_intent_tier = 'three_star_high_intent_friction'
  AND ccf.execution_state = 'not_started'
  AND (:consultation_from_date::date IS NULL OR ccf.consultation_date >= :consultation_from_date::date)
  AND (:consultation_to_date::date IS NULL OR ccf.consultation_date <= :consultation_to_date::date)
  AND (:primary_clinician_ids::uuid[] IS NULL OR ccf.primary_consult_clinician_id = ANY(:primary_clinician_ids::uuid[]))
  AND (:secondary_clinician_ids::uuid[] IS NULL OR ccf.secondary_review_clinician_id = ANY(:secondary_clinician_ids::uuid[]))
  AND (:friction_reason_codes::text[] IS NULL OR ccf.current_intent_reason_code = ANY(:friction_reason_codes::text[]))
  AND (:treatment_domain_ids::uuid[] IS NULL OR br.treatment_domain_ids && :treatment_domain_ids::uuid[])
  AND (:bundle_tiers::dentos_data.treatment_bundle_tier[] IS NULL OR br.bundle_tiers && :bundle_tiers::dentos_data.treatment_bundle_tier[])
  AND FLOOR(EXTRACT(EPOCH FROM (:as_of_at::timestamptz - ccf.consulted_at)) / 86400)::integer >= :minimum_pipeline_days::integer
ORDER BY pipeline_days DESC, ccf.consulted_at, ccf.case_no;
```

### Doctor-Wise Clinical Conversion Ratios

- Internal key: `conversion.primary_doctor_clinical_conversion_ratio`
- Category: `Conversion Intelligence`
- Source fact: finalized initial consultations assigned to each Primary Consult Doctor within the selected consultation cohort.
- Authoritative date: denominator cohort uses clinic-local `case_consultations.consulted_at`; numerator uses the same cohort's current execution state as of `:as_of_at`.
- Permission: `analytics.conversion.view`.
- Parameters: Clinic Branch `uuid[]` required; Consultation From Date `date` required; Consultation To Date `date` required; As-of At `timestamptz` required; Primary Consult Doctor `uuid[]` optional; Treatment Category `uuid[]` optional; Intent Tier Basis `text` required with `current` or `case_snapshot`; Intent Tier `dentos_data.intent_tier[]` optional; Include Zero Consultation Doctors `boolean` required.
- Output columns: clinic_id, clinic_name, primary_consult_clinician_id, primary_consult_doctor, total_initial_consultations, treatment_started_cases, not_started_cases, minor_issue_treated_same_day_cases, no_treatment_needed_cases, conversion_ratio_percent.
- Formula: `conversion_ratio_percent = treatment_started_cases / total_initial_consultations * 100`; zero denominator returns NULL.

```sql
WITH clinician_scope AS (
  SELECT sc.clinic_id, s.id AS clinician_id, s.display_name
  FROM staff s
  JOIN staff_clinics sc ON sc.staff_id = s.id AND sc.active = true
  WHERE sc.clinic_id = ANY(:clinic_ids::uuid[])
    AND s.staff_type = 'clinician'
    AND s.active = true
    AND (:primary_clinician_ids::uuid[] IS NULL OR s.id = ANY(:primary_clinician_ids::uuid[]))
),
case_categories AS (
  SELECT DISTINCT clinical_case_id, treatment_domain_id
  FROM dentos_analytics.v_case_bundle_domain_fact
),
cohort AS (
  SELECT DISTINCT
    ccf.clinic_id,
    ccf.clinic_name,
    ccf.clinical_case_id,
    ccf.primary_consult_clinician_id,
    ccf.execution_state,
    ccf.treatment_started_at,
    CASE WHEN :intent_tier_basis::text = 'current' THEN ccf.current_intent_tier ELSE ccf.intent_tier_snapshot END AS selected_intent_tier
  FROM dentos_analytics.v_case_conversion_fact ccf
  JOIN clinics cl ON cl.id = ccf.clinic_id
  LEFT JOIN case_categories ccat ON ccat.clinical_case_id = ccf.clinical_case_id
  WHERE ccf.clinic_id = ANY(:clinic_ids::uuid[])
    AND ccf.consultation_status = 'finalized'
    AND (ccf.consulted_at AT TIME ZONE cl.timezone)::date BETWEEN :consultation_from_date::date AND :consultation_to_date::date
    AND (:primary_clinician_ids::uuid[] IS NULL OR ccf.primary_consult_clinician_id = ANY(:primary_clinician_ids::uuid[]))
    AND (:treatment_domain_ids::uuid[] IS NULL OR ccat.treatment_domain_id = ANY(:treatment_domain_ids::uuid[]))
    AND (
      :intent_tiers::dentos_data.intent_tier[] IS NULL
      OR CASE WHEN :intent_tier_basis::text = 'current' THEN ccf.current_intent_tier ELSE ccf.intent_tier_snapshot END = ANY(:intent_tiers::dentos_data.intent_tier[])
    )
),
aggregated AS (
  SELECT
    clinic_id,
    primary_consult_clinician_id,
    COUNT(DISTINCT clinical_case_id) AS total_initial_consultations,
    COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'treatment_started' AND treatment_started_at <= :as_of_at::timestamptz) AS treatment_started_cases,
    COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'not_started') AS not_started_cases,
    COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'minor_issue_treated_same_day') AS minor_issue_treated_same_day_cases,
    COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'no_treatment_needed') AS no_treatment_needed_cases
  FROM cohort
  GROUP BY clinic_id, primary_consult_clinician_id
)
SELECT
  cs.clinic_id,
  cl.name AS clinic_name,
  cs.clinician_id AS primary_consult_clinician_id,
  cs.display_name AS primary_consult_doctor,
  COALESCE(a.total_initial_consultations, 0) AS total_initial_consultations,
  COALESCE(a.treatment_started_cases, 0) AS treatment_started_cases,
  COALESCE(a.not_started_cases, 0) AS not_started_cases,
  COALESCE(a.minor_issue_treated_same_day_cases, 0) AS minor_issue_treated_same_day_cases,
  COALESCE(a.no_treatment_needed_cases, 0) AS no_treatment_needed_cases,
  ROUND(100.0 * a.treatment_started_cases / NULLIF(a.total_initial_consultations, 0), 2) AS conversion_ratio_percent
FROM clinician_scope cs
JOIN clinics cl ON cl.id = cs.clinic_id
LEFT JOIN aggregated a ON a.clinic_id = cs.clinic_id AND a.primary_consult_clinician_id = cs.clinician_id
WHERE :include_zero_consultation_doctors::boolean OR COALESCE(a.total_initial_consultations, 0) > 0
ORDER BY cl.name, conversion_ratio_percent DESC NULLS LAST, cs.display_name, cs.clinician_id;
```

### High-Value Category Conversions

- Internal key: `conversion.high_value_category_role_conversions`
- Category: `Conversion Intelligence`
- Source fact: one distinct clinical case and high-value treatment domain expanded into Primary Consult Doctor and Secondary Review Doctor role rows.
- Authoritative date: clinic-local initial consultation date for the cohort; state is evaluated as of `:as_of_at`.
- Permission: `analytics.conversion.view`.
- Parameters: Clinic Branch `uuid[]` required; Consultation From Date `date` required; Consultation To Date `date` required; As-of At `timestamptz` required; High-Value Treatment Category `uuid[]` optional; Doctor Role `text[]` required with `primary_consult` and/or `secondary_review`; Doctor `uuid[]` optional; Intent Tier `dentos_data.intent_tier[]` optional; Execution State `dentos_data.case_execution_state[]` optional.
- Output columns: consultation_month, clinic_name, treatment_domain_name, doctor_role, clinician_id, clinician_name, total_high_value_consultations, treatment_started_cases, conversion_ratio_percent, advised_value, converted_advised_value.
- Total rule: one case contributes once per treatment domain and selected doctor role; role totals are not added together as unique-clinic totals without deduplicating clinical_case_id.

```sql
WITH case_domain AS (
  SELECT
    cbdf.clinical_case_id,
    cbdf.clinic_id,
    cbdf.clinic_name,
    date_trunc('month', cbdf.consulted_at AT TIME ZONE cl.timezone)::date AS consultation_month,
    cbdf.treatment_domain_id,
    cbdf.treatment_domain_name,
    cbdf.execution_state,
    cbdf.treatment_started_at,
    cbdf.current_intent_tier,
    cbdf.primary_consult_clinician_id,
    cbdf.primary_consult_doctor,
    cbdf.secondary_review_clinician_id,
    cbdf.secondary_review_doctor,
    SUM(cbdf.domain_advised_value)::numeric(14,2) AS advised_value
  FROM dentos_analytics.v_case_bundle_domain_fact cbdf
  JOIN clinics cl ON cl.id = cbdf.clinic_id
  WHERE cbdf.clinic_id = ANY(:clinic_ids::uuid[])
    AND cbdf.treatment_domain_high_value = true
    AND (:treatment_domain_ids::uuid[] IS NULL OR cbdf.treatment_domain_id = ANY(:treatment_domain_ids::uuid[]))
    AND (cbdf.consulted_at AT TIME ZONE cl.timezone)::date BETWEEN :consultation_from_date::date AND :consultation_to_date::date
    AND (:intent_tiers::dentos_data.intent_tier[] IS NULL OR cbdf.current_intent_tier = ANY(:intent_tiers::dentos_data.intent_tier[]))
    AND (:execution_states::dentos_data.case_execution_state[] IS NULL OR cbdf.execution_state = ANY(:execution_states::dentos_data.case_execution_state[]))
  GROUP BY
    cbdf.clinical_case_id, cbdf.clinic_id, cbdf.clinic_name, date_trunc('month', cbdf.consulted_at AT TIME ZONE cl.timezone)::date,
    cbdf.treatment_domain_id, cbdf.treatment_domain_name, cbdf.execution_state,
    cbdf.treatment_started_at, cbdf.current_intent_tier,
    cbdf.primary_consult_clinician_id, cbdf.primary_consult_doctor,
    cbdf.secondary_review_clinician_id, cbdf.secondary_review_doctor
),
role_rows AS (
  SELECT
    cd.*,
    role_value.doctor_role,
    role_value.clinician_id,
    role_value.clinician_name
  FROM case_domain cd
  CROSS JOIN LATERAL (
    VALUES
      ('primary_consult'::text, cd.primary_consult_clinician_id, cd.primary_consult_doctor),
      ('secondary_review'::text, cd.secondary_review_clinician_id, cd.secondary_review_doctor)
  ) AS role_value(doctor_role, clinician_id, clinician_name)
  WHERE role_value.doctor_role = ANY(:doctor_roles::text[])
    AND (:clinician_ids::uuid[] IS NULL OR role_value.clinician_id = ANY(:clinician_ids::uuid[]))
)
SELECT
  consultation_month,
  clinic_name,
  treatment_domain_name,
  doctor_role,
  clinician_id,
  clinician_name,
  COUNT(DISTINCT clinical_case_id) AS total_high_value_consultations,
  COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'treatment_started' AND treatment_started_at <= :as_of_at::timestamptz) AS treatment_started_cases,
  ROUND(
    100.0 * COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'treatment_started' AND treatment_started_at <= :as_of_at::timestamptz)
    / NULLIF(COUNT(DISTINCT clinical_case_id), 0),
    2
  ) AS conversion_ratio_percent,
  SUM(advised_value)::numeric(14,2) AS advised_value,
  SUM(advised_value) FILTER (WHERE execution_state = 'treatment_started' AND treatment_started_at <= :as_of_at::timestamptz)::numeric(14,2) AS converted_advised_value
FROM role_rows
GROUP BY consultation_month, clinic_name, treatment_domain_name, doctor_role, clinician_id, clinician_name
ORDER BY consultation_month, clinic_name, treatment_domain_name, doctor_role, conversion_ratio_percent DESC NULLS LAST, clinician_name;
```

### Cross-Tier Matrix Generator

- Internal key: `conversion.cross_tier_matrix_generator`
- Category: `Conversion Intelligence`
- Source fact: one distinct clinical case per selected treatment domain, collapsed to one case when Treatment Category is not a selected grouping dimension.
- Authoritative date: clinic-local initial consultation date.
- Permission: `analytics.conversion.view`.
- Parameters: Clinic Branch `uuid[]` required; Consultation From Date `date` required; Consultation To Date `date` required; Group Dimensions `text[]` required and limited to `treatment_category`, `intent_tier`, `execution_status`; Treatment Category `uuid[]` optional; Intent Tier Basis `text` required with `current` or `case_snapshot`; Intent Tier `dentos_data.intent_tier[]` optional; Execution State `dentos_data.case_execution_state[]` optional; Primary Consult Doctor `uuid[]` optional; Secondary Review Doctor `uuid[]` optional.
- Output columns: treatment_category_group, intent_tier_group, execution_status_group, case_count, total_advised_value, average_advised_value, treatment_started_count, treatment_started_percent.
- Total rule: `dimension_rows` applies `DISTINCT` after omitted dimensions become NULL, preventing one multi-category case from multiplying totals when category is not selected as a grouping dimension.

```sql
WITH source_rows AS (
  SELECT
    cbdf.clinical_case_id,
    cbdf.treatment_domain_id,
    cbdf.treatment_domain_name,
    CASE WHEN :intent_tier_basis::text = 'current' THEN cbdf.current_intent_tier ELSE cbdf.intent_tier_snapshot END AS selected_intent_tier,
    cbdf.execution_state,
    cbdf.primary_consult_clinician_id,
    cbdf.secondary_review_clinician_id,
    SUM(cbdf.domain_advised_value) OVER (PARTITION BY cbdf.clinical_case_id) AS case_advised_value
  FROM dentos_analytics.v_case_bundle_domain_fact cbdf
  JOIN clinics cl ON cl.id = cbdf.clinic_id
  WHERE cbdf.clinic_id = ANY(:clinic_ids::uuid[])
    AND (cbdf.consulted_at AT TIME ZONE cl.timezone)::date BETWEEN :consultation_from_date::date AND :consultation_to_date::date
    AND (:treatment_domain_ids::uuid[] IS NULL OR cbdf.treatment_domain_id = ANY(:treatment_domain_ids::uuid[]))
    AND (:execution_states::dentos_data.case_execution_state[] IS NULL OR cbdf.execution_state = ANY(:execution_states::dentos_data.case_execution_state[]))
    AND (:primary_clinician_ids::uuid[] IS NULL OR cbdf.primary_consult_clinician_id = ANY(:primary_clinician_ids::uuid[]))
    AND (:secondary_clinician_ids::uuid[] IS NULL OR cbdf.secondary_review_clinician_id = ANY(:secondary_clinician_ids::uuid[]))
    AND (
      :intent_tiers::dentos_data.intent_tier[] IS NULL
      OR CASE WHEN :intent_tier_basis::text = 'current' THEN cbdf.current_intent_tier ELSE cbdf.intent_tier_snapshot END = ANY(:intent_tiers::dentos_data.intent_tier[])
    )
),
dimension_rows AS (
  SELECT DISTINCT
    clinical_case_id,
    CASE WHEN 'treatment_category' = ANY(:group_dimensions::text[]) THEN treatment_domain_name ELSE NULL END AS treatment_category_group,
    CASE WHEN 'intent_tier' = ANY(:group_dimensions::text[]) THEN selected_intent_tier::text ELSE NULL END AS intent_tier_group,
    CASE WHEN 'execution_status' = ANY(:group_dimensions::text[]) THEN execution_state::text ELSE NULL END AS execution_status_group,
    execution_state,
    case_advised_value
  FROM source_rows
)
SELECT
  COALESCE(treatment_category_group, 'All Treatment Categories') AS treatment_category_group,
  COALESCE(intent_tier_group, 'All Intent Tiers') AS intent_tier_group,
  COALESCE(execution_status_group, 'All Execution States') AS execution_status_group,
  COUNT(DISTINCT clinical_case_id) AS case_count,
  SUM(case_advised_value)::numeric(14,2) AS total_advised_value,
  ROUND(AVG(case_advised_value), 2)::numeric(14,2) AS average_advised_value,
  COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'treatment_started') AS treatment_started_count,
  ROUND(
    100.0 * COUNT(DISTINCT clinical_case_id) FILTER (WHERE execution_state = 'treatment_started')
    / NULLIF(COUNT(DISTINCT clinical_case_id), 0),
    2
  ) AS treatment_started_percent
FROM dimension_rows
GROUP BY treatment_category_group, intent_tier_group, execution_status_group
ORDER BY treatment_category_group NULLS FIRST, intent_tier_group NULLS FIRST, execution_status_group NULLS FIRST;
```

### Pending Priority Treatment Registers

- Internal key: `conversion.pending_priority_treatment_registers`
- Category: `Conversion Intelligence`
- Source fact: pending Primary and Secondary treatment bundles and their immutable advised service lines.
- Authoritative date: selected Month Basis uses either `treatment_bundles.target_start_date` or clinic-local `treatment_bundles.advised_at`.
- Permission: `analytics.conversion.view` and `clinical_case.view`.
- Parameters: Clinic Branch `uuid[]` required; Selected Month `date` required; Month Basis `text` required with `target_start` or `advised`; Register Tier `dentos_data.treatment_bundle_tier[]` required and limited to `primary` and `secondary`; Bundle State `dentos_data.treatment_bundle_state[]` required and limited to `advised`, `accepted`, `scheduled`, `in_progress`; Treatment Category `uuid[]` optional; Intent Tier `dentos_data.intent_tier[]` optional; Execution State `dentos_data.case_execution_state[]` optional; Primary Consult Doctor `uuid[]` optional; Secondary Review Doctor `uuid[]` optional.
- Output columns: register_tier, clinic_name, target_or_advised_date, patient_no, patient_name, cell_phone, case_no, intent_tier, execution_state, primary_consult_doctor, secondary_review_doctor, bundle_title, bundle_state, treatment_categories, pending_services, pending_service_count, pending_advised_value, treatment_bundle_id, clinical_case_id, patient_id.
- Total rule: one row per pending bundle; completed, declined, cancelled, and Tertiary bundles are excluded even when requested by a forged parameter.

```sql
WITH pending_lines AS (
  SELECT
    tb.id AS treatment_bundle_id,
    tb.clinical_case_id,
    tb.bundle_tier,
    tb.title AS bundle_title,
    tb.status AS bundle_state,
    tb.target_start_date,
    tb.advised_at,
    string_agg(DISTINCT sd.name, ', ' ORDER BY sd.name) AS treatment_categories,
    string_agg(
      tbs.service_name_snapshot ||
      CASE WHEN tbs.tooth_code_snapshot IS NULL THEN '' ELSE ' | Tooth ' || tbs.tooth_code_snapshot END,
      '; ' ORDER BY tbs.sequence_no
    ) FILTER (WHERE tbs.line_state IN ('pending','scheduled','in_progress')) AS pending_services,
    COUNT(tbs.id) FILTER (WHERE tbs.line_state IN ('pending','scheduled','in_progress')) AS pending_service_count,
    SUM(tbs.proposed_amount_snapshot) FILTER (WHERE tbs.line_state IN ('pending','scheduled','in_progress'))::numeric(14,2) AS pending_advised_value,
    ARRAY_AGG(DISTINCT tbs.service_domain_id_snapshot) AS treatment_domain_ids
  FROM treatment_bundles tb
  JOIN treatment_bundle_services tbs ON tbs.treatment_bundle_id = tb.id
  JOIN service_domains sd ON sd.id = tbs.service_domain_id_snapshot
  WHERE tb.bundle_tier IN ('primary','secondary')
    AND tb.bundle_tier = ANY(:register_tiers::dentos_data.treatment_bundle_tier[])
    AND tb.status IN ('advised','accepted','scheduled','in_progress')
    AND tb.status = ANY(:bundle_states::dentos_data.treatment_bundle_state[])
  GROUP BY tb.id, tb.clinical_case_id, tb.bundle_tier, tb.title, tb.status, tb.target_start_date, tb.advised_at
  HAVING COUNT(tbs.id) FILTER (WHERE tbs.line_state IN ('pending','scheduled','in_progress')) > 0
)
SELECT
  pl.bundle_tier AS register_tier,
  ccf.clinic_name,
  CASE WHEN :month_basis::text = 'target_start' THEN pl.target_start_date ELSE (pl.advised_at AT TIME ZONE cl.timezone)::date END AS target_or_advised_date,
  ccf.patient_no,
  ccf.patient_name,
  ccf.cell_phone,
  ccf.case_no,
  ccf.current_intent_tier AS intent_tier,
  ccf.execution_state,
  ccf.primary_consult_doctor,
  ccf.secondary_review_doctor,
  pl.bundle_title,
  pl.bundle_state,
  pl.treatment_categories,
  pl.pending_services,
  pl.pending_service_count,
  pl.pending_advised_value,
  pl.treatment_bundle_id,
  ccf.clinical_case_id,
  ccf.patient_id
FROM pending_lines pl
JOIN dentos_analytics.v_case_conversion_fact ccf ON ccf.clinical_case_id = pl.clinical_case_id
JOIN clinics cl ON cl.id = ccf.clinic_id
WHERE ccf.clinic_id = ANY(:clinic_ids::uuid[])
  AND (:execution_states::dentos_data.case_execution_state[] IS NULL OR ccf.execution_state = ANY(:execution_states::dentos_data.case_execution_state[]))
  AND (:intent_tiers::dentos_data.intent_tier[] IS NULL OR ccf.current_intent_tier = ANY(:intent_tiers::dentos_data.intent_tier[]))
  AND (:primary_clinician_ids::uuid[] IS NULL OR ccf.primary_consult_clinician_id = ANY(:primary_clinician_ids::uuid[]))
  AND (:secondary_clinician_ids::uuid[] IS NULL OR ccf.secondary_review_clinician_id = ANY(:secondary_clinician_ids::uuid[]))
  AND (:treatment_domain_ids::uuid[] IS NULL OR pl.treatment_domain_ids && :treatment_domain_ids::uuid[])
  AND date_trunc(
        'month',
        CASE WHEN :month_basis::text = 'target_start'
             THEN pl.target_start_date::timestamp
             ELSE pl.advised_at AT TIME ZONE cl.timezone
        END
      )::date = date_trunc('month', :selected_month::date)::date
ORDER BY pl.bundle_tier, target_or_advised_date NULLS LAST, ccf.patient_name, ccf.case_no, pl.treatment_bundle_id;
```

## 14. Catalog Reconciliation Rules

1. The registry must contain exactly 143 active leaf contracts represented above; duplicate visible labels in different categories retain distinct internal keys.
2. `Gross Collection` is summed only from collection receipt tenders. `Fee Allocation` is summed only from application distributions or application tender allocations. `Due` is recalculated only from Fee Statements and dated settlement effects. `Unallocated Collection` is calculated only from collection receipt tender availability.
3. A report query receives authorized clinic IDs from middleware; browser-supplied clinic IDs can narrow but cannot broaden that set.
4. A void, reversal, refund, credit, or write-off remains dated and visible in the appropriate audit/detail report; no report repairs history by deleting a source transaction.
5. A zero denominator produces `NULL` for a rate. It never produces an invented zero-percent success or failure.
6. Source SQL, fresh projection, grid, print, PDF, and spreadsheet must reconcile to INR 0.00 for financial amounts and exactly for counts.
7. Conversion Intelligence reports count clinical cases and consultation roles; they never relabel gross collection, applied settlement, assessed value, or clinician share as conversion.
8. Monthly Total Category Consultations counts each case once per treatment domain. Doctor-Wise Clinical Conversion Ratios uses only Primary Consult Doctor in the denominator. High-Value Category Conversions expands Primary and Secondary roles explicitly and labels the role on every row.
9. High-Intent Pipeline Bottleneck always uses the patient's current 3 Star tier and current Not Started case state. Historical cohort analysis uses the explicit current or case-snapshot tier basis selected by the report.
10. Pending Priority Treatment Registers excludes Tertiary, completed, declined, and cancelled bundles at the source query even when a forged browser parameter requests them.
