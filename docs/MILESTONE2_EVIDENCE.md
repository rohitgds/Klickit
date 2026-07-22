# Milestone 2 Evidence — Gateway & Sync Foundation

**Milestone endpoint:** Phase 16  
**Status:** Approved 2026-07-22  
**Date:** 2026-07-22

## Delivered phases

| Phase | Outcome |
|---:|---|
| 11 | Local PostgreSQL connection, clinic bootstrap, migration apply script |
| 12 | Tauri scaffold, browser fallback shell, web runtime mode selection |
| 13 | LAN discovery beacon and gateway URL resolution |
| 14 | Sync outbox/inbox push/pull endpoints, idempotency keys, cursors |
| 15 | Conflict queue, duplicate candidate and appointment collision recording |
| 16 | Approved devices, 72-hour read-only enforcement, backup/updater foundations |

## Automated tests

Run from repo root:

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all workspace tests pass, including sync-contracts, gateway, web, desktop and migration baseline checks.

## Manual click-by-click checklist

### A. Local database and clinic config

1. Open Docker Desktop and wait until it is running.
2. In the project folder, run `npx supabase start`.
3. Run `npx supabase db reset`.
4. Run `npm run dev --workspace @klickit/gateway`.
5. Open `http://127.0.0.1:8787/clinic/config`.
6. Confirm `clinic.name` is `Development Clinic` and `offlinePolicy.writeAllowed` is `true`.

### B. LAN discovery

1. Open `http://127.0.0.1:8787/discovery`.
2. Confirm `clinicCode` is `DEV` and `gatewayCode` is `DEV-GW-01`.

### C. Web / desktop mode selection

1. Run `npm run dev --workspace @klickit/web`.
2. Open the Vite dev URL shown in the terminal.
3. Change mode between Auto, Local gateway and Cloud.
4. Confirm the resolved API base and indicator update.

### D. Sync foundation

1. With gateway running, POST to `/sync/push` using a REST client or browser extension with a synthetic event payload.
2. Open `GET /sync/outbox/pending` and confirm the event appears or was accepted.
3. Open `GET /sync/conflicts/open` and confirm the endpoint returns `{ conflicts: [] }` on a clean database.

### E. 72-hour read-only foundation

1. Open `GET /health` and confirm `offlinePolicy` is present.
2. Confirm automated tests include a read-only rejection case after simulated 80-hour offline duration.

### F. Resilience foundations

1. Open `GET /resilience/backup/manifest`.
2. Open `GET /resilience/updater/status`.
3. Optional: run `powershell -ExecutionPolicy Bypass -File .\scripts\backup-gateway-manifest.ps1`.

## Owner approval gate

Continue to Phase 17 only after manual testing and the exact phrase:

`APPROVE MILESTONE`
