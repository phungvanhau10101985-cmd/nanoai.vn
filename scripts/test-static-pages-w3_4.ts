// Smoke test (W3.3/W3.4): CMS trang tĩnh + SEO theo shop — DB layer.
// Chạy: npx tsx scripts/test-static-pages-w3_4.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  deletePartnerStaticPageFromPg,
  fetchPartnerStaticPagesForAdminFromPg,
  fetchPublishedPartnerStaticPageBySlugFromPg,
  insertPartnerStaticPageFromPg,
  updatePartnerStaticPageFromPg,
} from '../src/lib/db/messaging-partner-static-pages-pg'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const tag = Date.now().toString(36)
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W3.4 Test Shop', $2) returning id`,
    [ownerId, `w3-4-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  try {
    // 1) Ghi đè trang có sẵn (slug = 'about').
    const aboutOverride = await insertPartnerStaticPageFromPg(partnerId, {
      slug: 'about', title: 'Về chúng tôi (tuỳ chỉnh)', content: 'Đoạn 1.\n\nĐoạn 2.',
      seoTitle: 'Custom SEO title', seoDescription: 'Custom SEO desc', seoIndex: true, isPublished: true,
    })
    assert(aboutOverride.ok, `ghi đè trang about thất bại: ${JSON.stringify(aboutOverride)}`)
    console.log('OK insertPartnerStaticPageFromPg: ghi đè trang có sẵn (slug=about)')

    // 2) Trùng slug -> lỗi.
    const dup = await insertPartnerStaticPageFromPg(partnerId, { slug: 'about', title: 'Trùng', content: '' })
    assert(!dup.ok && dup.error === 'duplicate_slug', `phải chặn trùng slug: ${JSON.stringify(dup)}`)
    console.log('OK enforce unique (partner, slug) ở DB')

    // 3) Slug trùng route hệ thống (vd "cart") -> lỗi invalid_slug.
    const reserved = await insertPartnerStaticPageFromPg(partnerId, { slug: 'cart', title: 'Giỏ hàng giả', content: '' })
    assert(!reserved.ok && reserved.error === 'invalid_slug', `phải chặn slug trùng route hệ thống: ${JSON.stringify(reserved)}`)
    console.log('OK chặn slug trùng route hệ thống đã dùng (vd "cart")')

    // 4) Trang tự do mới.
    const custom = await insertPartnerStaticPageFromPg(partnerId, {
      slug: 'huong-dan-size', title: 'Hướng dẫn chọn size', content: 'Nội dung hướng dẫn size.',
    })
    assert(custom.ok, `tạo trang tự do thất bại: ${JSON.stringify(custom)}`)
    console.log('OK insertPartnerStaticPageFromPg: tạo trang tự do mới (không phải 1 trong 8 trang có sẵn)')

    // 5) Fetch công khai — chỉ trả về khi is_published=true.
    const publicAbout = await fetchPublishedPartnerStaticPageBySlugFromPg(partnerId, 'about')
    assert(publicAbout && publicAbout.title === 'Về chúng tôi (tuỳ chỉnh)', `phải trả đúng nội dung ghi đè: ${JSON.stringify(publicAbout)}`)
    console.log('OK fetchPublishedPartnerStaticPageBySlugFromPg: trả đúng nội dung ghi đè')

    // 6) Ẩn trang -> không còn public.
    const hidden = await updatePartnerStaticPageFromPg(partnerId, aboutOverride.ok ? aboutOverride.row.id : '', { isPublished: false })
    assert(hidden.ok, 'ẩn trang thất bại')
    const afterHide = await fetchPublishedPartnerStaticPageBySlugFromPg(partnerId, 'about')
    assert(afterHide === null, 'trang đã ẩn không được trả về công khai (phải fallback về mặc định)')
    console.log('OK trang bị ẩn (is_published=false) không còn hiện công khai -> trang public fallback về mặc định')

    // 7) Admin list.
    const adminList = await fetchPartnerStaticPagesForAdminFromPg(partnerId)
    assert(adminList && adminList.length === 2, `admin phải thấy 2 trang (gồm cả ẩn), thực tế ${adminList?.length}`)
    console.log('OK fetchPartnerStaticPagesForAdminFromPg: thấy cả trang đã ẩn')

    // 8) Xoá.
    const deleted = await deletePartnerStaticPageFromPg(partnerId, custom.ok ? custom.row.id : '')
    assert(deleted, 'xoá trang tự do thất bại')
    console.log('OK deletePartnerStaticPageFromPg: xoá thành công')

    console.log('\n✅ ALL W3.3/W3.4 (CMS trang tĩnh + SEO) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
