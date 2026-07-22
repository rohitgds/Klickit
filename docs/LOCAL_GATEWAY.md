# Local Gateway Guide

KlickIt uses a clinic-local PostgreSQL database on the gateway mini-PC. Development simulates this with the local Supabase stack.

## Development flow

1. Start Docker Desktop.
2. Run `npx supabase start`.
3. Run `npx supabase db reset` to apply migrations and synthetic seed.
4. Start the gateway: `npm run dev --workspace @klickit/gateway`.
5. Open `http://127.0.0.1:8787/clinic/config`.

## Clinic identity

The gateway loads clinic identity from PostgreSQL using:

- `KLICKIT_CLINIC_CODE` (default `DEV`)
- `KLICKIT_GATEWAY_CODE` (default `DEV-GW-01`)

Synthetic seed data creates the matching organization, clinic and gateway rows.

## Portable migration apply

For a non-Supabase local PostgreSQL instance:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-local-migrations.ps1
```

This applies the same ordered SQL files from `supabase/migrations/` and records them in `public.klickit_schema_migrations`.

## LAN discovery

When `GATEWAY_LAN_DISCOVERY=true`, the gateway exposes `GET /discovery` with clinic and gateway metadata for authorized LAN clients.

Bind to the clinic LAN with `GATEWAY_HOST=0.0.0.0` only after network review in pilot phases.
