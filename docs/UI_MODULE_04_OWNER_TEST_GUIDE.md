# UI Module 4 — Owner Test Guide (Scheduler)

Use synthetic demo data only. Orange **DEMO DATA** banner must remain visible.

## Before you start

Same setup as prior modules:

1. Docker Desktop running
2. `npx supabase start` and `npx supabase db reset`
3. `npm.cmd run dev --workspace @klickit/gateway`
4. `npm.cmd run dev --workspace @klickit/web`
5. Open **http://localhost:5173** and sign in with demo account

Tip: register at least one patient in **Patient Registry** first if you want to test registered-patient bookings.

---

## Test 1 — Scheduler shell

- [ ] Click **Scheduler** in top navigation
- [ ] Page title reads **Scheduler**
- [ ] View switcher shows Month, Week, Day, Resource Day
- [ ] Date navigation: Previous, Today, Next, and date picker work
- [ ] Chair and Lead clinician filters are visible

---

## Test 2 — Create a booking

- [ ] Click **Create Booking**
- [ ] Fill date, start time, duration, reason, clinician, chair
- [ ] Use **Quick registration** with a given name (example: Rahul)
- [ ] Availability note appears (available or conflict)
- [ ] Click **Save booking**
- [ ] Booking appears in the day/week/month list

---

## Test 3 — Booking details and transitions

- [ ] Click **Open** on a booking row
- [ ] Details panel shows status and times
- [ ] Click **Confirm** on a scheduled booking
- [ ] Re-open and try **Cancel** or **No-show** on another test booking
- [ ] Status history table appears when history exists

---

## Test 4 — Scheduler setup

- [ ] Click **Setup** from scheduler toolbar
- [ ] Chairs and booking reasons lists load from seed data
- [ ] Active blackouts list appears (may be empty)
- [ ] If you have edit permission, create a short test blackout and verify it appears in the list

---

## What is intentionally not in Module 4

- Full visual calendar grids with drag-resize (compact tables used instead)
- Resource Week view and print actions
- Save and Add to Clinical Queue from booking footer
- Full 12-column booking sheet from Blueprint 06

---

## When you are satisfied with Module 4

Reply exactly:

**APPROVE UI MODULE**

That allows work to start on **UI Module 5 — Clinical Queue**.

Report issues with **UI-SCH-001**, **UI-SCH-002**, or **UI-SCH-003**.
