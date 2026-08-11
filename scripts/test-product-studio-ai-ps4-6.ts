// Smoke test PS.4-PS.6 (Product Studio mode AI): slot order logic, approve/commit vào studio, vision
// naming thật (Gemini text, không tốn credit), publish đọc đúng ảnh từ studio (không phải payload).
// Test KHÔNG gọi runStudioImagePipeline thật (tốn credit) — seed candidateUrl thủ công để test logic
// commit/approve; sinh ảnh Gemini thật nên test qua UI/dev server thủ công riêng khi cần.
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
  computeNextProductStudioSlot,
} from '../src/lib/partner-website/product-studio/product-studio-slot-pipeline'
import { nameProductFromReferenceImage } from '../src/lib/partner-website/product-studio/product-studio-vision-naming'
import { publishProductStudioJob } from '../src/lib/partner-website/product-studio/product-studio-job-runner'
import { defaultProductStudioState, type ProductStudioJobPayload } from '../src/lib/partner-website/product-studio/product-studio-types'

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
      productName: '', // để trống — test vision naming
      productType: 'accessory',
      gender: 'unisex',
      style: 'minimalist',
      sizes: [],
      noSize: true,
      colors: [
        { name: 'Đen', img: '' },
        { name: 'Nâu', img: '' },
      ],
      available: 50,
      notes: '',
      refImageUrls: ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800'],
      galleryCount: 2,
      detailCount: 1,
      aspectRatio: '1:1',
      modelPresence: 'none',
      shotStyle: 'studio',
    }

    // 1) Slot order: màu Đen -> màu Nâu -> gallery x2 -> detail x1 -> material -> done
    let studio = defaultProductStudioState()
    let next = computeNextProductStudioSlot(payload, studio)
    assert(next?.kind === 'color' && next.name === 'Đen', `slot đầu phải là màu Đen, thực tế: ${JSON.stringify(next)}`)
    console.log('OK computeNextProductStudioSlot bắt đầu đúng từ màu đầu tiên')

    const prompt = buildProductStudioSlotPrompt(payload, 'color', 'Đen', undefined)
    assert(prompt.includes('Đen'), 'prompt phải chứa tên màu')
    assert(prompt.toLowerCase().includes('studio'), 'prompt studio shot style phải xuất hiện trong prompt')
    console.log('OK buildProductStudioSlotPrompt sinh prompt hợp lệ')

    // 2) Tạo job + seed candidateUrl thủ công (không tốn credit) rồi approve — test logic commit
    const job = await insertProductStudioJobPg({
      partnerId,
      createdBy: ownerId,
      mode: 'ai',
      payload,
      status: 'ready_for_review',
    })
    assert(job, 'tạo job AI thất bại')
    const jobId = job!.id

    async function seedAndApprove(kind: 'color' | 'gallery' | 'detail' | 'material', name: string | undefined, url: string) {
      const current = await fetchProductStudioJobByIdPg(partnerId, jobId)
      assert(current, 'load job thất bại')
      await updateProductStudioJobPg({
        partnerId,
        jobId,
        studio: { ...current!.studio, currentSlot: { kind, name, candidateUrl: url, approved: false } },
      })
      const res = await approveProductStudioSlot(partnerId, jobId)
      assert(res.ok, `approve thất bại: ${!res.ok ? res.error : ''}`)
      return res
    }

    await seedAndApprove('color', 'Đen', 'https://picsum.photos/seed/black/600')
    await seedAndApprove('color', 'Nâu', 'https://picsum.photos/seed/brown/600')
    await seedAndApprove('gallery', undefined, 'https://picsum.photos/seed/g1/600')
    let r = await seedAndApprove('gallery', undefined, 'https://picsum.photos/seed/g2/600')
    assert(!r.done, 'chưa xong detail/material nên done phải false')
    r = await seedAndApprove('detail', undefined, 'https://picsum.photos/seed/d1/600')
    assert(!r.done, 'chưa xong material nên done phải false')
    r = await seedAndApprove('material', undefined, 'https://picsum.photos/seed/m1/600')
    assert(r.done, 'đủ màu+gallery+detail+material thì done phải true')
    console.log('OK approveProductStudioSlot commit đúng thứ tự màu->gallery->detail->material, done=true khi đủ')

    const jobAfterStudio = await fetchProductStudioJobByIdPg(partnerId, jobId)
    assert(jobAfterStudio?.studio.colors.length === 2, 'studio.colors phải có 2 màu sau khi duyệt hết')
    assert(jobAfterStudio?.studio.gallery.length === 2, 'studio.gallery phải có 2 ảnh')
    assert(jobAfterStudio?.studio.detail.length === 1, 'studio.detail phải có 1 ảnh')
    assert(jobAfterStudio?.studio.materialImage, 'studio.materialImage phải có')
    assert(jobAfterStudio?.studio.mainImage === jobAfterStudio?.studio.colors[0]?.img, 'mainImage phải là ảnh màu đầu tiên duyệt')
    console.log('OK studio state persist đúng sau toàn bộ pipeline')

    // 3) Vision naming — Gemini thật (text+vision, KHÔNG tốn credit, khác billing với ảnh)
    const naming = await nameProductFromReferenceImage(ownerId, jobAfterStudio!.studio.mainImage!, payload, 'vi')
    assert(naming?.name && naming.name.length > 0, 'vision naming phải trả tên hợp lệ')
    console.log('OK nameProductFromReferenceImage (Gemini Vision thật) — tên đề xuất:', naming!.name)

    // 4) Publish — set tên từ vision naming, xác nhận đọc ảnh từ STUDIO (không phải payload trống)
    await updateProductStudioJobPg({
      partnerId,
      jobId,
      payload: { ...jobAfterStudio!.payload, productName: naming!.name },
    })
    const published = await publishProductStudioJob(partnerId, jobId)
    assert(published.ok, `publish AI mode thất bại: ${!published.ok ? published.error : ''}`)
    console.log('OK publishProductStudioJob (mode AI) — inventory:', published.ok ? published.result.inventoryId : '')

    const invRow = await pool.query(
      `select colors_json, gallery_urls, detail_image_urls, image_url, origin, name from public.messaging_partner_inventory where id = $1::uuid`,
      [published.ok ? published.result.inventoryId : '']
    )
    const inv = invRow.rows[0]
    assert(inv.origin === 'manual_ai', 'origin phải = manual_ai cho mode AI')
    assert(Array.isArray(inv.colors_json) && inv.colors_json.length === 2, 'inventory colors_json phải có 2 màu từ studio')
    assert(inv.image_url === jobAfterStudio!.studio.mainImage, 'image_url phải đúng ảnh mainImage từ studio (không phải rỗng từ payload)')
    assert(inv.name === naming!.name, 'tên sản phẩm phải là tên do Vision đề xuất')
    console.log('OK inventory tạo từ mode AI dùng đúng ảnh/màu từ studio pipeline — không đọc payload rỗng')

    console.log('\n✅ ALL PS.4-PS.6 CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
