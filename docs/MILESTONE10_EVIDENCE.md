# Milestone 10 Evidence — Pilot Acceptance

Manual review checklist for Phases 54–55. Staging and synthetic data only unless explicit production approval is recorded.

## Prerequisites

1. Docker Desktop running.
2. Reset local database: `npx supabase db reset`
3. Gateway running: `npm run dev --workspace @klickit/gateway`
4. Dev session token via `POST /auth/dev/session` with `{ "loginName": "dev.admin" }`

## Phase 54 — Controlled Rohini pilot release candidate

- [ ] `POST /pilot/release-candidate` creates draft release candidate
- [ ] `PUT /pilot/release-candidate/checklist` marks all go-live items complete
- [ ] `GET /pilot/production-gate` blocks production in local environment
- [ ] `POST /pilot/reconciliation/daily` records INR 0.00 variance day
- [ ] `GET /pilot/reconciliation/daily` lists recorded reconciliations
- [ ] Review `docs/runbooks/rohini-go-live.md` and `docs/runbooks/rohini-rollback.md`

## Phase 55 — Final acceptance, handover and Shalimar expansion

- [ ] `POST /pilot/acceptance` records pilot report with zero severity 1/2 issues
- [ ] `GET /pilot/acceptance` lists acceptance records
- [ ] `POST /pilot/issues` and `GET /pilot/issues` track unresolved defects
- [ ] `GET /pilot/handover/summary` lists operating runbooks and handover checklist
- [ ] `GET /pilot/expansion/shalimar` returns expansion plan contract
- [ ] Review `docs/plans/shalimar-expansion-plan.md` and `docs/SALE_AND_HANDOVER_CHECKLIST.md`

## Automated evidence

```powershell
npm test
npm run typecheck
npm run build
npx supabase db reset
node scripts/run-daily-reconciliation.mjs
```

## Approval gate

When satisfied, reply exactly:

`APPROVE MILESTONE`

This completes the 55-phase master plan.
