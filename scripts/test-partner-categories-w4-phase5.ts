// Smoke test Phase 5 (W4.12/S0.5/W4.13/S0.6): SEO danh mục (JSON-LD/canonical) + sitemap tenant + Product JSON-LD.
// Yêu cầu: dev server đang chạy. Chạy: npx tsx scripts/test-partner-categories-w4-phase5.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerCategoryFromPg, setCategoryProductsFromPg } from '../src/lib/db/messaging-partner-categories-pg'
import { insertPartnerInventoryDashboardItemFromPg } from '../src/lib/db/messaging-partner-inventory-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3002'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const siteSlug = `w4-p5-shop-${Date.now().toString(36)}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W4 Phase5 Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string

  // is_published = true -> bắt buộc để test sitemap.xml (route 404 nếu chưa publish)
  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale, is_published, published_at)
     values ($1::uuid, $2, 'W4 Phase5 Shop', 'vi', true, now())`,
    [partnerId, siteSlug]
  )

  try {
    const cat = await insertPartnerCategoryFromPg({
      partnerId,
      parentId: null,
      name: 'Giày thể thao',
      seoTitle: 'Giày thể thao chính hãng',
      seoDescription: 'Sưu tập giày thể thao đủ size, giao nhanh toàn quốc.',
    })
    assert(cat.ok, 'tạo category thất bại')

    const invId = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      name: 'Giày chạy bộ Pro', sku: 'SKU-P5', description: 'Giày chạy bộ êm ái', stock_note: '', stock_qty: 10,
      price_hint: '1.200.000đ', image_url: 'https://placehold.co/400', product_url: 'https://example.com/shoe',
      product_video_url: '', consult_note: '', material_note: '', material_detail_image_url: '',
      real_use_image_url: '', real_use_image_url_2: '', remarketing_id: null, sort_order: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    assert(invId, 'tạo sản phẩm thất bại')
    const assigned = await setCategoryProductsFromPg(partnerId, cat.row.id, [invId!])
    assert(assigned, 'gán sản phẩm thất bại')
    console.log('Seed OK. siteSlug =', siteSlug, ' category.path =', cat.row.path, ' invId =', invId)

    // 1) W4.12 — trang danh mục có JSON-LD BreadcrumbList + CollectionPage
    const catRes = await fetch(`${BASE}/site/${siteSlug}/c/${cat.row.path}`)
    assert(catRes.status === 200, `category page status ${catRes.status}`)
    const catHtml = await catRes.text()
    assert(catHtml.includes('"@type":"BreadcrumbList"'), 'trang danh mục phải có JSON-LD BreadcrumbList')
    assert(catHtml.includes('"@type":"CollectionPage"'), 'trang danh mục phải có JSON-LD CollectionPage')
    assert(catHtml.includes('Giày thể thao'), 'JSON-LD/HTML phải chứa tên danh mục')
    console.log('OK trang danh mục có JSON-LD BreadcrumbList + CollectionPage')

    // 2) SEO title/description dùng seoTitle/seoDescription đã set
    assert(catHtml.includes('Giày thể thao chính hãng'), 'metadata phải dùng seoTitle đã đặt')
    console.log('OK metadata category dùng seoTitle tuỳ chỉnh')

    // 3) S0.6 — trang sản phẩm có JSON-LD Product + Offer (vì đã có price_amount)
    const key = `giay-chay-bo-pro-${invId!.slice(0, 8)}`
    const prodRes = await fetch(`${BASE}/site/${siteSlug}/products/${key}`)
    assert(prodRes.status === 200, `product page status ${prodRes.status}`)
    const prodHtml = await prodRes.text()
    assert(prodHtml.includes('"@type":"Product"'), 'trang sản phẩm phải có JSON-LD Product')
    assert(prodHtml.includes('"@type":"Offer"'), 'trang sản phẩm phải có JSON-LD Offer (đã có price_amount)')
    assert(prodHtml.includes('"price":1200000'), 'Offer.price phải đúng 1200000')
    assert(prodHtml.includes('"priceCurrency":"VND"'), 'Offer.priceCurrency phải là VND')
    console.log('OK trang sản phẩm có JSON-LD Product + Offer với giá đúng')

    // 4) S0.5/W4.13 — sitemap.xml có home + category + product
    const sitemapRes = await fetch(`${BASE}/site/${siteSlug}/sitemap.xml`)
    assert(sitemapRes.status === 200, `sitemap.xml status ${sitemapRes.status}`)
    const contentType = sitemapRes.headers.get('content-type') || ''
    assert(contentType.includes('xml'), `Content-Type phải là xml, thực tế ${contentType}`)
    const sitemapXml = await sitemapRes.text()
    assert(sitemapXml.includes(`/site/${siteSlug}/c/${cat.row.path}`), 'sitemap phải chứa URL danh mục')
    assert(sitemapXml.includes(`/site/${siteSlug}/products/${key}`), 'sitemap phải chứa URL sản phẩm')
    assert(sitemapXml.includes('<urlset'), 'sitemap phải là XML urlset hợp lệ')
    console.log('OK GET /site/{slug}/sitemap.xml trả đúng home + category + product')

    console.log('\n✅ ALL PHASE 5 (W4.12/S0.5/W4.13/S0.6) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
