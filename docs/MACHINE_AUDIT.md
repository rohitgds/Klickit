# Machine Audit

Read-only audit captured during first-run discovery. No secrets recorded.

| Field | Value |
|---|---|
| Audit date | 2026-07-21 |
| Audited by | Cursor Agent (first-run discovery) |
| Machine role | Development laptop; clinic gateway will be simulated here first |

## Operating system

| Item | Result |
|---|---|
| OS | Microsoft Windows 11 Pro |
| Version | 10.0.26200 |
| Build | 26200 |
| PowerShell | 5.1.26100.8894 |

## Hardware

| Item | Result | KlickIt need |
|---|---|---|
| CPU | Intel Core i7-10850H @ 2.70 GHz | Sufficient for development and gateway simulation |
| RAM | 31.8 GB | Sufficient |
| C: drive free | 72.9 GB | Sufficient for initial development; monitor Docker/Rust disk use |
| C: drive used | 879.6 GB | — |
| Virtualization | HypervisorPresent = True | Good for WSL 2 / Docker |

## Virtualization and WSL

| Item | Result |
|---|---|
| WSL default distribution | Ubuntu |
| WSL default version | 2 |
| WSL version | 2.6.3.0 |
| Notes | WSL 2 is present. Docker Desktop is not installed yet. |

## Installed development tools

| Tool | Status | Version / path |
|---|---|---|
| Git | Installed | 2.53.0.windows.2 — `C:\Program Files\Git\cmd\git.exe` |
| Node.js | Installed | v24.16.0 — `C:\Program Files\nodejs\node.exe` |
| npm | Installed | 11.13.0 |
| Docker Desktop | Not found | Required later for local Supabase stack |
| Rust / Cargo | Not found | Required later for Tauri desktop build |
| Microsoft C++ Build Tools | Not detected | Required later for Tauri on Windows |
| WebView2 Runtime | Installed | 150.0.4078.83 |
| Supabase CLI | Not checked separately | Install in Phase 4/7 |
| GitHub CLI | Not checked separately | Optional |
| Vercel CLI | Not checked separately | Later phase |
| Cursor CLI | Not in PATH | Cursor IDE is in use; CLI optional |

## Browsers

| Browser | Status |
|---|---|
| Google Chrome | Installed — `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Microsoft Edge | Installed — `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| Mozilla Firefox | Installed — `C:\Program Files\Mozilla Firefox\firefox.exe` |

## Cursor and MCP

| Item | Result |
|---|---|
| Cursor IDE | Active in this session |
| Cursor subscription | Not verified programmatically; user indicated likely Cursor Pro |
| MCP servers currently available | Cursor app control, Cursor IDE browser |
| GitHub MCP | Not installed |
| Supabase MCP | Not installed |
| Vercel MCP | Not installed |
| Playwright MCP | Not installed |

Manual approval for MCP tool calls should remain enabled.

## Git repository

| Item | Result |
|---|---|
| Local Git repository | Not initialized yet |
| Planned action | Phase 6 — initialize Git and guide private GitHub repository creation |

## Readiness summary

### Ready now

- Windows 11 Pro with enough RAM and free disk for initial work
- Git, Node.js, npm, WebView2, WSL 2, and common browsers
- Full starter pack with verified blueprint originals

### Needed before Milestone 1 can complete

- Docker Desktop + WSL 2 integration (administrator approval may be required)
- Rust toolchain and Tauri prerequisites
- Microsoft C++ Build Tools (administrator approval required)
- Local Git initialization and private GitHub repository
- Cursor Pro subscription if not already active

### Not needed until later milestones

- Supabase hosted project connection
- Vercel preview deployment
- Pabbly / WhatsApp test connection
- Code-signing certificate
- Custom domain
- Clinic mini-PC hardware

## Risks from this audit

| Risk | Notes |
|---|---|
| Node 24 vs LTS | Project should pin a supported LTS version in Phase 4; Node 24 may work but LTS is safer for long-term portability |
| No Docker yet | Blocks local Supabase in Phase 7 |
| No Rust yet | Blocks Tauri desktop in Phase 12 |
| No Git repo yet | Blocks Phase 6 and all versioned implementation |
| OneDrive project path | Acceptable for starter pack; consider a non-synced dev path if file-lock issues appear during Docker/Rust builds |

## Next safe action

Obtain user approval for Phase 4 toolchain installation before running administrator installs or enabling new MCP connectors.
