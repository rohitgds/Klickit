# KlickIt Desktop

Windows desktop shell for Phase 12.

## What exists now

- Tauri 2 scaffold in `src-tauri/`
- Shared browser fallback launcher in `src/shell.ts`
- Uses the same React frontend from `apps/web`

## Browser fallback

If Tauri APIs are not available (for example during ordinary web development), the shell reports `browser-fallback` and resolves the same local/cloud API base as the web app.

## Commands

```powershell
npm install
npm run dev --workspace @klickit/web
npm run dev --workspace @klickit/desktop
```

Full signed desktop builds and updater integration are scheduled for Rohini readiness phases.
