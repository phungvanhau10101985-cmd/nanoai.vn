#Requires -Version 5.1
<#
  Restore file dump (custom) vào Postgres đích — thường DATABASE_URL local (nanoai).

  Trước khi chạy:
    $env:DATABASE_URL = "postgresql://postgres:...@localhost:5432/nanoai"
    $env:PG_DUMP_FILE = "G:\path\to\backups\pg-backup-....dump"

  Tuỳ chọn:
    $env:PG_BIN = "C:\Program Files\PostgreSQL\15\bin"

  Lần đầu restore vào DB trống: không dùng --clean.
  Nếu cần ghi đè lần 2: thêm cờ -Clean (xóa object cũ trước khi tạo) — NGUY HIỂM nếu DB có dữ liệu tay.

  Chạy:
    .\scripts\pg-restore-to-url.ps1
    .\scripts\pg-restore-to-url.ps1 -Clean
#>

param(
  [switch] $Clean
)

$ErrorActionPreference = "Stop"

$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
  Write-Error "Thiếu DATABASE_URL."
}

$dump = $env:PG_DUMP_FILE
if (-not $dump -or -not (Test-Path $dump)) {
  Write-Error "Thiếu PG_DUMP_FILE hoặc file không tồn tại: $dump"
}

$pgRestore = "pg_restore"
if ($env:PG_BIN) {
  $pgRestore = Join-Path $env:PG_BIN.TrimEnd('\') "pg_restore.exe"
}

$restoreArgs = @(
  "--dbname=$dbUrl",
  "--verbose",
  "--no-owner",
  "--no-acl"
)
if ($Clean) {
  $restoreArgs += @("--clean", "--if-exists")
}
$restoreArgs += $dump

Write-Host "pg_restore $(if ($Clean) { '(with --clean)' }) -> DATABASE_URL"
& $pgRestore @restoreArgs
$exit = $LASTEXITCODE
# pg_restore thường trả mã != 0 nếu có warning "already exists" — trên DB trống nên 0.
if ($exit -ne 0 -and $exit -ne 1) {
  Write-Warning "pg_restore exit code $exit (1 đôi khi chỉ là cảnh báo — kiểm tra DB trong pgAdmin)."
}
Write-Host "Xong. Kiểm tra schema trong pgAdmin."
