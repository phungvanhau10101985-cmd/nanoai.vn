// Smoke test L3.1-L3.4 (Ladipage AI — data model, context builder, dispatcher sinh text/ảnh).
// Chạy: npx tsx scripts/test-ladipage-ai-l3-1-4.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerCategoryFromPg } from '../src/lib/db/messaging-partner-categories-pg'
import {
  ensureDefaultLandingSectionsPg,
  fetchLandingSectionByIdPg,
  listLandingSectionsPg,
  updateLandingSectionPg,
} from '../src/lib/db/messaging-partner-landing-sections-pg'
import { insertPartnerLandingPagePg } from '../src/lib/db/messaging-partner-landing-pages-pg'
import { buildLandingAiContext } from '../src/lib/partner-website/landing/landing-ai-context'
import { generateOrRegenerateLandingSection } from '../src/lib/partner-website/landing/landing-ai-dispatcher'
import { generateLandingSeo } from '../src/lib/partner-website/landing/landing-ai-content-generator'
import { defaultLandingSectionPlan } from '../src/lib/partner-website/landing/landing-ai-types'

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
     values ($1, 'Ladipage AI Test Shop', 'lp-ai-test-shop-' || substr(gen_random_uuid()::text,1,8))
     returning id`,
    [ownerId]
  )
  const partnerId = partnerRes.rows[0].id as string
  console.log('Partner:', partnerId)

  const websiteRes = await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, brief_text, is_published)
     values ($1::uuid, 'lp-ai-test-site-' || substr(gen_random_uuid()::text,1,8), 'Test Site', 'brief', true)
     returning id, site_slug`,
    [partnerId]
  )
  const websiteId = websiteRes.rows[0].id as string

  try {
    // 1) Category test + 2 sản phẩm thật (image_url public để test ảnh chất liệu)
    const cat = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Túi da' })
    assert(cat.ok, 'tạo category thất bại')
    if (cat.ok) {
      await pool.query(
        `update public.messaging_partner_categories set seo_title = $2, seo_description = $3 where id = $1::uuid`,
        [cat.row.id, 'Túi da cao cấp chính hãng', 'Mua túi da thật, bảo hành 12 tháng, giao nhanh toàn quốc.']
      )
    }
    const inv1 = await pool.query(
      `insert into public.messaging_partner_inventory
         (partner_id, name, price_hint, price_amount, image_url, material_note, description)
       values ($1::uuid, 'Túi da bò thật cao cấp', '1.200.000đ', 1200000,
               'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
               'Da bò thật nguyên tấm', 'Túi da bò thật, thiết kế tối giản, dùng hàng ngày.')
       returning id`,
      [partnerId]
    )
    const inv1Id = inv1.rows[0].id as string
    await pool.query(
      `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary) values ($1::uuid, $2::uuid, true)`,
      [inv1Id, cat.row.id]
    )
    const inv2 = await pool.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint, price_amount, image_url, material_note)
       values ($1::uuid, 'Túi da bò mini', '890.000đ', 890000,
               'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800', 'Da bò thật')
       returning id`,
      [partnerId]
    )
    const inv2Id = inv2.rows[0].id as string
    await pool.query(
      `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary) values ($1::uuid, $2::uuid, false)`,
      [inv2Id, cat.row.id]
    )

    // 2) Landing "products" (1-8 SP chọn tay — hành vi cũ) + landing "category" (mới, L3.2)
    const landingProducts = await insertPartnerLandingPagePg({
      partnerId,
      websiteId,
      landingSlug: 'test-lp-products',
      title: 'Bộ sưu tập túi da mini',
      briefText: 'Landing bán 2 mẫu túi da bò thật, nhấn mạnh chất liệu.',
      locale: 'vi',
      inventoryIds: [inv1Id, inv2Id],
    })
    assert(landingProducts, 'insertPartnerLandingPagePg (products) thất bại')
    assert(landingProducts!.sourceType === 'products', 'sourceType mặc định phải là products')

    const landingCategory = await insertPartnerLandingPagePg({
      partnerId,
      websiteId,
      landingSlug: 'test-lp-category',
      title: 'Túi da bò thật - Bộ sưu tập mới',
      briefText: '',
      locale: 'vi',
      inventoryIds: [],
      sourceType: 'category',
      categoryId: cat.ok ? cat.row.id : undefined,
      productsLimit: 12,
    })
    assert(landingCategory, 'insertPartnerLandingPagePg (category) thất bại')
    assert(landingCategory!.sourceType === 'category' && landingCategory!.categoryId === cat.row.id, 'landing category lưu sai source_type/categoryId')
    console.log('OK insertPartnerLandingPagePg — cả 2 kiểu source_type products/category')

    // 3) Context builder resolve LIVE cho cả 2 loại
    const ctxProducts = await buildLandingAiContext(partnerId, landingProducts!)
    assert(ctxProducts?.products.length === 2, 'context products phải có đúng 2 SP')
    assert(ctxProducts?.categoryName === 'Túi da', 'context products phải suy ra category từ SP đầu (đối trọng SEO)')
    console.log('OK buildLandingAiContext (source_type=products) resolve live đúng 2 SP + category đối trọng')

    const ctxCategory = await buildLandingAiContext(partnerId, landingCategory!)
    assert(ctxCategory?.products.length === 2, 'context category phải resolve live 2 SP trong category')
    assert(ctxCategory?.categorySeoTitle === 'Túi da cao cấp chính hãng', 'context category phải lấy đúng SEO title category')
    console.log('OK buildLandingAiContext (source_type=category) resolve live theo category_id')

    // 4) Data model sections — ensure plan mặc định 6 section đúng thứ tự
    const sections = await ensureDefaultLandingSectionsPg(landingCategory!.id, defaultLandingSectionPlan())
    assert(sections.length === 6, `phải có đúng 6 section, thực tế: ${sections.length}`)
    assert(sections[0].sectionType === 'hero' && sections[3].sectionType === 'products_grid', 'thứ tự section sai')
    assert(sections[3].status === 'ready', 'products_grid phải ready ngay (không phải nội dung AI)')
    console.log('OK ensureDefaultLandingSectionsPg tạo đủ 6 section, đúng thứ tự, products_grid ready ngay')

    // Idempotent — gọi lại không tạo trùng
    const sectionsAgain = await ensureDefaultLandingSectionsPg(landingCategory!.id, defaultLandingSectionPlan())
    assert(sectionsAgain.length === 6, 'ensureDefaultLandingSectionsPg phải idempotent (không tạo trùng)')
    console.log('OK ensureDefaultLandingSectionsPg idempotent')

    // 5) Dispatcher — sinh text thật (DeepSeek) cho hero/highlights/material/trust_cta/faq
    const heroSection = sections.find((s) => s.sectionType === 'hero')!
    const heroData = await generateOrRegenerateLandingSection(ctxCategory!, heroSection, {
      target: 'text',
      partnerId,
    })
    assert(typeof (heroData as { headline?: string }).headline === 'string' && (heroData as { headline: string }).headline.length > 0, 'hero text phải có headline')
    await updateLandingSectionPg({ landingId: landingCategory!.id, sectionId: heroSection.id, status: 'ready', data: heroData })
    console.log('OK dispatcher hero (text, DeepSeek thật) — headline:', (heroData as { headline: string }).headline)

    const materialSection = sections.find((s) => s.sectionType === 'material')!
    const materialData = await generateOrRegenerateLandingSection(ctxCategory!, materialSection, {
      target: 'text',
      partnerId,
    })
    assert(typeof (materialData as { body?: string }).body === 'string' && (materialData as { body: string }).body.length > 10, 'material text phải có body')
    assert(Array.isArray((materialData as { callouts?: string[] }).callouts), 'material phải có callouts[]')
    console.log('OK dispatcher material (text, DeepSeek thật) — callouts:', (materialData as { callouts: string[] }).callouts)

    const faqSection = sections.find((s) => s.sectionType === 'faq')!
    const faqData = await generateOrRegenerateLandingSection(ctxCategory!, faqSection, { target: 'text', partnerId })
    assert(Array.isArray((faqData as { items?: unknown[] }).items) && (faqData as { items: unknown[] }).items.length >= 1, 'faq phải có ít nhất 1 câu hỏi')
    console.log('OK dispatcher faq (text, DeepSeek thật) —', (faqData as { items: unknown[] }).items.length, 'câu hỏi')

    const productsGridData = await generateOrRegenerateLandingSection(
      ctxCategory!,
      sections.find((s) => s.sectionType === 'products_grid')!,
      { target: 'all', partnerId }
    )
    assert(Object.keys(productsGridData as object).length === 0, 'products_grid không phải nội dung AI — data phải rỗng')
    console.log('OK dispatcher products_grid trả rỗng (render live, không phải AI)')

    // 6) SEO — guardrail không trùng category SEO title
    const seo = await generateLandingSeo(ctxCategory!, (heroData as { headline?: string }).headline, (heroData as { subheadline?: string }).subheadline)
    assert(seo?.metaTitle && seo.metaTitle.length > 0, 'SEO phải trả metaTitle')
    console.log('OK generateLandingSeo (DeepSeek thật) — metaTitle:', seo?.metaTitle)

    // 7) Cập nhật DB — đọc lại xác nhận persist đúng
    await updateLandingSectionPg({ landingId: landingCategory!.id, sectionId: materialSection.id, status: 'ready', data: materialData })
    const reloaded = await fetchLandingSectionByIdPg(landingCategory!.id, materialSection.id)
    assert(reloaded?.status === 'ready' && (reloaded.data as { body?: string }).body, 'section material phải persist đúng sau update')
    console.log('OK updateLandingSectionPg/fetchLandingSectionByIdPg persist đúng')

    const listed = await listLandingSectionsPg(landingCategory!.id)
    assert(listed.length === 6, 'listLandingSectionsPg phải trả đủ 6 section')
    console.log('OK listLandingSectionsPg trả đủ 6 section theo order_index')

    console.log('\n✅ ALL L3.1-L3.4 CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
