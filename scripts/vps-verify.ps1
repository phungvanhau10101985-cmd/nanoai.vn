# Kiểm tra health stack (nginx + pm2 + port 3000/3001)
param(
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot
Invoke-VpsSshCommand -RemoteCommand "bash $($env:VPS_APP_DIR)/deploy/verify-edge-stack.sh"
