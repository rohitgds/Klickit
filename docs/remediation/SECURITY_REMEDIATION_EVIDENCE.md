# Security Remediation 1 — Evidence

**Date:** 2026-07-22  
**Branch:** `remediation/pilot-safety`  
**Status:** Part D delivered (local verification)

## Changes delivered

| Requirement | Evidence |
|-------------|----------|
| Argon2id + per-password salt | `packages/identity/src/index.ts` — `@node-rs/argon2` PHC format |
| Legacy scrypt verifier | `PASSWORD_ALGORITHM_LEGACY_SCRYPT` for migration path |
| Synthetic credential migration | `scripts/migrate-synthetic-credentials.mjs` (APP_ENV=local only) |
| Session validation | `apps/gateway/src/security/middleware.ts` — active user, membership, authz_version match, expiry, revocation |
| Session invalidation triggers | `supabase/migrations/20260723120000_security_credential_and_offline_auth.sql` |
| Multi-user offline device | Offline snapshot PK `(clinic_id, device_fingerprint_hash, user_id)` |
| No hash/token leakage | `sanitizeSessionForResponse`, route wrappers in `milestone3.ts` |
| PostgreSQL integration tests | `apps/gateway/test/security-auth-integration.test.ts` |

## Seed credentials (synthetic)

| User | Password | Algorithm |
|------|----------|-----------|
| `dev.admin` | `DevPass123!` | argon2id |
| `dev.reception` | `DevPass123!` | argon2id |

## Test execution

Run with local Supabase:

```powershell
npx supabase start
npx supabase db reset
npm run test --workspace @klickit/gateway
```

Integration tests connect to `postgresql://postgres:postgres@127.0.0.1:54322/postgres` by default. Set `KLICKIT_SKIP_PG_TESTS=1` to skip when Docker is unavailable.

## Not in scope (owner decisions still open)

- Cloud RLS architecture
- Supabase browser JWT auth
- Production credential changes
- Penetration test

## Remaining release blockers

Security Remediation 1 closes P0 password/session defects. Release state remains **NOT READY** until finance, sync drills, backup/desktop, and live migration verify pass.
