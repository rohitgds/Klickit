# Backup and Restore Readiness

**Release state:** NOT READY for production — local synthetic drills only  
**Last updated:** 2026-07-22

## What works today

| Capability | Status | Script / API |
|------------|--------|--------------|
| Local pg_dump backup | **Implemented** | `infrastructure/backup/run-backup.ps1` |
| Restore drill (temp DB) | **Implemented** | `infrastructure/backup/run-restore-drill.ps1` |
| Backup manifest API | **Implemented** | `GET /resilience/backup/manifest` |
| Record backup run | **Implemented** | `POST /resilience/backup/run` (auth required) |
| Encrypted off-site storage | **Not yet** | Owner decision pending |
| Code-signed Tauri desktop | **Deferred** | When SaaS/subscription sales begin — owner decision 2026-07-22 |

## Local backup (click-by-click)

1. Start **Docker Desktop** and ensure Supabase is up (`npx supabase start` or after `npm run verify:migrations`)
2. Open PowerShell in the project folder
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\infrastructure\backup\run-backup.ps1
```

4. Outputs under `artifacts/backups/`:
   - `klickit-DEV-<timestamp>.dump` — pg_dump custom format (gitignored)
   - `klickit-DEV-<timestamp>.dump.manifest.json` — checksum + metadata

## Restore drill (click-by-click)

```powershell
powershell -ExecutionPolicy Bypass -File .\infrastructure\backup\run-restore-drill.ps1 `
  -ManifestPath ".\artifacts\backups\<your-file>.dump.manifest.json"
```

Verifies SHA256, restores to temporary database `klickit_restore_drill`, checks permission/sync table counts, then drops temp DB.

## BCP-001 evidence

- 2026-07-22 drill: `docs/remediation/evidence/BACKUP_DRILL_20260722.md`

## Not ready for production until

- [ ] Owner approves backup storage location (local disk vs cloud bucket)
- [ ] Off-site encrypted copy workflow documented and tested
- [ ] Rohini gateway hardware install drill
- [ ] Code signing certificate when SaaS/subscription sales begin (owner deferred 2026-07-22)

## Related

- `docs/remediation/BACKUP_DESKTOP_REMEDIATION_PLAN.md`
- `docs/runbooks/spare-gateway-activation.md`
- `docs/runbooks/rohini-rollback.md`
