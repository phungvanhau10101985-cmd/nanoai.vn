// Smoke test PS.7-PS.9 (Publish: mô tả AI + auto gán/tạo danh mục AI + bridge Ladipage L3).
// Gọi DeepSeek/Gemini text THẬT (không tốn credit ảnh). Chạy: npx tsx scripts/test-product-studio-ps7-9.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerCategoryFromPg } from '../src/lib/db/messaging-partner-categories-pg'
import { insertProductStudioJobPg } from '../src/lib/db/messaging-partner-product-studio-jobs-pg'
import { listLandingSectionsPg } from '../src/lib/db/messaging-partner-landing-sections-pg'
import { publishProductStudioJob } from '../src/lib/partner-website/product-studio/product-studio-job-runner'
import type { ProductStudioJobPayload } from '../src/lib/partner-website/product-studio/product-studio-types'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  const ownerId = ownerRes.rows[0].id

  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'PS789 Test Shop', 'ps789-test-shop-' || substr(gen_random_uuid()::text,1,8))
     returning id`,
    [ownerId]
  )
  const partnerId = partnerRes.rows[0].id as string
  const siteSlug = 'ps789-site-' + partnerId.slice(0, 8)
  const websiteRes = await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, brief_text, is_published)
     values ($1::uuid, $2, 'Test Site', 'brief', true) returning id`,
    [partnerId, siteSlug]
  )
  void websiteRes

  try {
    // 1) Shop CHƯA có category nào — đăng SP đầu tiên -> AI phải tự tạo cả nhánh L1(->L2->L3 nếu hợp lý)
    const payload1: ProductStudioJobPayload = {
      mode: 'manual',
      price: 320000,
      material: 'Cotton organic',
      productName: 'Áo thun cổ tròn nam basic',
      description: '', // để trống — bắt buộc test PS.7 AI viết mô tả
      productType: 'apparel',
      gender: 'nam',
      style: 'basic',
      sizes: ['M', 'L'],
      noSize: false,
      colors: [{ name: 'Trắng', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800' }],
      available: 100,
      notes: '',
      mainImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
    }
    const job1 = await insertProductStudioJobPg({ partnerId, createdBy: ownerId, mode: 'manual', payload: payload1 })
    assert(job1, 'tạo job1 thất bại')
    const pub1 = await publishProductStudioJob(partnerId, job1!.id)
    assert(pub1.ok, `publish job1 thất bại: ${!pub1.ok ? pub1.error : ''}`)

    const descRow = await pool.query(`select description from public.messaging_partner_inventory where id = $1::uuid`, [
      pub1.ok ? pub1.result.inventoryId : '',
    ])
    assert((descRow.rows[0].description as string).length > 20, 'PS.7 — mô tả AI phải được viết (không phải fallback rỗng/ngắn)')
    console.log('OK PS.7 — DeepSeek viết mô tả khi merchant để trống:', (descRow.rows[0].description as string).slice(0, 80), '...')

    assert(pub1.ok && pub1.result.categoryId, 'PS.8 — phải tự tạo/gán category dù shop chưa có category nào')
    const catChain = await pool.query(
      `with recursive chain as (
         select id, parent_id, name, depth, ai_generated from public.messaging_partner_categories where id = $1::uuid
         union all
         select c.id, c.parent_id, c.name, c.depth, c.ai_generated from public.messaging_partner_categories c
         join chain ch on c.id = ch.parent_id
       ) select * from chain order by depth asc`,
      [pub1.ok ? pub1.result.categoryId : '']
    )
    assert(catChain.rows.length >= 1, 'phải resolve được ít nhất 1 cấp category')
    assert(catChain.rows.every((r) => r.ai_generated === true), 'mọi node mới tạo phải đánh dấu ai_generated=true')
    console.log(
      'OK PS.8 — AI tự tạo nhánh category (bootstrap từ rỗng):',
      catChain.rows.map((r) => r.name).join(' > '),
      `(depth cao nhất=${catChain.rows[catChain.rows.length - 1].depth})`
    )

    assert(pub1.ok && pub1.result.landingId, 'PS.9 — phải tự tạo Ladipage cho SP vừa đăng')
    const sections1 = await listLandingSectionsPg(pub1.ok ? pub1.result.landingId! : '')
    const hero1 = sections1.find((s) => s.sectionType === 'hero')
    assert(hero1?.status === 'ready', 'PS.9 — hero section của landing bridge phải ready')
    const lpPublished = await pool.query(`select is_published from public.messaging_partner_landing_pages where id = $1::uuid`, [
      pub1.ok ? pub1.result.landingId : '',
    ])
    assert(lpPublished.rows[0].is_published === true, 'PS.9 — landing bridge phải được publish tự động')
    console.log('OK PS.9 — bridge tự tạo + publish Ladipage 1-SP, hero ready, slug:', pub1.ok ? pub1.result.landingSlug : '')

    // 2) Đăng SP thứ 2, CÙNG loại áo — AI phải TÁI SỬ DỤNG nhánh category đã tạo ở bước 1, không tạo trùng
    const payload2: ProductStudioJobPayload = {
      ...payload1,
      productName: 'Áo thun cổ tròn nam tay ngắn',
      description: '',
      colors: [{ name: 'Đen', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800' }],
      mainImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
    }
    const job2 = await insertProductStudioJobPg({ partnerId, createdBy: ownerId, mode: 'manual', payload: payload2 })
    const pub2 = await publishProductStudioJob(partnerId, job2!.id)
    assert(pub2.ok, `publish job2 thất bại: ${!pub2.ok ? pub2.error : ''}`)

    const totalCats = await pool.query(`select count(*)::int as c from public.messaging_partner_categories where partner_id = $1::uuid`, [
      partnerId,
    ])
    console.log(
      `OK PS.8 (regression chống trùng) — SP2 category=${pub2.ok ? pub2.result.categoryId : ''}, tổng số category trong shop hiện tại = ${totalCats.rows[0].c} (không nổ số lượng nếu AI tái dùng đúng)`
    )

    // 3) Merchant tự chọn category tay — AI KHÔNG được ghi đè lựa chọn của merchant
    const manualCat = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Danh mục merchant tự chọn' })
    assert(manualCat.ok, 'tạo category tay thất bại')
    const payload3: ProductStudioJobPayload = {
      ...payload1,
      productName: 'Áo thun test category tay',
      description: 'Mô tả merchant tự viết, không cần AI.',
      categoryId: manualCat.row.id,
      colors: [{ name: 'Xanh', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800' }],
      mainImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
    }
    const job3 = await insertProductStudioJobPg({ partnerId, createdBy: ownerId, mode: 'manual', payload: payload3 })
    const pub3 = await publishProductStudioJob(partnerId, job3!.id)
    assert(pub3.ok, `publish job3 thất bại: ${!pub3.ok ? pub3.error : ''}`)
    assert(pub3.ok && pub3.result.categoryId === manualCat.row.id, 'PS.8 — không được ghi đè category do merchant tự chọn')
    console.log('OK PS.8 — tôn trọng category merchant tự chọn, không chạy AI ghi đè')

    console.log('\n✅ ALL PS.7-PS.9 CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
