import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function loadEnvFile(name) {
  const p = join(root, name)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')
if (!process.env.DATABASE_URL?.trim()) {
  console.error('Thiếu DATABASE_URL')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const fk = await pool.query(`
  select c.conrelid::regclass::text as table_name, c.confdeltype as on_delete
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid = 'public.worksheet_curricula'::regclass
  order by 1
`)
console.log('FK')
console.table(fk.rows)
const counts = await pool.query(`
  select 'worksheet_curricula' as t, count(*)::int as n from public.worksheet_curricula
  union all select 'worksheet_worksheets', count(*)::int from public.worksheet_worksheets
  union all select 'worksheet_questions', count(*)::int from public.worksheet_questions
  union all select 'worksheet_textbook_lessons', count(*)::int from public.worksheet_textbook_lessons
  union all select 'worksheet_official_questions', count(*)::int from public.worksheet_official_questions
`)
console.table(counts.rows)
await pool.end()
