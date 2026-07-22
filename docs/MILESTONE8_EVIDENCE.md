# Milestone 8 Evidence — Communications & Printing

Manual review checklist for Phases 47–50. Use synthetic data only. Do not connect live WhatsApp during development.

## Prerequisites

1. Docker Desktop running.
2. Reset local database: `npx supabase db reset`
3. Gateway running: `npm run dev --workspace @klickit/gateway`
4. Dev session token via `POST /auth/dev/session` with `{ "loginName": "dev.admin" }`
5. Use header `x-session-token` on protected routes.

## Phase 47 — Recall and follow-up rules

- [ ] `GET /continuity/policies` returns seeded six-month recall policy
- [ ] `POST /continuity/tasks` creates scheduled task with due date
- [ ] `GET /continuity/tasks/due` lists due and snoozed tasks
- [ ] `POST /continuity/tasks/:id/snooze` snoozes a task
- [ ] `POST /continuity/tasks/:id/complete` completes a task
- [ ] `POST /continuity/recalls` creates recall record

## Phase 48 — Provider-neutral messaging adapter

- [ ] `GET /messaging/templates` returns approved WhatsApp templates
- [ ] `PUT /messaging/preferences` stores patient channel consent
- [ ] `POST /messaging/outbound` queues message through Pabbly stub adapter (development mode)
- [ ] `POST /messaging/provider/webhook` deduplicates provider status events

## Phase 49 — Ten WhatsApp automations and retention

- [ ] `GET /messaging/automations` lists all ten automation route types
- [ ] `POST /messaging/templates/:id/approve` approves draft template
- [ ] `GET /messaging/patients/:patientId/messages` returns queued message history
- [ ] Marketing messages reject unknown consent

## Phase 50 — Thermal, labels, appointment and corporate printing

- [ ] `GET /documents/print-catalog` lists extended print templates
- [ ] `GET /documents/print-templates/extended?groupCode=document_output&key=thermal_receipt` returns layout JSON
- [ ] `POST /documents/print-snapshots/extended` stores fee statement or thermal receipt snapshot

## Automated evidence

```powershell
npm test
npm run typecheck
npm run build
npx supabase db reset
```

## Approval gate

When satisfied, reply exactly:

`APPROVE MILESTONE`
