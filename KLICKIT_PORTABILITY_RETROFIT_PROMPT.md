# KLICKIT PORTABILITY RETROFIT PROMPT FOR AN EXISTING CURSOR PROJECT

Use this only when KlickIt development has already started.

Do not delete completed work, reset Git history, recreate the repository, replace providers or alter production.

## Goal

Retrofit KlickIt so it can be rebuilt from zero, transferred between accounts, moved to another provider, handed over or sold, and operated without Cursor, MCP or one AI model.

## First action: audit only

Before changing code:

1. Read AGENTS, current status, phase plan, decisions and all ten blueprints.
2. Inspect provider-specific dependencies and dashboard-only configuration.
3. Identify current accounts and ownership without requesting secret values.
4. Inspect direct usage of Supabase, Vercel, GitHub Actions, Pabbly, WhatsApp APIs, Tauri, Docker/WSL, Windows services, monitoring, storage, auth, realtime, jobs and MCP workflows.
5. Report:
   - already portable;
   - coupling to fix now;
   - acceptable pilot coupling with exit plan;
   - destructive or expensive changes requiring approval.

Stop and show the audit before refactoring.

## Required documents

Create or update the full portability, provider inventory, exit, account transfer, rebuild, sale/handover, data export, license, secret inventory and portability test documents supplied in the v2 starter pack.

## Refactoring rules

- Do not rewrite stable modules merely for theoretical purity.
- Prioritize boundaries around data, identity, files, messaging, deployment, desktop and gateway runtime.
- Replace scattered provider calls with internal adapters where practical.
- Keep provider implementations behind adapters.
- Store provider-neutral object keys and identifiers.
- Put migrations, functions, scripts and configuration in Git.
- Make build/test commands runnable without Cursor.
- Treat MCP as optional.
- Record accepted lock-in risks honestly.

## Validation

Before completion:

- clean clone builds;
- local synthetic environment starts;
- database exports and restores;
- files export with manifests/checksums;
- Git bundle or mirror restores;
- provider and account inventories are complete;
- secrets are not exposed;
- dependency/license report exists;
- one provider adapter is substituted with a test double or alternative;
- existing tests pass.

Stop before any real migration, account transfer, purchase, administrator action, login or production change.
