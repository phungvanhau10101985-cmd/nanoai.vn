/**
 * Backfill Gemini image embeddings for existing partner inventory.
 *
 * Usage:
 *   npx tsx scripts/backfill-partner-inventory-embeddings.ts
 *   npx tsx scripts/backfill-partner-inventory-embeddings.ts <partnerId>
 *   npx tsx scripts/backfill-partner-inventory-embeddings.ts <partnerId> --force
 *   npx tsx scripts/backfill-partner-inventory-embeddings.ts <partnerId> <inventoryItemId> [--text-only|--image-only] --force
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { isPgConfigured } from '../src/lib/db/pool'
import { pgQuery } from '../src/lib/db/pg-query'
import { syncPartnerInventoryEmbeddings } from '../src/lib/messaging/partner-inventory-embedding'
import { syncPartnerInventoryTextEmbeddings } from '../src/lib/messaging/partner-inventory-text-embedding'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })

const argvFlags = new Set(process.argv.filter((a) => a.startsWith('--')))
const posArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const partnerIdArg = posArgs[0]?.trim() || ''
const inventoryIdArg = posArgs[1]?.trim() || ''
const force = argvFlags.has('--force')
const textOnly = argvFlags.has('--text-only')
const imageOnly = argvFlags.has('--image-only')
const itemIds = inventoryIdArg ? [inventoryIdArg] : undefined

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
  console.log(
    `Mode: ${force ? 'force' : 'incremental'}${itemIds ? ` item=${itemIds[0]}` : ''}${textOnly ? ' (text only)' : ''}${imageOnly ? ' (image only)' : ''}`
  )
  if (textOnly && imageOnly) {
    console.error('Use only one of --text-only or --image-only.')
    process.exit(1)
  }

  let totalSynced = 0
  let totalFailed = 0
  let totalSkipped = 0
  let partnerErrors = 0

  for (const partnerId of partnerIds) {
    const startedAt = Date.now()
    const res = textOnly
      ? ({ ok: true as const, synced: 0, failed: 0, skipped: 0 })
      : await syncPartnerInventoryEmbeddings(partnerId, { force, inventoryIds: itemIds })
    const resText = imageOnly
      ? ({ ok: true as const, synced: 0, failed: 0, skipped: 0 })
      : await syncPartnerInventoryTextEmbeddings(partnerId, { force, inventoryIds: itemIds })
    const elapsedMs = Date.now() - startedAt
    if (!res.ok) {
      partnerErrors += 1
      console.error(`- ${partnerId}: IMAGE ERROR ${res.error} (${elapsedMs}ms)`)
      continue
    }
    if (!resText.ok) {
      partnerErrors += 1
      console.error(`- ${partnerId}: TEXT ERROR ${resText.error} (${elapsedMs}ms)`)
      continue
    }
    totalSynced += res.synced + resText.synced
    totalFailed += res.failed + resText.failed
    totalSkipped += res.skipped + resText.skipped
    console.log(
      `- ${partnerId}: image synced=${res.synced} text synced=${resText.synced}, failed=${res.failed + resText.failed}, skipped=${res.skipped + resText.skipped} (${elapsedMs}ms)`
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
