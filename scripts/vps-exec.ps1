# Chạy một lệnh trên VPS. Ví dụ:
#   powershell -File scripts/vps-exec.ps1 "pm2 status"
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Command,
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot
Invoke-VpsSshCommand -RemoteCommand $Command
