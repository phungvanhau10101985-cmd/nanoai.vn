/**
 * Đưa khung mẫu thiệp lên Bunny (cdn) và in URL public.
 *   npx tsx scripts/upload-wedding-cover-frames.ts
 */
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { uploadTryOnToBunnyOnly } from '../src/lib/storage/try-on-public-upload'

const root = process.cwd()

function loadEnv(name: string) {
  const p = join(root, name)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv('.env.local')
loadEnv('.env')

async function main() {
  const dir = join(root, 'public', 'wedding', 'covers')
  const files = readdirSync(dir).filter((name) => name.endsWith('.webp')).sort()
  if (!files.length) throw new Error('Không có file webp trong public/wedding/covers')

  for (const file of files) {
    const body = readFileSync(join(dir, file))
    const path = `wedding/covers/${file}`
    const { publicUrl } = await uploadTryOnToBunnyOnly(path, body, 'image/webp')
    console.log(publicUrl)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
