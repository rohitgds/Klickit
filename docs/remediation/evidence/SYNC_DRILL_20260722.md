# Sync drill evidence template

**Date:** 2026-07-22  
**Environment:** Synthetic local gateway only — **not production**  
**Operator:** ____________________

## Scenarios

| ID | Scenario | Result | Timestamp (IST) | Notes |
|----|----------|--------|-----------------|-------|
| OFF-001 | Multi-workstation offline writes | Pending | | Requires two LAN workstations |
| OFF-002 | Reconnect after offline period | Pending | | |
| OFF-003 | 72h read-only write rejection | | | Run `scripts/drill-offline-readonly.ps1` |
| SYNC-001 | Idempotent push replay | Automated | | `sync-integration.test.ts` |
| SYNC-002 | Same-field conflict queue | Automated | | |
| SYNC-003 | Different-field auto-merge | Automated | | |
| SYNC-004 | Duplicate patients preserved | Automated | | |

## OFF-003 drill steps (click-by-click)

1. Start Docker Desktop.
2. Open PowerShell in the KlickIt project folder.
3. Run `npx supabase start` then `npx supabase db reset` if gateway uses local PG.
4. Start gateway: `npm run dev --workspace @klickit/gateway`
5. Run drill: `powershell -File scripts/drill-offline-readonly.ps1`
6. Confirm output shows **403** on push and `readOnly: true` in status.
7. Paste command output below.

## Command output

```
(paste drill script output here)
```

## UI verification

- [ ] Shell sync badge shows pending/failed/conflict counts when non-zero
- [ ] System Configuration → Sync Conflicts shows local vs cloud values
- [ ] Resolve buttons mark conflict resolved

## Staging cloud drill (blocked)

Staging Supabase sync target **not approved** — do not use production credentials.

## Screenshots

Attach to local evidence folder (not Git): `audit-export/sync-drills/`
