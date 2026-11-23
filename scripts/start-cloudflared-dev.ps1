#Requires -Version 5.1
<#
  Quick tunnel Cloudflare cho test dien thoai online (4G), tro vao cong dev cua repo nay.

  QR local doc hostname tu http://127.0.0.1:20241/metrics (userHostname).
  Tunnel dang song va metrics tra hostname thi giu nguyen — khong tao ten mien moi.
  Khong dung cloudflared forward cong 188-com-vn (8001/3001).

  Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-cloudflared-dev.ps1 -DevPort 3000
#>

param(
  [int]$DevPort = 3000,
  [int]$MetricsPort = 20241
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$Blocked188Ports = @(8001, 3001)
if ($Blocked188Ports -contains $DevPort) {
  Write-Host "      [LOI] Cong $DevPort la cong 188-com-vn. Khong mo tunnel Thu-do vao cong nay."
  exit 2
}

function Find-CloudflaredExe {
  $cmd = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return [string]$cmd.Source }
  $candidates = @(
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
    "$env:ProgramFiles\cloudflared\cloudflared.exe"
  )
  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) { return $path }
  }
  return $null
}

function Test-ForwardsPort([string]$CommandLine, [int]$Port) {
  if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $false }
  return $CommandLine -match ('(?i)--url\s+\S+:' + [regex]::Escape([string]$Port) + '(?!\d)')
}

function Read-MetricsOrigin([int]$Port) {
  try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/metrics" -TimeoutSec 2 -UseBasicParsing
  }
  catch {
    return $null
  }
  $hits = [regex]::Matches([string]$resp.Content, 'userHostname="([^"]+)"')
  foreach ($hit in $hits) {
    $raw = [string]$hit.Groups[1].Value
    $raw = $raw.Trim().TrimEnd('/')
    if ($raw -match '^https://') { return $raw }
  }
  foreach ($hit in $hits) {
    $raw = [string]$hit.Groups[1].Value
    $raw = $raw.Trim().TrimEnd('/')
    if (-not $raw) { continue }
    if ($raw -notmatch '^https?://') { $raw = "https://$raw" }
    return $raw
  }
  return $null
}

function Get-ListenPid([int]$Port) {
  $pattern = ':' + $Port + '\s+\S+\s+LISTENING\s+(\d+)\s*$'
  try {
    $lines = @(netstat.exe -ano -p tcp 2>$null)
  }
  catch {
    return 0
  }
  foreach ($line in $lines) {
    if ([string]$line -match $pattern) { return [int]$Matches[1] }
  }
  return 0
}

function Stop-CloudflaredTree([int]$ProcessId) {
  $killId = $ProcessId
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if ($proc -and [int]$proc.ParentProcessId -gt 0) {
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.ParentProcessId)" -ErrorAction SilentlyContinue
    $parentName = ''
    if ($parent) { $parentName = [string]$parent.Name }
    $parentCmd = ''
    if ($parent) { $parentCmd = [string]$parent.CommandLine }
    $parentIsLauncher = $parentName -eq 'cmd.exe' -and $parentCmd -match '(?i)start-cloudflared-dev-window\.cmd'
    if ($parentIsLauncher) { $killId = [int]$parent.ProcessId }
  }
  & taskkill.exe /F /T /PID $killId 2>$null | Out-Null
}

$exe = Find-CloudflaredExe
if (-not $exe) {
  Write-Host '      [LOI] Khong tim thay cloudflared.exe.'
  Write-Host '            Cai: winget install --id Cloudflare.cloudflared -e'
  exit 1
}

$cloudflared = @(Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" -ErrorAction SilentlyContinue)
$ours = @()
foreach ($proc in $cloudflared) {
  $command = [string]$proc.CommandLine
  $hits188 = $false
  foreach ($blocked in $Blocked188Ports) {
    if (Test-ForwardsPort $command $blocked) { $hits188 = $true }
  }
  if ($hits188) { continue }
  if (Test-ForwardsPort $command $DevPort) { $ours += $proc }
}

$origin = Read-MetricsOrigin $MetricsPort
if ($ours.Count -gt 0 -and $origin) {
  Write-Host "      Cloudflare dang chay: $origin"
  Write-Host '      Dien thoai 4G mo dia chi nay. Restart server khong doi ten mien.'
  exit 0
}

$metricsPid = Get-ListenPid $MetricsPort
$metricsOwnedByUs = $false
if ($metricsPid -gt 0) {
  foreach ($proc in $ours) {
    if ([int]$proc.ProcessId -eq $metricsPid) { $metricsOwnedByUs = $true }
  }
}
if ($metricsPid -gt 0 -and -not $metricsOwnedByUs -and $ours.Count -eq 0) {
  Write-Host "      [CANH BAO] Cong metrics $MetricsPort dang do PID $metricsPid giu, khong phai tunnel cong $DevPort."
  Write-Host '            Khong mo them cloudflared, de tranh de len tunnel khac.'
  exit 0
}

foreach ($proc in $ours) {
  Write-Host "      Dung cloudflared cu PID $($proc.ProcessId) (chua co hostname tren metrics $MetricsPort)."
  Stop-CloudflaredTree ([int]$proc.ProcessId)
}
if ($ours.Count -gt 0) { Start-Sleep -Seconds 1 }

$launcher = Join-Path $PSScriptRoot 'start-cloudflared-dev-window.cmd'
if (-not (Test-Path -LiteralPath $launcher)) {
  Write-Host "      [LOI] Thieu $launcher"
  exit 1
}
# cmd /k chi nhan phan trong ngoac kep. Ngoac kep doi de duong dan script van la mot lenh.
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $env:ComSpec
$psi.Arguments = "/k `"`"$launcher`" $DevPort $MetricsPort`""
$psi.UseShellExecute = $true
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
[void][System.Diagnostics.Process]::Start($psi)
Write-Host "      Dang mo Cloudflare Tunnel -> http://127.0.0.1:$DevPort"

$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Seconds 2
  $origin = Read-MetricsOrigin $MetricsPort
  if ($origin) {
    Write-Host "      Dien thoai online: $origin"
    exit 0
  }
} while ((Get-Date) -lt $deadline)

Write-Host '      [CANH BAO] Tunnel da mo nhung chua doc duoc hostname. Xem cua so Cloudflare Tunnel Thu-do.'
exit 0
