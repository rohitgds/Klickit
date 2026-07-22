# Finance Remediation — Evidence

**Date:** 2026-07-22  
**Branch:** `remediation/pilot-safety`  
**Status:** Finance Remediation 1 delivered (local)

## Decisions recorded (FIN-DEC-01..06)

All six pilot financial policies closed in `docs/DECISION_LOG.md` per BP10 §13 and blueprint UNRESOLVED-01..06.

| ID | Policy |
|----|--------|
| FIN-DEC-01 | Manual allocation default |
| FIN-DEC-02 | Clinic/type/year numbering |
| FIN-DEC-03 | Aging anchor `coalesce(due_date, statement_date)` |
| FIN-DEC-04 | Proportional multi-clinician splits |
| FIN-DEC-05 | Refund limited to unapplied balance |
| FIN-DEC-06 | Split-tender allowed in pilot |

**Deferred:** FIN-OFF-002 offline pending payments (DEC-040).

## Code delivered

| Area | Change |
|------|--------|
| `@klickit/finance` | REP-001 `validateRep001Reconciliation`, FIN-DEC-04 proportional splits, FIN-DEC-05 refund guard |
| Gateway repository | Collection returns tender IDs; refunds use `unapplied_total` |
| Web API | Collection, allocation, reconcile, daily reconciliation clients |
| UI | `FinancialOperationsPage` tabbed: Balance, Statements, Collections, Allocations, Reconciliation |
| Tests | 12 finance package tests; web helper tests extended |

## Owner UAT (synthetic)

Follow `docs/uat/staff-finance-synthetic.md`:

1. Statements tab — create draft, add line, issue
2. Collections tab — record split-tender collection
3. Allocations tab — allocate to issued statement
4. Reconciliation tab — statement reconcile + daily pilot reconcile

## Not claimed fixed

- Patient workspace financial tabs (BP06) — not wired
- Refunds UI — API only
- Offline pending payments (FIN-OFF-002)
- Release state remains **NOT READY**

## Verification commands

```powershell
npm run test --workspace @klickit/finance
npm run test --workspace @klickit/web
npm run test --workspace @klickit/gateway
```

With Supabase: execute UAT script and confirm `GET /finance/fee-statements/:id/reconcile` returns `ok: true`.
