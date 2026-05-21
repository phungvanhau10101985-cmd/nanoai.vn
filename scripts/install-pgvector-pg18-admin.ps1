# Copy pgvector into PostgreSQL 18 (Administrator).
# Prepare: node scripts/pg-setup-pgvector-pg18.mjs
# Run as administrator:
#   cd E:\python-code\Thu-do-online
#   powershell -ExecutionPolicy Bypass -File scripts\install-pgvector-pg18-admin.ps1
$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$src = Join-Path $repoRoot '.cache\vector-pg18\extracted'
$pg = 'C:\Program Files\PostgreSQL\18'

if (-not (Test-Path (Join-Path $src 'lib\vector.dll'))) {
  Write-Error "Missing $src\lib\vector.dll - run: node scripts/pg-setup-pgvector-pg18.mjs"
}

Copy-Item (Join-Path $src 'lib\vector.dll') (Join-Path $pg 'lib\vector.dll') -Force
Copy-Item (Join-Path $src 'share\extension\*') (Join-Path $pg 'share\extension') -Force
Write-Host "OK: copied pgvector to $pg"
$svc = Get-Service -Name 'postgresql-x64-18' -ErrorAction SilentlyContinue
if ($svc) {
  Restart-Service -Name 'postgresql-x64-18' -Force
  Write-Host 'OK: restarted postgresql-x64-18'
}
Write-Host 'Then: npm run pg:ensure-pgvector && npm run db:migrate:push'
