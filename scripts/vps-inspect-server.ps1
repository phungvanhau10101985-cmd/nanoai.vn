# Inspect VPS: RAM, PM2, ports, key processes
param(
  [string]$ProjectRoot = ''
)

if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot

if (-not (Get-Module -ListAvailable Posh-SSH)) {
  Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
}
Import-Module Posh-SSH

$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH login failed.' }

$remote = (
  'echo "=== RAM (MB) ==="',
  'free -m',
  'echo ""',
  'echo "=== PM2 ==="',
  'pm2 status 2>/dev/null || echo empty',
  'echo ""',
  'echo "=== APP PORTS ==="',
  'ss -tlnp 2>/dev/null | grep -E ":3000|:3001|:8001" || echo none',
  'echo ""',
  'echo "=== CURL ==="',
  'curl -s -o /dev/null -w "3000=%{http_code}\n" --connect-timeout 2 http://127.0.0.1:3000/ 2>/dev/null || echo "3000=FAIL"',
  'curl -s -o /dev/null -w "3001=%{http_code}\n" --connect-timeout 2 http://127.0.0.1:3001/ 2>/dev/null || echo "3001=FAIL"',
  'curl -s -o /dev/null -w "8001=%{http_code}\n" --connect-timeout 2 http://127.0.0.1:8001/health 2>/dev/null || echo "8001=FAIL"',
  'echo ""',
  'echo "=== 188/NANOAI PROCESSES ==="',
  'ps aux | grep 188.com | grep -v grep || echo none',
  'ps aux | grep Thu-do-online | grep -v grep || echo none'
) -join "`n"

$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $remote -TimeOut 90
Remove-SSHSession -SessionId $session.SessionId | Out-Null

$result.Output | ForEach-Object { Write-Host $_ }
if ($result.Error) {
  Write-Host '--- stderr ---' -ForegroundColor DarkYellow
  $result.Error | ForEach-Object { Write-Host $_ }
}
exit $result.ExitStatus
