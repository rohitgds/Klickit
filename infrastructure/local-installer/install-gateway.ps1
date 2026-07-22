param(
  [string]$GatewayRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "KlickIt\Gateway")
)

Write-Host "KlickIt gateway installer (local preview)"
Write-Host "Gateway root: $GatewayRoot"
Write-Host "Install root: $InstallRoot"

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
Copy-Item -Path (Join-Path $GatewayRoot "apps\gateway\package.json") -Destination (Join-Path $InstallRoot "package.json") -Force
Copy-Item -Path (Join-Path $GatewayRoot "docs\runbooks\gateway-recovery-drill.md") -Destination (Join-Path $InstallRoot "gateway-recovery-drill.md") -Force

Write-Host "Preview install complete. Run npm install and npm run dev from the repository for development."
