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
$cmd = "cd $appDir && node tmp-gudo-groups.mjs"
$result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd -TimeOut 90
Remove-SSHSession -SessionId $session.SessionId | Out-Null
$result.Output | ForEach-Object { Write-Host $_ }
if ($result.Error) { $result.Error | ForEach-Object { Write-Host $_ } }
exit $result.ExitStatus
