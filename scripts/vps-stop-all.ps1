param([string]$ProjectRoot = '')
if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}
. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot
Import-Module Posh-SSH
$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)
$s = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30

function Invoke-Remote([string]$cmd) {
  $r = Invoke-SSHCommand -SessionId $s.SessionId -Command $cmd -TimeOut 120
  if ($r.Output) { $r.Output | ForEach-Object { Write-Host $_ } }
  if ($r.Error) { $r.Error | ForEach-Object { Write-Host $_ -ForegroundColor DarkYellow } }
  return $r.ExitStatus
}

Write-Host '=== RAM TRUOC ===' -ForegroundColor Cyan
Invoke-Remote 'free -m' | Out-Null

Write-Host '=== pm2 delete all ===' -ForegroundColor Cyan
Invoke-Remote 'pm2 delete all; pm2 save' | Out-Null

Write-Host '=== fuser ports ===' -ForegroundColor Cyan
Invoke-Remote 'fuser -k 3000/tcp 2>/dev/null; fuser -k 3001/tcp 2>/dev/null; fuser -k 8001/tcp 2>/dev/null; sleep 2; sync' | Out-Null

Write-Host '=== RAM SAU ===' -ForegroundColor Cyan
Invoke-Remote 'free -m' | Out-Null

Write-Host '=== PM2 + PORTS + CURL ===' -ForegroundColor Cyan
Invoke-Remote 'pm2 status; echo ---; ss -tlnp | grep -E ":3000|:3001|:8001" || echo none; echo ---; curl -s -o /dev/null -w "3000=%{http_code}\n" --connect-timeout 2 http://127.0.0.1:3000/ || echo 3000=FAIL; curl -s -o /dev/null -w "3001=%{http_code}\n" --connect-timeout 2 http://127.0.0.1:3001/ || echo 3001=FAIL; curl -s -o /dev/null -w "8001=%{http_code}\n" --connect-timeout 2 http://127.0.0.1:8001/health || echo 8001=FAIL' | Out-Null

Remove-SSHSession -SessionId $s.SessionId | Out-Null
