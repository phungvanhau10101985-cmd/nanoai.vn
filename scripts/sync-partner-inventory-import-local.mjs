/**
 * Import partner categories + inventory (+ junction) CSV dumps into local DATABASE_URL.
 * Replaces existing rows for the target partner first.
 *
 * Usage:
 *   node scripts/sync-partner-inventory-import-local.mjs \
 *     --partner-id <local-uuid> \
 *     --source-partner-id <vps-uuid> \
 *     --copy-dir backups/sync-188-.../
 */
import { createReadStream, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'
import { config } from 'dotenv'
import pg from 'pg'
import { from as copyFrom } from 'pg-copy-streams'

const cwd = process.cwd()
if (existsSync(resolve(cwd, '.env'))) config({ path: resolve(cwd, '.env') })
if (existsSync(resolve(cwd, '.env.local'))) config({ path: resolve(cwd, '.env.local'), override: true })

function arg(name) {
  const i = process.argv.indexOf(name)
  if (i < 0) return ''
  return (process.argv[i + 1] ?? '').trim()
}

const partnerId = arg('--partner-id')
const sourcePartnerId = arg('--source-partner-id')
const copyDir = resolve(arg('--copy-dir'))
const sqlPath = arg('--sql')

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  console.error('DATABASE_URL is required in .env.local')
  process.exit(1)
}

if (!partnerId) {
  console.error('Missing --partner-id')
  process.exit(1)
}

function resolvePsqlBin() {
  if (process.env.PSQL_PATH && existsSync(process.env.PSQL_PATH)) return process.env.PSQL_PATH
  if (process.env.PG_BIN) {
    const p = resolve(process.env.PG_BIN, process.platform === 'win32' ? 'psql.exe' : 'psql')
    if (existsSync(p)) return p
  }
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files'
    for (const ver of ['17', '16', '15']) {
      const p = resolve(pf, 'PostgreSQL', ver, 'bin', 'psql.exe')
      if (existsSync(p)) return p
    }
  }
  return 'psql'
}

async function countRows(client, table, whereSql, params) {
  const r = await client.query(`select count(*)::int as c from public.${table} ${whereSql}`, params)
  return r.rows[0]?.c ?? 0
}

function runCopyFrom(client, table, filePath, format = 'csv') {
  const sql =
    format === 'binary'
      ? `copy public.${table} from stdin with (format binary)`
      : `copy public.${table} from stdin with (format csv, header true)`
  return pipeline(createReadStream(filePath), client.query(copyFrom(sql)))
}

async function importFromCsvDir(client, dir, targetPartnerId, srcPartnerId) {
  const binCats = join(dir, 'categories.bin')
  const binInv = join(dir, 'inventory.bin')
  const binLinks = join(dir, 'inventory_categories.bin')
  const csvCats = join(dir, 'categories.csv')
  const csvInv = join(dir, 'inventory.csv')
  const csvLinks = join(dir, 'inventory_categories.csv')

  const useBinary = existsSync(binInv)
  const cats = useBinary ? binCats : csvCats
  const inv = useBinary ? binInv : csvInv
  const links = useBinary ? binLinks : csvLinks
  const copyFormat = useBinary ? 'binary' : 'csv'
  for (const p of [cats, inv, links]) {
    if (!existsSync(p)) throw new Error(`Missing file: ${p}`)
  }

  const remapPartner = srcPartnerId && srcPartnerId !== targetPartnerId

  await client.query('drop table if exists public._partner_sync_staging_categories')
  await client.query('drop table if exists public._partner_sync_staging_inventory')
  await client.query('drop table if exists public._partner_sync_staging_inventory_categories')
  await client.query(
    'create unlogged table public._partner_sync_staging_categories (like public.messaging_partner_categories including defaults)'
  )
  await client.query(
    'create unlogged table public._partner_sync_staging_inventory (like public.messaging_partner_inventory including defaults)'
  )
  await client.query(
    'create unlogged table public._partner_sync_staging_inventory_categories (like public.messaging_partner_inventory_categories including defaults)'
  )

  console.log(`[import] COPY staging categories <- ${cats}`)
  await runCopyFrom(client, '_partner_sync_staging_categories', cats, copyFormat)
  console.log(`[import] COPY staging inventory <- ${inv}`)
  await runCopyFrom(client, '_partner_sync_staging_inventory', inv, copyFormat)
  console.log(`[import] COPY staging inventory_categories <- ${links}`)
  await runCopyFrom(client, '_partner_sync_staging_inventory_categories', links, copyFormat)

  if (remapPartner) {
    await client.query(
      `update public._partner_sync_staging_categories set partner_id = $1::uuid where partner_id = $2::uuid`,
      [targetPartnerId, srcPartnerId]
    )
    await client.query(
      `update public._partner_sync_staging_inventory set partner_id = $1::uuid where partner_id = $2::uuid`,
      [targetPartnerId, srcPartnerId]
    )
  }

  console.log('[import] INSERT categories')
  const depthRows = await client.query(
    `select coalesce(max(depth), 1)::int as max_depth from public._partner_sync_staging_categories`
  )
  const maxDepth = depthRows.rows[0]?.max_depth ?? 1
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const ins = await client.query(
      `insert into public.messaging_partner_categories
       select * from public._partner_sync_staging_categories
       where depth = $1`,
      [depth]
    )
    console.log(`[import] categories depth=${depth} inserted=${ins.rowCount ?? 0}`)
  }
  console.log('[import] INSERT inventory')
  await client.query(`insert into public.messaging_partner_inventory select * from public._partner_sync_staging_inventory`)
  console.log('[import] INSERT inventory_categories')
  await client.query(
    `insert into public.messaging_partner_inventory_categories select * from public._partner_sync_staging_inventory_categories`
  )

  await client.query('drop table if exists public._partner_sync_staging_categories')
  await client.query('drop table if exists public._partner_sync_staging_inventory')
  await client.query('drop table if exists public._partner_sync_staging_inventory_categories')
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  console.log(`[import] partner=${partnerId}`)
  if (sourcePartnerId) console.log(`[import] source_partner=${sourcePartnerId}`)

  const beforeInv = await countRows(client, 'messaging_partner_inventory', 'where partner_id = $1::uuid', [partnerId])
  const beforeCat = await countRows(client, 'messaging_partner_categories', 'where partner_id = $1::uuid', [partnerId])
  console.log(`[import] before inventory=${beforeInv} categories=${beforeCat}`)

  await client.query('begin')
  try {
    await client.query(
      `delete from public.messaging_partner_inventory_categories pic
       using public.messaging_partner_inventory inv
       where pic.inventory_id = inv.id and inv.partner_id = $1::uuid`,
      [partnerId]
    )
    await client.query(`delete from public.messaging_partner_inventory where partner_id = $1::uuid`, [partnerId])
    await client.query(`delete from public.messaging_partner_categories where partner_id = $1::uuid`, [partnerId])

    if (sqlPath) {
      const psql = resolvePsqlBin()
      console.log(`[import] running ${psql} -f ${sqlPath}`)
      const run = spawnSync(psql, ['-v', 'ON_ERROR_STOP=1', databaseUrl, '-f', sqlPath], {
        stdio: 'inherit',
        env: process.env,
      })
      if (run.status !== 0) throw new Error(`psql import failed (exit ${run.status ?? 'unknown'})`)
    } else {
      await importFromCsvDir(client, copyDir, partnerId, sourcePartnerId)
    }

    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  }

  const afterInv = await countRows(client, 'messaging_partner_inventory', 'where partner_id = $1::uuid', [partnerId])
  const afterCat = await countRows(client, 'messaging_partner_categories', 'where partner_id = $1::uuid', [partnerId])
  const afterImgVec = await countRows(
    client,
    'messaging_partner_inventory',
    'where partner_id = $1::uuid and image_embedding_vec is not null',
    [partnerId]
  )
  const afterTxtVec = await countRows(
    client,
    'messaging_partner_inventory',
    'where partner_id = $1::uuid and text_embedding_vec is not null',
    [partnerId]
  )
  const afterLinks = await client.query(
    `select count(*)::int as c
     from public.messaging_partner_inventory_categories pic
     join public.messaging_partner_inventory inv on inv.id = pic.inventory_id
     where inv.partner_id = $1::uuid`,
    [partnerId]
  )

  console.log('[import] after:')
  console.log(`  inventory=${afterInv}`)
  console.log(`  categories=${afterCat}`)
  console.log(`  inventory_category_links=${afterLinks.rows[0]?.c ?? 0}`)
  console.log(`  image_embedding_vec=${afterImgVec}`)
  console.log(`  text_embedding_vec=${afterTxtVec}`)

  await client.end()
}

main().catch((err) => {
  console.error('[import] ERROR', err instanceof Error ? err.message : err)
  process.exit(1)
})
