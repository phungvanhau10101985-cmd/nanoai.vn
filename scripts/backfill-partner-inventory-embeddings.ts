/**
 * Backfill Gemini image embeddings for existing partner inventory.
 *
 * Usage:
 *   npx tsx scripts/backfill-partner-inventory-embeddings.ts
 *   npx tsx scripts/backfill-partner-inventory-embeddings.ts <partnerId>
 *   npx tsx scripts/backfill-partner-inventory-embeddings.ts <partnerId> --force
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { isPgConfigured } from '../src/lib/db/pool'
import { pgQuery } from '../src/lib/db/pg-query'
import { syncPartnerInventoryEmbeddings } from '../src/lib/messaging/partner-inventory-embedding'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })

const partnerIdArg = process.argv[2]?.trim() || ''
const force = process.argv.includes('--force')

async function listPartnerIdsWithInventory(): Promise<string[]> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL is required')
  }
  const rows = await pgQuery<{ partner_id: string }>(
    `select distinct partner_id::text as partner_id from public.messaging_partner_inventory`,
    []
  )
  const set = new Set<string>()
  for (const row of rows) {
    const id = (row.partner_id ?? '').trim()
    if (id) set.add(id)
  }
  return Array.from(set)
}

async function main() {
  const partnerIds = partnerIdArg ? [partnerIdArg] : await listPartnerIdsWithInventory()

  if (partnerIds.length === 0) {
    console.log('No partner inventory found. Nothing to backfill.')
    return
  }

  console.log(`Backfilling inventory embeddings for ${partnerIds.length} partner(s)...`)
  console.log(`Mode: ${force ? 'force' : 'incremental'}`)

  let totalSynced = 0
  let totalFailed = 0
  let totalSkipped = 0
  let partnerErrors = 0

  for (const partnerId of partnerIds) {
    const startedAt = Date.now()
    const res = await syncPartnerInventoryEmbeddings(partnerId, { force })
    const elapsedMs = Date.now() - startedAt
    if (!res.ok) {
      partnerErrors += 1
      console.error(`- ${partnerId}: ERROR ${res.error} (${elapsedMs}ms)`)
      continue
    }
    totalSynced += res.synced
    totalFailed += res.failed
    totalSkipped += res.skipped
    console.log(
      `- ${partnerId}: synced=${res.synced}, failed=${res.failed}, skipped=${res.skipped} (${elapsedMs}ms)`
    )
  }

  console.log('---')
  console.log(
    `Done. partners=${partnerIds.length}, partnerErrors=${partnerErrors}, synced=${totalSynced}, failed=${totalFailed}, skipped=${totalSkipped}`
  )
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
