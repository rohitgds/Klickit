# KlickIt restore drill — restores backup into a temporary database and verifies row counts.
# Synthetic dev data only. Never run against production.

param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,
  [string]$ContainerName = "supabase_db_klickit-local",
  [string]$TempDatabase = "klickit_restore_drill",
  [int]$MinPermissions = 88
)

$ErrorActionPreference = "Stop"

function Exit-WithFailure {
  param([string]$Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $ManifestPath)) {
  Exit-WithFailure "Manifest not found: $ManifestPath"
}

$manifest = Get-Content -Path $ManifestPath -Raw | ConvertFrom-Json
$dumpPath = $manifest.artifactPath
if (-not (Test-Path $dumpPath)) {
  Exit-WithFailure "Backup dump not found: $dumpPath"
}

$onDiskHash = (Get-FileHash -Path $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($onDiskHash -ne $manifest.sha256) {
  Exit-WithFailure "SHA256 mismatch. Manifest=$($manifest.sha256) file=$onDiskHash"
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  $fallback = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path $fallback) {
    $docker = $fallback
  } else {
    Exit-WithFailure "Docker not found."
  }
}

$remoteDump = "/tmp/klickit-restore-drill.dump"

Write-Host "KlickIt restore drill (BCP-001 preview)" -ForegroundColor Cyan
Write-Host "Manifest: $ManifestPath"
Write-Host "Temp database: $TempDatabase"

& $docker cp $dumpPath "${ContainerName}:${remoteDump}"
if ($LASTEXITCODE -ne 0) {
  Exit-WithFailure "docker cp to container failed"
}

& $docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $TempDatabase;"
& $docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $TempDatabase;"
if ($LASTEXITCODE -ne 0) {
  Exit-WithFailure "Failed to create temp database $TempDatabase"
}

& $docker exec $ContainerName pg_restore -U postgres -d $TempDatabase --no-owner --no-acl $remoteDump
if ($LASTEXITCODE -ne 0) {
  Write-Host "WARN: pg_restore returned nonzero (often safe for extension warnings)" -ForegroundColor Yellow
}

$permissionCount = (& $docker exec $ContainerName psql -U postgres -d $TempDatabase -tAc "select count(*) from dentos_data.permissions;").Trim()
$syncTableCount = (& $docker exec $ContainerName psql -U postgres -d $TempDatabase -tAc "select count(*) from information_schema.tables where table_schema = 'dentos_runtime' and table_name like 'sync_%';").Trim()

& $docker exec $ContainerName psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $TempDatabase;" | Out-Null
& $docker exec $ContainerName rm -f $remoteDump | Out-Null

if ([int]$permissionCount -lt $MinPermissions) {
  Exit-WithFailure "Expected at least $MinPermissions permissions after restore, found $permissionCount"
}
if ([int]$syncTableCount -lt 4) {
  Exit-WithFailure "Expected at least 4 sync_* tables after restore, found $syncTableCount"
}

Write-Host "Restore drill passed." -ForegroundColor Green
Write-Host "  sha256 verified: $($manifest.sha256)"
Write-Host "  permissions: $permissionCount"
Write-Host "  sync tables: $syncTableCount"
Write-Host "Record results in docs/remediation/evidence/BACKUP_DRILL_20260722.md"
