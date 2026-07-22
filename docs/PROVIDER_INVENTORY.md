# Provider and Platform Inventory

Never record secret values here.

| Capability | Current provider | Provider-neutral boundary | Replacement candidates | Business owner | Export method | Restore/import | Known lock-in | Status |
|---|---|---|---|---|---|---|---|---|
| AI coding | Cursor | Repository files, scripts, AGENTS/rules | Other IDEs/agents | Owner | Git clone + docs | Open in another IDE | Cursor commands optional only | Planned |
| Source control | GitHub | Standard Git | GitLab, Bitbucket, self-hosted Git | Owner | Git mirror/bundle | Push/restore mirror | Actions syntax | Planned |
| CI/CD | GitHub Actions | Repository scripts | GitLab CI, Jenkins, Azure | Owner | Workflows + scripts | Recreate runner | Workflow syntax | Planned |
| Web hosting | Vercel | Static build/container | Cloudflare, Netlify, AWS, VPS | Owner | Build artifacts/config | Deploy same artifact | Vercel-specific runtime | Planned |
| Database | Supabase Postgres | PostgreSQL 16+ | RDS, Cloud SQL, Neon, self-hosted | Owner | pg_dump + migrations | pg_restore/psql | Extensions/auth | Defined |
| File storage | Supabase Storage | ObjectStorageProvider | S3, R2, B2, MinIO | Owner | API/S3 copy + manifest | Bulk upload + hash verify | Metadata/policies | Defined |
| Authentication | Supabase Auth initially | AuthProvider | Keycloak, Auth0, Cognito, custom | Owner | Provider-supported export | Provider-specific import | Passwords/sessions | Defined |
| Realtime | Supabase Realtime initially | RealtimeProvider | SSE/WebSocket, Ably, Pusher | Owner | Event/config contracts | New adapter | Provider semantics | Defined |
| Jobs | PostgreSQL queue | JobQueueProvider | Graphile, pg-boss, managed queues | Owner | DB/config export | Worker adapter | Job semantics | Defined |
| WhatsApp inbox | Pabbly Chatflow | MessagingProvider | Meta Cloud API/BSP alternatives | Owner | Provider export/API | Provider-specific | Number/templates/history | Defined |
| Automation | Pabbly Connect | Integration adapter | n8n, Make, custom workers | Owner | Workflow inventory | Rebuild documented flow | Proprietary workflow | Planned |
| Desktop shell | Tauri | DesktopShellProvider | Electron, PWA, native shell | Owner | Source/config | Build alternate shell | Native plugins | Defined |
| Local gateway | Windows service | LocalGatewayRuntime | Linux service/container/appliance | Owner | DB/files/config backup | Installer + restore | OS/service manager | Defined |
| Monitoring | To be selected | MonitoringProvider/OpenTelemetry | Sentry, Grafana, Datadog | Owner | Logs/config | New backend | Dashboard-only rules | Defined |
| Domain/DNS | Deferred | DNS record inventory | Any registrar/DNS host | Owner | Zone export | Zone import | Transfer restrictions | Deferred |
| Code signing | Deferred | Certificate inventory | Alternative CA | Owner | If exportable | Reissue/import | Non-exportable keys | Deferred |
