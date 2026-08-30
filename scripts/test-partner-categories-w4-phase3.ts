// Smoke test Phase 3 (W4.7/W4.8/W4.9): seed shop + category + inventory, then curl thật qua dev server.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-partner-categories-w4-phase3.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerCategoryFromPg, setCategoryProductsFromPg } from '../src/lib/db/messaging-partner-categories-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const siteSlug = `w4-p3-shop-${Date.now().toString(36)}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W4 Phase3 Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string

  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale)
     values ($1::uuid, $2, 'W4 Phase3 Shop', 'vi')`,
    [partnerId, siteSlug]
  )

  try {
    const l1 = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Áo', imageUrl: 'https://placehold.co/200' })
    assert(l1.ok, 'tạo L1 thất bại')
    const l2 = await insertPartnerCategoryFromPg({ partnerId, parentId: l1.row.id, name: 'Áo thun' })
    assert(l2.ok, 'tạo L2 thất bại')

    const invRes = await pool.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
       values ($1::uuid, 'Áo thun test', '150k', 'https://placehold.co/400', 'https://example.com/p', true)
       returning id`,
      [partnerId]
    )
    const invId = invRes.rows[0].id as string
    const assigned = await setCategoryProductsFromPg(partnerId, l2.row.id, [invId])
    assert(assigned, 'gán sản phẩm thất bại')

    console.log('Seed OK. siteSlug =', siteSlug, ' l1.path =', l1.row.path, ' l2.path =', l2.row.path)

    // 1) W4.8 — API cây danh mục công khai
    const catRes = await fetch(`${BASE}/api/site/${siteSlug}/categories`)
    assert(catRes.status === 200, `categories API status ${catRes.status}`)
    const catJson = (await catRes.json()) as { tree: Array<{ id: string; slug: string; children: unknown[] }> }
    assert(catJson.tree.length === 1, `phải có 1 root category, thực tế ${catJson.tree.length}`)
    assert(catJson.tree[0].slug === 'ao', `root slug sai: ${catJson.tree[0].slug}`)
    assert(catJson.tree[0].children.length === 1, 'root phải có 1 con')
    console.log('OK GET /api/site/{slug}/categories trả đúng cây')

    // 2) W4.7 — trang danh mục con render 200
    const pageRes = await fetch(`${BASE}/site/${siteSlug}/c/${l2.row.path}`)
    assert(pageRes.status === 200, `category page status ${pageRes.status} (path=${l2.row.path})`)
    const html = await pageRes.text()
    assert(html.includes('Áo thun'), 'trang danh mục phải chứa tên danh mục')
    assert(html.includes('Áo thun test'), 'trang danh mục phải chứa tên sản phẩm đã gán')
    console.log('OK GET /site/{slug}/c/{path} render 200 kèm đúng tên danh mục + sản phẩm')

    // 3) Listing `/c/{path}` — không khối «Danh mục con»; chỉ lọc + lưới + head.
    const parentPageRes = await fetch(`${BASE}/site/${siteSlug}/c/${l1.row.path}`)
    assert(parentPageRes.status === 200, `parent category page status ${parentPageRes.status}`)
    const parentHtml = await parentPageRes.text()
    assert(!parentHtml.includes('Danh mục con'), 'listing không hiện khối danh mục con')
    assert(!parentHtml.includes('pw-shop-category-tiles'), 'listing không hiện lưới tile con')
    console.log('OK trang danh mục listing không hiện khối danh mục con')

    // 4) Danh mục không tồn tại -> 404
    const notFoundRes = await fetch(`${BASE}/site/${siteSlug}/c/khong-ton-tai`)
    assert(notFoundRes.status === 404, `path không tồn tại phải trả 404, thực tế ${notFoundRes.status}`)
    console.log('OK path không tồn tại trả 404')

    // 5) W4.7 — API products lọc theo categoryId
    const prodRes = await fetch(`${BASE}/api/site/${siteSlug}/products?categoryId=${l2.row.id}`)
    assert(prodRes.status === 200, `products API status ${prodRes.status}`)
    const prodJson = (await prodRes.json()) as { products: Array<{ id: string }>; total: number }
    assert(prodJson.total === 1 && prodJson.products.length === 1, `phải có đúng 1 SP trong danh mục, thực tế ${prodJson.total}`)
    assert(prodJson.products[0].id === invId, 'SP trả về phải đúng id đã gán')
    console.log('OK GET /api/site/{slug}/products?categoryId= lọc đúng sản phẩm')

    console.log('\n✅ ALL PHASE 3 (W4.7/W4.8/W4.9) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
