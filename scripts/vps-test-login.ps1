# One-off VPS login test using password from .env.local.server
param(
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $ProjectRoot 'scripts\load-vps-env.ps1') -ProjectRoot $ProjectRoot

if (-not (Get-Module -ListAvailable Posh-SSH)) {
  Write-Host 'Installing Posh-SSH module (one-time)...' -ForegroundColor Cyan
  Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
}

Import-Module Posh-SSH

$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)

Write-Host "Connecting to $($env:VPS_USER)@$($env:VPS_HOST):$($env:VPS_PORT) ..." -ForegroundColor Cyan
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 20

if (-not $session) {
  throw 'SSH login failed: could not create session.'
}

$result = Invoke-SSHCommand -SessionId $session.SessionId -Command 'echo VPS_OK; hostname; whoami; uptime; pm2 status 2>/dev/null | head -10'
Remove-SSHSession -SessionId $session.SessionId | Out-Null

Write-Host '--- SSH login OK ---' -ForegroundColor Green
$result.Output | ForEach-Object { Write-Host $_ }

if ($result.Error) {
  Write-Host '--- stderr ---' -ForegroundColor DarkYellow
  $result.Error | ForEach-Object { Write-Host $_ }
}

if ($result.ExitStatus -ne 0) {
  exit $result.ExitStatus
}
