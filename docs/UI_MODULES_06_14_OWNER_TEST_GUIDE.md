# UI Modules 6–14 — Owner Test Guide

Continuous build authorized (DEC-037). Test all remaining modules in one walk-through.

## Before you start

1. Start Docker Desktop and run `npx supabase start` then `npx supabase db reset`.
2. In PowerShell use **`npm.cmd`** (not `npm`):
   - `npm.cmd run dev --workspace @klickit/gateway` (port **8787**)
   - `npm.cmd run dev --workspace @klickit/web` (port **5173**)
3. Open http://localhost:5173 and use demo login.

## Module 6 — Clinical Records

1. Go to **Clinical Queue**.
2. Check in or admit a patient; click **Begin care** if needed.
3. Click **Workspace** on a queue row (or open `/clinical/encounters/{id}`).
4. On **Summary** tab confirm allergies and counts load.
5. On **Clinical Notes** tab add a progress note and sign it.
6. On **Odontogram** tab add a finding (tooth + code).

**Pass if:** workspace loads; note and finding save without error.

## Module 7 — Treatment Plans

1. In the encounter workspace open the **Care Plan** tab.
2. Click **Create care plan**.
3. Add a stage, click **Propose**, then **Accept** with a total amount.

**Pass if:** care plan id appears and status updates after propose/accept.

## Module 8 — Prescriptions

1. Open **Prescription** tab in the encounter workspace.
2. **Create medication order draft**.
3. Search medication (2+ letters), select one, **Save order line**.
4. Enter signing PIN and **Sign order** (demo PIN must exist in gateway seed).

**Pass if:** draft order id appears; sign succeeds or shows a clear PIN error.

## Module 9 — Financial Operations

1. Open **Financial Operations** from the nav.
2. Enter a patient ID from registry; **Lookup balance**.
3. Create a **fee statement draft** (reference + fee schedule).
4. **Issue statement** if draft status allows.

**Pass if:** balance and masters load; draft creates successfully.

## Module 10 — Recall and Communications

1. Open **Comms Center**.
2. Review **Due continuity tasks** for today.
3. Review **Message templates** list.
4. Enter patient ID and **Load messages**.
5. Optionally queue a **test outbound message** (test mode).

**Pass if:** tasks/templates load; test message queues without live WhatsApp.

## Module 11 — Files and Printing

1. In encounter workspace open **Files & Print**.
2. Register a small image or text file.
3. On **Care Plan** tab use **Print snapshot** after a plan exists.

**Pass if:** file registers; print snapshot returns without error.

## Module 12 — Settings and Permissions

1. Open **System Configuration** → **Staff** tab.
2. Confirm staff list loads; optionally add a staff member.
3. Open **Users** tab and confirm user list.

**Pass if:** staff and users load for demo admin.

## Module 13 — Offline, Sync and Conflicts

1. In **System Configuration** → **Sync Conflicts** tab.
2. Confirm open conflicts list (empty is OK).
3. Open **Backup & Recovery** tab; confirm manifest/recovery status loads.

**Pass if:** sync and resilience panels load without crash.

## Module 14 — End-to-End Demo

1. Open **System Configuration** → **Pilot Handover** tab, or go to `/pilot-demo`.
2. Walk the **10-step demo flow** table links.
3. Review production gate and handover summary.
4. Optionally **Record pilot acceptance**.

**Pass if:** all nav modules reachable; pilot page shows gate and handover data.

## Known pilot limitations

- Patient names often show as ID fragments until richer list APIs exist.
- Medication sign requires a seeded doctor PIN in the database.
- Full calendar grid, collections UI and allocation splits are deferred.
- Live WhatsApp is not connected in development.

## When finished

Reply **`APPROVE UI MODULE`** for any module you want marked accepted, or **`APPROVE MILESTONE`** after full frontend sign-off.
