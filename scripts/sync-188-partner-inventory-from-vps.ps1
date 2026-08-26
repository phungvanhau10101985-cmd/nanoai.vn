#Requires -Version 5.1
<#
.SYNOPSIS
  Đồng bộ kho + danh mục + vector embedding shop 188 từ Postgres VPS → local.

.DESCRIPTION
  Nguồn: partner VPS (mặc định bffd3362-72d6-4690-9a18-5b69d77b30f0 / 188-com-vn-rl56)
  Đích: partner local (mặc định 02770565-2cbe-4ff1-a63e-77c10d7de584 / 188-com-vn-u560)

  Chạy:
    powershell -ExecutionPolicy Bypass -File scripts/sync-188-partner-inventory-from-vps.ps1
#>
param(
  [string]$ProjectRoot = '',
  [string]$SourcePartnerId = 'bffd3362-72d6-4690-9a18-5b69d77b30f0',
  [string]$TargetPartnerId = '02770565-2cbe-4ff1-a63e-77c10d7de584',
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

. (Join-Path $PSScriptRoot 'load-vps-env.ps1') -ProjectRoot $ProjectRoot

$columnOrderFile = Join-Path $ProjectRoot 'backups\_sync-column-order.json'
Push-Location $ProjectRoot
node (Join-Path $PSScriptRoot 'sync-partner-inventory-column-order.mjs') $columnOrderFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to read local column order' }
Pop-Location
$columnOrder = Get-Content $columnOrderFile -Raw | ConvertFrom-Json
$invCols = ($columnOrder.inventory -join ',')
$catCols = ($columnOrder.categories -join ',')
$linkCols = (($columnOrder.inventoryCategories | ForEach-Object { "pic.$_" }) -join ',')

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteDir = "/tmp/nanoai-sync-188-$stamp"
$localDir = Join-Path $ProjectRoot "backups\sync-188-$stamp"

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

if (-not (Get-Module -ListAvailable Posh-SSH)) {
  Write-Host 'Installing Posh-SSH module (one-time)...' -ForegroundColor Cyan
  Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
}
Import-Module Posh-SSH

$secure = ConvertTo-SecureString $env:VPS_PASSWORD -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($env:VPS_USER, $secure)

Write-Host "=== Sync 188 inventory VPS -> local ===" -ForegroundColor Cyan
Write-Host "Source partner: $SourcePartnerId"
Write-Host "Target partner: $TargetPartnerId"
Write-Host "Remote dir:     $remoteDir"
Write-Host "Local dir:      $localDir"

$session = New-SSHSession -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'SSH login failed' }

$remoteCats = "$remoteDir/categories.bin"
$remoteInv = "$remoteDir/inventory.bin"
$remoteLinks = "$remoteDir/inventory_categories.bin"
$localCats = Join-Path $localDir 'categories.bin'
$localInv = Join-Path $localDir 'inventory.bin'
$localLinks = Join-Path $localDir 'inventory_categories.bin'

$exportCmd = "mkdir -p '$remoteDir' && cd /var/www/Thu-do-online && DB=`$(grep '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '\r') && psql `"`$DB`" -v ON_ERROR_STOP=1 -c `"\\copy (select $catCols from public.messaging_partner_categories where partner_id='$SourcePartnerId') to '$remoteCats' with (format binary)`" && psql `"`$DB`" -v ON_ERROR_STOP=1 -c `"\\copy (select $invCols from public.messaging_partner_inventory where partner_id='$SourcePartnerId') to '$remoteInv' with (format binary)`" && psql `"`$DB`" -v ON_ERROR_STOP=1 -c `"\\copy (select $linkCols from public.messaging_partner_inventory_categories pic join public.messaging_partner_inventory inv on inv.id = pic.inventory_id where inv.partner_id='$SourcePartnerId') to '$remoteLinks' with (format binary)`" && ls -la '$remoteDir'"

Write-Host 'Exporting on VPS...' -ForegroundColor Yellow
$export = Invoke-SSHCommand -SessionId $session.SessionId -Command $exportCmd -TimeOut 7200
$export.Output | ForEach-Object { Write-Host $_ }
if ($export.ExitStatus -ne 0) {
  if ($export.Error) { $export.Error | ForEach-Object { Write-Host $_ -ForegroundColor Red } }
  Remove-SSHSession -SessionId $session.SessionId | Out-Null
  throw "VPS export failed (exit $($export.ExitStatus))"
}

function Get-RemoteFile {
  param(
    [string]$RemotePath,
    [string]$LocalPath
  )
  Get-SCPItem -ComputerName $env:VPS_HOST -Credential $cred -Port ([int]$env:VPS_PORT) -Path $RemotePath -PathType File -Destination $LocalPath -AcceptKey -Force
}

Write-Host 'Downloading COPY dumps...' -ForegroundColor Yellow
Get-RemoteFile -RemotePath $remoteCats -LocalPath $localDir
Get-RemoteFile -RemotePath $remoteInv -LocalPath $localDir
Get-RemoteFile -RemotePath $remoteLinks -LocalPath $localDir

$cleanup = Invoke-SSHCommand -SessionId $session.SessionId -Command "rm -rf '$remoteDir'" -TimeOut 120
Remove-SSHSession -SessionId $session.SessionId | Out-Null

foreach ($p in @($localCats, $localInv, $localLinks)) {
  if (-not (Test-Path $p)) { throw "Download failed: $p" }
  $bytes = (Get-Item $p).Length
  Write-Host "Downloaded $bytes bytes -> $p" -ForegroundColor Green
}

if ($DryRun) {
  Write-Host 'DryRun: skip local import.' -ForegroundColor DarkYellow
  exit 0
}

Write-Host 'Importing into local DATABASE_URL...' -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
  node (Join-Path $PSScriptRoot 'sync-partner-inventory-import-local.mjs') `
    --partner-id $TargetPartnerId `
    --source-partner-id $SourcePartnerId `
    --copy-dir $localDir
  if ($LASTEXITCODE -ne 0) { throw "Local import failed (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

Write-Host '=== Sync completed ===' -ForegroundColor Green
