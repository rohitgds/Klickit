# KlickIt Architecture

Frozen during Phase 8. Blueprint 10 overrides Blueprint 05 cloud-only topology for KlickIt delivery.

## Product components

| Component | Code location | Runs on | Purpose |
|---|---|---|---|
| KlickIt Web | `apps/web` | Browser / Vercel static host | Shared React UI |
| KlickIt Windows Desktop | `apps/desktop` | Windows workstation | Tauri shell (Phase 12) |
| KlickIt Clinic Gateway | `apps/gateway` | Clinic Windows mini-PC / dev laptop simulation | Local API + local PostgreSQL + sync edge |
| Cloud system of record | `supabase/` + cloud project later | Supabase | Multi-clinic authoritative store |
| Communications | provider adapter | Pabbly + KlickIt metadata | WhatsApp automations and inbox links |

## Runtime modes

```text
cloud-online   -> browser talks to cloud when gateway unavailable but internet works
clinic-lan     -> browser/desktop talks to local gateway while cloud also reachable
clinic-offline -> browser/desktop talks to local gateway with no cloud connectivity
```

After 72 hours without successful cloud sync, clinic mode becomes read-only. No routine admin bypass.

## Layering

```text
UI (web/desktop)
  -> application/domain commands
    -> provider adapters (`packages/providers`)
      -> current implementations (Supabase, Pabbly, Tauri, Windows service)
```

Domain modules live in `@klickit/domain`. Business UI must not call provider SDKs directly except through adapters wired by server/gateway composition roots.

## Domain modules

Modules own tables and command handlers. Cross-module writes happen inside one transaction or through outbox events after commit. See `@klickit/domain` for the frozen module registry.

Pilot exclusions remain frozen: inventory, laboratory, advanced analytics catalog, patient portal, native mobile, full in-app WhatsApp helpdesk.

## Sync rules

- Application-level transactional outbox/inbox
- Idempotent commands with explicit conflict handling
- No unsupervised last-write-wins
- Posted clinical and financial records are never silently overwritten

## Code map

| Package/App | Boundary |
|---|---|
| `packages/shared` | Product constants and cross-cutting primitives |
| `packages/domain` | Architecture and module boundaries |
| `packages/providers` | Provider-neutral adapter interfaces |
| `apps/gateway` | Clinic edge API composition root |
| `apps/web` | Frontend shell and route hosting |
| `supabase/migrations` | Version-controlled PostgreSQL schema |

## Evidence

- Registry code: `packages/domain/src/boundaries.ts`
- Provider interfaces: `packages/providers/src/interfaces.ts`
- Gateway architecture endpoint: `GET /architecture`
