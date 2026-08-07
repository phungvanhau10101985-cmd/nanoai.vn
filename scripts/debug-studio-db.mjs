import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const f of ['.env.local', '.env']) {
  const p = join(root, f)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim()
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const col = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='messaging_partner_websites' AND column_name='creation_journal_json'`
  )
  console.log('creation_journal_json column:', col.rows.length > 0)

  const rows = await pool.query(`
    SELECT mp.id::text AS partner_id, mp.slug,
           mw.id IS NOT NULL AS has_web,
           mw.creation_journal_json->>'phase' AS phase
    FROM messaging_partners mp
    LEFT JOIN messaging_partner_websites mw ON mw.partner_id = mp.id
    ORDER BY mp.created_at DESC NULLS LAST
    LIMIT 8
  `)
  const journal = await pool.query(
    `SELECT creation_journal_json FROM messaging_partner_websites
     WHERE partner_id = '02770565-2cbe-4ff1-a63e-77c10d7de584'::uuid`
  )
  console.log('journal sample:', JSON.stringify(journal.rows[0]?.creation_journal_json, null, 2))
} catch (e) {
  console.error('ERR', e.message)
} finally {
  await pool.end()
}
