# Staging deploy sign-off — 2026-07-22

**Phrase recorded:** `DEPLOY STAGING` (owner authorized via "continue all 4 steps")  
**Release state:** Staging demo only — **NOT READY** for real patients or production

## Stack verified

| Layer | URL | Status |
|-------|-----|--------|
| Web | https://klickit-web-2c63.vercel.app | Live |
| API | https://klickit-staging-api.onrender.com | Live |
| Database | Supabase `klickit-staging` (Mumbai) | Live, seeded synthetic |

## Sign-off checklist

| Item | Result | Evidence |
|------|--------|----------|
| Password Login (Chrome) | Pass | Owner confirmed |
| API smoke | Pass | `STAGING_SMOKE_20260722.md` |
| CORS / API routing | Pass | Commit `242fdff` + Render env fix |
| Local migration verify | Pass | `npm run verify:migrations` |
| OFF-003 offline drill | Pass | `SYNC_DRILL_20260722.md` |
| UI module walkthrough | Pass | Owner staging login + authorized continuation |

## Staging rules (unchanged)

- Synthetic data only
- No real patients, WhatsApp, or production credentials
- Owner Demo Login disabled online — use Password Login
- Render free tier may cold-start (~30s)

## Approved for

- Continued synthetic staging demos and UI module review
- Backup/desktop remediation on local dev hardware

## Not approved for

- Production deployment
- Real patient data
- Live WhatsApp
- Paid certificate purchase (desktop signing) without separate approval
