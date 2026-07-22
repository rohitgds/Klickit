# UI Module 1 — Owner Test Guide (Login and Application Shell)

Use synthetic demo data only. You should see an orange banner: **DEMO DATA — NOT REAL PATIENT DATA**.

## Before you start

1. Open **Docker Desktop** and wait until it is running.
2. Open **three PowerShell windows** in the project folder:
   `C:\Users\drroh\OneDrive\Desktop\KlickIt_Cursor_Starter_Pack_v2_Portable`

### Window 1 — database

```powershell
npx supabase start
npx supabase db reset
```

### Window 2 — backend gateway

```powershell
npm run dev --workspace @klickit/gateway
```

Keep this window open.

### Window 3 — web UI

```powershell
npm run dev --workspace @klickit/web
```

Keep this window open.

### Open the app

In **Chrome** or **Edge**, go to: **http://localhost:5173**

---

## Test 1 — Demo login screen

- [ ] Orange demo banner is visible at the top
- [ ] Page title shows **KlickIt — Sign In**
- [ ] **Sign In with Demo Account** button is visible
- [ ] Password section is visible below (advanced)

**Click:** **Sign In with Demo Account**

Expected:

- [ ] You reach the main app (Dashboard area)
- [ ] Top menu shows items like Dashboard, Clinical Queue, Scheduler, Patient Registry
- [ ] Context bar shows clinic name **Development Clinic (DEV)**
- [ ] Sync status label appears (for example “Sync: Local only”)
- [ ] **Sign Out** button appears on the right

---

## Test 2 — Navigation placeholders

Click each top menu item once:

| Menu item | Expected placeholder message |
|---|---|
| Dashboard | “coming next” message for UI Module 2 |
| Clinical Queue | mentions UI Module 5 |
| Scheduler | mentions UI Module 4 |
| Patient Registry | mentions UI Module 3 |
| Financial Operations | mentions UI Module 9 |
| Comms Center | mentions UI Module 10 |
| System Configuration | mentions UI Module 12 |

Each page should load without a blank screen or browser error.

---

## Test 3 — Sign out and sign in again

1. Click **Sign Out** (top right).
2. Expected: you return to the login screen.
3. Click **Sign In with Demo Account** again.
4. Expected: you return to Dashboard.

---

## Test 4 — Password login (expected to fail for now)

1. On login screen, enter login name `dev.admin` and any password.
2. Click **Sign In with Password**.

Expected:

- [ ] Error message explaining password login is not ready yet (credentials not seeded)
- [ ] Demo login still works afterward

---

## Test 5 — Layout check (quick visual)

- [ ] Navigation is compact (not large cards or hero banners)
- [ ] Text is readable on a normal laptop screen
- [ ] No decorative gradient background

---

## If something fails

| Problem | What to check |
|---|---|
| Blank page | Is Window 3 (`npm run dev --workspace @klickit/web`) still running? |
| Demo login error | Is Window 2 (gateway) running? Is Docker running? |
| “Gateway unreachable” sync label | Restart gateway window after database reset |

---

## When you are satisfied with Module 1

Reply exactly:

**APPROVE UI MODULE**

That allows work to start on **UI Module 2 — Dashboard**.

If something needs fixing, describe what you saw and use a screen reference such as `UI-SHL-001` (login) or `UI-SHL-003` (application shell).
