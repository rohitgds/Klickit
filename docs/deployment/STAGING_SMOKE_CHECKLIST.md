# Staging Smoke Test Checklist (synthetic data only)

**URL:** https://klickit-web-2c63.vercel.app  
**Login:** Password Login → `dev.admin` / `DevPass123!` (not Owner Demo Login)  
**Release state:** NOT READY — no real patients

---

## Before you start

- Use **Chrome or Edge** (your normal browser). Cursor’s built-in browser may not keep your session.
- First API call after idle may take **~30 seconds** (Render free tier wakes up).
- All data is **synthetic** — safe to click around.

---

## Automated API checks (agent — 2026-07-22)

| Check | Result |
|-------|--------|
| `GET /health` | Pass — database connected |
| `POST /auth/login` | Pass |
| `GET /dashboard/operational/daily` | Pass — empty day (no seeded bookings) |
| `GET /patients/search` | Pass — 0 patients (masters seeded; no demo patients yet) |
| `GET /scheduling/masters` | Pass |

---

## Manual UI checks (owner — click each)

### 1. Login
- [ ] Open https://klickit-web-2c63.vercel.app/login
- [ ] **Password Login** → dashboard loads (no red error box)

### 2. Dashboard (Module 2)
- [ ] Top bar shows clinic name / user
- [ ] Date picker and summary cards visible (counts may be zero)
- [ ] Quick actions visible (Create Booking, Register Patient, etc.)

### 3. Patients (Module 3)
- [ ] Open **Patients** from nav or quick action
- [ ] Search box loads (empty list is OK)
- [ ] **Register Patient** form opens without crash

### 4. Scheduler (Module 4)
- [ ] Open **Scheduler**
- [ ] Calendar/view loads (may be empty)

### 5. Clinical Queue (Module 5)
- [ ] Open **Clinical Queue**
- [ ] Queue board loads (may be empty)

### 6. Sign out
- [ ] Sign out returns to login page

---

## If something fails

| Symptom | Likely cause |
|---------|----------------|
| “Failed to fetch” | Render API sleeping — wait 30s and refresh |
| JSON / HTML error | Hard refresh (`Ctrl+Shift+R`) after a new Vercel deploy |
| Demo login fails | Expected on staging — use **Password Login** |
| Empty lists | OK for now — seed has users/masters, not demo patients/bookings |

Note the **exact error text** and tell the agent.

---

## When all boxes are ticked

Reply: **`STAGING SMOKE OK`**

Optional formal sign-off: **`DEPLOY STAGING`**

---

## Related

- `STAGING_API_RUNBOOK.md` — infrastructure setup (done)
- `docs/remediation/evidence/STAGING_SMOKE_20260722.md` — API evidence log
