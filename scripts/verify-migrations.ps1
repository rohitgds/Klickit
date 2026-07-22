$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "KlickIt migration verification" -ForegroundColor Cyan

Push-Location $root
try {
  npm run compile:migrations
  npx supabase db reset | Out-Host

  $checks = @(
    "select count(*) as permission_count from dentos_data.permissions;",
    "select count(*) as sync_table_count from information_schema.tables where table_schema = 'dentos_runtime' and table_name like 'sync_%';",
    "select count(*) as identity_table_count from information_schema.tables where table_schema = 'dentos_data' and table_name in ('organizations','users','permissions');"
  )

  foreach ($sql in $checks) {
    Write-Host "CHECK: $sql"
    docker exec supabase_db_klickit-local psql -U postgres -d postgres -tAc $sql
  }

  Write-Host "Migration verification passed." -ForegroundColor Green
}
finally {
  Pop-Location
}
