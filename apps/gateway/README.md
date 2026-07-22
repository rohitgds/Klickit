# KlickIt Clinic Gateway

Local Fastify API host for offline-first clinic operation.

## Capabilities through Phase 16

- Local PostgreSQL connection and clinic bootstrap
- Clinic configuration endpoint
- LAN discovery beacon
- Sync push/pull outbox/inbox foundation
- Conflict, duplicate and appointment-collision queues
- Approved device registry
- 72-hour offline read-only enforcement
- Backup manifest and updater status foundations

## Run locally

```powershell
npx supabase start
npx supabase db reset
npm run dev --workspace @klickit/gateway
```

Check:

- [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health)
- [http://127.0.0.1:8787/clinic/config](http://127.0.0.1:8787/clinic/config)
- [http://127.0.0.1:8787/discovery](http://127.0.0.1:8787/discovery)

## Apply migrations to a clinic-local database

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-local-migrations.ps1
```

## Configuration names (no secrets)

Set in untracked `.env.local` if needed:

- `GATEWAY_HOST`
- `GATEWAY_PORT`
- `GATEWAY_LOG_LEVEL`
- `GATEWAY_LAN_DISCOVERY`
- `GATEWAY_DATABASE_URL`
- `KLICKIT_CLINIC_CODE`
- `KLICKIT_GATEWAY_CODE`
- `KLICKIT_SOFTWARE_VERSION`
- `KLICKIT_CLOUD_SYNC_URL`

## Windows service (later phase)

Production clinic gateway Windows service installation requires administrator approval and arrives in Rohini readiness phases.
