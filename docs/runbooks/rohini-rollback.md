# Rohini Rollback Runbook

Use when pilot activity must revert to DrKlick historical reference or a prior backup.

## Trigger conditions

- Unresolved data-loss defect
- Daily reconciliation cannot reach INR 0.00 variance
- Severity 1 issue without workaround
- Owner decision to halt pilot activity

## Steps

1. Stop new KlickIt activity at the clinic gateway.
2. Initiate rollback record:
   - `POST /pilot/rollback`
   - body: `{ "releaseId": "<id>", "reason": "Owner-approved rollback" }`
3. Restore latest verified backup using `infrastructure/backup/run-restore-drill.ps1`.
4. Record restore drill through Milestone 9 resilience routes.
5. Keep DrKlick available as read-only historical reference only.
6. Log unresolved issues and owner sign-off in `GET /pilot/issues`.

## Evidence

Capture rollback reason, backup checksum and reconciliation status in `docs/MILESTONE10_EVIDENCE.md`.
