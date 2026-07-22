# KlickIt local gateway database backup (synthetic dev data only).
# Uses pg_dump from the local Supabase Docker container.

param(
  [string]$ContainerName = "supabase_db_klickit-local",
  [string]$OutputDir = (Join-Path $PSScriptRoot "..\..\artifacts\backups"),
  [string]$ClinicCode = "DEV",
  [string]$GatewayCode = "DEV-GW-01"
)

$ErrorActionPreference = "Stop"

function Exit-WithFailure {
  param([string]$Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit 1
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  $fallback = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path $fallback) {
    $docker = $fallback
  } else {
    Exit-WithFailure "Docker not found. Start Docker Desktop and retry."
  }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$dumpName = "klickit-$ClinicCode-$timestamp.dump"
$dumpPath = (Resolve-Path $OutputDir).Path
$dumpPath = Join-Path $dumpPath $dumpName
$manifestPath = "$dumpPath.manifest.json"
$remoteDump = "/tmp/klickit-backup.dump"

Write-Host "KlickIt backup (pg_dump custom format)" -ForegroundColor Cyan
Write-Host "Container: $ContainerName"
Write-Host "Output: $dumpPath"

& $docker exec $ContainerName pg_dump -U postgres -d postgres -Fc -n dentos_data -n dentos_runtime -f $remoteDump
if ($LASTEXITCODE -ne 0) {
  Exit-WithFailure "pg_dump failed. Is Supabase running? Try: npx supabase start"
}

& $docker cp "${ContainerName}:${remoteDump}" $dumpPath
if ($LASTEXITCODE -ne 0) {
  Exit-WithFailure "docker cp failed"
}

& $docker exec $ContainerName rm -f $remoteDump | Out-Null

$fileInfo = Get-Item $dumpPath
$hash = Get-FileHash -Path $dumpPath -Algorithm SHA256
$startedAt = Get-Date -Format o

$manifest = [ordered]@{
  product       = "KlickIt"
  clinicCode    = $ClinicCode
  gatewayCode   = $GatewayCode
  createdAt     = $startedAt
  artifactPath  = $dumpPath
  format        = "pg_dump-custom"
  fileSizeBytes = $fileInfo.Length
  sha256        = $hash.Hash.ToLowerInvariant()
  schemas       = @("dentos_data", "dentos_runtime")
  note          = "Synthetic local backup only. Register via POST /resilience/backup/run when gateway is running."
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Backup complete." -ForegroundColor Green
Write-Host "  dump: $dumpPath"
Write-Host "  manifest: $manifestPath"
Write-Host "  sha256: $($hash.Hash.ToLowerInvariant())"
Write-Host "  size bytes: $($fileInfo.Length)"
