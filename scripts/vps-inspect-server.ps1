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

$remote = @'
echo "=== RAM ==="
free -h
echo ""
echo "=== PM2 ==="
pm2 status 2>/dev/null || echo "(pm2 empty)"
echo ""
echo "=== LISTEN PORTS ==="
ss -tlnp 2>/dev/null | grep -E ':3000|:3001|:8001|:5432|:80 |:443 ' || true
echo ""
echo "=== TOP PROCESSES (node/nginx/postgres) ==="
ps aux --sort=-%mem | grep -E 'node|next|nginx|postgres|python' | grep -v grep | head -20
echo ""
echo "=== SERVICES ==="
systemctl is-active nginx 2>/dev/null; systemctl is-active postgresql 2>/dev/null || systemctl is-active postgres 2>/dev/null
echo ""
echo "=== GIT (Thu-do-online) ==="
cd /var/www/Thu-do-online && git log -1 --oneline && test -d .next && echo ".next: exists" || echo ".next: missing"
'@

$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $remote -TimeOut 90
Remove-SSHSession -SessionId $session.SessionId | Out-Null

$result.Output | ForEach-Object { Write-Host $_ }
if ($result.Error) {
  Write-Host '--- stderr ---' -ForegroundColor DarkYellow
  $result.Error | ForEach-Object { Write-Host $_ }
}
exit $result.ExitStatus
