# Xem PM2 logs NanoAI trên VPS
param(
  [int]$Lines = 100,
  [string]$App = 'thu-do-online',
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot
Invoke-VpsSshCommand -RemoteCommand "pm2 logs $App --lines $Lines"
