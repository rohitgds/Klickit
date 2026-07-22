# Milestone 4 Evidence — Scheduler & Queue

Manual review checklist for Phases 24–29. Use synthetic data only.

## Prerequisites

1. Docker Desktop running.
2. Local Supabase started: `npx supabase start`
3. Gateway running: `npm run dev --workspace @klickit/gateway`
4. Obtain dev session token:
   ```http
   POST http://127.0.0.1:8787/auth/dev/session
   Content-Type: application/json

   { "loginName": "dev.admin" }
   ```
5. Use response `token` as header `x-session-token` on protected routes.

## Phase 24 — Scheduling masters

- [ ] `GET /scheduling/masters` returns chair, booking reason and working-hour seed data
- [ ] `POST /scheduling/chairs` creates a chair (requires `scheduler.edit`)
- [ ] `POST /scheduling/blackouts` creates an active blackout interval

## Phase 25 — Scheduler views

- [ ] `GET /scheduling/views/day?date=2026-07-22` returns day range metadata and bookings array
- [ ] `GET /scheduling/keyboard-shortcuts` returns dense keyboard action map

## Phase 26 — Booking state machine

- [ ] `POST /scheduling/bookings` creates a booking in `scheduled` status
- [ ] `POST /scheduling/bookings/:id/confirm` moves to `confirmed`
- [ ] `POST /scheduling/bookings/:id/reschedule` updates interval without duplicate booking
- [ ] `GET /scheduling/bookings/:id/history` shows state events including creation
- [ ] `POST /scheduling/bookings/:id/cancel` stores cancellation reason

Sample create body (adjust IDs from `/scheduling/masters`):

```json
{
  "patientKind": "established",
  "startsAt": "2026-07-22T09:00:00.000Z",
  "endsAt": "2026-07-22T09:30:00.000Z",
  "leadClinicianId": "88888891-8888-4891-8891-888888888891",
  "chairId": "88888892-8888-4892-8892-888888888892",
  "reasonId": "88888893-8888-4893-8893-888888888893"
}
```

## Phase 27 — Clinical Queue

- [ ] `GET /clinical-queue?date=2026-07-22` lists encounters and arrival candidates
- [ ] `POST /clinical-queue/bookings/:id/check-in` creates linked encounter and sets booking `arrived`
- [ ] `POST /clinical-queue/encounters/:id/engage` then `/release` or `/checkout` transitions queue state

## Phase 28 — Live refresh and reconciliation

- [ ] After booking or queue change, `GET /scheduling/live/events` returns recent events
- [ ] `POST /scheduling/reconciliation/check-collisions` runs without error (zero warnings is acceptable in dev seed)

## Phase 29 — Operational Dashboard

- [ ] `GET /dashboard/operational/daily?date=2026-07-22` returns counts and quick actions
- [ ] Dashboard does not expose blocked future finance or messaging actions beyond placeholders

## Automated evidence

Run from repository root:

```powershell
npm test
npm run typecheck
npm run build
```

## Approval gate

When satisfied, reply exactly:

`APPROVE MILESTONE`
