# Synthetic Finance UAT Script

1. Create a draft fee statement with one line.
2. Issue the fee statement.
3. Record a split-tender collection.
4. Allocate the collection to the fee statement.
5. Run `GET /finance/fee-statements/:id/reconcile` and confirm zero variance.

Record pass/fail in `docs/MILESTONE9_EVIDENCE.md`.
