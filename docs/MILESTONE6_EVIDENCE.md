# Milestone 6 Evidence — Plans & Prescriptions

Manual review checklist for Phases 35–39. Use synthetic data only.

## Prerequisites

1. Docker Desktop running.
2. Reset local database: `npx supabase db reset`
3. Gateway running: `npm run dev --workspace @klickit/gateway`
4. Dev session token via `POST /auth/dev/session` with `{ "loginName": "dev.admin" }`
5. Use header `x-session-token` on protected routes.

## Phase 35 — Treatment plan phases and alternatives

- [ ] `POST /plans/care-plans` creates draft plan for a patient
- [ ] `POST /plans/care-plans/:id/stages` adds phase rows
- [ ] `POST /plans/stages/:stageId/services` adds service lines with fees
- [ ] `POST /plans/clinical-cases` creates case + consultation for an encounter
- [ ] `POST /plans/treatment-bundles` creates primary/secondary/tertiary bundle alternatives

## Phase 36 — Estimates, acceptance and signatures

- [ ] `POST /plans/care-plans/:id/propose` moves plan to proposed
- [ ] `GET /plans/care-plans/:id` shows derived totals
- [ ] `POST /plans/care-plans/:id/accept` records staff/OTP/signature acceptance

## Phase 37 — Medicine masters and safety checks

- [ ] `GET /medication/catalog/search?q=dolo` returns seeded medication catalog rows
- [ ] `GET /medication/safety/evaluate?patientId=...&medicationId=...` returns allergy warnings

## Phase 38 — Doctor signing PIN and prescription revisions

- [ ] `PUT /medication/signing-pins` stores clinician PIN hash
- [ ] `POST /medication/orders` creates draft order
- [ ] `POST /medication/orders/:id/save` saves diagnoses, services and lines
- [ ] `POST /medication/orders/:id/sign` signs with clinician PIN and stores hash
- [ ] `POST /medication/orders/:id/revise` creates immutable replacement draft

## Phase 39 — Plan, prescription and consent printing

- [ ] `GET /documents/print-templates?groupCode=document_output&key=care_plan_a4` returns layout JSON
- [ ] `POST /documents/print-snapshots` stores versioned print payload and reprint number

## Automated evidence

```powershell
npm test
npm run typecheck
npm run build
```

## Approval gate

When satisfied, reply exactly:

`APPROVE MILESTONE`
