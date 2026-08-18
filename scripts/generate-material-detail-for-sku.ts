/**
 * Tạo lại ảnh chất liệu cho 1 SKU (prompt mới + ảnh SP gốc, không gửi ảnh mẫu layout).
 * Chạy: npx tsx scripts/generate-material-detail-for-sku.ts B0668
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\r/g, '').trim()
if (process.env.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY.replace(/\r/g, '').trim()

import { getPgPool, isPgConfigured } from '../src/lib/db/pool'
import { fetchPartnerInventoryRowBySkuForPartnerFromPg } from '../src/lib/db/messaging-partner-inventory-pg'
import { regenerateInventoryMaterialDetailImage } from '../src/lib/messaging/partner-inventory-material-detail-image'
import { pickPreferredWebsitePartnerId } from '../src/lib/partner-website/pick-preferred-website-partner'

async function main() {
  const sku = String(process.argv[2] || '').trim()
  if (!sku) {
    console.error('Usage: npx tsx scripts/generate-material-detail-for-sku.ts <SKU>')
    process.exit(1)
  }
  if (!isPgConfigured()) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  const pool = getPgPool()
  const found = await pool.query(
    `select mpi.partner_id, mp.slug as partner_slug, mp.display_name, mp.brand_name, mp.industry_key
       from public.messaging_partner_inventory mpi
       join public.messaging_partners mp on mp.id = mpi.partner_id
      where lower(trim(coalesce(mpi.sku, ''))) = lower($1)
        and coalesce(mpi.is_active, true) = true
      order by mpi.updated_at desc nulls last
      limit 20`,
    [sku]
  )
  if (!found.rows.length) {
    console.error(`Không thấy SKU ${sku} trong kho local`)
    process.exit(1)
  }
  const preferred = pickPreferredWebsitePartnerId(
    found.rows.map((r: { partner_id: string; partner_slug: string; display_name: string; brand_name: string | null; industry_key: string | null }) => ({
      id: r.partner_id,
      slug: r.partner_slug,
      display_name: r.display_name,
      brand_name: r.brand_name,
      industry_key: r.industry_key,
    }))
  )
  const partnerId = preferred || found.rows[0].partner_id
  const shop = found.rows.find((r: { partner_id: string }) => r.partner_id === partnerId) || found.rows[0]
  const inv = await fetchPartnerInventoryRowBySkuForPartnerFromPg(partnerId, sku)
  if (!inv) {
    console.error(`Không load được dòng kho SKU ${sku}`)
    process.exit(1)
  }
  console.log('SKU', inv.sku, '| shop', shop.partner_slug, '|', inv.name)
  console.log('Ảnh gốc', inv.image_url)
  if (!/^https?:\/\//i.test((inv.image_url || '').trim())) {
    console.error('Thiếu ảnh chính — không tạo được ảnh chất liệu')
    process.exit(1)
  }
  const result = await regenerateInventoryMaterialDetailImage(partnerId, inv)
  if (!result) {
    console.error('Tạo ảnh chất liệu thất bại (kiểm tra GOOGLE_API_KEY / Gemini)')
    process.exit(1)
  }
  console.log('OK ảnh chất liệu:', result.publicUrl)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
