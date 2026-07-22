# Finance Remediation Plan

**Track:** Critical remediation — P0  
**Status:** Plan only  
**Last updated:** 2026-07-22  
**Remediation 1:** Delivered — see `FINANCE_REMEDIATION_EVIDENCE.md`

## Blueprint requirements

| Source | Requirement |
|--------|-------------|
| BP03 | Four non-interchangeable financial facts; allocation-only settlement |
| BP07 FIN-DEC-01..06 / UNRESOLVED-01..06 | Release blockers before Phase 2 financial release |
| BP07 LED-002..012, REP-001 | Collections, allocations, refunds, INR 0.00 reconciliation |
| BP06 §9 Financial Operations | Six tabs: statements, collections, allocations, credits, refunds, ledger |
| BP10 §13 pilot decisions | Manual allocation, split tender, clinic/year numbering, aging anchor |

## Defective / incomplete areas

| Area | Evidence | Gap |
|------|----------|-----|
| FIN-DEC decisions | `docs/DECISION_LOG.md` | No FIN-DEC-01..06 entries |
| Collections UI | `apps/web/src/pages/FinancialOperationsPage.tsx` | Backend only |
| Allocations UI | Same | Backend only |
| Refunds UI | Missing | API exists |
| Patient workspace financial tabs | BP06 | Not wired |
| REP-001 automated fixture | BP07 | Not in test suite |
| Offline pending payments | BP10 FIN-OFF-002 | Not implemented |

## Target architecture

1. Record owner decisions FIN-DEC-01..06 in `DECISION_LOG.md` mapping to BP10 pilot overrides where applicable.
2. Extend `FinancialOperationsPage` with tabbed sub-routes matching BP06 (minimal pilot forms first).
3. Keep posting commands in `apps/gateway/src/finance/repository.ts` — single source of truth.
4. Daily reconciliation: wire UI to `/pilot/reconciliation/daily` + `/finance/fee-statements/:id/reconcile`.
5. Immutable posted history: void/reversal only — no hard delete (already in repository patterns).

## Migrations

Likely **no new tables** for pilot if FIN-DEC-02 numbering uses existing `document_series`. Possible:

- `offline_pending_payments` (BP10) — new migration when FIN-OFF-002 implemented
- Decision audit table for FIN-DEC acceptance records

## Compatibility

- Existing milestone7 tests must continue passing
- Seed fee schedules unchanged for synthetic UAT

## Tests

| Test | Type |
|------|------|
| LED-002 collection create | Gateway integration |
| LED-004 manual allocation | Gateway integration |
| LED-008 refund blocked when allocated | Gateway integration |
| REP-001 grid = journal variance 0 | New fixture in `packages/finance/test/` |
| FIN-DEC-06 split tender | Extend `finance.test.ts` |
| UI smoke | Record collection → allocate (E2E later) |

## Rollback

- Feature-flag new financial UI tabs behind `pilot.finance.v2` env if needed
- No migration rollback if only UI + decision docs

## Risks

| Risk | Mitigation |
|------|------------|
| R-003 financial divergence | Mandatory INR 0.00 test before go-live |
| R-015 blueprint pilot closures | Owner signs FIN-DEC before enabling UI |
| Split tender vs BP03 single-method | Document DEC-038 resolving UNRESOLVED-06 |

## Owner decisions required

- [ ] Confirm manual allocation as pilot default (FIN-DEC-01)
- [ ] Confirm clinic/type/year numbering format (FIN-DEC-02)
- [ ] Confirm aging anchor: due date else bill date (FIN-DEC-03)
- [ ] Confirm proportional multi-doctor split (FIN-DEC-04)
- [ ] Confirm refund blocked until deallocation (FIN-DEC-05)
- [ ] Confirm split-tender allowed in pilot (FIN-DEC-06) — resolves BP03/BP10 tension

## Definition of done

- [ ] All six FIN-DEC entries in DECISION_LOG with date and approver
- [ ] Financial Operations UI: balance, statement, **collection**, **allocation** minimum paths
- [ ] REP-001 or equivalent automated reconciliation test passing
- [ ] Owner finance UAT checklist completed (`docs/uat/staff-finance-synthetic.md`)
- [ ] `20_FINANCIAL_READINESS_REPORT.md` regenerated with VERIFIED items listed
- [ ] Release state remains NOT READY until offline payment path (FIN-OFF) addressed or explicitly deferred
