import { readFileSync, existsSync } from 'fs'
import pg from 'pg'

function load(name) {
  if (!existsSync(name)) return
  for (const line of readFileSync(name, 'utf8').split('\n')) {
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

load('.env.local')
load('.env')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const url = 'https://cdn.nanoai.vn/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/wedding_417213ca-b2e3-4e2c-a642-d7bac605fad0_cover_frame_1792244354852.png'
const cols = await pool.query(
  `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'wedding_cover_frame_library' order by ordinal_position`,
)
console.log(cols.rows.map((row) => row.column_name).join(','))
const frame = await pool.query(
  `select image_url, hole, panel, ink from public.wedding_cover_frame_library where image_url = $1`,
  [url],
)
console.log(JSON.stringify(frame.rows[0] || null))
await pool.end()
