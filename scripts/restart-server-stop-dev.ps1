#Requires -Version 5.1
<#
  Stop dev processes for Thu-do-online only (does not affect 188-com-vn 8001/3001).

  Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restart-server-stop-dev.ps1
    powershell ... -File scripts/restart-server-stop-dev.ps1 -DevPort 3000 -ProjectRoot "E:\python-code\Thu-do-online"
#>

param(
  [int]$DevPort = 3000,
  [string]$ProjectRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

# CMD often passes -ProjectRoot "E:\path\" — trailing \ escapes the closing quote,
# so PowerShell receives a path ending with a literal " and Resolve-Path fails.
$ProjectRoot = $ProjectRoot.Trim().Trim('"').TrimEnd('\', '/')

try {
  $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
}
catch {
  Write-Error "ProjectRoot not found: $ProjectRoot"
  exit 1
}

$Blocked188Ports = @(8001, 3001)

if ($Blocked188Ports -contains $DevPort) {
  Write-Error "[restart-server] DEV_PORT=$DevPort overlaps 188-com-vn ports ($($Blocked188Ports -join ', ')). Change PORT in .env.local."
  exit 2
}

function Normalize-PathForMatch([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
  try { $x = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path }
  catch { $x = $Path }
  return ($x.TrimEnd('\', '/')).Replace('\', '/').ToLowerInvariant()
}

function Stop-ProcessesListeningOnPort {
  param([int]$Port)
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq 'Listen' }
    $procIds = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($procId in $procIds) {
      if ($procId -gt 0) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped LISTEN on port $Port (PID $procId)"
      }
    }
  }
  catch {
    Write-Host "  [warn] Kill port $Port : $($_.Exception.Message)"
  }
}

function Stop-NgrokForwardingLocalPort {
  param([int]$LocalPort)
  try {
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'ngrok.exe'" -ErrorAction SilentlyContinue
  }
  catch { return }
  if (-not $procs) { return }
  $esc = [regex]::Escape([string]$LocalPort)
  $rx = "(?i)\s$esc(?:\s|$|[`"])"
  foreach ($p in @($procs)) {
    $cmd = [string]$p.CommandLine
    if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
    if ($cmd -notmatch $rx) { continue }
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      Write-Host "  Stopped ngrok.exe PID $($p.ProcessId) (forward localhost:$LocalPort)"
    }
    catch {
      Write-Host "  [warn] Could not stop ngrok PID $($p.ProcessId)"
    }
  }
}

function Stop-NodeProcessesForDirectory {
  param([string]$Dir)
  if (-not (Test-Path -LiteralPath $Dir)) { return }
  $needle = Normalize-PathForMatch $Dir
  if (-not $needle) { return }
  try { $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue }
  catch { return }
  foreach ($p in @($procs)) {
    $cmd = ([string]$p.CommandLine).Replace('\', '/').ToLowerInvariant()
    if (-not $cmd -or $cmd -notlike "*$needle*") { continue }
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      Write-Host "  Stopped node.exe PID $($p.ProcessId) (Thu-do-online)"
    }
    catch { }
  }
}

function Stop-EsbuildForDirectory {
  param([string]$Dir)
  $needle = Normalize-PathForMatch $Dir
  if (-not $needle) { return }
  try { $procs = Get-CimInstance Win32_Process -Filter "Name = 'esbuild.exe'" -ErrorAction SilentlyContinue }
  catch { return }
  foreach ($p in @($procs)) {
    $cmd = ([string]$p.CommandLine).Replace('\', '/').ToLowerInvariant()
    if (-not $cmd -or $cmd -notlike "*$needle*") { continue }
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      Write-Host "  Stopped esbuild.exe PID $($p.ProcessId) (Thu-do-online)"
    }
    catch { }
  }
}

Write-Host "[restart-server] Thu-do-online only - port $DevPort (188-com-vn 8001/3001 untouched)"

Stop-ProcessesListeningOnPort -Port $DevPort
Stop-NgrokForwardingLocalPort -LocalPort $DevPort
Stop-NodeProcessesForDirectory -Dir $ProjectRoot
Stop-EsbuildForDirectory -Dir $ProjectRoot

foreach ($title in @('Next.js Dev Server', 'Worksheet Worker', "NGROK Thu-do $DevPort")) {
  $null = & taskkill.exe /F /FI "WINDOWTITLE eq $title*" 2>$null
}

exit 0
