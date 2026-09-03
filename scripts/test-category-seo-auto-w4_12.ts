// Smoke test (W4.12 bổ sung): tự động sinh nội dung SEO danh mục bằng AI + bug fix metadata shop.
// Chạy: npx tsx scripts/test-category-seo-auto-w4_12.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  insertPartnerCategoryFromPg,
  fetchPartnerCategoryByIdFromPg,
  fetchPartnerCategoryProductSampleNamesFromPg,
  setPartnerCategoryGeneratedSeoFromPg,
  updatePartnerCategoryFieldsFromPg,
  setCategoryProductsFromPg,
} from '../src/lib/db/messaging-partner-categories-pg'
import { generatePartnerCategorySeoContent } from '../src/lib/partner-website/category/partner-category-seo-ai'

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
     values ($1, 'W4.12 SEO Auto Test Shop', $2) returning id`,
    [ownerId, `w4-12-seo-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  try {
    // 1) Tạo danh mục + sản phẩm mẫu.
    const cat = await insertPartnerCategoryFromPg({
      partnerId,
      parentId: null,
      name: 'Áo thun nam',
    })
    assert(cat.ok, `tạo danh mục thất bại: ${JSON.stringify(cat)}`)
    const categoryId = cat.row.id
    assert(cat.row.seoBody === '', 'seo_body mặc định phải rỗng')
    assert(cat.row.seoBodyGeneratedAt === null, 'seo_body_generated_at mặc định phải null')
    console.log('OK insertPartnerCategoryFromPg: seo_body/seo_body_generated_at mặc định rỗng/null')

    const invRes = await pool.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint)
       values ($1::uuid, 'Áo thun cotton basic', '150k') returning id`,
      [partnerId]
    )
    const invId = invRes.rows[0].id as string
    await setCategoryProductsFromPg(partnerId, categoryId, [invId])

    // 2) fetchPartnerCategoryProductSampleNamesFromPg trả tên sản phẩm gán trực tiếp.
    const sampleNames = await fetchPartnerCategoryProductSampleNamesFromPg(categoryId, 6)
    assert(sampleNames.includes('Áo thun cotton basic'), `phải có tên sản phẩm mẫu, thực tế ${JSON.stringify(sampleNames)}`)
    console.log('OK fetchPartnerCategoryProductSampleNamesFromPg: lấy đúng tên sản phẩm gán trực tiếp')

    // 3) generatePartnerCategorySeoContent chỉ nhận bản Gemini — không mẫu dự phòng.
    const result = await generatePartnerCategorySeoContent({
      categoryName: 'Áo thun nam',
      breadcrumbNames: ['Áo thun nam'],
      productCount: 1,
      sampleProductNames: sampleNames,
      shopDisplayName: 'W4.12 SEO Auto Test Shop',
      locale: 'vi',
    })
    if (!result.ok) throw new Error(`FAIL: Gemini phải sinh SEO: ${JSON.stringify(result)}`)
    assert(result.description.length > 0, 'description AI không được rỗng')
    assert(result.body.length >= 100, `body phải đủ dài (>=100 ký tự), thực tế ${result.body.length}`)
    console.log(`OK generatePartnerCategorySeoContent: description=${result.description.length} ký tự, body=${result.body.length} ký tự`)

    // 4) setPartnerCategoryGeneratedSeoFromPg ghi seo_description/seo_body + đánh dấu generated_at/locale.
    const updated = await setPartnerCategoryGeneratedSeoFromPg(partnerId, categoryId, {
      seoDescription: result.description,
      seoBody: result.body,
      locale: 'vi',
    })
    assert(updated, 'setPartnerCategoryGeneratedSeoFromPg phải trả về row')
    assert(updated!.seoBody === result.body.trim().slice(0, 3000), 'seo_body phải khớp nội dung AI sinh')
    assert(updated!.seoBodyGeneratedAt !== null, 'seo_body_generated_at phải được set sau khi AI sinh')
    assert(updated!.seoBodyGeneratedLocale === 'vi', 'seo_body_generated_locale phải = vi')
    console.log('OK setPartnerCategoryGeneratedSeoFromPg: lưu đúng nội dung + đánh dấu generated_at/locale')

    const refetched = await fetchPartnerCategoryByIdFromPg(partnerId, categoryId)
    assert(refetched?.seoBody === updated!.seoBody, 'fetch lại phải thấy seo_body đã lưu')
    console.log('OK fetchPartnerCategoryByIdFromPg: đọc lại đúng seo_body vừa sinh (trang công khai đọc thuần từ DB, không gọi AI lúc render)')

    // 5) Sửa tay seo_body -> phải xoá mốc generated_at/locale (phân biệt bản AI vs bản merchant tự viết).
    const manualEdit = await updatePartnerCategoryFieldsFromPg(partnerId, categoryId, {
      seoBody: 'Merchant tự viết nội dung SEO khác.',
    })
    assert(manualEdit, 'updatePartnerCategoryFieldsFromPg(seoBody) phải trả về row')
    assert(manualEdit!.seoBody === 'Merchant tự viết nội dung SEO khác.', 'seo_body phải cập nhật theo bản tự viết')
    assert(manualEdit!.seoBodyGeneratedAt === null, 'sửa tay phải xoá seo_body_generated_at (không còn là bản AI)')
    assert(manualEdit!.seoBodyGeneratedLocale === null, 'sửa tay phải xoá seo_body_generated_locale')
    console.log('OK updatePartnerCategoryFieldsFromPg: sửa tay seo_body xoá đúng mốc "do AI sinh"')

    console.log('\nALL PASS — W4.12 auto-generate SEO danh mục (DB layer + AI service)')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
