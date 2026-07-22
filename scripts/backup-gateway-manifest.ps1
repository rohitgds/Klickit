# Write a gateway backup manifest without exporting secrets.

param(
  [string]$GatewayUrl = "http://127.0.0.1:8787",
  [string]$OutputPath = "./artifacts/gateway-backup-manifest.json"
)

New-Item -ItemType Directory -Force -Path (Split-Path $OutputPath) | Out-Null
$response = Invoke-RestMethod -Uri "$GatewayUrl/resilience/backup/manifest" -Method Get
$response | ConvertTo-Json -Depth 6 | Set-Content -Path $OutputPath -Encoding UTF8
Write-Host "Backup manifest written to $OutputPath"
