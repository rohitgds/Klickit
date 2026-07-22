# Milestone 3 Evidence — Access & Patients

**Milestone endpoint:** Phase 23  
**Status:** Ready for manual review  
**Date:** 2026-07-22

## Delivered phases

| Phase | Outcome |
|---:|---|
| 17 | Organization/clinic/staff/user APIs and expanded synthetic seed |
| 18 | Effective permission evaluation, route guards, authorization denial audit |
| 19 | Online login, logout, offline verifier cache, local dev session bootstrap |
| 20 | Patient registry migrations, search and registration APIs |
| 21 | Patient profile, allergies, medical responses and consent tables/APIs |
| 22 | Patient numbering, duplicate review queue, cross-clinic safety summary |
| 23 | Synthetic DrKlick demographic staging batch validation (no live DrKlick) |

## Automated tests

```powershell
npm test
npm run typecheck
npm run build
```

## Manual click-by-click checklist

### A. Database

1. Start Docker Desktop.
2. Run `npx supabase start`.
3. Run `npx supabase db reset`.
4. Confirm no migration errors.

### B. Local dev session

1. Run `npm run dev --workspace @klickit/gateway`.
2. POST to `http://127.0.0.1:8787/auth/dev/session` with body `{ "loginName": "dev.admin" }`.
3. Copy the returned `token`.
4. Use header `x-session-token: <token>` on later requests.

### C. Workforce

1. GET `http://127.0.0.1:8787/identity/staff` with session header.
2. POST `/identity/staff` with `{ "displayName": "Test Reception", "staffType": "reception" }`.
3. GET `/identity/users` and confirm `dev.admin` appears.

### D. Patient registry

1. GET `/patients/search?q=` with session header.
2. POST `/patients/register` with synthetic patient details.
3. GET `/patients/<id>/profile` for the returned patient id.
4. GET `/patients/<id>/safety-summary`.

### E. Migration staging dry run

1. POST `/migration/drklick/batches`.
2. POST `/migration/drklick/batches/<batchId>/stage` with a few synthetic rows.
3. Confirm valid/invalid counts in the response.

### F. Web shell

1. Run `npm run dev --workspace @klickit/web`.
2. Confirm workforce and patient registry sections render.

## Owner approval gate

Continue to Phase 24 only after manual testing and the exact phrase:

`APPROVE MILESTONE`
