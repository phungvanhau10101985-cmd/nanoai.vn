/**
 * Lấp cột catalog (size/màu/gallery/danh mục) từ GET kho khách.
 *   npx tsx scripts/fill-external-catalog-fields.ts <partnerId>
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\r/g, '').trim()

import { runPartnerExternalCatalogFieldFillJob } from '../src/lib/messaging/partner-inventory-external-catalog-sync'

async function main() {
  const partnerId = String(process.argv[2] || '').trim()
  if (!partnerId) {
    console.error('Usage: npx tsx scripts/fill-external-catalog-fields.ts <partnerId>')
    process.exit(1)
  }
  console.log('[fill] start', partnerId, new Date().toISOString())
  const out = await runPartnerExternalCatalogFieldFillJob({ partnerId })
  console.log('[fill] outcome', JSON.stringify(out, null, 2))
  if (!out.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
