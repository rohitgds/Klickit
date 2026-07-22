# UI Module 2 — Owner Test Guide (Dashboard)

Use synthetic demo data only. You should see the orange **DEMO DATA — NOT REAL PATIENT DATA** banner.

## Before you start

Same setup as Module 1:

1. **Docker Desktop** running
2. **Window 1** — database:
   ```powershell
   npx supabase start
   npx supabase db reset
   ```
3. **Window 2** — gateway:
   ```powershell
   npm.cmd run dev --workspace @klickit/gateway
   ```
4. **Window 3** — web UI:
   ```powershell
   npm.cmd run dev --workspace @klickit/web
   ```
5. Browser: **http://localhost:5173**
6. Click **Sign In with Demo Account**

---

## Test 1 — Dashboard loads after login

- [ ] After login you land on **Dashboard**
- [ ] Page title in the shell reads **Dashboard**
- [ ] You see **Operational date** with today’s date
- [ ] You see a **Refresh** button (↻)
- [ ] Layout is compact tables — not large coloured cards

---

## Test 2 — Operational counts

- [ ] Section **Today’s counts** shows seven rows:
  - Bookings scheduled
  - Bookings confirmed
  - Arrivals expected
  - Queue waiting
  - Queue engaged
  - No-shows today
  - Cancellations today
- [ ] All counts show **0** on a fresh database reset (this is normal)
- [ ] No red error box appears

---

## Test 3 — Quick actions

- [ ] Action strip shows buttons you are allowed to use (depends on demo permissions)
- [ ] Typical demo account shows: **Register Patient**, **Add to Clinical Queue**, **Create Booking**
- [ ] **Record Collection** appears only if your account has collection permission
- [ ] Clicking an action navigates to the target module placeholder (Modules 3–9)

---

## Test 4 — Date change and refresh

- [ ] Change **Operational date** to another day — counts reload
- [ ] Click **Refresh** — data reloads without signing out
- [ ] If gateway is stopped, you see an error with a **Retry** button

---

## Test 5 — Empty activity grid

- [ ] Section **Operational activity** shows table headers (#, Name, Time, Lead clinician, Status)
- [ ] With zero demo bookings, you see **No activity for this date**
- [ ] Note under the table explains activity rows will come in later modules

---

## What is intentionally not in Module 2

- Patient/booking rows in the activity grid (gateway API returns summary counts only)
- **Active Clinic / Authorized Clinics** scope switch (single clinic for pilot)
- **Activity Audit** command (needs audit module)
- Deep links that open booking or registration sheets (Modules 3–5)

---

## When you are satisfied with Module 2

Reply exactly:

**APPROVE UI MODULE**

That allows work to start on **UI Module 3 — Patient Registry**.

If something needs fixing, describe what you saw and use screen reference **UI-DSH-001**.
