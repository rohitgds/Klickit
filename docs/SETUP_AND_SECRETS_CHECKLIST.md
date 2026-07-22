# Setup, Subscription, API and Connector Checklist

Never record actual passwords, keys or tokens in this file.

## 1. Already available

| Item | Status | Portability / ownership notes |
|---|---|---|
| Windows 11 Pro development laptop | Ready | Gateway simulated here first; clinic mini-PC deferred |
| RAM / disk | 31.8 GB RAM; ~73 GB free on C: | Monitor Docker and Rust disk growth |
| Git for Windows | Installed (2.53.0) | Standard Git; GitHub is first provider, not permanent lock-in |
| Node.js / npm | Installed (Node 24.16.0 / npm 11.13.0) | Pin supported LTS in project during Phase 4 |
| WSL 2 + Ubuntu | Installed | Needed for Docker Desktop |
| WebView2 Runtime | Installed | Required for Tauri |
| Chrome, Edge, Firefox | Installed | Used for UI testing and OAuth flows |
| Cursor IDE session | Active | Optional assistant only; not a runtime dependency |
| GitHub free account | Exists | Private repo still to be created in Phase 6 |
| Supabase free account | Exists | Local dev first; hosted staging later only |
| Vercel free account | Exists | Preview/staging only until pilot approval |
| Pabbly Connect paid account | Exists | Connect only after approved test workflow |
| Pabbly Chatflow paid account + WhatsApp number | Exists | Do not connect live patient messaging in development |
| Ten verified blueprint originals | Present in workspace | SHA-256 verified 2026-07-21 |
| Starter governance docs, rules, commands | Present | AGENTS, phase plan, portability charter |

## 2. Required now (before Milestone 1 can finish)

| Item | Why now | Approval needed | Secret handling |
|---|---|---|---|
| Cursor Pro subscription (if not active) | Stable Agent for phased build | User purchase decision | Billing account owned by business/user |
| Docker Desktop + WSL integration | Local Supabase in Phase 7 | Admin/WSL changes — ask first | No secret in chat |
| Rust toolchain + Tauri prerequisites | Desktop shell in Phase 12 | Normal install; explain disk use | No secret in chat |
| Microsoft C++ Build Tools | Windows Tauri build | Administrator install — ask first | No secret in chat |
| Local Git initialization | Phase 6 foundation | Safe without elevation | N/A |
| Private GitHub repository | Source control and CI | Browser OAuth or GitHub CLI login — ask first | Tokens only via OAuth/CLI |
| Node LTS version pin | Reproducible builds | Project decision in Phase 4 | N/A |

## 3. Required in a later phase

| Item | Phase / milestone | Notes |
|---|---|---|
| Supabase CLI / local stack | Phase 7 | Dev dependency and local containers |
| GitHub Actions secrets | Phase 7+ | Store in GitHub secret store only |
| Supabase hosted staging project | After local baseline | Project-scoped, not production |
| Vercel preview project | After web baseline | Staging/preview only |
| Playwright test runner | Phase 6+ / testing phases | Project dev dependency |
| GitHub MCP (read-only) | After repo exists | KlickIt repo only |
| Supabase MCP (read-only, dev project) | Local/staging setup | Never production |
| Vercel CLI/MCP | Preview deployment | KlickIt project only |
| Pabbly webhook/API credentials | Communications milestone | Test recipients only |
| WhatsApp test recipient allow-list | Phase 48+ | Owner/staff numbers only |
| DrKlick read-only export access | Phase 23 | Separate approved migration discovery |
| Clinic mini-PC hardware | After Rohini readiness | Spare gateway + UPS + encrypted backup |
| Code-signing certificate | Post internal pilot | Deferred; unsigned internal installer allowed first |
| Custom domain | Before public pilot | Compare options before purchase |
| Meta Developer account | Only if Pabbly flow requires it | Investigate when communications phase starts |

## 4. Optional or deferred

| Item | Reason deferred |
|---|---|
| Cursor CLI in PATH | IDE is enough for now |
| GitHub CLI | Optional if browser OAuth is easier |
| External OpenAI/Anthropic API keys | Use Cursor-included models first |
| Random community MCP servers | Not approved |
| Production Supabase/Vercel | Blocked until Rohini pilot approval |
| Live WhatsApp to patients | Blocked until approved pilot comms |
| Inventory / lab / patient portal / native mobile | Explicitly out of first pilot |
| Advanced analytics catalog | Pilot keeps operational reports only |
| Automatic HA between two live clinic servers | Manual spare-gateway activation only |
| Business monitoring vendor | Select during readiness phases |

## Secret names (placeholders only)

Use `.env.example` for names only. Real values go in untracked `.env.local` or provider secret stores.

- `APP_ENV`
- `KLICKIT_CLINIC_CODE`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `PABBLY_WEBHOOK_SECRET`
- `PABBLY_API_CREDENTIAL` (if required by chosen integration)
- WhatsApp/Pabbly identifiers required by approved provider flow
- Tauri updater public-key configuration
- Signing credentials (only after certificate purchase approval)

## Rules

- Identify all expected credentials early, but request them only when a phase needs them.
- Prefer OAuth/browser or official CLI login.
- Never paste passwords, private keys or production credentials into normal chat.
- Never connect production without explicit approval.
- Before connecting any service, update provider inventory, exit plan, account-transfer runbook and environment/secret inventory.

## Portability review required before each service connection

Document for each connector:

- why it is needed
- whether a business-controlled account owns it
- plan, cost and cancellation effect
- export and restore methods
- replacement options
- provider-specific code expected
- account-transfer support
- data region
- secret rotation
- whether the same capability can run locally
- whether it is required to rebuild KlickIt

Do not connect a service only because an MCP makes it convenient.

## Development-tool independence

The repository must remain usable with command-line scripts, another compatible editor, no Cursor chat history, no mandatory MCP and no external AI API key for normal build/test/deploy commands.
