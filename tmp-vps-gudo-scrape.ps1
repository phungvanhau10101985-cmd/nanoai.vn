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

function Upload-ToApp([string]$LocalPath, [string]$RemoteName) {
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  $appDir = $env:VPS_APP_DIR
  $cmd = "echo $b64 | base64 -d > $appDir/$RemoteName && wc -c $appDir/$RemoteName"
  $up = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd -TimeOut 60
  $up.Output | ForEach-Object { Write-Host $_ }
  if ($up.ExitStatus -ne 0) { throw "upload failed $RemoteName" }
}

Upload-ToApp (Join-Path $ProjectRoot 'tmp-gudo-groups.mjs') 'tmp-gudo-groups.mjs'
Upload-ToApp (Join-Path $ProjectRoot 'tmp-execute-gudo.ts') 'tmp-execute-gudo.ts'
Upload-ToApp (Join-Path $ProjectRoot 'src\lib\messaging\listing-import\listing-import-rating-groups.ts') 'tmp-listing-import-rating-groups.ts'

$appDir = $env:VPS_APP_DIR
$remote = @'
set -e
cd APPDIR_PLACEHOLDER
echo '=== GROUPS ==='
node tmp-gudo-groups.mjs
echo '=== PREP LISTING-IMPORT SRC ==='
git fetch origin --quiet || true
git checkout origin/main -- src/lib/messaging/listing-import/ || true
cp tmp-listing-import-rating-groups.ts src/lib/messaging/listing-import/listing-import-rating-groups.ts
echo '=== SCRAPE GUDO A107 ==='
set +e
npx tsx tmp-execute-gudo.ts
status=$?
set -e
echo '=== RESTORE SRC ==='
git checkout HEAD -- src/lib/messaging/listing-import/ || true
rm -f tmp-gudo-groups.mjs tmp-execute-gudo.ts tmp-listing-import-rating-groups.ts
exit $status
'@
$remote = $remote.Replace('APPDIR_PLACEHOLDER', $appDir).Replace("`r`n", "`n")
$b64sh = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
$run = "echo $b64sh | base64 -d > /tmp/gudo-scrape.sh && bash /tmp/gudo-scrape.sh"
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $run -TimeOut 360
Remove-SSHSession -SessionId $session.SessionId | Out-Null
$result.Output | ForEach-Object { Write-Host $_ }
if ($result.Error) { $result.Error | ForEach-Object { Write-Host $_ } }
exit $result.ExitStatus
