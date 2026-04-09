/**
 * Áp db/migrations/20260408120000_email_auth_challenges.sql lên DATABASE_URL (.env.local).
 * Chạy: node scripts/run-email-auth-challenges-migration.mjs
 */
import dotenv from 'dotenv'
import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const sql = readFileSync(
  join(__dirname, '..', 'db/migrations/20260408120000_email_auth_challenges.sql'),
  'utf8'
)
const raw = process.env.DATABASE_URL
const url = raw ? raw.replace(/^["']|["']$/g, '').trim() : ''
if (!url) {
  console.error('Thiếu DATABASE_URL trong .env.local')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(sql)
  console.log('OK: public.nanoai_email_login_challenges + public.nanoai_ensure_user_by_email')
} catch (e) {
  console.error(String(e?.message || e))
  process.exit(1)
} finally {
  await client.end()
}
