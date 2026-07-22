# Milestone 5 Evidence — Clinical & Files

Manual review checklist for Phases 30–34. Use synthetic data only.

## Prerequisites

1. Docker Desktop running.
2. Reset local database: `npx supabase db reset`
3. Gateway running: `npm run dev --workspace @klickit/gateway`
4. Dev session token via `POST /auth/dev/session` with `{ "loginName": "dev.admin" }`
5. Use header `x-session-token` on protected routes.

## Phase 30 — Encounter workspace

- [ ] Create or check in an encounter from Milestone 4 queue flow
- [ ] `GET /clinical/encounters/:id/workspace` returns safety allergies and counts

## Phase 31 — FDI tooth-wise records

- [ ] `POST /clinical/encounters/:id/findings` with tooth `36` and surfaces `["O","M"]`
- [ ] `POST /clinical/encounters/:id/diagnoses` using diagnosis seed `CARIES`
- [ ] `POST /clinical/encounters/:id/recommendations` using service seed `FILL-001`
- [ ] `POST /clinical/encounters/:id/deliveries` then `/clinical/deliveries/:id/start` and `/complete`

## Phase 32 — Signed notes and amendments

- [ ] `POST /clinical/encounters/:id/notes` creates draft note
- [ ] `POST /clinical/notes/:id/sign` locks note
- [ ] `POST /clinical/notes/:id/amend` with reason stores amendment history
- [ ] `GET /clinical/notes/:id/amendments` lists prior bodies

## Phase 33 — Files and sync metadata

- [ ] `POST /clinical/files/register` stores file hash and returns `pdfWarning` for PDF mime type
- [ ] `GET /clinical/files/:id/sync-status` returns completed upload job
- [ ] `POST /clinical/files/:id/verify-hash` confirms hash match

## Phase 34 — Clinical permissions

- [ ] User without `clinical.view` receives 403 on workspace route
- [ ] `GET /clinical/access/effective?patientId=...` denies cross-clinic edit mode

Sample finding body:

```json
{
  "patientId": "PATIENT_UUID",
  "toothCode": "36",
  "surfaceCodes": ["O", "M"],
  "findingCode": "CARIES"
}
```

## Automated evidence

```powershell
npm test
npm run typecheck
npm run build
```

## Approval gate

When satisfied, reply exactly:

`APPROVE MILESTONE`
