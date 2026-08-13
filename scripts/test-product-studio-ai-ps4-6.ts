// Smoke test PS.4-PS.6 (Product Studio mode AI, luồng giống 188):
// - merchant tự chọn mốc (không auto-nhảy)
// - duyệt xong không auto-gen slot kế
// - đăng khi đủ 1 màu + 2 gallery + 1 chất liệu (chi tiết tuỳ chọn)
// - vision naming thật (Gemini text, không tốn credit)
// - publish đọc đúng ảnh từ studio
// Test KHÔNG gọi runStudioImagePipeline thật (tốn credit) — seed candidateUrl thủ công.
// Chạy: npx tsx scripts/test-product-studio-ai-ps4-6.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  insertProductStudioJobPg,
  fetchProductStudioJobByIdPg,
  updateProductStudioJobPg,
} from '../src/lib/db/messaging-partner-product-studio-jobs-pg'
import {
  approveProductStudioSlot,
  buildProductStudioSlotPrompt,
  selectProductStudioImages,
  suggestedProductStudioKind,
} from '../src/lib/partner-website/product-studio/product-studio-slot-pipeline'
import { nameProductFromReferenceImage } from '../src/lib/partner-website/product-studio/product-studio-vision-naming'
import { publishProductStudioJob } from '../src/lib/partner-website/product-studio/product-studio-job-runner'
import {
  defaultProductStudioState,
  studioCanPublish,
  studioColorCount,
  type ProductStudioJobPayload,
} from '../src/lib/partner-website/product-studio/product-studio-types'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  const ownerId = ownerRes.rows[0].id

  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'PS AI Test Shop', 'ps-ai-test-shop-' || substr(gen_random_uuid()::text,1,8))
     returning id`,
    [ownerId]
  )
  const partnerId = partnerRes.rows[0].id as string

  try {
    const payload: ProductStudioJobPayload = {
      mode: 'ai',
      price: 450000,
      material: 'Da PU cao cấp',
      productName: '',
      productType: 'accessory',
      gender: 'unisex',
      style: 'minimalist',
      sizes: [],
      noSize: true,
      colors: [],
      available: 50,
      notes: '',
      refImageUrls: [],
      aspectRatio: '1:1',
      modelPresence: 'none',
      shotStyle: 'studio',
    }

    let studio = defaultProductStudioState()
    assert(suggestedProductStudioKind(studio) === 'color', 'tab gợi ý ban đầu phải là màu')
    assert(!studioCanPublish(studio), 'chưa có ảnh thì không được đăng')

    const prompt = buildProductStudioSlotPrompt(payload, 'color', 'Đen', undefined, { colorIndex: 0 })
    assert(prompt.toLowerCase().includes('studio') || prompt.toLowerCase().includes('catalog'), 'prompt màu phải là catalog photo')
    const galleryPrompt = buildProductStudioSlotPrompt(payload, 'gallery', undefined, undefined)
    assert(galleryPrompt.toLowerCase().includes('different'), 'prompt gallery phải đổi góc so với ref')
    console.log('OK buildProductStudioSlotPrompt — màu giữ góc mẫu, gallery đổi góc (giống 188)')

    const job = await insertProductStudioJobPg({
      partnerId,
      createdBy: ownerId,
      mode: 'ai',
      payload,
      status: 'draft',
      step: 'awaiting_input',
    })
    assert(job, 'tạo job AI thất bại')
    const jobId = job!.id

    async function seedAndApprove(kind: 'color' | 'gallery' | 'detail' | 'material', name: string | undefined, url: string) {
      const current = await fetchProductStudioJobByIdPg(partnerId, jobId)
      assert(current, 'load job thất bại')
      await updateProductStudioJobPg({
        partnerId,
        jobId,
        status: 'ready_for_review',
        studio: { ...current!.studio, currentSlot: { kind, name, candidateUrl: url, approved: false } },
      })
      const res = await approveProductStudioSlot(partnerId, jobId)
      assert(res.ok, `approve thất bại: ${!res.ok ? res.error : ''}`)
      return res
    }

    let r = await seedAndApprove('color', 'Đen', 'https://picsum.photos/seed/black/600')
    assert(!r.done, '1 ảnh màu chưa đủ điều kiện đăng')
    assert(r.ok && r.job.status === 'draft', 'sau duyệt phải về draft/awaiting_input — không auto-gen mốc kế')
    assert(r.ok && !r.job.studio.currentSlot, 'currentSlot phải null sau duyệt')

    r = await seedAndApprove('gallery', undefined, 'https://picsum.photos/seed/g1/600')
    assert(!r.done, '1 gallery chưa đủ')
    r = await seedAndApprove('gallery', undefined, 'https://picsum.photos/seed/g2/600')
    assert(!r.done, 'chưa có chất liệu nên chưa đăng được')
    r = await seedAndApprove('material', undefined, 'https://picsum.photos/seed/m1/600')
    assert(r.done, 'đủ 1 màu + 2 gallery + 1 chất liệu thì done/canPublish phải true (chi tiết tuỳ chọn)')
    console.log('OK approve không auto-nhảy mốc; canPublish khi đủ 1 màu + 2 gallery + 1 chất liệu')

    const jobAfterStudio = await fetchProductStudioJobByIdPg(partnerId, jobId)
    assert(studioColorCount(jobAfterStudio!.studio) === 1, 'studio.colors phải có 1 màu')
    assert(jobAfterStudio?.studio.gallery.length === 2, 'studio.gallery phải có 2 ảnh')
    assert(jobAfterStudio?.studio.materialImage, 'studio.materialImage phải có')
    assert(jobAfterStudio?.studio.mainImage === jobAfterStudio?.studio.colors[0]?.img, 'mainImage phải là ảnh màu đầu')
    assert(jobAfterStudio?.studio.canPublish, 'canPublish phải true')

    const selected = await selectProductStudioImages(partnerId, jobId, 'gallery', [
      jobAfterStudio!.studio.colors[0]!.img,
      jobAfterStudio!.studio.gallery[0]!,
    ])
    assert(selected.ok, `select gallery thất bại: ${!selected.ok ? selected.error : ''}`)
    assert(selected.ok && selected.job.studio.gallery.length === 2, 'select phải ghi đúng 2 ảnh gallery')
    console.log('OK selectProductStudioImages chọn lại gallery từ ảnh Studio (giống 188)')

    const naming = await nameProductFromReferenceImage(ownerId, jobAfterStudio!.studio.mainImage!, payload, 'vi')
    assert(naming?.name && naming.name.length > 0, 'vision naming phải trả tên hợp lệ')
    console.log('OK nameProductFromReferenceImage (Gemini Vision thật) — tên đề xuất:', naming!.name)

    await updateProductStudioJobPg({
      partnerId,
      jobId,
      payload: { ...jobAfterStudio!.payload, productName: naming!.name },
    })
    const published = await publishProductStudioJob(partnerId, jobId)
    assert(published.ok, `publish AI mode thất bại: ${!published.ok ? published.error : ''}`)
    console.log('OK publishProductStudioJob (mode AI) — inventory:', published.ok ? published.result.inventoryId : '')

    const invRow = await pool.query(
      `select colors_json, gallery_urls, detail_image_urls, material_detail_image_url, image_url, origin, name from public.messaging_partner_inventory where id = $1::uuid`,
      [published.ok ? published.result.inventoryId : '']
    )
    const inv = invRow.rows[0]
    assert(inv.origin === 'manual_ai', 'origin phải = manual_ai cho mode AI')
    assert(Array.isArray(inv.colors_json) && inv.colors_json.length === 1, 'inventory colors_json phải có 1 màu từ studio')
    assert(inv.image_url === jobAfterStudio!.studio.mainImage, 'image_url phải đúng ảnh mainImage từ studio')
    assert(inv.material_detail_image_url === jobAfterStudio!.studio.materialImage, 'ảnh chất liệu phải ghi riêng material_detail_image_url (không nhét vào detail)')
    assert(!Array.isArray(inv.detail_image_urls) || !inv.detail_image_urls.includes(jobAfterStudio!.studio.materialImage), 'detail_image_urls không được chứa ảnh chất liệu')
    assert(inv.name === naming!.name, 'tên sản phẩm phải là tên do Vision đề xuất')
    console.log('OK inventory tạo từ mode AI dùng đúng ảnh/màu từ studio — luồng đăng giống 188')

    console.log('\n✅ ALL PS.4-PS.6 CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
