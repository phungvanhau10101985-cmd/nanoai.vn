/**
 * Tải pgvector bản build cho PostgreSQL 15 (Windows x64) vào .cache/vector-pg15
 * (community build — andreiramani/pgvector_pgsql_windows).
 *
 *   node scripts/pg-setup-pgvector-pg15.mjs
 *
 * Sau đó chạy PowerShell **Run as administrator**:
 *   powershell -ExecutionPolicy Bypass -File scripts\install-pgvector-pg15-admin.ps1
 */
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const ZIP_URL =
  'https://github.com/andreiramani/pgvector_pgsql_windows/releases/download/0.8.2_15.14/vector.v0.8.2-pg15.zip'

const root = resolve(process.cwd(), '.cache', 'vector-pg15')
const zipPath = join(root, 'vector-pg15.zip')
const extractDir = join(root, 'extracted')

mkdirSync(root, { recursive: true })

if (!existsSync(join(extractDir, 'lib', 'vector.dll'))) {
  console.log('Downloading', ZIP_URL)
  const res = await fetch(ZIP_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await pipeline(res.body, createWriteStream(zipPath))
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit' }
  )
  if (ps.status !== 0) process.exit(ps.status ?? 1)
}

if (!existsSync(join(extractDir, 'lib', 'vector.dll'))) {
  console.error('Giải nén thất bại — không thấy lib/vector.dll')
  process.exit(1)
}

console.log('OK: pgvector đã có tại', extractDir)
console.log('Bước tiếp: chạy (admin) scripts\\install-pgvector-pg15-admin.ps1')
