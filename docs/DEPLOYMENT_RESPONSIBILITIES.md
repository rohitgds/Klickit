# Deployment Responsibilities

Frozen during Phase 8. Important configuration must live in Git scripts and docs, not only in provider dashboards.

## By environment

| Concern | Local development | Staging / preview | Production |
|---|---|---|---|
| Web UI | `npm run dev --workspace @klickit/web` | Vercel preview | Vercel production after Rohini approval |
| Gateway API | `npm run dev --workspace @klickit/gateway` | Simulated on approved test machine | Clinic mini-PC Windows service |
| Database | `npx supabase start` / local PostgreSQL | Supabase staging project | Supabase production after approval |
| Object storage | Local Supabase storage | Supabase staging bucket | Supabase/cloud bucket after approval |
| Auth | Local Supabase auth | Staging auth project | Production auth after approval |
| CI/CD | GitHub Actions on push | Same | Same |
| WhatsApp | Disabled / stub adapter | Approved test numbers only | Live Pabbly after pilot approval |
| Secrets | Untracked `.env.local` | Provider secret stores | Provider secret stores + business recovery admins |

## By component owner

| Component | Build owner | Runtime owner | Backup owner |
|---|---|---|---|
| Git repository | Developer via Git | GitHub initially | Owner via Git mirror/bundle |
| Web frontend | GitHub Actions / local npm | Vercel | Redeploy from Git artifact |
| Gateway service | GitHub Actions / local npm | Clinic hardware | Gateway DB/files backup runbook |
| Cloud database | Supabase migrations in Git | Supabase account | pg_dump + PITR per plan |
| Desktop installer | GitHub Actions release workflow | Clinic workstations | Previous signed/unsigned build retained |
| Pabbly workflows | Documented in repo | Pabbly account | Export/inventory + rebuild plan |

## Forbidden shortcuts

- Browser direct SQL access
- Cloud-only operation without clinic gateway for pilot topology
- Provider URLs stored as permanent business identifiers
- Hidden production setup existing only in dashboards without repo documentation

## Replacement rule

Every row above must remain movable using `docs/PROVIDER_EXIT_PLAN.md` and `docs/PROVIDER_INVENTORY.md`.
