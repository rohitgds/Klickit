# Migration Baseline

Phase 9 establishes a portable PostgreSQL migration baseline derived from Blueprint 01 and Blueprint 10 sync requirements.

## Principles

- Migrations live in `supabase/migrations/` and are version-controlled.
- Blueprint 01 remains read-only; SQL is compiled through `scripts/compile-migrations-from-blueprint.mjs`.
- Generated migrations are committed so a clean clone can rebuild without Cursor chat memory.
- Re-run the compiler after any accepted Blueprint 01 amendment that changes executable SQL.

## Current migration order

| File | Purpose |
|---|---|
| `20260721100000_extensions_schemas_enums.sql` | Extensions, schemas, enums |
| `20260721101000_runtime_audit_functions.sql` | Audit and row-version functions |
| `20260721102000_identity_access_tables.sql` | Phase 1 identity/access tables |
| `20260721103000_runtime_infrastructure_tables.sql` | Audit, outbox, jobs, idempotency |
| `20260721104000_identity_runtime_foreign_keys.sql` | Foreign keys for baseline tables |
| `20260721105000_identity_audit_triggers.sql` | Audit triggers for identity tables |
| `20260721106000_permission_catalog_seed.sql` | Permission catalog seed |
| `20260721107000_sync_foundation.sql` | Sync/devices/conflicts foundation from Blueprint 10 |

## Local commands

```powershell
npm run compile:migrations
npx supabase db reset
npm run verify:migrations
```

## Synthetic seed

`supabase/seed.sql` creates a development organization, clinic, admin role, and simulated gateway only. No real patient data.

## Not yet migrated

Remaining Blueprint 01 tables (patients, scheduler, finance, clinical, etc.) arrive in later phases through additional compiled migration batches.

## Provider portability

Database target is PostgreSQL 16+ through Supabase locally first. The same migration files must apply to another PostgreSQL provider using standard restore/migration tooling documented in `docs/PROVIDER_EXIT_PLAN.md`.
