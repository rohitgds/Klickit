# Local Supabase

Provider-neutral PostgreSQL development through the Supabase CLI and Docker.

## Prerequisites

1. Docker Desktop running
2. Node dependencies installed at repo root

## First-time setup

From the project root:

```powershell
npx supabase --version
npx supabase start
npx supabase db reset
```

Expected local services:

| Service | URL / port |
|---|---|
| API | http://127.0.0.1:54321 |
| Database | localhost:54322 |
| Studio | http://127.0.0.1:54323 |

## Notes

- Milestone 1 includes only a tiny bootstrap migration and synthetic seed.
- Blueprint 01 executable schema conversion begins in Phase 9.
- Never put real patient data in local development.
- Hosted Supabase staging is deferred until after local baseline is stable.

## Stop local stack

```powershell
npx supabase stop
```
