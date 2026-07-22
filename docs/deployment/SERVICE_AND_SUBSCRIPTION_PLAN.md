# Service and Subscription Plan

**Date:** 2026-07-22  
**Purpose:** Staging-first deployment — synthetic data only  
**Prices verified from official provider pages (July 2026).** Registry fees can change slightly.

**Legend — Required when:**  
- **Now** = needed before useful staging  
- **Before production** = required before real clinic use  
- **Later** = optional or deferrable  

---

## Summary table

| Service | KlickIt use | You appear to have it? | When | Provider | Plan | Free/Paid | Official price (Jul 2026) | Est. monthly | Data stored | Account owner | Connect method | Lock-in risk |
|---------|-------------|------------------------|------|----------|------|-----------|---------------------------|--------------|-------------|---------------|----------------|--------------|
| **Cursor** | Coding, review, deployment guidance | **Yes** (you are using it) | Now (already) | Cursor | Your current plan | Paid or trial varies | See cursor.com/pricing | $0–20+ (existing) | Code in repo, chat not operational | Owner | Desktop app | Low — not runtime |
| **GitHub** | Private repo, CI, secret scanning | **Likely yes** — remote `rohitgds/Klickit` exists | **Now** | GitHub | Free (private repos) | Free tier OK to start | $0; Team $4/user/mo if needed | **$0** | Source code, Actions logs | **Confirm owner** | OAuth / CLI | Low — standard Git |
| **Vercel** | Host web app, preview, HTTPS, custom domain | **Unknown** | **Now** (staging web) | Vercel | **Pro required** — KlickIt is commercial software | Paid | **$20/user/month** + $20 usage credit ([vercel.com/pricing](https://vercel.com/pricing)) | **~$20** | Static web build, env var names | Business preferred | OAuth / CLI | Medium — config |
| **Supabase** | Cloud Postgres, storage, future sync target | **Unknown** | **Now** (staging project only) | Supabase | Free or Pro | Free: $0; Pro: **$25/org/month** ([supabase.com/pricing](https://supabase.com/pricing)) | **$0–25** | Synthetic DB, files (staging) | Business preferred | OAuth / CLI | Medium — Postgres |
| **Domain + DNS** | `staging.` and later `app.` hostnames | **Unknown — must ask** | Now (if domain owned) / Later (if buying) | Cloudflare Registrar (recommended) or existing registrar | .com at cost | Paid annually | **~$10.44/year** .com ([cloudflare.com/products/registrar](https://www.cloudflare.com/products/registrar/)) | **~$1** amortized | DNS records only | Business preferred | Manual DNS UI | Low if documented |
| **Cloud worker / API host** | Staging API if web must work online | **No** | **Now only if** full online staging | Railway / Render / Fly.io | Starter | Paid | Railway ~$5+ usage; Render free tier limited ([render.com/pricing](https://render.com/pricing)) | **$0–10** | Synthetic API logs | Business preferred | CLI / dashboard | Medium |
| **Transactional email** | Invites, password reset (future) | **Unknown** | Later for staging; before production if email login | Resend / Postmark / Supabase default | Free tier | Free start | Resend free tier 100 emails/day ([resend.com/pricing](https://resend.com/pricing)) | **$0** | Email addresses, send logs | Business preferred | API | Low |
| **Monitoring (Sentry)** | Error reporting for staging web | **No** | Later (recommended before production) | Sentry | Developer free | Free | $0 developer plan ([sentry.io/pricing](https://sentry.io/pricing)) | **$0** | Errors (no PHI) | Business preferred | OAuth | Low |
| **Pabbly Connect + Chatflow** | WhatsApp automations | **You said planned/in use** | Later for staging; test number only | Pabbly | Your existing plan | Paid (your plan) | Check Pabbly account | **Existing** | Message metadata | Owner | Webhook / API | Medium |
| **Backup storage (R2/B2)** | Off-site encrypted backups | **No** | Before production | Cloudflare R2 / Backblaze B2 | Pay-as-you-go | Paid usage | R2 ~$0.015/GB-month ([developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/)) | **~$1–5** | Encrypted backup blobs | Business preferred | API / CLI | Low |
| **Windows Clinic Gateway PC** | Local clinic operations | **Your laptop** | Before production pilot | Self / Windows | N/A | Hardware | One-time | N/A | Local PostgreSQL, files | Clinic | Local install | N/A |
| **Code signing (Windows)** | Trusted Tauri installer | **No** | Before wide desktop rollout | DigiCert / Sectigo / SSL.com | OV cert | Paid | ~$200–400/year typical | **~$25** amortized | Certificate | Business | Manual purchase | Medium |

---

## Divided lists

### Required now (safe staging path)

| Item | Why | Est. cost |
|------|-----|-----------|
| **GitHub** (push latest code, 2FA) | Source of truth for Vercel deploy | $0 |
| **Decision on staging API** | Web app cannot log in without an API URL | $0 (decision only) |
| **Vercel Pro** | Hobby plan is **not** for commercial clinic software ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)) | ~$20/mo |
| **Supabase Free staging project** (optional first step) | Synthetic cloud DB if we test cloud sync | $0 (1 of 2 free projects) |

**Conditional now:** Cloud API host (~$5–10/mo) **only if** you want the full app online — not just static pages.

### Required before production

| Item | Why |
|------|-----|
| Supabase **Production** project (separate from staging) | Real cloud data boundary |
| Vercel production environment + `app.` domain | Staff access |
| Backup + **restore test** | R-008 / pilot gate |
| Live cloud sync drill (staging Supabase) | SYNC-DEC-01 approval |
| Staging UAT sign-off | Owner checklist |
| RLS or approved server-only boundary audit | Security gate |
| Pabbly test → controlled production WhatsApp | Separate credentials |
| Monitoring with PHI-safe rules | Operations |
| `APPROVE PRODUCTION DEPLOYMENT` | Mandatory phrase |

### Optional later

| Item | When |
|------|------|
| GitHub Team ($4/user/mo) | Multiple developers need branch protection |
| Supabase Pro ($25/mo) | Staging needs daily backups / no pause |
| Custom Supabase API domain | Only if clear migration benefit |
| Sentry paid | High traffic |
| Railway/Render upgrade | Heavy staging API usage |
| Code signing certificate | Before distributing desktop to many PCs |

---

## Estimated minimum monthly cost

| Scenario | Monthly estimate | Notes |
|----------|------------------|-------|
| **A — Web shell only on Vercel** (pages load, login fails) | **~$20** | Vercel Pro only; not useful for full testing |
| **B — Recommended minimum useful staging** | **~$25–45** | Vercel Pro $20 + Supabase Free $0 **or** Pro $25 + optional API host $5–10 |
| **C — Before production (separate prod Supabase + monitoring + backups)** | **~$50–80+** | Adds prod Supabase, backup storage, email, Pabbly (existing) |

**One-time / annual:** domain ~**$10–11/year** if you buy new.

**Not included:** Cursor subscription you already pay, Pabbly existing fees, clinic hardware, code signing (~$200+/year later).

---

## Provider connection permissions (when approved)

| Provider | Cursor/MCP needs | Owner action |
|----------|------------------|--------------|
| GitHub | Read repo; optional PR checks | `APPROVE SERVICE CONNECTION` — OAuth read-only first |
| Vercel | Read projects; deploy only after `DEPLOY STAGING` | OAuth; no secrets in chat |
| Supabase | Read schema; staging project only | OAuth; never paste service-role key |
| DNS | None in Cursor — manual clicks | `APPROVE DNS CHANGE` per record |

---

## Account ownership recommendations

- Use a **business-controlled email** (not only personal) for GitHub, Vercel, Supabase.
- Add a **backup administrator** on each account.
- Enable **two-factor authentication** everywhere.
- Record owners in `docs/PROVIDER_INVENTORY.md` after each connection (no secrets).

---

## Cheaper replacements (portability)

| Capability | Primary | Replacement |
|------------|---------|-------------|
| Web host | Vercel | Cloudflare Pages, Netlify, static on VPS |
| Database | Supabase | Neon, RDS, self-hosted PostgreSQL |
| Git | GitHub | GitLab, Gitea |
| DNS | Cloudflare | Namecheap, Porkbun, registrar DNS |
| API host | Railway | Render, Fly.io, small VPS |

---

## Pricing sources (checked 2026-07-22)

- Vercel: https://vercel.com/pricing — Pro **$20/user/month**; Hobby non-commercial only  
- Supabase: https://supabase.com/pricing — Free **$0**; Pro **from $25/month** per organization  
- GitHub: https://github.com/pricing — Free private repos **$0**  
- Cloudflare Registrar: at-cost .com **~$10.44/year** (wholesale + ICANN fee)

---

## Blocked until owner decides

1. Staging Supabase project creation — `APPROVE SERVICE CONNECTION`
2. Vercel Pro upgrade (commercial staging) — `APPROVE PAID SUBSCRIPTION`
3. Domain purchase — `APPROVE PAID SUBSCRIPTION`
4. DNS records — `APPROVE DNS CHANGE`
5. First deploy — `DEPLOY STAGING`
6. Production — `APPROVE PRODUCTION DEPLOYMENT`

## Owner answers (2026-07-22)

See `STAGING_OWNER_ANSWERS.md` — no domain yet; staging goal **B** (full synthetic online); GitHub/Vercel/Supabase free accounts exist; personal GitHub OK for now.
