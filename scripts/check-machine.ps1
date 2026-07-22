$ErrorActionPreference = "Continue"

Write-Host "KlickIt machine audit (read-only)" -ForegroundColor Cyan
Write-Host "Windows:" (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "Version:" (Get-CimInstance Win32_OperatingSystem).Version
Write-Host "CPU:" (Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)
$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Write-Host "RAM GB:" $ram
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N="FreeGB";E={[math]::Round($_.Free/1GB,1)}}, @{N="UsedGB";E={[math]::Round($_.Used/1GB,1)}}

$commands = @("git", "node", "npm", "docker", "wsl", "rustc", "cargo")
foreach ($cmd in $commands) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($found) {
    Write-Host "$cmd found:" $found.Source
    try { & $cmd --version } catch { Write-Host "Unable to read $cmd version." }
  } else {
    Write-Host "$cmd not found"
  }
}
