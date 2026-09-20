#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $here '..')).Path
. (Join-Path $ProjectRoot 'scripts\load-vps-env.ps1') -ProjectRoot $ProjectRoot
Import-Module Posh-SSH
$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH login failed' }
$cmd = 'echo VPS_OK; hostname; date -u'
try {
  $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd -TimeOut 60
  $result.Output | ForEach-Object { Write-Host $_ }
  if ($result.Error) { $result.Error | ForEach-Object { Write-Host $_ -ForegroundColor Yellow } }
  Write-Host "EXIT=$($result.ExitStatus)"
} finally {
  Remove-SSHSession -SessionId $session.SessionId | Out-Null
}
