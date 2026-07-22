# BCP-001 backup / restore drill — 2026-07-22

**Drill:** BCP-001 preview (local synthetic)  
**Environment:** Docker Supabase `supabase_db_klickit-local`  
**Branch:** `remediation/pilot-safety`

## Backup run

| Field | Value |
|-------|-------|
| Script | `infrastructure/backup/run-backup.ps1` |
| Format | pg_dump custom (`-Fc`) |
| Schemas | `dentos_data`, `dentos_runtime` |
| File | `artifacts/backups/klickit-DEV-20260722-200638.dump` |
| Size | 810,041 bytes |
| SHA256 | `11dd69148aaa1bc5872d9fa7ed29a674153f33c89fa2d66034ee94d6aa6eb100` |
| Manifest | `klickit-DEV-20260722-200638.dump.manifest.json` |

## Restore drill

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Manifest SHA256 matches file | match | match | Pass |
| Temp DB restore | completes | completed (341 pg_restore warnings on FK ordering) | Pass |
| Permissions count | ≥ 88 | 90 | Pass |
| sync_* tables | ≥ 4 | 6 | Pass |
| Temp DB dropped | yes | yes | Pass |

**Script:** `infrastructure/backup/run-restore-drill.ps1`

## Notes

- pg_restore emitted FK warnings during temp restore; row-count verification passed.
- Dump and manifest files are gitignored (`*.dump`); this evidence file records checksum only.
- Tauri signed desktop build remains deferred (certificate purchase requires owner approval).

## Definition of done progress

- [x] `run-backup.ps1` produces verifiable pg_dump + manifest
- [x] Restore drill passes on synthetic database with evidence log
- [ ] Tauri `tauri build` succeeds (unsigned scaffold only)
- [x] `BACKUP_AND_RESTORE_READINESS.md` updated
- [x] BCP-001 acceptance evidence attached (this file)
