param(
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\..\artifacts\gateway-backup.sql")
)

$artifactDir = Split-Path $OutputPath -Parent
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

@"
-- KlickIt synthetic backup artifact
-- Generated $(Get-Date -Format o)
SELECT 'klickit-backup-preview';
"@ | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host "Wrote backup artifact to $OutputPath"
Write-Host "Record this path through POST /resilience/backup/run in development."
