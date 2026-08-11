# Deploy Thu-do-online trên VPS: git pull + deploy/update-vps.sh
param(
  [string]$Branch = 'main',
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot

$remote = @"
set -e
cd '$($env:VPS_APP_DIR)'
git fetch origin
git checkout '$Branch'
git pull origin '$Branch'
bash deploy/update-vps.sh '$Branch'
"@

Write-Host "Deploying on VPS ($($env:VPS_HOST)) branch=$Branch ..." -ForegroundColor Cyan
Invoke-VpsSshCommand -RemoteCommand $remote
