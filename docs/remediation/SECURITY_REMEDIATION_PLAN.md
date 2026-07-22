# Security Remediation Plan

**Track:** Critical remediation — P0  
**Status:** Plan only (Part D not started)  
**Last updated:** 2026-07-22

## Blueprint requirements

| Source | Requirement |
|--------|-------------|
| BP02 §11 IAM | Argon2id `user_credentials`; passwords never returned |
| BP05 §8 | Authorization middleware: session + permission on every route |
| BP07 IAM-001..008, SEC-001..003 | Server-side permissions, denial audit, no client-only auth |
| BP10 §9 | Offline login on approved device; cached permission snapshot within 72h |
| BP10 §9.2 | Multiple staff may use same clinic device offline |
| Audit `38_SECURITY_READINESS.md` | Fixed-salt scrypt is defective |

## Defective files (current)

| File | Defect |
|------|--------|
| `packages/identity/src/index.ts` | `hashPassword` / `verifyPassword` use fixed salt `"klickit-dev-salt"` |
| `packages/identity/src/index.ts` | `hashSessionToken` uses fixed salt `"klickit-session-salt"` |
| `apps/gateway/src/security/middleware.ts` | Session query does not verify `users.status`, membership `authz_version` match, or user.active on session row |
| `apps/gateway/src/auth/service.ts` | `cacheOfflineSnapshot` ON CONFLICT updates by `device_fingerprint_hash` only — **one user per device** |
| `apps/gateway/src/auth/service.ts` | No session revocation on role/permission/membership/user changes |
| `supabase/seed.sql` | Dev credentials may use legacy hash format |

## Target architecture

1. **Password storage:** Argon2id (via `@node-rs/argon2` or `argon2` package) with random 16+ byte salt per credential; store `password_hash` as structured string (`$argon2id$...`) or separate `password_salt` column.
2. **Session validation (every request):** Join `user_sessions` → `users` → `clinic_memberships`; require:
   - `users.status = 'active'`
   - `memberships.active = true`
   - `sessions.authz_version = users.authz_version`
   - `sessions.revoked_at IS NULL`
   - `sessions.expires_at > now()`
3. **Authz invalidation:** On change to roles, overrides, membership, or `users.authz_version` increment → revoke all sessions for that user (or bump invalidation marker).
4. **Offline snapshots:** Key `(clinic_id, device_fingerprint_hash, user_id)` or separate rows per user; allow two+ users on one approved device.
5. **Never expose:** No password hashes, session tokens, or PIN hashes in API responses or logs.

## Migrations (synthetic-only path)

| Migration | Purpose |
|-----------|---------|
| `20260723XXXX00_credential_hash_upgrade.sql` | Add `password_salt` nullable; add `password_algorithm` default `legacy-scrypt-v1` |
| `20260723XXXX01_offline_snapshot_per_user.sql` | Change PK/unique on `offline_auth_snapshots` to include `user_id` |
| `20260723XXXX02_session_invalidation_support.sql` | Optional `authz_invalidation_seq` on users if not using authz_version only |

**Synthetic credential migration script:** `scripts/migrate-synthetic-credentials.mjs` — re-hash seed/demo users only when `APP_ENV=local`; never run on production without owner approval.

## Compatibility

- Verify legacy scrypt hashes during transition (`password_algorithm = 'legacy-scrypt-v1'`) then re-hash on successful login.
- Session tokens in flight: invalidated after authz_version bump (expected logout).

## Tests (real PostgreSQL — Part D)

New file: `apps/gateway/test/security-auth-integration.test.ts` (requires `DATABASE_URL` or local Supabase):

| Test case | Expected |
|-----------|----------|
| Login success | 200, session token, permissions loaded |
| Disabled user | 401 after status set inactive |
| Revoked session | 401 after logout/revoke |
| Changed authz_version | 401 on existing token |
| Inactive membership | 401 |
| Deny overrides allow | 403 on denied permission |
| Two offline users same device | Both snapshots valid independently |
| Expired offline snapshot | Reject offline verify |
| Unapproved device | Login rejected when fingerprint required |

## Rollback

1. Revert migration only if no production credentials upgraded (local dev).
2. Keep `legacy-scrypt-v1` verifier path until all synthetic users re-hashed.
3. Feature flag `AUTH_ARGON2_ENABLED` default false until tests pass — remove after validation.

## Risks

| Risk | Mitigation |
|------|------------|
| Lock out dev demo login | Synthetic migration + update seed in same PR |
| Session mass logout on deploy | Communicate; single-clinic pilot acceptable |
| Argon2 native module on Windows | Use `@node-rs/argon2` with CI matrix test |

## Owner decisions required (mandatory stops)

- [ ] Approve Argon2 library choice (Node native vs WASM)
- [ ] **Server-only API vs Supabase Auth in browser** — plan assumes gateway-only session tokens (no Supabase browser JWT for clinic app)
- [ ] **Cloud RLS architecture** — defer; local gateway authZ first
- [ ] Approve synthetic credential re-hash on local `db reset`
- [ ] Do **not** change production credentials without separate approval

## Definition of done (Security Remediation 1)

- [ ] Argon2id + per-password salt in `@klickit/identity`
- [ ] Legacy verifier + synthetic migration path documented and tested
- [ ] Session middleware validates user, membership, authz_version, expiry, revocation
- [ ] Sessions invalidated on permission/membership/user changes
- [ ] Multiple offline users per approved device
- [ ] ≥10 PostgreSQL integration tests passing against local Supabase
- [ ] No hash/token leakage in responses (grep + test assertion)
- [ ] `docs/remediation/SECURITY_REMEDIATION_EVIDENCE.md` updated (after implementation)
- [ ] Audit report `38_SECURITY_READINESS.md` status upgraded with evidence

**Not in scope for Remediation 1:** Cloud RLS, production Supabase Auth cutover, penetration test.
