# KlickIt Toolchain

Provider-neutral development tools for a clean rebuild. Cursor is optional; these tools are the real build boundary.

## Pinned targets

| Tool | Target | Why |
|---|---|---|
| Git | 2.40+ | Standard source control |
| Node.js | 24 LTS channel via winget | Shared frontend, Fastify API, tooling |
| npm | Bundled with Node | Package management |
| Docker Desktop + WSL 2 | Current stable | Local Supabase stack |
| Rust / Cargo | Stable via rustup | Tauri desktop shell |
| Microsoft C++ Build Tools | VS 2022 Build Tools | Windows native build for Tauri |
| WebView2 Runtime | Current stable | Tauri runtime on Windows |

Project pin file: `.node-version` (major 24).

## Verify

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-toolchain.ps1
```

## Install commands (Windows)

Run these only after explicit approval. Administrator approval is required for Docker Desktop and C++ Build Tools.

```powershell
winget install --id Rustlang.Rustup -e --accept-package-agreements --accept-source-agreements
winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements
```

After Rustup installs, open a **new** terminal and run:

```powershell
rustup default stable
rustup target add x86_64-pc-windows-msvc
```

For Node 22 LTS if the machine still has Node 24 only:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
```

Then reopen the terminal and confirm:

```powershell
node --version
```

## Notes

- Keep installs documented here rather than only in vendor dashboards.
- Do not store secrets in this file.
- Replace any tool through the same documented commands on a clean machine.
