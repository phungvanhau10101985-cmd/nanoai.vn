import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import pg from 'pg'

const cwd = process.cwd()
if (existsSync(resolve(cwd, '.env'))) config({ path: resolve(cwd, '.env') })
if (existsSync(resolve(cwd, '.env.local'))) config({ path: resolve(cwd, '.env.local'), override: true })

const outPath = resolve(cwd, process.argv[2] || 'backups/_sync-column-order.json')
const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

async function cols(table) {
  const r = await c.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name=$1
     order by ordinal_position`,
    [table]
  )
  return r.rows.map((x) => x.column_name)
}

const payload = {
  inventory: await cols('messaging_partner_inventory'),
  categories: await cols('messaging_partner_categories'),
  inventoryCategories: await cols('messaging_partner_inventory_categories'),
}
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
console.log(outPath)
await c.end()
