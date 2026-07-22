# Staging smoke test evidence — 2026-07-22

**Environment:** Vercel web + Render API + Supabase `klickit-staging`  
**Data:** Synthetic only  
**Branch:** `remediation/pilot-safety` @ `242fdff`

## Owner verification

| Test | Result | Notes |
|------|--------|-------|
| Password Login (Chrome) | **Pass** | Owner confirmed login working 2026-07-22 |

## Automated API smoke (agent)

Command: PowerShell `Invoke-RestMethod` against `https://klickit-staging-api.onrender.com`

| Endpoint | HTTP | Result |
|----------|------|--------|
| `GET /health` | 200 | `database.connected: true` |
| `POST /auth/login` | 200 | Session for `dev.admin` |
| `GET /dashboard/operational/daily?date=2026-07-22` | 200 | Zero counts; quick actions present |
| `GET /patients/search?limit=5` | 200 | 0 patients |
| `GET /scheduling/masters` | 200 | Empty clinicians list |

## CORS fix (same day)

- Root cause: Render `GATEWAY_CORS_ORIGINS` was literal string `undefined`
- Fix: Set to `https://klickit-web-2c63.vercel.app`; commit `242fdff` adds fallback + `render.yaml` value

## Not run (blocked)

| Test | Blocker |
|------|---------|
| ~~`npm run verify:migrations`~~ | **Done** — pass 2026-07-22 |
| ~~OFF-003 offline drill~~ | **Done** — pass 2026-07-22 (`SYNC_DRILL_20260722.md`) |

## Next

1. Owner manual UI checklist: `docs/deployment/STAGING_SMOKE_CHECKLIST.md`
2. Start Docker Desktop → `npm run verify:migrations`
3. Local gateway → `scripts/drill-offline-readonly.ps1`
