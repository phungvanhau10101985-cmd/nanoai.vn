param(
  [string]$ProjectRoot = ''
)
if (-not $ProjectRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $ProjectRoot = (Resolve-Path $scriptDir).Path
}
. (Join-Path $ProjectRoot 'scripts\load-vps-env.ps1') -ProjectRoot $ProjectRoot
if (-not (Get-Module -ListAvailable Posh-SSH)) {
  Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
}
Import-Module Posh-SSH
$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH login failed.' }

$local = Join-Path $ProjectRoot 'tmp-gudo-groups.mjs'
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($local))
$appDir = $env:VPS_APP_DIR
$upload = "echo $b64 | base64 -d > $appDir/tmp-gudo-groups.mjs && wc -c $appDir/tmp-gudo-groups.mjs"
$up = Invoke-SSHCommand -SessionId $session.SessionId -Command $upload -TimeOut 30
$up.Output | ForEach-Object { Write-Host $_ }

$remote = @'
set -e
cd APPDIR_PLACEHOLDER
echo '=== PROC ==='
ps -eo pid,etime,cmd | grep -E 'tsx tmp-execute-gudo|gudo-scrape' | grep -v grep || true
echo '=== GIT LISTING-IMPORT ==='
git status --short src/lib/messaging/listing-import/ || true
echo '=== GROUPS ==='
node tmp-gudo-groups.mjs
rm -f tmp-gudo-groups.mjs
'@
$remote = $remote.Replace('APPDIR_PLACEHOLDER', $appDir).Replace("`r`n", "`n")
$b64sh = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
$run = "echo $b64sh | base64 -d > /tmp/gudo-status.sh && bash /tmp/gudo-status.sh"
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $run -TimeOut 90
Remove-SSHSession -SessionId $session.SessionId | Out-Null
$result.Output | ForEach-Object { Write-Host $_ }
if ($result.Error) { $result.Error | ForEach-Object { Write-Host $_ } }
exit $result.ExitStatus
