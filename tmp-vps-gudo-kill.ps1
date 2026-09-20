param(
  [string]$ProjectRoot = ''
)
if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path $scriptDir).Path
}
. (Join-Path $ProjectRoot 'scripts\load-vps-env.ps1') -ProjectRoot $ProjectRoot
Import-Module Posh-SSH
$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH login failed.' }
$appDir = $env:VPS_APP_DIR
$remote = @'
set -e
cd APPDIR_PLACEHOLDER
pkill -f 'tmp-execute-gudo.ts' || true
pkill -f 'gudo-scrape.sh' || true
sleep 1
echo '=== PROC ==='
ps -eo pid,etime,cmd | grep -E 'tsx tmp-execute-gudo|gudo-scrape' | grep -v grep || echo 'none'
git checkout HEAD -- src/lib/messaging/listing-import/ || true
git status --short src/lib/messaging/listing-import/ || true
rm -f tmp-gudo-groups.mjs tmp-execute-gudo.ts tmp-listing-import-rating-groups.ts
'@
$remote = $remote.Replace('APPDIR_PLACEHOLDER', $appDir).Replace("`r`n", "`n")
$b64sh = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
$run = "echo $b64sh | base64 -d > /tmp/gudo-kill.sh && bash /tmp/gudo-kill.sh"
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $run -TimeOut 30
Remove-SSHSession -SessionId $session.SessionId | Out-Null
$result.Output | ForEach-Object { Write-Host $_ }
if ($result.Error) { $result.Error | ForEach-Object { Write-Host $_ } }
exit $result.ExitStatus
