# Milestone 1 Manual Test Guide

Use this checklist after Phase 7. Synthetic data only.

## A. Verify project files

1. Open the project folder in Cursor.
2. Confirm these folders exist: `apps/web`, `apps/gateway`, `packages/shared`, `supabase`, `docs`.
3. Open `docs/CURRENT_STATUS.md` and confirm Milestone 1 is ready for review.

## B. Verify toolchain

1. Open PowerShell in the project folder.
2. Run:

```powershell
npm run verify
```

3. Expected: all blueprint files show `OK` and toolchain verification passes.

## C. Run automated tests

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all pass with no errors.

## D. Optional local database check (after Docker Desktop is running)

1. Open **Docker Desktop** from the Start menu and wait until it says it is running.
2. In PowerShell:

```powershell
npx supabase start
npx supabase db reset
```

3. Open [http://127.0.0.1:54323](http://127.0.0.1:54323) for Supabase Studio.
4. Confirm a bootstrap table exists in schema `dentos_runtime`.

## E. Run the web shell

```powershell
npm run dev --workspace @klickit/web
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) and confirm the page title says **KlickIt Web**.

## F. Run the gateway shell

In a second PowerShell window:

```powershell
npm run dev --workspace @klickit/gateway
```

Open [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health) and confirm JSON shows `"product": "KlickIt"`.

## G. GitHub setup (owner action)

Follow `docs/GIT_SETUP.md` to create a private GitHub repository and tell Cursor the URL when ready.

## Pass criteria

- Automated commands pass
- Web and gateway shells open locally
- No secrets pasted into chat
- Owner is satisfied with setup progress

When satisfied, reply exactly: `APPROVE MILESTONE`
