import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envDest = resolve(root, '.env.local')
const envSrc = resolve(root, '.env.local.dev')
const stopPs1 = resolve(__dirname, 'restart-server-stop-dev.ps1')

function readDevPort() {
  for (const file of [envDest, envSrc]) {
    if (!existsSync(file)) continue
    const m = readFileSync(file, 'utf8').match(/^\s*PORT\s*=\s*(\d+)/m)
    if (m) return Number(m[1])
  }
  return 3000
}

const devPort = readDevPort()

// 1. Stop Thu-do dev only (does not kill 188-com-vn on 8001/3001 or ngrok :3001)
console.log(`[restart-server] Stopping Thu-do dev on port ${devPort} (188-com-vn safe)...`)
try {
  execSync(
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${stopPs1}" -DevPort ${devPort} -ProjectRoot "${root}"`,
    { stdio: 'inherit', cwd: root }
  )
} catch {
  // stop script may return non-zero if nothing to kill
}

// 2. Ensure .env.local exists (copy from .env.local.dev) — only within this repo
if (!existsSync(envDest) && existsSync(envSrc)) {
  copyFileSync(envSrc, envDest)
  console.log('[restart-server] Copied .env.local.dev -> .env.local')
}

// 3. Clean old next caches (this repo only)
for (const d of ['.next-dev', '.next']) {
  try {
    rmSync(resolve(root, d), { recursive: true, force: true })
  } catch {}
}

const pub = resolve(root, 'public')
for (const name of ['sw.js', 'sw.js.map']) {
  try {
    rmSync(resolve(pub, name), { force: true })
  } catch {}
}
try {
  for (const name of readdirSync(pub)) {
    if (/^(workbox|worker)-.+\.js(\.map)?$/.test(name)) {
      rmSync(resolve(pub, name), { force: true })
    }
  }
} catch {}

// 4. Start dev server
execSync('npm run dev', { stdio: 'inherit', cwd: root })
