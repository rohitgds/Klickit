# Sync Remediation Plan

**Track:** Critical remediation — P1  
**Status:** Plan only  
**Last updated:** 2026-07-22

## Blueprint requirements

| Source | Requirement |
|--------|-------------|
| BP10 §8 | Outbox/inbox, idempotency, cursors — not last-write-wins |
| BP07 OFF-001..003, SYNC-001..004 | Acceptance tests |
| BP10 §8.4 | Same-field conflicts → manual queue; different-field merge |
| BP10 §7 | Duplicate patients never auto-deleted |
| Audit `34–37` | Engine coded; live drills not executed |

## Defective / unverified areas

| Area | File | Gap |
|------|------|-----|
| Live cloud push/pull | `apps/gateway/src/sync/engine.ts` | No production cloud endpoint tested |
| SYNC-001 idempotent replay | — | No automated two-clinic test |
| OFF-001 multi-workstation | — | Manual drill not recorded |
| 72h read-only | `evaluateOfflineWritePolicy` | Unit test only |
| Conflict UI | `SystemConfigurationPage` | Minimal resolve buttons |
| Dead-letter visibility | sync engine | Partial |

## Target architecture

1. **Staging cloud sync target** (owner-approved Supabase project only — not production Rohini).
2. **Synthetic two-clinic fixture** in `@klickit/test-fixtures` for push/pull replay tests.
3. **Drill runbook** with evidence template in `docs/remediation/evidence/SYNC_DRILL_YYYYMMDD.md`.
4. **Sync status dashboard** — extend shell sync indicator with pending/failed counts from `/sync/outbox/pending`.

## Migrations

Review existing `20260721107000_sync_foundation.sql` — likely sufficient. Add if missing:

- `sync_dead_letters` table for failed events (if not present)
- Indexes for conflict queue by clinic + status

## Compatibility

- Existing `sync-contracts` unit tests remain canonical for merge rules
- Gateway `/sync/*` routes unchanged where possible

## Tests

| ID | Test |
|----|------|
| SYNC-001 | Push same idempotency key twice → second accepted as duplicate |
| SYNC-002 | Same-field conflict → open conflict row |
| SYNC-003 | Different-field merge → auto-merged |
| SYNC-004 | Offline duplicate patients → both preserved, conflict queue |
| OFF-003 | Simulated 72h → read-only write rejection |

Implementation: `apps/gateway/test/sync-integration.test.ts` + optional manual drill script `scripts/drill-offline-readonly.ps1`.

## Rollback

- Disable cloud sync URL via env (`CLOUD_SYNC_URL=`) to force local-only
- No destructive migration rollback without owner approval

## Risks

| Risk | Mitigation |
|------|------------|
| R-002 sync data loss | Never enable auto LWW; keep conflict queue |
| Cloud credentials in CI | Use GitHub secrets + staging only after approval |

## Owner decisions required

- [ ] Approve staging Supabase project for sync drills (not production)
- [ ] Approve scheduled maintenance window for 72h offline simulation

## Definition of done

- [ ] SYNC-001..004 automated tests passing against local PG + mock cloud handler
- [ ] OFF-001..003 drill evidence document with timestamps and screenshots
- [ ] Conflict resolution UI shows entity, field, local vs cloud values
- [ ] `34_SYNC_ENGINE_READINESS.md` updated to IMPLEMENTED AND TESTED for passed items
- [ ] No claim of production sync readiness until staging drill complete
