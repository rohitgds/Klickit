# KlickIt OFF-003 drill helper - simulates 72-hour offline read-only policy (synthetic only).
# Requires: gateway running locally, Docker/Supabase optional for PG-backed gateway.

param(
  [string]$GatewayUrl = "http://127.0.0.1:8787"
)

$ErrorActionPreference = "Stop"

Write-Host "KlickIt offline read-only drill (OFF-003)" -ForegroundColor Cyan
Write-Host "Gateway: $GatewayUrl"
Write-Host ""

Write-Host "Step 1: Enter read-only mode via gateway endpoint..."
try {
  $enter = Invoke-RestMethod -Method Post -Uri "$GatewayUrl/sync/offline/enter-read-only" -ContentType "application/json" -Body "{}"
  Write-Host "  readOnly: $($enter.readOnly)"
} catch {
  Write-Host "  FAILED: $_" -ForegroundColor Red
  exit 1
}

Write-Host "Step 2: Attempt push while read-only (expect HTTP 403)..."
try {
  $body = @{
    gatewayId = "44444444-4444-4444-8444-444444444444"
    clinicId  = "22222222-2222-4222-8222-222222222222"
    events    = @()
  } | ConvertTo-Json -Depth 5

  Invoke-RestMethod -Method Post -Uri "$GatewayUrl/sync/push" -Body $body -ContentType "application/json" | Out-Null
  Write-Host "  FAILED: push succeeded but should be blocked" -ForegroundColor Red
  exit 1
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 403) {
    Write-Host "  OK: push rejected with 403" -ForegroundColor Green
  } else {
    Write-Host "  FAILED: unexpected error $_" -ForegroundColor Red
    exit 1
  }
}

Write-Host "Step 3: Fetch sync status summary..."
try {
  $status = Invoke-RestMethod -Method Get -Uri "$GatewayUrl/sync/status"
  Write-Host "  pendingOutbox: $($status.pendingOutbox)"
  Write-Host "  readOnly: $($status.offlinePolicy.readOnly)"
} catch {
  Write-Host "  WARN: /sync/status unavailable - $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Record results in docs/remediation/evidence/SYNC_DRILL_YYYYMMDD.md" -ForegroundColor Cyan
