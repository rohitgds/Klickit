# KlickIt Portability Charter

## Goal

KlickIt must be rebuildable from zero, transferable between accounts, movable to another provider, sellable or handover-ready, operable without Cursor or a specific AI model, and recoverable from documented backups.

Portability applies to every layer:

- source control and CI/CD
- AI development tools and MCP connectors
- frontend and API hosting
- PostgreSQL database
- authentication, realtime and background jobs
- object/file storage
- monitoring and logs
- WhatsApp, SMS and email
- domains, DNS, secrets and environment configuration
- Windows desktop shell
- clinic gateway and local database
- installers, updates, hardware and operating-system assumptions
- documentation, intellectual property and third-party licenses

## Equal-priority rule

Every layer has equal portability priority.

This does not mean every transfer has identical effort. Authentication, WhatsApp number/templates, code-signing certificates and local gateway replacement may require more work than moving static files. Cursor must document actual difficulty and must never claim a one-click transfer when that is not true.

## Non-negotiable outcomes

KlickIt fails the portability requirement if:

- the build depends on Cursor chat memory;
- a personal account is the only owner of a production service;
- the application cannot be built from a clean clone;
- provider URLs are permanently stored as business data;
- important setup exists only in a provider dashboard;
- schema changes are not version-controlled;
- production cannot be restored outside the original account;
- source code cannot run without one AI or MCP tool;
- business data cannot be exported in documented formats;
- third-party licenses or ownership are unknown.

## Standard pattern

```text
KlickIt domain and UI
          |
Internal provider interfaces
          |
Provider adapters
          |
Current service implementation
```

Required boundaries include database, storage, auth, realtime, jobs, messaging, monitoring, deployment, desktop shell, local gateway and updater.

## Evidence before Rohini production approval

- clean rebuild from a disposable machine or VM
- database export and restore
- file export and restore
- Git repository recovery
- local gateway backup and restore
- environment and secret inventory
- account-transfer checklist
- provider-exit plan
- dependency and license report
- one non-production provider-exit rehearsal
- known lock-in register with approved risks
