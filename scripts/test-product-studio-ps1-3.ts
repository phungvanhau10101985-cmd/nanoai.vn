// Smoke test PS.1-PS.3/PS.10 (Product Studio — đăng sản phẩm thủ công): schema, publish, backward-compat.
// Chạy: npx tsx scripts/test-product-studio-ps1-3.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerCategoryFromPg } from '../src/lib/db/messaging-partner-categories-pg'
import { fetchPartnerInventoryRowByProductUrlFromPg } from '../src/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerCategoryFacetCountsFromPg } from '../src/lib/db/messaging-partner-inventory-pg'
import {
  insertProductStudioJobPg,
  fetchProductStudioJobByIdPg,
} from '../src/lib/db/messaging-partner-product-studio-jobs-pg'
import { publishProductStudioJob } from '../src/lib/partner-website/product-studio/product-studio-job-runner'
import { getProductPurchaseOptions } from '../src/lib/messaging/guest-chat-ordering'
import type { ProductStudioJobPayload } from '../src/lib/partner-website/product-studio/product-studio-types'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()

  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'Product Studio Test Shop', 'ps-test-shop-' || substr(gen_random_uuid()::text,1,8))
     returning id`,
    [ownerId]
  )
  const partnerId = partnerRes.rows[0].id as string
  console.log('Partner:', partnerId)

  try {
    // 1) Tạo job thủ công đầy đủ dữ liệu (màu + size + gallery + category có sẵn)
    const cat = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Áo' })
    assert(cat.ok, 'tạo category test thất bại')

    const payload: ProductStudioJobPayload = {
      mode: 'manual',
      price: 259000,
      material: 'Cotton 100%',
      productName: 'Áo thun test Product Studio',
      description: 'Áo thun cotton mềm mại, thoáng mát — mô tả thật do merchant nhập.',
      productType: 'apparel',
      gender: 'unisex',
      style: 'basic',
      sizes: ['S', 'M', 'L'],
      noSize: false,
      colors: [
        { name: 'Trắng', img: 'https://example.com/ao-trang.jpg' },
        { name: 'Đen', img: 'https://example.com/ao-den.jpg' },
      ],
      available: 100,
      notes: 'Ghi chú nội bộ',
      mainImage: 'https://example.com/ao-trang.jpg',
      gallery: ['https://example.com/ao-detail-1.jpg'],
      categoryId: cat.row.id,
    }

    const job = await insertProductStudioJobPg({
      partnerId,
      createdBy: ownerId,
      mode: 'manual',
      payload,
      status: 'publishing',
      step: 'create_product',
    })
    assert(job, 'insertProductStudioJobPg thất bại')
    console.log('OK insertProductStudioJobPg — job:', job!.id)

    const published = await publishProductStudioJob(partnerId, job!.id)
    assert(published.ok, `publishProductStudioJob thất bại: ${!published.ok ? published.error : ''}`)
    const inventoryId = published.ok ? published.result.inventoryId : ''
    console.log('OK publishProductStudioJob — inventory:', inventoryId, 'category:', published.ok ? published.result.categoryId : null)

    const jobAfter = await fetchProductStudioJobByIdPg(partnerId, job!.id)
    assert(jobAfter?.status === 'done', 'job phải ở status done sau publish')
    assert(jobAfter?.result?.inventoryId === inventoryId, 'job.result.inventoryId phải khớp')
    console.log('OK job status=done + result lưu đúng')

    // 2) Đọc lại dòng inventory — kiểm tra cột structured
    const invRow = await pool.query(
      `select colors_json, sizes_json, gallery_urls, origin, description, stock_note, price_amount
       from public.messaging_partner_inventory where id = $1::uuid`,
      [inventoryId]
    )
    const inv = invRow.rows[0]
    assert(Array.isArray(inv.colors_json) && inv.colors_json.length === 2, 'colors_json phải có 2 màu')
    assert(Array.isArray(inv.sizes_json) && inv.sizes_json.length === 3, 'sizes_json phải có 3 size')
    assert(inv.origin === 'manual', 'origin phải = manual')
    assert(inv.description.startsWith('Áo thun cotton'), 'description phải là text thật (không phải JSON size)')
    assert(inv.stock_note === '', 'stock_note phải để trống (colors đã ở colors_json)')
    assert(Number(inv.price_amount) === 259000, 'price_amount phải = 259000')
    console.log('OK dòng inventory dùng cột structured mới, không đụng quy ước description/stock_note cũ')

    // 3) getProductPurchaseOptions (chat AI) phải đọc đúng màu/size từ cột mới
    await pool.query(`update public.messaging_partner_inventory set product_url = $2 where id = $1::uuid`, [
      inventoryId,
      'https://shop.local/p/test-ps',
    ])
    const opts = await getProductPurchaseOptions({ partnerId, productUrl: 'https://shop.local/p/test-ps' })
    assert(opts?.colors.length === 2, 'getProductPurchaseOptions phải trả 2 màu từ colors_json')
    assert(opts?.sizes.length === 3, 'getProductPurchaseOptions phải trả 3 size từ sizes_json')
    console.log('OK getProductPurchaseOptions ưu tiên cột structured mới (regression-safe)')

    // 4) Regression: sản phẩm CŨ (chỉ có stock_note/description JSON legacy) vẫn parse đúng như trước
    const legacyRes = await pool.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint, stock_note, description, product_url)
       values ($1::uuid, 'SP cũ legacy', '100k', '[{"name":"Xanh","img":"https://example.com/xanh.jpg"}]', '["M","L"]', 'https://shop.local/p/legacy-ps')
       returning id`,
      [partnerId]
    )
    const legacyId = legacyRes.rows[0].id as string
    const legacyOpts = await getProductPurchaseOptions({ partnerId, productUrl: 'https://shop.local/p/legacy-ps' })
    assert(legacyOpts?.colors.length === 1 && legacyOpts.colors[0].name === 'Xanh', 'SP cũ vẫn phải đọc màu từ stock_note JSON (fallback)')
    assert(legacyOpts?.sizes.length === 2, 'SP cũ vẫn phải đọc size từ description JSON (fallback)')
    console.log('OK sản phẩm cũ (trước Product Studio) vẫn hoạt động y hệt trước — không hồi quy')
    void legacyId
    void fetchPartnerInventoryRowByProductUrlFromPg

    // 5) Facet count theo category — trộn cả SP mới (structured) lẫn logic cũ vẫn không lỗi
    await pool.query(
      `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
       values ($1::uuid, $2::uuid, true)
       on conflict (inventory_id, category_id) do nothing`,
      [inventoryId, cat.row.id]
    )
    const facets = await fetchPartnerCategoryFacetCountsFromPg(partnerId, cat.row.id)
    assert(facets && facets.sizes.length === 3, `facet sizes phải có 3, thực tế: ${facets?.sizes.length}`)
    assert(facets && facets.colors.length === 2, `facet colors phải có 2, thực tế: ${facets?.colors.length}`)
    console.log('OK fetchPartnerCategoryFacetCountsFromPg đọc đúng từ cột structured mới')

    console.log('\n✅ ALL PS.1-PS.3/PS.10 CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
