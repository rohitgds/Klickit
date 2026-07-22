# Sync Remediation — Evidence

**Date:** 2026-07-22  
**Branch:** `remediation/pilot-safety`  
**Status:** Sync Remediation 1 delivered (local)

## Decisions recorded

| ID | Decision |
|----|----------|
| SYNC-DEC-01 | Staging Supabase sync drills **deferred** until owner approves non-production cloud project |
| SYNC-DEC-02 | OFF-001 multi-workstation drill remains **manual** with evidence template |
| DEC-041 | Duplicate idempotency replay returns `already_applied` (SYNC-001) |

## Code delivered

| Area | Change |
|------|--------|
| Migration | `20260723130000_sync_dead_letters.sql` — dead-letter queue |
| `@klickit/test-fixtures` | Synthetic two-clinic sync envelopes (`SYNTHETIC_SYNC_CLINIC_A/B`) |
| Gateway engine | Idempotent replay, `getSyncStatusSummary`, dead-letter recording |
| Gateway conflicts | `reconcileFieldPatches` for field merge vs conflict queue |
| Gateway routes | `GET /sync/status`; extended `/sync/outbox/pending` summary |
| Gateway tests | `sync-integration.test.ts` — SYNC-001..004, OFF-003 (PG; skip without migration) |
| Web API | Fixed conflict field mapping; `fetchSyncStatus` |
| Web UI | Conflict table shows local/cloud values; shell badge shows pending/failed/conflicts |
| Drill script | `scripts/drill-offline-readonly.ps1` |
| Evidence template | `docs/remediation/evidence/SYNC_DRILL_20260722.md` |

## Automated tests

| ID | Coverage |
|----|----------|
| SYNC-001 | Duplicate idempotency → `already_applied`, single outbox row |
| SYNC-002 | Same-field patch → open conflict |
| SYNC-003 | Different-field patches → merged, no conflict |
| SYNC-004 | Duplicate patient candidate → conflict queue, no deletion |
| OFF-003 | 72h policy → HTTP 403 on push |

## Owner drill (manual)

1. Start Docker + `npx supabase db reset`
2. Run gateway tests: `npm run test --workspace @klickit/gateway`
3. Run OFF-003 drill: `powershell -File scripts/drill-offline-readonly.ps1`
4. Record output in `docs/remediation/evidence/SYNC_DRILL_20260722.md`

## Not claimed fixed

- Live cloud push/pull against staging Supabase
- OFF-001 multi-workstation LAN drill
- Production sync readiness
- Release state remains **NOT READY**

## Verification commands

```powershell
npm run test --workspace @klickit/test-fixtures
npm run test --workspace @klickit/gateway
npm run test --workspace @klickit/web
```

With Supabase running and migrations applied, sync integration tests should **pass** instead of skip.
