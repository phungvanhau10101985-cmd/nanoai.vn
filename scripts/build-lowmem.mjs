/**
 * Build production: bỏ ESLint trong `next build` + heap Node gắn trên đúng process.
 * `npm run build:full` (`next build` trần) chỉ theo NODE_OPTIONS. Heap 4096 đã OOM
 * trên VPS 12GB khi webpack Map ~3.1GB (2026-11-01) — deploy gọi script này với 8192.
 * Nếu vẫn «Killed» ở bước TypeScript: `npm run build:vps` hoặc NEXT_BUILD_SKIP_TYPECHECK=1 (xem .env.example).
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.SKIP_ESLINT_ON_BUILD = '1'

const heapMb = Number.parseInt(process.env.NODE_BUILD_HEAP_MB ?? '8192', 10)
const heap = Number.isFinite(heapMb) && heapMb >= 512 ? heapMb : 8192

if (process.argv.includes('--skip-typescript')) {
  process.env.NEXT_BUILD_SKIP_TYPECHECK = '1'
}

const nextBin = join(root, 'node_modules/next/dist/bin/next')
const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=' + String(heap) }
const r = spawnSync(
  process.execPath,
  ['--max-old-space-size=' + String(heap), nextBin, 'build'],
  { stdio: 'inherit', cwd: root, env }
)
process.exit(r.status === null ? 1 : r.status)
