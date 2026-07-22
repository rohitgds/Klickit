# KlickIt migration verification — fails with nonzero exit on any error.
# Used by: npm run verify:migrations
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Exit-WithFailure {
  param(
    [int]$Code,
    [string]$Message
  )
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit $Code
}

function Invoke-External {
  param(
    [string]$Label,
    [scriptblock]$Command
  )
  Write-Host "RUN: $Label" -ForegroundColor Cyan
  & $Command
  $exitCode = $LASTEXITCODE
  if ($null -eq $exitCode) {
    $exitCode = 0
  }
  if ($exitCode -ne 0) {
    Exit-WithFailure -Code $exitCode -Message "$Label failed (exit $exitCode)"
  }
}

function Invoke-DockerSql {
  param(
    [string]$Sql,
    [string]$ContainerName = "supabase_db_klickit-local"
  )
  Write-Host "CHECK: $Sql"
  $output = docker exec $ContainerName psql -U postgres -d postgres -tAc $Sql 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Write-Host $output
    Exit-WithFailure -Code $exitCode -Message "Docker psql failed for container '$ContainerName'. Is Docker running and has 'npx supabase start' been executed?"
  }
  return ($output | Out-String).Trim()
}

Write-Host "KlickIt migration verification" -ForegroundColor Cyan

Push-Location $root
try {
  Invoke-External -Label "docker info" -Command { docker info | Out-Null }

  Invoke-External -Label "npm run compile:migrations" -Command { npm run compile:migrations | Out-Host }

  Invoke-External -Label "npx supabase db reset" -Command { npx supabase db reset | Out-Host }

  $permissionCount = [int](Invoke-DockerSql -Sql "select count(*) from dentos_data.permissions;")
  $syncTableCount = [int](Invoke-DockerSql -Sql "select count(*) from information_schema.tables where table_schema = 'dentos_runtime' and table_name like 'sync_%';")
  $identityTableCount = [int](Invoke-DockerSql -Sql "select count(*) from information_schema.tables where table_schema = 'dentos_data' and table_name in ('organizations','users','permissions');")

  if ($permissionCount -lt 88) {
    Exit-WithFailure -Code 1 -Message "Expected at least 88 permissions, found $permissionCount"
  }
  if ($syncTableCount -lt 4) {
    Exit-WithFailure -Code 1 -Message "Expected at least 4 sync_* runtime tables, found $syncTableCount"
  }
  if ($identityTableCount -ne 3) {
    Exit-WithFailure -Code 1 -Message "Expected 3 identity tables (organizations, users, permissions), found $identityTableCount"
  }

  Write-Host "Migration verification passed." -ForegroundColor Green
  Write-Host "  permissions: $permissionCount"
  Write-Host "  sync tables: $syncTableCount"
  Write-Host "  identity tables: $identityTableCount"
  exit 0
}
catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
finally {
  Pop-Location
}
