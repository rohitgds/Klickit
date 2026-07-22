# Remediation staging milestone — owner sign-off 2026-07-22

**Approval phrase:** `APPROVE MILESTONE` (owner, 2026-07-22)  
**Decision:** DEC-048  
**Branch:** `remediation/pilot-safety`  
**Release state:** NOT READY (unchanged — synthetic staging only)

## What was approved

| Area | Evidence |
|------|----------|
| Online staging stack | `STAGING_DEPLOY_SIGNOFF_20260722.md`, `STAGING_SMOKE_20260722.md` |
| Staging login (Chrome) | Owner verified Password Login |
| Staging API health | Owner verified `/health` — `readOnly: false`, database connected |
| UI Modules 6–14 review | `UI_MODULES_TEST_20260722.md` |
| Sync OFF-003 drill | `SYNC_DRILL_20260722.md` |
| Backup BCP-001 drill | `BACKUP_DRILL_20260722.md` |
| Migration verify | `npm run verify:migrations` pass |
| Read-only recovery fix | Gateway `cloud-sync/success` in-memory refresh |

## Explicitly not approved

- Production deployment
- Real patient data
- Live WhatsApp
- Tauri code signing (deferred DEC-046)
- Vercel Pro upgrade (deferred DEC-043)

## Known open items (do not block this milestone)

- Odontogram finding FK bug (`recorded_by` staff vs user ID) — KI-004
- Full care-plan propose/accept walk-through on staging UI (Chrome)
- Backup storage location and pilot hardware decisions

## Next safe step

1. Fix KI-004 odontogram finding bug
2. Optional unsigned Tauri build checklist
3. Owner decisions: backup storage, pilot hardware
4. Production remains blocked until release gate cleared
