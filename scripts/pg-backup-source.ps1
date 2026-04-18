#Requires -Version 5.1
<#
  Backup Postgres (URI bất kỳ) -> file dump (custom format) cho pg_restore.

  Trước khi chạy, set URI Postgres (khuyến nghị PG_DUMP_SOURCE_URL).
  Nên dùng direct port 5432 cho pg_dump; pooler đôi khi không phù hợp.

  Ví dụ:
    $env:PG_DUMP_SOURCE_URL = "postgresql://USER:PASS@HOST:5432/postgres"
  Chạy từ thư mục gốc repo:
    .\scripts\pg-backup-source.ps1
  Hoặc chỉ định thư mục chứa pg_dump:
    $env:PG_BIN = "C:\Program Files\PostgreSQL\15\bin"
    .\scripts\pg-backup-source.ps1

  Output: backups/pg-backup-<timestamp>.dump (gitignore backups/)
#>

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$backupDir = Join-Path $root "backups"
if (-not (Test-Path $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$uri = $env:PG_DUMP_SOURCE_URL
if (-not $uri) { $uri = $env:DATABASE_BACKUP_SOURCE_URL }
if (-not $uri) {
  Write-Error "Thiếu PG_DUMP_SOURCE_URL hoặc DATABASE_BACKUP_SOURCE_URL (connection string Postgres cho pg_dump)."
}

$pgDump = "pg_dump"
if ($env:PG_BIN) {
  $pgDump = Join-Path $env:PG_BIN.TrimEnd('\') "pg_dump.exe"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $backupDir "pg-backup-$stamp.dump"

Write-Host "pg_dump -> $outFile"
& $pgDump --dbname=$uri --format=custom --file=$outFile --no-owner
if ($LASTEXITCODE -ne 0) {
  Write-Error "pg_dump failed with exit code $LASTEXITCODE"
}
Write-Host "OK: $outFile"
