// Smoke test L3.8 (public render): tạo landing category + section hero "ready" thật, curl trang công khai
// qua dev server thật (http://localhost:3000), xác nhận render React mới (không phải iframe cũ) và không
// vỡ layout. Chạy: npx tsx scripts/test-ladipage-ai-l3-public-render.ts  (cần `npm run dev` đang chạy)
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerCategoryFromPg } from '../src/lib/db/messaging-partner-categories-pg'
import { ensureDefaultLandingSectionsPg, updateLandingSectionPg, listLandingSectionsPg } from '../src/lib/db/messaging-partner-landing-sections-pg'
import { insertPartnerLandingPagePg, setPartnerLandingPublishedPg } from '../src/lib/db/messaging-partner-landing-pages-pg'
import { defaultLandingSectionPlan } from '../src/lib/partner-website/landing/landing-ai-types'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  const ownerId = ownerRes.rows[0].id

  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug, is_active)
     values ($1, 'LP Public Render Test', 'lp-public-render-' || substr(gen_random_uuid()::text,1,8), true)
     returning id`,
    [ownerId]
  )
  const partnerId = partnerRes.rows[0].id as string
  const siteSlug = 'lp-public-render-site-' + partnerId.slice(0, 8)
  const websiteRes = await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, brief_text, is_published)
     values ($1::uuid, $2, 'Test Site', 'brief', true) returning id`,
    [partnerId, siteSlug]
  )
  const websiteId = websiteRes.rows[0].id as string

  try {
    const cat = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Giày sneaker' })
    assert(cat.ok, 'category thất bại')
    const inv = await pool.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint, price_amount, image_url, is_active)
       values ($1::uuid, 'Giày sneaker trắng', '990.000đ', 990000, 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800', true)
       returning id`,
      [partnerId]
    )
    const invId = inv.rows[0].id as string
    await pool.query(
      `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary) values ($1::uuid, $2::uuid, true)`,
      [invId, cat.row.id]
    )

    const landing = await insertPartnerLandingPagePg({
      partnerId,
      websiteId,
      landingSlug: 'test-public-render',
      title: 'Giày sneaker trắng - Bộ sưu tập',
      briefText: '',
      locale: 'vi',
      inventoryIds: [],
      sourceType: 'category',
      categoryId: cat.row.id,
      productsLimit: 12,
    })
    assert(landing, 'tạo landing thất bại')

    const sections = await ensureDefaultLandingSectionsPg(landing!.id, defaultLandingSectionPlan())
    const hero = sections.find((s) => s.sectionType === 'hero')!
    await updateLandingSectionPg({
      landingId: landing!.id,
      sectionId: hero.id,
      status: 'ready',
      data: { headline: 'Giày sneaker trắng - Sale sốc', subheadline: 'Bền đẹp, dễ phối đồ', imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800' },
    })
    const published = await setPartnerLandingPublishedPg({ partnerId, landingId: landing!.id, published: true })
    assert(published?.isPublished, 'publish thất bại')

    const url = `http://localhost:3000/site/${siteSlug}/lp/test-public-render`
    console.log('Fetching', url)
    const res = await fetch(url)
    const html = await res.text()
    assert(res.status === 200, `public LP phải trả 200, thực tế: ${res.status}`)
    assert(html.includes('Giày sneaker trắng - Sale sốc'), 'HTML phải chứa headline hero AI đã sinh')
    assert(html.includes('data-lp-section="hero"'), 'HTML phải có marker data-lp-section (render React mới, không phải iframe)')
    assert(!html.includes('<iframe'), 'landing mới KHÔNG được render qua iframe cũ')
    console.log('OK public LP render React mới (hero ready) — status 200, có headline + marker section, không iframe')

    // Regression: landing legacy (chưa có section ready) vẫn phải fallback y hệt hành vi cũ (iframe placeholder)
    const legacyLanding = await insertPartnerLandingPagePg({
      partnerId,
      websiteId,
      landingSlug: 'test-legacy-render',
      title: 'Legacy landing',
      briefText: '',
      locale: 'vi',
      inventoryIds: [invId],
    })
    assert(legacyLanding, 'tạo legacy landing thất bại')
    await pool.query(
      `update public.messaging_partner_landing_pages set html_source = $2, is_published = true where id = $1::uuid`,
      [legacyLanding!.id, '<html><body><h1>Legacy HTML</h1></body></html>']
    )
    const legacyUrl = `http://localhost:3000/site/${siteSlug}/lp/test-legacy-render`
    const legacyRes = await fetch(legacyUrl)
    const legacyHtml = await legacyRes.text()
    assert(legacyRes.status === 200, `legacy LP phải trả 200, thực tế: ${legacyRes.status}`)
    assert(legacyHtml.includes('<iframe'), 'legacy landing (chưa có section ready) PHẢI vẫn render qua iframe cũ — không hồi quy')
    console.log('OK legacy landing (chưa generate AI section) vẫn giữ nguyên hành vi render iframe cũ — không hồi quy')

    console.log('\n✅ ALL L3.8 PUBLIC RENDER CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
