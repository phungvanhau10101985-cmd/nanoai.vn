/**
 * CREATE EXTENSION vector nếu có (pgvector) — cần cho cột embedding.
 *   node scripts/pg-ensure-pgvector.mjs
 */
import pg from 'pg'
import { resolve } from 'node:path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('Thiếu DATABASE_URL.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query('CREATE EXTENSION IF NOT EXISTS vector')
  console.log('OK: extension vector')
} catch (e) {
  console.error(e.message)
  process.exit(1)
} finally {
  await client.end()
}
