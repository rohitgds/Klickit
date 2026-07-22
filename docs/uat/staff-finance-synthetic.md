# Synthetic Finance UAT Script

Use **Financial Operations** (`/financial-operations`) tabs in order:

1. **Statements** — create draft fee statement, add one line, issue.
2. **Collections** — record a split-tender collection for the same patient (FIN-DEC-06).
3. **Allocations** — manually allocate the collection to the issued statement (FIN-DEC-01).
4. **Reconciliation** — run statement reconcile; confirm INR 0.00 variance. Record daily reconciliation if pilot.manage is available.

Record pass/fail in `docs/remediation/FINANCE_REMEDIATION_EVIDENCE.md`.
