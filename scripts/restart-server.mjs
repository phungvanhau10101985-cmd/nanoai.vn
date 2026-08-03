import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envDest = resolve(root, '.env.local')
const envSrc = resolve(root, '.env.local.dev')

// 1. Kill process on port 3000
try { execSync('npx kill-port 3000', { stdio: 'pipe', cwd: root }) } catch {}

// 2. Ensure .env.local exists (copy from .env.local.dev)
if (!existsSync(envDest) && existsSync(envSrc)) {
  copyFileSync(envSrc, envDest)
  console.log('[restart-server] Copied .env.local.dev -> .env.local')
}

// 3. Clean old next caches
for (const d of ['.next-dev', '.next']) {
  try { rmSync(resolve(root, d), { recursive: true, force: true }) } catch {}
}

// 4. Start dev server
execSync('npm run dev', { stdio: 'inherit', cwd: root })
