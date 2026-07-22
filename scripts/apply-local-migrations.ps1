# Apply KlickIt migrations to a local PostgreSQL database (clinic gateway or dev).

param(
  [string]$DatabaseUrl = $env:GATEWAY_DATABASE_URL
)

if (-not $DatabaseUrl) {
  $DatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
}

Write-Host "Applying migrations to local PostgreSQL..."
Write-Host "Database URL name only: $($DatabaseUrl.Split('@')[-1])"

$env:GATEWAY_DATABASE_URL = $DatabaseUrl
node --import tsx ./apps/gateway/src/scripts/apply-migrations.ts

if ($LASTEXITCODE -ne 0) {
  throw "Local migration apply failed."
}

Write-Host "Local migrations applied successfully."
