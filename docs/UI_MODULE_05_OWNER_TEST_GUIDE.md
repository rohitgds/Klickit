# UI Module 5 — Owner Test Guide (Clinical Queue)

Use synthetic demo data only. Orange **DEMO DATA** banner must remain visible.

## Before you start

Same setup as prior modules:

1. Docker Desktop running
2. `npx supabase start` and `npx supabase db reset`
3. `npm.cmd run dev --workspace @klickit/gateway`
4. `npm.cmd run dev --workspace @klickit/web`
5. Open **http://localhost:5173** and sign in with demo account

**Recommended prep:** register a patient (Patient Registry) and optionally create a booking for **today** in Scheduler.

---

## Test 1 — Queue board

- [ ] Click **Clinical Queue** in top navigation
- [ ] Page title reads **Clinical Queue**
- [ ] Operational date defaults to today
- [ ] **Active queue** section loads (may be empty)
- [ ] **Arrivals expected** section lists today’s scheduled/confirmed bookings (if any)

---

## Test 2 — Walk-in admit

- [ ] Click **Add Unscheduled Encounter**
- [ ] Search and select a registered patient
- [ ] Choose clinician and reason; optional chair
- [ ] Click **Admit to queue**
- [ ] New row appears in Active queue with status **checked in**

---

## Test 3 — Booking check-in

- [ ] Create a booking in Scheduler for **today** with a registered patient
- [ ] Return to Clinical Queue (same operational date)
- [ ] Booking appears under **Arrivals expected**
- [ ] Click **Check in**
- [ ] Encounter appears in Active queue; booking moves out of arrivals list on refresh

---

## Test 4 — Chair flow actions

- [ ] On a **checked in** encounter, click **Begin care** → status becomes **engaged**
- [ ] Click **Release** → status returns toward waiting/checked in per clinic rules
- [ ] Click **Checkout** on an engaged or checked-in encounter → status **checked out**

---

## What is intentionally not in Module 5

- Full care stream / priority filters from Blueprint 06
- Reopen encounter and override permissions UI
- Live websocket refresh (manual refresh only)
- Clinical encounter workspace (Module 6)

---

## When you are satisfied with Module 5

Reply exactly:

**APPROVE UI MODULE**

That allows work to start on **UI Module 6 — Clinical Records**.

Report issues with **UI-QUE-001**, **UI-QUE-002**, or **UI-QUE-003**.
