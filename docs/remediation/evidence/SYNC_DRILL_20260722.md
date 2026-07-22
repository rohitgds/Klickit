# OFF-003 offline read-only drill — 2026-07-22

**Drill code:** OFF-003  
**Environment:** Local gateway + Docker Supabase (synthetic data only)  
**Gateway:** http://127.0.0.1:8787  
**Branch:** `remediation/pilot-safety`

## Preconditions

- Docker Desktop running
- `npx supabase db reset` succeeded via `npm run verify:migrations`
- Local gateway: `npm run dev` in `apps/gateway` (`APP_ENV=local`)

## Results

| Step | Expected | Actual | Result |
|------|----------|--------|--------|
| 1. `POST /sync/offline/enter-read-only` | `readOnly: true` | `readOnly: True` | Pass |
| 2. `POST /sync/push` while read-only | HTTP 403 | HTTP 403 | Pass |
| 3. `GET /sync/status` | `readOnly: true` | `readOnly: True`, `pendingOutbox: 1` | Pass |

**Script:** `scripts/drill-offline-readonly.ps1`

## Fixes applied same session

1. Drill script: send `{}` body for enter-read-only; replace em-dash characters breaking PowerShell parse
2. Gateway: refresh in-memory `bootstrap.gateway.readOnlyAt` after enter-read-only so push enforcement matches DB

## Related verification (same session)

| Check | Result |
|-------|--------|
| `npm run verify:migrations` | Pass (90 permissions, 6 sync tables) |
| Staging Chrome login | Pass (owner confirmed) |
| Staging API smoke | Pass — see `STAGING_SMOKE_20260722.md` |

## Notes

- `.env.local` had a UTF-8 BOM that blocked `supabase db reset`; BOM stripped (file not committed)
- Agent shell needed Docker added to PATH: `C:\Program Files\Docker\Docker\resources\bin`
