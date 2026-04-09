/**
 * Xóa import `createClient as createSupabaseClient` từ package npm hosted Postgres client (tên module cũ trong regex)
 * khi identifier không còn dùng trong file (dọn dẹp sau khi gỡ SDK).
 *
 *   node scripts/legacy/cleanup-orphan-legacy-sdk-imports.mjs
 */
import fs from 'fs'
import path from 'path'

const root = path.join(process.cwd(), 'src')
const exts = new Set(['.ts', '.tsx'])

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (exts.has(path.extname(ent.name))) out.push(p)
  }
  return out
}

let fixed = 0
for (const f of walk(root)) {
  let s = fs.readFileSync(f, 'utf8')
  if (!s.includes('createClient as createSupabaseClient')) continue
  const withoutImport = s.replace(
    /import\s*\{\s*createClient\s+as\s+createSupabaseClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]\s*\n?/,
    ''
  )
  if (withoutImport === s) continue
  // Count references to createSupabaseClient in code (not in comments only - good enough)
  const refs = (withoutImport.match(/\bcreateSupabaseClient\b/g) || []).length
  if (refs === 0) {
    fs.writeFileSync(f, withoutImport)
    fixed++
    console.log('clean', path.relative(process.cwd(), f))
  }
}
console.log('cleaned files:', fixed)
