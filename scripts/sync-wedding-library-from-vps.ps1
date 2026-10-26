#Requires -Version 5.1
<#
.SYNOPSIS
  Kéo kho ảnh nền thiệp và kho khung thiệp từ Postgres VPS về local.

.DESCRIPTION
  Bảng: wedding_background_library, wedding_cover_frame_library.
  Ảnh là URL (CDN). Script chép dòng kho, không tải file ảnh về đĩa.

  Chạy:
    powershell -ExecutionPolicy Bypass -File scripts/sync-wedding-library-from-vps.ps1
#>
param(
  [string]$ProjectRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteDir = "/tmp/nanoai-wedding-lib-$stamp"
$localDir = Join-Path $ProjectRoot "backups\wedding-library-$stamp"
New-Item -ItemType Directory -Force -Path $localDir | Out-Null

if (-not (Get-Module -ListAvailable Posh-SSH)) {
  Write-Host 'Installing Posh-SSH module (one-time)...' -ForegroundColor Cyan
  Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
}
Import-Module Posh-SSH

$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)

Write-Host '=== Sync wedding library VPS -> local ===' -ForegroundColor Cyan
Write-Host "Local dir: $localDir"

$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH login failed' }

$exportCmd = @"
mkdir -p '$remoteDir' && cd /var/www/Thu-do-online && DB=`$(grep -h '^DATABASE_URL=' .env.local .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r\"') && psql "`$DB" -v ON_ERROR_STOP=1 -tA -c "select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select id, image_url, image_type, reference_image_url, created_at from public.wedding_background_library order by created_at) t" > '$remoteDir/backgrounds.json' && psql "`$DB" -v ON_ERROR_STOP=1 -tA -c "select coalesce(json_agg(row_to_json(t)), '[]'::json) from (select id, image_url, hole, panel, ink, reference_image_url, created_at from public.wedding_cover_frame_library order by created_at) t" > '$remoteDir/frames.json' && wc -c '$remoteDir/backgrounds.json' '$remoteDir/frames.json'
"@

Write-Host 'Exporting on VPS...' -ForegroundColor Yellow
$export = Invoke-SSHCommand -SessionId $session.SessionId -Command $exportCmd -TimeOut 180
$export.Output | ForEach-Object { Write-Host $_ }
if ($export.ExitStatus -ne 0) {
  if ($export.Error) { $export.Error | ForEach-Object { Write-Host $_ -ForegroundColor Red } }
  Remove-SSHSession -SessionId $session.SessionId | Out-Null
  throw "VPS export failed (exit $($export.ExitStatus))"
}

function Get-RemoteFile {
  param([string]$RemotePath, [string]$LocalPath)
  Get-SCPItem -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -Path $RemotePath -PathType File -Destination $LocalPath -AcceptKey -Force
}

Write-Host 'Downloading...' -ForegroundColor Yellow
Get-RemoteFile -RemotePath "$remoteDir/backgrounds.json" -LocalPath $localDir
Get-RemoteFile -RemotePath "$remoteDir/frames.json" -LocalPath $localDir

Invoke-SSHCommand -SessionId $session.SessionId -Command "rm -rf '$remoteDir'" -TimeOut 60 | Out-Null
Remove-SSHSession -SessionId $session.SessionId | Out-Null

foreach ($name in @('backgrounds.json', 'frames.json')) {
  $path = Join-Path $localDir $name
  if (-not (Test-Path $path)) { throw "Download failed: $path" }
  Write-Host "Downloaded $((Get-Item $path).Length) bytes -> $name" -ForegroundColor Green
}

Write-Host 'Importing into local database...' -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
  node (Join-Path $PSScriptRoot 'sync-wedding-library-import-local.mjs') --dir $localDir
  if ($LASTEXITCODE -ne 0) { throw "Local import failed (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

Write-Host '=== Sync completed ===' -ForegroundColor Green
