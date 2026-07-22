# UI Module 3 — Owner Test Guide (Patient Registry)

Use synthetic demo data only. Orange **DEMO DATA** banner must remain visible.

## Before you start

Same three-window setup as Module 1:

1. Docker Desktop running
2. `npx supabase start` and `npx supabase db reset`
3. `npm.cmd run dev --workspace @klickit/gateway`
4. `npm.cmd run dev --workspace @klickit/web`
5. Open **http://localhost:5173** and sign in with **Sign In with Demo Account**

---

## Test 1 — Patient Registry search

- [ ] Click **Patient Registry** in the top navigation
- [ ] Page title reads **Patient Registry**
- [ ] Click **Search** with an empty box — recent patients list loads (may be empty on fresh reset)
- [ ] Type a single letter — search stays blocked until 2 characters (unless patient ID format)
- [ ] Grid columns: Sr, Patient ID, Patient name, Mobile, Status, Actions

---

## Test 2 — Register a patient

- [ ] Click **Register Patient**
- [ ] Fill **Given name** (required), optional mobile and family name
- [ ] Click **Save profile**
- [ ] You are taken to the new **Patient Profile** page
- [ ] Patient ID is auto-assigned (not typed manually)

Suggested demo patient:

| Field | Example |
|---|---|
| Given name | Anita |
| Family name | Sharma |
| Mobile | 9876543210 |

---

## Test 3 — Duplicate warning

- [ ] Register another patient with the **same mobile and similar name**
- [ ] Before save, a duplicate banner should appear
- [ ] Click **Review duplicates** — dialog lists possible matches
- [ ] Use **Save anyway** if you still want a second record
- [ ] After save, **Queue review** is available only if your account has merge permission

---

## Test 4 — Patient profile and safety summary

- [ ] From registry grid, click **Open** on a patient row
- [ ] **Care overview** tab shows core profile fields
- [ ] Switch to **Safety summary** tab
- [ ] Allergies list or empty state appears
- [ ] **Back to registry** returns to search grid

---

## What is intentionally not in Module 3

- Advanced filter matrix (location, birth window, cohorts, etc.)
- Full 12-row registration form and intent tier editor
- Complete 13-tab patient care workspace
- Edit profile mutations

---

## When you are satisfied with Module 3

Reply exactly:

**APPROVE UI MODULE**

That allows work to start on **UI Module 4 — Scheduler**.

Report issues with screen references such as **UI-PAT-001** (search), **UI-PAT-002** (register), **UI-PAT-004** (profile).
