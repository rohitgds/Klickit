# Milestone 7 Evidence — Finance

Manual review checklist for Phases 40–46. Use synthetic data only.

## Prerequisites

1. Docker Desktop running.
2. Reset local database: `npx supabase db reset`
3. Gateway running: `npm run dev --workspace @klickit/gateway`
4. Dev session token via `POST /auth/dev/session` with `{ "loginName": "dev.admin" }`
5. Use header `x-session-token` on protected routes.

## Phase 40 — Financial masters, fees, taxes and discount controls

- [ ] `GET /finance/masters` returns seeded tax codes, collection methods and fee schedule items
- [ ] Fee schedule item for composite filling shows GST 18% split (9% CGST + 9% SGST)
- [ ] Adding a line with discount above 10% is rejected on draft fee statements

## Phase 41 — Fee statements and clinic/year numbering

- [ ] `POST /finance/fee-statements` creates draft statement with reference
- [ ] `POST /finance/fee-statements/:id/lines` adds service line with computed GST totals
- [ ] `POST /finance/fee-statements/:id/issue` moves draft to issued with outstanding balance
- [ ] `GET /finance/fee-statements/:id` shows header totals and line detail

## Phase 42 — Collections, split tenders and patient advances

- [ ] `POST /finance/collections` records cash/UPI split tenders on one receipt
- [ ] Receipt stores gross, applied and unapplied totals
- [ ] `GET /finance/patients/:patientId/balance` shows open exposure and advance balance

## Phase 43 — Allocations and multi-doctor distribution

- [ ] `POST /finance/allocations` applies receipt amount to issued statement
- [ ] Line and tender split totals must match allocation amount
- [ ] Statement status moves to `part_paid` or `paid` after allocation

## Phase 44 — Refunds, reversals, voids and immutable journals

- [ ] `POST /finance/refunds` posts refund with processed/approved actors
- [ ] Refund above available receipt balance is rejected
- [ ] `POST /finance/journal-entries` posts balanced ledger lines

## Phase 45 — Aging, balances and verified opening balances

- [ ] `GET /finance/patients/:patientId/aging` returns current/30/60/90+ buckets
- [ ] `POST /finance/opening-balances` records verified legacy receivable/advance snapshot

## Phase 46 — Financial documents, reconciliation and UAT

- [ ] `GET /finance/fee-statements/:id/reconcile` returns zero cent variance for issued totals
- [ ] Source line totals reconcile to statement header totals

## Automated evidence

```powershell
npm test
npm run typecheck
npm run build
npx supabase db reset
```

## Approval gate

When satisfied, reply exactly:

`APPROVE MILESTONE`
