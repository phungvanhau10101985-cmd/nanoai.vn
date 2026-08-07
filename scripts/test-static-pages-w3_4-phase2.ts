// Smoke test Phase 2 (W3.3/W3.4): trang có sẵn ghi đè + trang tự do mới render 200 qua HTTP thật.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-static-pages-w3_4-phase2.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { insertPartnerStaticPageFromPg } from '../src/lib/db/messaging-partner-static-pages-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const tag = Date.now().toString(36)
  const siteSlug = `w3-4-p2-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W3.4 Phase2 Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string
  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale)
     values ($1::uuid, $2, 'W3.4 Phase2 Shop', 'vi')`,
    [partnerId, siteSlug]
  )

  try {
    // Trang KHÔNG có ghi đè (contact) -> vẫn dùng nội dung mặc định (regression an toàn).
    const contactRes = await fetch(`${BASE}/site/${siteSlug}/contact`)
    assert(contactRes.status === 200, `trang contact mặc định phải render 200, thực tế ${contactRes.status}`)
    console.log('OK REGRESSION: trang có sẵn CHƯA ghi đè vẫn render nội dung mặc định bình thường')

    // Ghi đè trang "about".
    const overrideRes = await insertPartnerStaticPageFromPg(partnerId, {
      slug: 'about', title: 'Câu chuyện thương hiệu Test W3.4', content: 'Đoạn giới thiệu tuỳ chỉnh đầu tiên.\n\nĐoạn thứ hai.',
      seoTitle: 'SEO Title Tuỳ Chỉnh W3.4', seoDescription: 'Mô tả SEO tuỳ chỉnh', seoIndex: false, isPublished: true,
    })
    assert(overrideRes.ok, 'ghi đè trang about thất bại')

    const aboutRes = await fetch(`${BASE}/site/${siteSlug}/about`)
    assert(aboutRes.status === 200, `trang about ghi đè phải render 200, thực tế ${aboutRes.status}`)
    const aboutHtml = await aboutRes.text()
    assert(aboutHtml.includes('Câu chuyện thương hiệu Test W3.4'), 'trang about phải hiện tiêu đề đã ghi đè')
    assert(aboutHtml.includes('Đoạn giới thiệu tuỳ chỉnh đầu tiên'), 'trang about phải hiện nội dung đã ghi đè')
    assert(aboutHtml.includes('SEO Title Tuỳ Chỉnh W3.4'), 'meta title phải dùng SEO title tuỳ chỉnh')
    assert(aboutHtml.includes('noindex'), 'seoIndex=false phải render meta robots noindex')
    console.log('OK trang about ĐÃ ghi đè: hiện đúng title/nội dung/SEO tuỳ chỉnh, tôn trọng seoIndex=false')

    // Trang tự do mới.
    const customRes = await insertPartnerStaticPageFromPg(partnerId, {
      slug: 'huong-dan-size', title: 'Hướng dẫn chọn size W3.4', content: 'Nội dung bảng size chi tiết.',
    })
    assert(customRes.ok, 'tạo trang tự do thất bại')

    const customPageRes = await fetch(`${BASE}/site/${siteSlug}/pages/huong-dan-size`)
    assert(customPageRes.status === 200, `trang tự do phải render 200, thực tế ${customPageRes.status}`)
    const customHtml = await customPageRes.text()
    assert(customHtml.includes('Hướng dẫn chọn size W3.4') && customHtml.includes('Nội dung bảng size chi tiết'), 'trang tự do phải hiện đúng nội dung')
    console.log('OK GET /site/{slug}/pages/{pageSlug}: trang tự do mới render đúng nội dung')

    // Trang tự do không tồn tại -> 404.
    const notFoundRes = await fetch(`${BASE}/site/${siteSlug}/pages/khong-ton-tai`)
    assert(notFoundRes.status === 404, `trang tự do không tồn tại phải 404, thực tế ${notFoundRes.status}`)
    console.log('OK trang tự do không tồn tại -> 404')

    // Admin API: list + tạo qua HTTP thật (dev bypass).
    const devUserRes = await pool.query(`select id from auth.users where lower(email) = 'dev@local.test' limit 1`)
    if (devUserRes.rows.length) {
      await pool.query(`update public.messaging_partners set owner_user_id = $1::uuid where id = $2::uuid`, [devUserRes.rows[0].id, partnerId])
      const listRes = await fetch(`${BASE}/api/messaging/partners/${partnerId}/static-pages`)
      assert(listRes.status === 200, `admin list status ${listRes.status}`)
      const listJson = (await listRes.json()) as { pages: Array<{ slug: string }> }
      assert(listJson.pages.length === 2, `admin phải thấy 2 trang, thực tế ${listJson.pages.length}`)
      console.log('OK GET /api/messaging/partners/{id}/static-pages (admin, dev bypass) trả đúng dữ liệu qua HTTP thật')
    }

    console.log('\n✅ ALL W3.3/W3.4 PHASE 2 (render + admin API qua HTTP thật) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
