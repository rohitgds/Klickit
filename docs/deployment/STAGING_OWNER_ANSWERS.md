# Staging Owner Answers

**Recorded:** 2026-07-22  
**Owner:** Rohit (non-coder workflow)

| Question | Answer |
|----------|--------|
| Own a domain? | **No** — not yet |
| DNS manager | **N/A** until a domain is purchased |
| GitHub account | **Yes** — free; repo `rohitgds/Klickit` (personal) |
| Vercel account | **Yes** — free tier today |
| Supabase account | **Yes** — free tier today |
| GitHub org later? | **Yes** — when selling subscriptions to other clinics |
| Staging goal | **B — full synthetic clinic testing online** |
| Pabbly | **Yes** — paid |
| WhatsApp | **Test number only** — correct for staging |
| Cursor | **Pro** — sufficient; not a runtime dependency |

## Implications

- **No custom domain yet** — first staging can use a temporary `*.vercel.app` address. Domain purchase waits for `APPROVE PAID SUBSCRIPTION`.
- **Vercel Free → Pro likely required** — KlickIt is commercial software; Hobby/free is not for business use ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)). Budget **~$20/month**.
- **Option B needs a staging API host** — web on Vercel + a separate **staging demo API** (synthetic data only). This is **not** the real clinic LAN gateway exposed to the internet.
- **Supabase Free** can host one staging cloud project (synthetic only). Upgrade to Pro (~$25/mo) later if backups/no-pause are needed.
- **GitHub personal repo OK for now**; plan business organization before multi-customer subscriptions.

## Approved phrases still required

| Action | Phrase |
|--------|--------|
| Connect GitHub/Vercel/Supabase in Cursor | `APPROVE SERVICE CONNECTION` |
| Vercel Pro or domain purchase | `APPROVE PAID SUBSCRIPTION` |
| DNS records (when domain exists) | `APPROVE DNS CHANGE` |
| First staging deploy | `DEPLOY STAGING` |
| Production | `APPROVE PRODUCTION DEPLOYMENT` |
