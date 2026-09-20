#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $here '..')).Path
. (Join-Path $ProjectRoot 'scripts\load-vps-env.ps1') -ProjectRoot $ProjectRoot
Import-Module Posh-SSH

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteDir = "/tmp/nanoai-chat-4d-$stamp"
$localDir = Join-Path $here "out-4d-$stamp"
New-Item -ItemType Directory -Force -Path $localDir | Out-Null

$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)
$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH login failed' }

try {
  $sftp = New-SFTPSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey
  if (-not $sftp) { throw 'SFTP login failed' }
  try {
    Invoke-SSHCommand -SessionId $session.SessionId -Command "mkdir -p '$remoteDir'" -TimeOut 30 | Out-Null
    foreach ($name in @('summary-4d.sql','by_partner-4d.sql','jobs-4d.sql','pairs-4d.sql')) {
      Set-SFTPItem -SessionId $sftp.SessionId -Path (Join-Path $here $name) -Destination $remoteDir -Force
    }
    Invoke-SSHCommand -SessionId $session.SessionId -Command "sed -i 's/\r`$//' '$remoteDir'/*.sql" -TimeOut 30 | Out-Null

    $cmd = (@(
      'set -euo pipefail',
      "cd /var/www/Thu-do-online",
      'DB=$(grep ''^DATABASE_URL='' .env.local | head -1 | cut -d= -f2- | tr -d ''\r'' | sed ''s/^"//;s/"$//'')',
      'export PSQL_PAGER=',
      "psql `"`$DB`" -v ON_ERROR_STOP=1 -A -F `$'\t' -f '$remoteDir/summary-4d.sql' > '$remoteDir/summary.tsv'",
      "psql `"`$DB`" -v ON_ERROR_STOP=1 -A -F `$'\t' -f '$remoteDir/by_partner-4d.sql' > '$remoteDir/by_partner.tsv'",
      "psql `"`$DB`" -v ON_ERROR_STOP=1 -A -F `$'\t' -f '$remoteDir/jobs-4d.sql' > '$remoteDir/jobs.tsv'",
      "psql `"`$DB`" -v ON_ERROR_STOP=1 -f '$remoteDir/pairs-4d.sql' > '$remoteDir/pairs.csv'",
      "wc -l '$remoteDir'/*"
    ) -join "`n") -replace "`r", ''
    Write-Host "Running SQL on VPS..." -ForegroundColor Yellow
    $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd -TimeOut 600
    $result.Output | ForEach-Object { Write-Host $_ }
    if ($result.Error) { $result.Error | ForEach-Object { Write-Host $_ -ForegroundColor Yellow } }
    if ($result.ExitStatus -ne 0) { throw "Remote SQL failed (exit $($result.ExitStatus))" }

    foreach ($name in @('summary.tsv','by_partner.tsv','jobs.tsv','pairs.csv')) {
      Get-SFTPItem -SessionId $sftp.SessionId -Path "$remoteDir/$name" -Destination $localDir -Force
    }
  } finally {
    Remove-SFTPSession -SessionId $sftp.SessionId | Out-Null
  }
} finally {
  Invoke-SSHCommand -SessionId $session.SessionId -Command "rm -rf '$remoteDir'" -TimeOut 60 | Out-Null
  Remove-SSHSession -SessionId $session.SessionId | Out-Null
}

Write-Host "Saved: $localDir" -ForegroundColor Green
Get-ChildItem $localDir | ForEach-Object { Write-Host ("{0}`t{1}" -f $_.Length, $_.Name) }
