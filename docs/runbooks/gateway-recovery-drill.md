# Gateway Recovery Drill Runbook

## Prerequisites

- Docker Desktop running for local Supabase
- Gateway dev session available
- No production data

## Backup drill

1. Run `infrastructure/backup/run-backup.ps1`
2. Record backup via gateway:
   - `POST /resilience/backup/run`
   - body: `{ "artifactPath": "./artifacts/gateway-backup.sql" }`
3. Confirm `GET /resilience/backup/runs`

## Restore drill

1. Run `infrastructure/backup/run-restore-drill.ps1`
2. Record result:
   - `POST /resilience/restore/drill`
   - body: `{ "backupRunId": "<id>", "restoredChecksum": "<checksum>" }`
3. Confirm `GET /resilience/recovery/status`

## Spare gateway drill

Follow `docs/runbooks/spare-gateway-activation.md` using synthetic data only.
