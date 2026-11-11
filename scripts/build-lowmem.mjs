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

const requestedHeapMb = Number.parseInt(process.env.NODE_BUILD_HEAP_MB ?? '', 10)
// Webpack production đã OOM quanh 3.1GB khi heap 3072/4096 (VPS 12GB, 2026-11-11).
// Cho phép nâng trên 8192, không cho env thấp hơn kéo build xuống mức chết.
const heap = Number.isFinite(requestedHeapMb) && requestedHeapMb > 8192 ? requestedHeapMb : 8192
console.log('[build] next heap MB ' + heap + (requestedHeapMb !== heap && Number.isFinite(requestedHeapMb) ? ' (ignored NODE_BUILD_HEAP_MB=' + requestedHeapMb + ')' : ''))

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
