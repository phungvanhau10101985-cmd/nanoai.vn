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
import { createServiceRoleClient } from '../src/lib/supabase/service-role'
import { syncPartnerInventoryEmbeddings } from '../src/lib/messaging/partner-inventory-embedding'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })

const partnerIdArg = process.argv[2]?.trim() || ''
const force = process.argv.includes('--force')

async function listPartnerIdsWithInventory(): Promise<string[]> {
  const db = createServiceRoleClient()
  const pageSize = 1000
  let from = 0
  const set = new Set<string>()

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await db
      .from('messaging_partner_inventory')
      .select('partner_id')
      .range(from, to)

    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const row of rows) {
      const id = (row.partner_id ?? '').trim()
      if (id) set.add(id)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }

  return Array.from(set)
}

async function main() {
  const db = createServiceRoleClient()
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
    const res = await syncPartnerInventoryEmbeddings(db, partnerId, { force })
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
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Backfill failed:', msg)
  process.exit(1)
})

