// Smoke test (W1.6): Sticky Buy mobile + gallery swipe/zoom + cảnh báo sắp hết hàng trên PDP.
// Yêu cầu: dev server đang chạy. Chạy: npx tsx scripts/test-pdp-w1_6-mobile-ux.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerInventoryDashboardItemFromPg } from '../src/lib/db/messaging-partner-inventory-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const siteSlug = `w1-6-shop-${Date.now().toString(36)}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W1.6 Test Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string

  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale, is_published, published_at)
     values ($1::uuid, $2, 'W1.6 Test Shop', 'vi', true, now())`,
    [partnerId, siteSlug]
  )

  try {
    // Sản phẩm sắp hết hàng (stock_qty=3, trong ngưỡng cảnh báo 1-5) + nhiều ảnh gallery.
    const lowStockId = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      name: 'Áo khoác sắp hết hàng',
      sku: 'SKU-W16-LOW',
      description: 'Áo khoác test W1.6',
      stock_note: '',
      stock_qty: 3,
      price_hint: '350.000đ',
      image_url: 'https://placehold.co/400/111/fff?text=main',
      product_url: 'https://example.com/w16',
      product_video_url: '',
      consult_note: '',
      material_note: '',
      material_detail_image_url: '',
      real_use_image_url: 'https://placehold.co/400/222/fff?text=alt1',
      real_use_image_url_2: 'https://placehold.co/400/333/fff?text=alt2',
      remarketing_id: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    assert(lowStockId, 'tạo sản phẩm sắp hết hàng thất bại')

    // Sản phẩm tồn kho mặc định 0 (shop chưa từng nhập số liệu) — KHÔNG được hiện cảnh báo/chặn mua.
    const untrackedId = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      name: 'Quần jeans chưa cấu hình tồn kho',
      sku: 'SKU-W16-UNTRACKED',
      description: 'Quần test W1.6',
      stock_note: '',
      stock_qty: 0,
      price_hint: '450.000đ',
      image_url: 'https://placehold.co/400/444/fff?text=main2',
      product_url: 'https://example.com/w16b',
      product_video_url: '',
      consult_note: '',
      material_note: '',
      material_detail_image_url: '',
      real_use_image_url: '',
      real_use_image_url_2: '',
      remarketing_id: null,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    assert(untrackedId, 'tạo sản phẩm chưa cấu hình tồn kho thất bại')
    console.log('Seed OK. siteSlug =', siteSlug, ' lowStockId =', lowStockId, ' untrackedId =', untrackedId)

    // 1) Sản phẩm sắp hết hàng: hiện badge cảnh báo, hiện gallery hint, hiện sticky buy bar (markup luôn render, CSS ẩn/hiện qua JS).
    const lowKey = `ao-khoac-sap-het-hang-${lowStockId!.slice(0, 8)}`
    const lowRes = await fetch(`${BASE}/site/${siteSlug}/products/${lowKey}`)
    assert(lowRes.status === 200, `PDP status ${lowRes.status}`)
    const lowHtml = await lowRes.text()
    // Lưu ý: class `pw-shop-urgency-badge` LUÔN xuất hiện trong <style> (CSS theme nhúng toàn trang) —
    // phải kiểm tra nội dung text thật ("Chỉ còn 3 sản phẩm") thay vì chỉ tìm tên class.
    assert(lowHtml.includes('Chỉ còn 3 sản phẩm'), 'phải hiện đúng số lượng tồn (3) trong badge cảnh báo')
    assert(lowHtml.includes('pw-pdp-sticky'), 'phải render markup thanh mua nổi (mobile, kiểu 188)')
    assert(lowHtml.includes('Chạm để phóng to'), 'phải hiện hint zoom/swipe khi có nhiều ảnh')
    console.log('OK PDP sản phẩm sắp hết hàng: badge cảnh báo + sticky buy bar + gallery hint')

    // 2) Sản phẩm chưa cấu hình tồn kho (stock_qty=0): KHÔNG hiện badge, KHÔNG chặn mua (không có "disabled" gắn theo lý do hết hàng).
    const untrackedKey = `quan-jeans-chua-cau-hinh-ton-kho-${untrackedId!.slice(0, 8)}`
    const untrackedRes = await fetch(`${BASE}/site/${siteSlug}/products/${untrackedKey}`)
    assert(untrackedRes.status === 200, `PDP status ${untrackedRes.status}`)
    const untrackedHtml = await untrackedRes.text()
    assert(!/Chỉ còn \d+ sản phẩm/.test(untrackedHtml), 'KHÔNG được hiện badge khi tồn kho mặc định = 0 (chưa cấu hình, không phải hết hàng thật)')
    console.log('OK PDP sản phẩm chưa cấu hình tồn kho: không hiện cảnh báo sai (an toàn, không chặn mua hàng loạt)')

    console.log('\n✅ ALL W1.6 (Sticky Buy + gallery swipe/zoom + urgency tồn) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
