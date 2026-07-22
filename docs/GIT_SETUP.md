# Git and GitHub Setup

Phase 6 foundation for provider-neutral source control.

## Local Git

Local repository initialized on `main`. Standard Git remains the boundary; GitHub is the first remote provider only.

## Branch model

| Branch | Purpose |
|---|---|
| `main` | Stable approved milestones |
| `develop` | Integration branch for completed phases |
| `feature/*` | Individual phase or feature work |
| `release/*` | Milestone release candidates |
| `hotfix/*` | Urgent fixes |

## Create the private GitHub repository (owner action)

Do this once, using browser login. Do not paste passwords or tokens into Cursor chat.

1. Open [https://github.com/new](https://github.com/new)
2. Repository name: `klickit` (or your preferred private name)
3. Visibility: **Private**
4. Do **not** add README, `.gitignore`, or license (this project already has them)
5. Click **Create repository**
6. Copy the HTTPS URL shown, for example `https://github.com/YOUR-USERNAME/klickit.git`

Then tell Cursor the repository URL. Cursor can connect the local repo with:

```powershell
git remote add origin YOUR-REPO-URL
git push -u origin main
git push -u origin develop
```

Push only happens after milestone approval and when you explicitly agree.

## Secret protection

- Real secrets stay in untracked `.env.local`
- Deployment secrets stay in GitHub/Supabase/Vercel secret stores
- Never commit `.env`, dumps, backups, patient files, or credentials

## Git recovery without GitHub

To export a portable bundle:

```powershell
git bundle create klickit-backup.bundle --all
```

Restore elsewhere with:

```powershell
git clone klickit-backup.bundle klickit-restored
```

## Status

- Local Git: initialized
- Remote GitHub: waiting for owner repository URL and login approval
