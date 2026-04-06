/**
 * Quick end-to-end sanity test for partner image search.
 *
 * Usage:
 *   npx tsx scripts/test-partner-image-search-once.ts <partnerId>
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { createServiceRoleClient } from '../src/lib/supabase/service-role'
import { fetchRemoteImageForCatalog } from '../src/lib/fetch-image-1688'
import { geminiProductSearchFromImageBufferViaVectorDb } from '../src/lib/messaging/partner-gemini-image-search'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })

const partnerId = (process.argv[2] || '').trim()
if (!partnerId) {
  console.error('Usage: npx tsx scripts/test-partner-image-search-once.ts <partnerId>')
  process.exit(1)
}

async function main() {
  const db = createServiceRoleClient()
  const { data: invRows, error } = await db
    .from('messaging_partner_inventory')
    .select('id,name,image_url,is_active')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .limit(50)

  if (error) throw new Error(error.message)
  const pick = (invRows ?? []).find((r) => /^https?:\/\//i.test((r.image_url || '').trim()))
  if (!pick?.image_url) throw new Error('No active inventory image_url found for test.')

  const img = await fetchRemoteImageForCatalog(pick.image_url, { timeoutMs: 15000 })
  if (!img?.buf) throw new Error('Failed to fetch test image from inventory URL.')

  const result = await geminiProductSearchFromImageBufferViaVectorDb(db, img.buf, partnerId, {
    maxResults: 5,
    userId: null,
  })

  console.log('partnerId:', partnerId)
  console.log('queryFromInventory:', { id: pick.id, name: pick.name, image_url: pick.image_url })
  console.log('error:', result.error ?? null)
  console.log(
    'topCandidates:',
    result.candidates.map((c) => ({ inventoryId: c.inventoryId, name: c.name, score: c.score }))
  )
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Test failed:', msg)
  process.exit(1)
})

