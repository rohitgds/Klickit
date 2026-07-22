# Web Deployment Readiness Audit

**Date:** 2026-07-22  
**Branch inspected:** `remediation/pilot-safety` (local, not fully pushed)  
**Release state:** **NOT READY** — production and real patient data **prohibited**

This audit is read-only. No services were connected during this review.

---

## Executive summary (plain English)

KlickIt can **build the web pages** on your computer. It **cannot yet** be a full online staging clinic system the way a normal SaaS website works, because the browser app expects a **Clinic Gateway API** running nearby — and that gateway must **not** be opened to the public internet per project safety rules.

Staging today = possible for **static web hosting preview**, but **not** for full login + patients + finance + sync unless we first decide a safe API hosting approach.

---

## Area-by-area status

| Area | Status | Staging | Production |
|------|--------|---------|------------|
| Web app production build (`apps/web`) | **Available and working** | Required | Required |
| Vercel configuration (`vercel.json`) | **Missing** | Required | Required |
| Monorepo build on Vercel | **Partially implemented** | Required | Required |
| Browser → API wiring | **Available locally** | Blocked without safe API plan | Blocked |
| Clinic Gateway (`apps/gateway`) | **Available and working locally** | Must stay private | Clinic LAN only |
| Separate cloud API app | **Missing** | Optional path | May be required |
| Supabase migrations | **Available** (many SQL files) | Required (staging project) | Required |
| Supabase RLS | **Missing** (server-only auth chosen for now) | Acceptable if gateway-only | Must verify boundary |
| Supabase Auth in browser | **Not used** — gateway sessions | Not required for current design | Review before cloud |
| Authentication (Argon2id + sessions) | **Delivered locally** | Available but untested online | Required before production |
| Finance remediation | **Delivered locally** | Available but untested online | Required before production |
| Sync remediation (local PG tests) | **Delivered locally** (55/55 gateway tests pass) | Partially implemented | Required before production |
| Live cloud sync push/pull | **Missing / untested** | Blocked (owner decision) | Required before production |
| GitHub remote | **Connected** (`rohitgds/Klickit`) | Required | Required |
| Latest remediation commits | **Not committed/pushed** | Required before team staging | Required |
| GitHub Actions CI | **Available** (Windows runner) | Available but untested on branch | Required |
| Custom domain / DNS docs | **Missing** | Required later | Required |
| Tauri desktop installer | **Partially implemented** (scaffold) | Not required for web staging | Required before wide rollout |
| Real backup/restore | **Partially implemented** | Not required for first web preview | Required before production |
| Pabbly / WhatsApp live | **Not connected** | Test numbers only | Blocked until approval |
| Secrets in Git | **Absent from tracked files** (`.env.example` names only) | Required | Required |
| Environment variable docs for deploy | **Partial** (`.env.example` only) | Required | Required |

---

## Web application (Vercel)

| Question | Answer |
|----------|--------|
| Does the web app build? | **Yes** — `npm run build --workspace @klickit/web` succeeds; output in `apps/web/dist/` |
| Vercel project root | **`apps/web`** (not repository root) |
| Framework | **Vite + React 19** |
| Install command (monorepo) | From repo root: `npm ci` then build shared packages, **or** configure Vercel root directory with custom install |
| Build command | Must build `@klickit/ui`, `@klickit/shared`, `@klickit/patients`, etc. first; simplest: root `npm run build` filtered, or documented staging script (to be added) |
| Output directory | **`dist`** (relative to `apps/web`) |
| SPA deep links | **Rewrite required** — no `vercel.json` yet; need fallback to `index.html` |
| Browser API target | Default **`/api`** (local dev proxy → `http://127.0.0.1:8787`). Online staging needs **`VITE_API_BASE`** set at build time to a reachable HTTPS API |
| Preview branch | Recommend **`staging`** or `remediation/pilot-safety` until stable |

**Important:** Vercel should host **only the web frontend**, not PostgreSQL, not the Clinic Gateway, not sync workers.

---

## API architecture (critical)

| Component | Exists? | Role |
|-----------|---------|------|
| `apps/web` | Yes | Browser UI |
| `apps/gateway` | Yes | **All business APIs** today (auth, patients, finance, sync, etc.) |
| `cloud-api/` | **No** | Blueprint mentions it; not implemented as separate deployable |
| Supabase direct from browser | **No** | Web uses `fetch` to gateway via `VITE_API_BASE` / `/api` |

**Staging blocker:** A Vercel URL alone will show pages but **login and data will fail** unless a gateway (or future cloud API) is reachable at the URL configured in `VITE_API_BASE`.

**Safety rule:** Do **not** expose the real Clinic Gateway on a public hostname. Staging options must be decided with the owner (private VPN, dedicated staging API host with synthetic data, or local-only demo).

---

## Database and Supabase

| Item | Status |
|------|--------|
| Migration files | **Complete set** under `supabase/migrations/` |
| Local apply + seed | **Working** after `npx supabase db reset` |
| `verify:migrations` script | **Fixed** — fails closed if Docker missing |
| Staging Supabase project | **Not created** — owner approval required |
| Production Supabase project | **Not created** — blocked |
| RLS policies in migrations | **Not found** — DEC-039 uses gateway server-only authorization |
| Service role key in browser | **Must never happen** — not wired today |
| Staging vs production separation | **Not set up** |

---

## Security, finance, sync (remediation)

| Track | Local status | Safe for staging? | Safe for production? |
|-------|--------------|-------------------|----------------------|
| Security Remediation 1 | Delivered; PG tests pass after db reset | **Yes with synthetic data** after staging API exists | **No** — needs staging UAT + cloud boundary review |
| Finance Remediation 1 | Delivered; 12 finance + 35 web tests pass | **Yes with synthetic data** | **No** — needs owner finance UAT |
| Sync Remediation 1 | SYNC-001..004 pass locally; no live cloud drill | **Partial** — offline indicators only | **No** — needs staging cloud sync drill |
| Backup / Desktop | Not complete | Not required for web-only preview | **Required** |

---

## Authentication and routes

| Item | Status |
|------|--------|
| Frontend protected routes | **Yes** — `ProtectedLayout` redirects to login |
| Synthetic login (local) | **Yes** — `dev.admin` / `DevPass123!` after seed |
| Session validation | **Implemented** in gateway |
| Online login without gateway | **Will not work** |

---

## Git and CI

| Item | Status |
|------|--------|
| Remote | `https://github.com/rohitgds/Klickit.git` |
| Current branch | `remediation/pilot-safety` |
| Uncommitted work | **Yes** — security, finance, sync remediation not committed |
| CI workflow | `.github/workflows/ci.yml` — runs on `main`, `develop`, feature branches (not `remediation/*` by default) |
| Secret scanning | GitHub feature — confirm enabled in repo settings |

---

## What is **not** required for first staging web preview

- Production custom domain (`app.yourdomain.com`)
- Live WhatsApp
- Public Clinic Gateway
- Production Supabase
- Tauri signed installer
- Real patient data

---

## What **is** required before any useful staging

1. Owner answers (domain, accounts, staging API strategy)
2. Commit and push remediation branch (or merge to `staging`)
3. `vercel.json` + monorepo build settings
4. **Decision:** how the online web app reaches an API safely
5. Staging Supabase project (synthetic only) — if cloud sync/storage in scope
6. `DEPLOY STAGING` approval

---

## Required before production (gate)

See user deployment brief §10 and `docs/CURRENT_STATUS.md`. Includes: live cloud sync, backup/restore proof, staging UAT, no Severity 1–2 defects, `APPROVE PRODUCTION DEPLOYMENT`.

---

## Recommended next documentation (not yet created)

- `STAGING_DEPLOYMENT_RUNBOOK.md`
- `STAGING_ENVIRONMENT_VARIABLES.md`
- `STAGING_TEST_CHECKLIST.md`
- `OWNER_STAGING_UAT.md`
- `DOMAIN_AND_DNS_REGISTER.md`

Create after owner answers and `APPROVE SERVICE CONNECTION` for first provider.
