$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "blueprints\manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

foreach ($item in $manifest) {
  $path = Join-Path $root ($item.file -replace "/", "\")
  if (-not (Test-Path $path)) {
    Write-Error "Missing blueprint: $($item.file)"
  }
  $hash = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
  if ($hash -ne $item.sha256.ToLower()) {
    Write-Error "Hash mismatch: $($item.file)"
  }
  Write-Host "OK $($item.file)"
}
