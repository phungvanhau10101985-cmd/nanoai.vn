# Copy pgvector into PostgreSQL 17 (Administrator).
# Prepare: node scripts/pg-setup-pgvector-pg17.mjs
# Run as administrator:
#   cd G:\python-code\Thu-do-online
#   powershell -ExecutionPolicy Bypass -File scripts\install-pgvector-pg17-admin.ps1
$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$src = Join-Path $repoRoot '.cache\vector-pg17\extracted'
$pg = 'C:\Program Files\PostgreSQL\17'

if (-not (Test-Path (Join-Path $src 'lib\vector.dll'))) {
  Write-Error "Missing $src\lib\vector.dll - run: node scripts/pg-setup-pgvector-pg17.mjs"
}

Copy-Item (Join-Path $src 'lib\vector.dll') (Join-Path $pg 'lib\vector.dll') -Force
Copy-Item (Join-Path $src 'share\extension\*') (Join-Path $pg 'share\extension') -Force
Write-Host "OK: copied pgvector to $pg"
Write-Host 'Optional: Restart-Service postgresql-x64-17'
Write-Host 'Then in DB: CREATE EXTENSION IF NOT EXISTS vector;'
