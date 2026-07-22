# Vercel Hobby Staging Setup (click-by-click)

**Owner decision (2026-07-22):** Use **Vercel Hobby** for first deploy; upgrade to **Pro** when the app goes live (production).  
**Risk:** Hobby is officially non-commercial — owner accepts moving to Pro before real go-live.

**Branch to deploy:** `remediation/pilot-safety`  
**Data:** Synthetic only — **NOT READY** for real patients.

---

## Vercel project settings (use exactly)

| Setting | Value |
|---------|--------|
| Repository | `rohitgds/Klickit` |
| Branch | `remediation/pilot-safety` |
| Framework | Vite |
| Root Directory | `apps/web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `cd ../.. && npm ci` |

**Environment variable (add later when staging API exists):**

| Name | Purpose | Example (not a secret) |
|------|---------|------------------------|
| `VITE_API_BASE` | HTTPS URL of staging demo API | `https://your-staging-api.example.com` |

Leave unset for first deploy — pages load; login waits for API.

---

## Step 1 — Import project (do this first)

1. Open **https://vercel.com/new**
2. Sign in
3. Under **Import Git Repository**, find **`rohitgds/Klickit`**
4. Click **Import**

**Stop here.** Tell me **“import clicked”** or if GitHub is not listed.

---

## Step 2 — Configure (after Step 1)

1. Set **Root Directory** → **Edit** → type `apps/web` → **Continue**
2. Expand **Build and Output Settings**
3. Set **Install Command** to: `cd ../.. && npm ci`
4. Confirm **Build Command** = `npm run build`
5. Confirm **Output Directory** = `dist`
6. Do **not** add secrets in the UI yet
7. Click **Deploy**

---

## Step 3 — After deploy

1. Copy the `*.vercel.app` URL Vercel shows
2. Open it in browser — you should see KlickIt login page
3. Login will **fail until** staging API + `VITE_API_BASE` are configured — see **`STAGING_API_RUNBOOK.md`**

---

## Upgrade to Pro (before go-live)

When ready for production/commercial go-live:

1. Vercel → **Settings** → **Billing** → **Upgrade to Pro**
2. Budget ~**$20/user/month**

---

## Undo

Vercel dashboard → Project → **Settings** → **Delete Project** (does not delete GitHub repo).
