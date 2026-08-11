# Mở SSH shell vào VPS (dùng key nếu đã cài, không thì nhập password từ .env.local.server).
param(
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot

$target = Get-VpsSshTarget
Write-Host "Connecting: ssh -p $env:VPS_PORT $target" -ForegroundColor Cyan
Write-Host "Password stored in .env.local.server (VPS_PASSWORD)" -ForegroundColor DarkGray

& ssh -p $env:VPS_PORT $target
