# KlickIt Agent Instructions

## Identity

- Product: **KlickIt**
- DrKlick is only an authorised read-only migration reference.
- Never copy DrKlick code, private APIs, database identifiers, wording, visual design or assets.

## User

The owner is not a coder. Use simple English, with brief Hinglish only when useful. Give click-by-click instructions for any manual action.

## Authority

- Read `blueprints/original/01` through `10`.
- Document 10 overrides earlier documents only where it explicitly records a newer decision.
- Original blueprints are read-only.
- Put accepted clarifications under `blueprints/amendments/` and `docs/DECISION_LOG.md`.
- Stop for genuine contradictions or unclear clinical, security or financial behavior.

## Session startup

Before work, read:

1. `docs/CURRENT_STATUS.md`
2. `docs/MASTER_PHASE_PLAN.md`
3. `docs/DECISION_LOG.md`
4. `docs/KNOWN_ISSUES.md`
5. relevant blueprint sections

## Workflow

- Take the next numbered incomplete phase unless a dependency blocker requires prerequisite work.
- Implement one bounded phase at a time.
- Test, update documentation and commit after each phase.
- Automatically continue between phases only when tests pass and no mandatory stop condition exists.
- Stop at each major milestone for manual testing.
- Continue past a milestone only after the exact phrase `APPROVE MILESTONE`.
- Push to private GitHub only after milestone approval.

## Mandatory stops

Stop before:

- paid purchases
- administrator/elevated commands
- secrets or OAuth login
- destructive migrations
- production deployment
- live WhatsApp connection/messages
- real patient data
- DrKlick access
- unsafe MCP permissions
- unresolved security/financial behavior
- three failed repair attempts

## Safety

- Synthetic data only before controlled migration.
- No secrets in chat, Git, logs, rules or documentation.
- Use `.env.local` and provider secret stores.
- No production resources before Rohini pilot approval.
- Preserve immutable posted clinical and financial history.

## Architecture

KlickIt is an offline-first multi-clinic system with:

- shared React/TypeScript/Vite frontend
- Tauri Windows desktop app
- Windows clinic gateway
- local PostgreSQL and Fastify API
- Supabase cloud PostgreSQL/Storage
- transactional outbox/inbox sync
- explicit conflicts
- 72-hour offline limit followed by read-only mode
- Pabbly Chatflow/Connect integration

Do not turn it into a cloud-only generic dashboard.


## Portability, rebuild and resale

KlickIt must not depend permanently on Cursor, GitHub, Vercel, Supabase, Pabbly, Tauri, Docker Desktop, Windows-only development assumptions, one MCP server, or one owner account.

Before adding or changing an external service:

1. update `docs/PROVIDER_INVENTORY.md`;
2. identify account, billing and recovery owners;
3. define export, restore, replacement and account-transfer paths;
4. place provider-specific code behind an internal adapter where practical;
5. keep important configuration and scripts in Git;
6. document environment-variable names without values;
7. update provider-exit and handover documents;
8. ask before accepting material lock-in.

Cursor chat memory is never an operational dependency. The repository must build from a clean clone using documented commands.

Portability applies equally to cloud, local gateway, desktop shell, development tools, communications, monitoring, domains, signing and hardware. Equal priority does not mean identical migration effort; document actual difficulty honestly.
