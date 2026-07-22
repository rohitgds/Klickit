# Backup and Desktop Remediation Plan

**Track:** Critical remediation — P1  
**Status:** Plan only  
**Last updated:** 2026-07-22

## Blueprint requirements

| Source | Requirement |
|--------|-------------|
| BP05 §17 | Backup/recovery strategy |
| BP10 §17 | Gateway backup, restore drill, spare gateway |
| BP07 BCP-001, REL-* | Backup verification acceptance |
| DEC-002 | Tauri required for desktop |

## Defective / incomplete areas

| Area | File | Gap |
|------|------|-----|
| Backup script | `infrastructure/backup/run-backup.ps1` | Synthetic SQL stub, not pg_dump |
| Restore drill | `run-restore-drill.ps1` | Checks file exists only |
| Tauri production build | `apps/desktop/` | Scaffold; unsigned |
| Updater | `/resilience/updater/status` | Status only |
| Code signing | Provider inventory | Deferred |

## Target architecture

1. **Backup pipeline:** `pg_dump` (custom format) + manifest JSON (checksum, timestamp, clinic id) → encrypted storage path documented in runbook.
2. **Restore drill:** Restore to temporary database name; verify row counts + checksum; record in `dentos_runtime.backup_runs`.
3. **Desktop:** Signed Tauri build for pilot (requires owner approval for certificate purchase).
4. **Gateway Windows service:** Complete `install-gateway.ps1` beyond preview copy.

## Migrations

Use existing `20260722160000_milestone9_resilience_tables.sql` — verify columns match drill outputs.

## Compatibility

- Backup must restore on clean Windows mini-PC (Rohini target hardware)
- Desktop loads same `apps/web/dist` as browser mode

## Tests

| Test | Method |
|------|--------|
| Backup manifest API | gateway milestone9.test |
| Restore checksum match | Integration script |
| Desktop shell loads | desktop.test.ts + manual |
| Tauri build | CI job (after signing cert) |

## Rollback

- Keep previous backup manifest generations (n-1) before restore drill on production-like data

## Risks

| Risk | Mitigation |
|------|------------|
| R-008 gateway hardware | Laptop drill first |
| R-012 account ownership | Business-owned signing cert |
| OneDrive path locks (R-014) | Document non-synced install path |

## Owner decisions required

- [ ] Approve code signing certificate purchase (paid service — **mandatory stop**)
- [ ] Approve pilot hardware for gateway install test
- [ ] Approve backup storage location (local disk vs cloud bucket)

## Definition of done

- [ ] `run-backup.ps1` produces verifiable pg_dump + manifest
- [ ] Restore drill passes on synthetic database with evidence log
- [ ] Tauri `tauri build` succeeds in CI or documented manual checklist
- [ ] `39_BACKUP_AND_RESTORE_READINESS.md` updated
- [ ] BCP-001 acceptance evidence attached
