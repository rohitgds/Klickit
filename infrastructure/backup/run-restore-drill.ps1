param(
  [string]$BackupPath = (Join-Path $PSScriptRoot "..\..\artifacts\gateway-backup.sql")
)

if (-not (Test-Path $BackupPath)) {
  throw "Backup artifact not found at $BackupPath. Run run-backup.ps1 first."
}

Write-Host "Restore drill preview using $BackupPath"
Write-Host "Compare restored checksum with the recorded backup run before marking drill passed."
