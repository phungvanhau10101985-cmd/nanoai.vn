/**
 * Build trên VPS RAM thấp: bỏ ESLint trong `next build` + tăng heap Node để giảm nguy cơ OOM (process «Killed»).
 * Vẫn chạy kiểm tra TypeScript của Next.js.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.SKIP_ESLINT_ON_BUILD = '1'

const nextBin = join(root, 'node_modules/next/dist/bin/next')
const r = spawnSync(
  process.execPath,
  ['--max-old-space-size=6144', nextBin, 'build'],
  { stdio: 'inherit', cwd: root, env: process.env }
)
process.exit(r.status === null ? 1 : r.status)
