/**
 * @deprecated One-off cũ: thay import service role / client hosted. Repo đã gỡ thư mục đó và SDK npm tương ứng — giữ file chỉ để tham khảo lịch sử.
 * One-off (cũ): replace direct createClient(..., SERVICE_ROLE) with createServiceRoleClient().
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

function ensureServiceRoleImport(s) {
  if (/from ['"]@\/lib\/supabase\/service-role['"]/.test(s)) return s
  const first = s.match(/^import[^\n]+\n/)
  const line = `import { createServiceRoleClient } from '@/lib/supabase/service-role'\n`
  if (first) return first[0] + line + s.slice(first[0].length)
  return line + s
}

function stripSupabaseImportIfUnused(s) {
  // Remove line: import { createClient as createSupabaseClient } from '@supabase/supabase-js'
  if (!/createSupabaseClient/.test(s)) {
    s = s.replace(
      /import\s*\{\s*createClient\s+as\s+createSupabaseClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]\s*\n?/,
      ''
    )
  }
  // Remove: import { createClient } from '@supabase/supabase-js' if createClient( not used
  if (!/\bcreateClient\s*\(/.test(s)) {
    s = s.replace(/import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]\s*\n?/, '')
  }
  // Remove: import { createClient as createAdminClient } ...
  if (!/createAdminClient\s*\(/.test(s)) {
    s = s.replace(
      /import\s*\{\s*createClient\s+as\s+createAdminClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]\s*\n?/,
      ''
    )
  }
  return s
}

const files = walk(root)
let changed = 0

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8')
  const orig = s

  s = s.replace(
    /createSupabaseClient\s*\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!\s*,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*,\s*\{\s*auth:\s*\{\s*persistSession:\s*false\s*,\s*autoRefreshToken:\s*false\s*\}\s*\}\s*\)/g,
    'createServiceRoleClient()'
  )
  s = s.replace(
    /createSupabaseClient\s*\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!\s*,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*,\s*\{\s*auth:\s*\{\s*persistSession:\s*false\s*\}\s*\}\s*\)/g,
    'createServiceRoleClient()'
  )
  s = s.replace(
    /createSupabaseClient\s*\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!\s*,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*\)/g,
    'createServiceRoleClient()'
  )

  s = s.replace(
    /createAdminClient\s*\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!\s*,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*,\s*\{\s*auth:\s*\{\s*persistSession:\s*false\s*\}\s*\}\s*\)/g,
    'createServiceRoleClient()'
  )

  s = s.replace(
    /createClient\s*\(\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL!\s*,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY!\s*\)/g,
    'createServiceRoleClient()'
  )

  if (s !== orig) {
    if (/createServiceRoleClient\s*\(/.test(s)) {
      s = ensureServiceRoleImport(s)
      s = stripSupabaseImportIfUnused(s)
    }
    try {
      fs.writeFileSync(f, s)
      changed++
      console.log('OK', path.relative(process.cwd(), f))
    } catch (e) {
      console.error('SKIP write failed:', path.relative(process.cwd(), f), e.message)
    }
  }
}

console.log('files changed:', changed)
