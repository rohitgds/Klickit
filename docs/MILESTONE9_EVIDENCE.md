# Milestone 9 Evidence — Rohini Readiness

Manual review checklist for Phases 51–53. Synthetic data and preview/staging only.

## Prerequisites

1. Docker Desktop running.
2. Reset local database: `npx supabase db reset`
3. Gateway running: `npm run dev --workspace @klickit/gateway`
4. Dev session token via `POST /auth/dev/session` with `{ "loginName": "dev.admin" }`

## Phase 51 — Gateway installer, alternate runtime and recovery drill

- [ ] `GET /runtime/boundary` documents alternate runtime contract
- [ ] `POST /resilience/backup/run` records a backup run with checksum
- [ ] `POST /resilience/restore/drill` records pass/fail against backup checksum
- [ ] `GET /resilience/recovery/status` shows last backup and restore drill
- [ ] `POST /resilience/incidents` opens spare-gateway incident record
- [ ] Review `docs/runbooks/gateway-recovery-drill.md` and `docs/runbooks/spare-gateway-activation.md`

## Phase 52 — Migration dry run, training data and synthetic UAT

- [ ] `node scripts/generate-drklick-fixture.mjs` writes synthetic fixture file
- [ ] `POST /migration/drklick/batches` + stage rows from fixture
- [ ] `GET /migration/drklick/batches/:id` returns acceptance report
- [ ] `POST .../accept` then `POST .../apply` imports valid synthetic patients
- [ ] Complete staff UAT scripts under `docs/uat/`

## Phase 53 — Staging, security, portability, performance and 72-hour drills

- [ ] `GET /readiness/portability/status` confirms non-production guards
- [ ] `POST /readiness/drills` with `OFF-003` passes when writes blocked and reads allowed
- [ ] `POST /readiness/drills` with `SYNC-001` passes with duplicate suppression evidence
- [ ] `GET /readiness/drills` lists recorded drill runs
- [ ] Run `scripts/drill-72-hour-offline.mjs` and capture output

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
