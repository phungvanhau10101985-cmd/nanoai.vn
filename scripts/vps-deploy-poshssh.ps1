# Deploy via Posh-SSH when plink/SSH key unavailable (uses VPS_PASSWORD from .env.local.server)
param(
  [string]$Branch = 'main',
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot

if (-not (Get-Module -ListAvailable Posh-SSH)) {
  Write-Host 'Installing Posh-SSH module (one-time)...' -ForegroundColor Cyan
  Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
}

Import-Module Posh-SSH

$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)

Write-Host "Deploying on VPS ($($env:VPS_HOST)) branch=$Branch via Posh-SSH ..." -ForegroundColor Cyan
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30

if (-not $session) {
  throw 'SSH login failed: could not create session.'
}

$remote = (
  "set -e",
  "export NODE_OPTIONS='--max-old-space-size=4096'",
  "cd '$($env:VPS_APP_DIR)'",
  "echo '=== Pre-deploy: stop all apps, max free RAM ==='",
  "pkill -f 'next build' 2>/dev/null || true",
  "pkill -f 'next/dist/bin/next build' 2>/dev/null || true",
  "pm2 delete all 2>/dev/null || true",
  "pm2 save --force 2>/dev/null || true",
  "pkill -f '/var/www/188.com.vn' 2>/dev/null || true",
  "pkill -f '/var/www/Thu-do-online/node_modules/.bin/next' 2>/dev/null || true",
  "fuser -k 3000/tcp 2>/dev/null || true",
  "fuser -k 3001/tcp 2>/dev/null || true",
  "fuser -k 8001/tcp 2>/dev/null || true",
  "rm -f deploy/.deploy-in-progress.lock",
  "sync; sleep 2; free -m | head -2",
  "git fetch origin",
  "git checkout '$Branch'",
  "git pull origin '$Branch'",
  "DEPLOY_DELETE_PM2_BEFORE_BUILD=1 bash deploy/update-vps.sh '$Branch'"
) -join "`n"

$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $remote -TimeOut 7200
Remove-SSHSession -SessionId $session.SessionId | Out-Null

$result.Output | ForEach-Object { Write-Host $_ }
if ($result.Error) {
  Write-Host '--- stderr ---' -ForegroundColor DarkYellow
  $result.Error | ForEach-Object { Write-Host $_ }
}

if ($result.ExitStatus -ne 0) {
  Write-Host "Deploy failed (exit $($result.ExitStatus))" -ForegroundColor Red
  exit $result.ExitStatus
}

Write-Host 'Deploy completed successfully.' -ForegroundColor Green
