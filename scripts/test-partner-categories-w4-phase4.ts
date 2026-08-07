// Smoke test Phase 4 (W4.10/W4.11): giá số tự tính khi ghi + lọc/sắp xếp theo giá qua HTTP thật.
// Yêu cầu: dev server đang chạy. Chạy: npx tsx scripts/test-partner-categories-w4-phase4.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerCategoryFromPg, setCategoryProductsFromPg } from '../src/lib/db/messaging-partner-categories-pg'
import {
  insertPartnerInventoryDashboardItemFromPg,
  updatePartnerInventoryDashboardItemFromPg,
} from '../src/lib/db/messaging-partner-inventory-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3001'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const siteSlug = `w4-p4-shop-${Date.now().toString(36)}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W4 Phase4 Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string

  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale)
     values ($1::uuid, $2, 'W4 Phase4 Shop', 'vi')`,
    [partnerId, siteSlug]
  )

  try {
    // 1) W4.10 — tạo qua dashboard-style insert, price_hint có dấu chấm ngăn cách nghìn (đúng convention parseVndFromPriceHint)
    const idCheap = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      name: 'SP giá rẻ', sku: null, description: '', stock_note: '', stock_qty: 1,
      price_hint: '100.000đ', image_url: 'https://placehold.co/100', product_url: 'https://example.com/1',
      product_video_url: '', consult_note: '', material_note: '', material_detail_image_url: '',
      real_use_image_url: '', real_use_image_url_2: '', remarketing_id: null, sort_order: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    assert(idCheap, 'tạo SP giá rẻ thất bại')

    const idMid = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      name: 'SP giá vừa', sku: null, description: '', stock_note: '', stock_qty: 1,
      price_hint: '300.000đ', image_url: 'https://placehold.co/100', product_url: 'https://example.com/2',
      product_video_url: '', consult_note: '', material_note: '', material_detail_image_url: '',
      real_use_image_url: '', real_use_image_url_2: '', remarketing_id: null, sort_order: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    assert(idMid, 'tạo SP giá vừa thất bại')

    const idExpensive = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      name: 'SP giá cao', sku: null, description: '', stock_note: '', stock_qty: 1,
      price_hint: '900.000đ', image_url: 'https://placehold.co/100', product_url: 'https://example.com/3',
      product_video_url: '', consult_note: '', material_note: '', material_detail_image_url: '',
      real_use_image_url: '', real_use_image_url_2: '', remarketing_id: null, sort_order: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    assert(idExpensive, 'tạo SP giá cao thất bại')

    const priceCheck = await pool.query(
      `select id, name, price_amount from public.messaging_partner_inventory where id = any($1::uuid[]) order by price_amount asc`,
      [[idCheap, idMid, idExpensive]]
    )
    assert(priceCheck.rows.length === 3, 'phải có 3 dòng price_amount')
    assert(Number(priceCheck.rows[0].price_amount) === 100000, `giá rẻ phải = 100000, thực tế ${priceCheck.rows[0].price_amount}`)
    assert(Number(priceCheck.rows[1].price_amount) === 300000, `giá vừa phải = 300000, thực tế ${priceCheck.rows[1].price_amount}`)
    assert(Number(priceCheck.rows[2].price_amount) === 900000, `giá cao phải = 900000, thực tế ${priceCheck.rows[2].price_amount}`)
    console.log('OK W4.10: insertPartnerInventoryDashboardItemFromPg tự tính đúng price_amount')

    // 2) Sửa giá qua update -> price_amount phải cập nhật lại theo
    const updated = await updatePartnerInventoryDashboardItemFromPg(partnerId, idCheap!, {
      name: 'SP giá rẻ', sku: null, description: '', stock_note: '', stock_qty: 1,
      price_hint: '150.000đ', image_url: 'https://placehold.co/100', product_url: 'https://example.com/1',
      product_video_url: '', consult_note: '', material_note: '', material_detail_image_url: '',
      real_use_image_url: '', real_use_image_url_2: '', remarketing_id: null, sort_order: 0,
      updated_at: new Date().toISOString(),
    })
    assert(updated, 'update SP giá rẻ thất bại')
    const afterUpdate = await pool.query(`select price_amount from public.messaging_partner_inventory where id = $1::uuid`, [idCheap])
    assert(Number(afterUpdate.rows[0].price_amount) === 150000, `sau update phải = 150000, thực tế ${afterUpdate.rows[0].price_amount}`)
    console.log('OK W4.10: updatePartnerInventoryDashboardItemFromPg tự tính lại price_amount khi sửa price_hint')

    // 3) Gán cả 3 SP vào 1 category
    const cat = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Đồng hồ' })
    assert(cat.ok, 'tạo category thất bại')
    const assigned = await setCategoryProductsFromPg(partnerId, cat.row.id, [idCheap!, idMid!, idExpensive!])
    assert(assigned, 'gán 3 SP vào category thất bại')
    console.log('Seed OK. siteSlug =', siteSlug, ' category.id =', cat.row.id)

    // 4) W4.11 — API sort=price_asc
    const ascRes = await fetch(`${BASE}/api/site/${siteSlug}/products?categoryId=${cat.row.id}&sort=price_asc`)
    assert(ascRes.status === 200, `sort=price_asc status ${ascRes.status}`)
    const ascJson = (await ascRes.json()) as { products: Array<{ name: string }> }
    assert(ascJson.products.length === 3, `phải có 3 SP, thực tế ${ascJson.products.length}`)
    assert(
      ascJson.products[0].name === 'SP giá rẻ' && ascJson.products[2].name === 'SP giá cao',
      `thứ tự sort=price_asc sai: ${ascJson.products.map((p) => p.name).join(', ')}`
    )
    console.log('OK GET /api/site/{slug}/products?sort=price_asc trả đúng thứ tự tăng dần')

    // 5) sort=price_desc
    const descRes = await fetch(`${BASE}/api/site/${siteSlug}/products?categoryId=${cat.row.id}&sort=price_desc`)
    const descJson = (await descRes.json()) as { products: Array<{ name: string }> }
    assert(
      descJson.products[0].name === 'SP giá cao' && descJson.products[2].name === 'SP giá rẻ',
      `thứ tự sort=price_desc sai: ${descJson.products.map((p) => p.name).join(', ')}`
    )
    console.log('OK GET /api/site/{slug}/products?sort=price_desc trả đúng thứ tự giảm dần')

    // 6) minPrice/maxPrice
    const filteredRes = await fetch(
      `${BASE}/api/site/${siteSlug}/products?categoryId=${cat.row.id}&minPrice=200000&maxPrice=400000`
    )
    const filteredJson = (await filteredRes.json()) as { products: Array<{ name: string }>; total: number }
    assert(filteredJson.total === 1 && filteredJson.products[0]?.name === 'SP giá vừa', `lọc khoảng giá sai: total=${filteredJson.total}`)
    console.log('OK GET /api/site/{slug}/products?minPrice&maxPrice lọc đúng 1 SP trong khoảng')

    // 7) Trang danh mục phải render được (không lỗi) với price filter bar
    const pageRes = await fetch(`${BASE}/site/${siteSlug}/c/${cat.row.path}`)
    assert(pageRes.status === 200, `category page status ${pageRes.status}`)
    const html = await pageRes.text()
    assert(html.includes('SP giá rẻ') && html.includes('SP giá cao'), 'trang danh mục phải hiện đủ sản phẩm')
    console.log('OK trang danh mục render 200 kèm đủ sản phẩm giá khác nhau')

    console.log('\n✅ ALL PHASE 4 (W4.10/W4.11) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
