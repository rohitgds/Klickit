# KlickIt

Offline-first multi-clinic dental operations platform.

## Product components

1. KlickIt Web — shared React/TypeScript/Vite frontend
2. KlickIt Windows Desktop — Tauri shell (Phase 12)
3. KlickIt Clinic Gateway — local Fastify API and PostgreSQL host
4. Supabase cloud system of record
5. Pabbly Chatflow/Connect communications integration

## Milestone 1 status

This repository contains the setup skeleton only:

- governance docs, blueprints, portability files
- monorepo workspaces for web, gateway, and shared code
- local Supabase config with synthetic bootstrap migration
- baseline CI workflow

## Quick start

```powershell
npm install
npm run verify
npm test
npm run build
```

Optional local database after Docker Desktop is running:

```powershell
npx supabase start
npx supabase db reset
```

See `docs/SUPABASE_LOCAL.md`.

## Development rules

- Read `AGENTS.md` before making changes
- Synthetic data only until controlled migration
- Never commit secrets or patient files
- Stop at milestone endpoints until the owner sends `APPROVE MILESTONE`
