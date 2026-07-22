$ErrorActionPreference = "Continue"

Write-Host "KlickIt toolchain verification" -ForegroundColor Cyan

$required = @(
  @{ Name = "git"; Min = "2.40" },
  @{ Name = "node"; Min = "22" },
  @{ Name = "npm"; Min = "10" },
  @{ Name = "docker"; Min = "24" },
  @{ Name = "rustc"; Min = "1.77" },
  @{ Name = "cargo"; Min = "1.77" }
)

$fail = 0

foreach ($tool in $required) {
  $cmd = Get-Command $tool.Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host "MISSING $($tool.Name)"
    $fail++
    continue
  }
  try {
    $versionOutput = & $tool.Name --version 2>&1 | Select-Object -First 1
    Write-Host "OK $($tool.Name): $versionOutput"
  } catch {
    Write-Host "WARN $($tool.Name): installed but version unreadable"
  }
}

$wv2 = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
if ($wv2) {
  Write-Host "OK webview2: $($wv2.pv)"
} else {
  Write-Host "WARN webview2: registry entry not found"
}

if ($fail -gt 0) {
  Write-Host "Toolchain incomplete: $fail missing tool(s)." -ForegroundColor Yellow
  exit 1
}

Write-Host "Toolchain verification passed." -ForegroundColor Green
exit 0
