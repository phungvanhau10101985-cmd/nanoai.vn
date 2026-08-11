import { randomUUID } from 'node:crypto'
import { runStudioImagePipeline } from '@/lib/hub-agent/studio-image-pipeline'
import {
  fetchProductStudioJobByIdPg,
  updateProductStudioJobPg,
} from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import type {
  ProductStudioColorItem,
  ProductStudioJobPayload,
  ProductStudioJobRow,
  ProductStudioSlotKind,
  ProductStudioState,
} from '@/lib/partner-website/product-studio/product-studio-types'

/**
 * PS.5 — Studio slot pipeline: màu -> gallery -> chi tiết -> chất liệu. Mỗi slot: build prompt (ref
 * pool + thuộc tính + ghi chú admin) -> Gemini image-edit (qua `runStudioImagePipeline`, kind
 * `product_photo` — đúng đường billing credit đã dùng cho mọi công cụ AI-build web/landing/studio) ->
 * merchant Duyệt (commit + thêm ref pool, sang slot kế) hoặc Tạo lại (sửa prompt/ref, thử lại).
 */

function shotStyleBrief(payload: ProductStudioJobPayload): string {
  const style = payload.shotStyle ?? 'studio'
  if (style === 'lifestyle') return 'natural lifestyle setting, soft ambient light, model or context suggesting real-life use'
  if (style === 'outdoor') return 'outdoor natural setting, daylight, realistic environment'
  return 'clean studio product photography, neutral seamless background, soft even lighting'
}

function modelPresenceBrief(payload: ProductStudioJobPayload): string {
  if (payload.modelPresence !== 'model') return ''
  const bits = [payload.modelGender, payload.modelAgeGroup, payload.modelEthnicity].filter(Boolean)
  return bits.length
    ? ` Include a ${bits.join(' ')} model wearing/using the product naturally.`
    : ' Include a model wearing/using the product naturally.'
}

function attributesBrief(payload: ProductStudioJobPayload): string {
  const bits: string[] = []
  if (payload.material) bits.push(`material: ${payload.material}`)
  if (payload.style) bits.push(`style: ${payload.style}`)
  if (payload.gender) bits.push(`for: ${payload.gender}`)
  return bits.length ? ` Product attributes — ${bits.join(', ')}.` : ''
}

export function buildProductStudioSlotPrompt(
  payload: ProductStudioJobPayload,
  kind: ProductStudioSlotKind,
  colorName: string | undefined,
  customPrompt: string | undefined
): string {
  const shot = shotStyleBrief(payload)
  const modelBrief = modelPresenceBrief(payload)
  const attrs = attributesBrief(payload)
  const notes = customPrompt?.trim() || payload.notes?.trim()
  const noteBlock = notes ? ` Admin note: ${notes}.` : ''

  if (kind === 'color') {
    return `E-commerce catalog product photo. Using the attached reference photo(s) as the exact product
(keep identical silhouette, cut, proportions, hardware/trim), render this SAME product in color "${colorName}".
${shot}.${modelBrief}${attrs}${noteBlock} Photorealistic, professional catalog quality, square 1:1 framing,
product centered and fully visible. No watermark, no text overlay, no other brand logos.`
  }
  if (kind === 'gallery') {
    return `E-commerce catalog gallery photo. Using the attached reference photo(s) as the exact same
product (keep identical color/silhouette/details), generate an ADDITIONAL catalog shot from a different
angle or styling (e.g. side view, back view, styled flat-lay, or worn) — must clearly be the same product.
${shot}.${modelBrief}${attrs}${noteBlock} Photorealistic, professional catalog quality. No watermark, no text
overlay, no other brand logos.`
  }
  if (kind === 'detail') {
    return `E-commerce zoom/detail catalog photo. Using the attached reference photo(s) as the exact same
product, generate a CLOSE-UP detail shot (fabric texture, stitching, hardware, trim, or a distinctive
design element) of this same item — must be recognizably the same product.${attrs}${noteBlock}
Photorealistic, macro/close-up framing, soft studio lighting. No watermark, no text overlay, no other
brand logos.`
  }
  // material
  return `E-commerce "material detail" collage. Using the attached reference photo(s) as the exact same
product, create ONE composite image: a larger panel plus a few macro close-up crops of different regions
of the SAME item (weave/grain/stitching/hem) — keep exact product color and pattern.${attrs}${noteBlock}
Thin white borders between panels, warm neutral studio background. No watermark, no text overlay, no other
brand logos.`
}

export function computeNextProductStudioSlot(
  payload: ProductStudioJobPayload,
  studio: ProductStudioState
): { kind: ProductStudioSlotKind; name?: string } | null {
  const doneColorNames = new Set(studio.colors.map((c) => c.name))
  const pendingColor = (payload.colors ?? []).find((c) => !doneColorNames.has(c.name))
  if (pendingColor) return { kind: 'color', name: pendingColor.name }
  const galleryCount = Math.max(0, payload.galleryCount ?? 5)
  if (studio.gallery.length < galleryCount) return { kind: 'gallery' }
  const detailCount = Math.max(0, payload.detailCount ?? 3)
  if (studio.detail.length < detailCount) return { kind: 'detail' }
  if (!studio.materialImage) return { kind: 'material' }
  return null
}

function refPoolUrls(studio: ProductStudioState): string[] {
  return studio.refPool.map((r) => r.url).slice(-3)
}

/** Sinh 1 slot mới (hoặc slot hiện tại nếu regenerate) — không commit, chỉ trả candidate để merchant duyệt. */
export async function generateProductStudioSlot(
  partnerId: string,
  jobId: string,
  opts: { kind?: ProductStudioSlotKind; name?: string; customPrompt?: string; refUrlsOverride?: string[] }
): Promise<{ ok: true; job: ProductStudioJobRow } | { ok: false; error: string }> {
  const job = await fetchProductStudioJobByIdPg(partnerId, jobId)
  if (!job) return { ok: false, error: 'job_not_found' }
  if (job.mode !== 'ai') return { ok: false, error: 'not_ai_mode' }
  if (!job.createdBy) return { ok: false, error: 'missing_created_by' }

  const next = opts.kind ? { kind: opts.kind, name: opts.name } : computeNextProductStudioSlot(job.payload, job.studio)
  if (!next) return { ok: false, error: 'all_slots_done' }

  const prompt = buildProductStudioSlotPrompt(job.payload, next.kind, next.name, opts.customPrompt)
  const refs = (opts.refUrlsOverride ?? [...(job.payload.refImageUrls ?? []), ...refPoolUrls(job.studio)]).slice(0, 4)

  await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'generating',
    step: `slot_${next.kind}`,
    message: 'Đang tạo ảnh…',
  })

  const gen = await runStudioImagePipeline({
    userId: job.createdBy,
    kind: 'product_photo',
    screenLabel: `Product Studio — ${next.kind}${next.name ? ` (${next.name})` : ''}`,
    brief: prompt,
    referenceImageUrls: refs,
    aspectRatio: job.payload.aspectRatio || '1:1',
    verbatimPrompt: true,
  })

  if (!gen.ok) {
    const updated = await updateProductStudioJobPg({
      partnerId,
      jobId,
      status: 'ready_for_review',
      errorMessage: gen.error,
      studio: {
        ...job.studio,
        currentSlot: { kind: next.kind, name: next.name, promptUsed: prompt, error: gen.error, approved: false },
      },
    })
    return updated ? { ok: true, job: updated } : { ok: false, error: gen.error }
  }

  const updated = await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'ready_for_review',
    message: null,
    errorMessage: null,
    studio: {
      ...job.studio,
      currentSlot: {
        kind: next.kind,
        name: next.name,
        candidateUrl: gen.resultUrl,
        promptUsed: prompt,
        approved: false,
      },
    },
  })
  if (!updated) return { ok: false, error: 'save_failed' }
  return { ok: true, job: updated }
}

/** Duyệt ảnh hiện tại: commit vào studio.colors/gallery/detail/materialImage + thêm ref pool, chuyển slot kế. */
export async function approveProductStudioSlot(
  partnerId: string,
  jobId: string
): Promise<{ ok: true; job: ProductStudioJobRow; done: boolean } | { ok: false; error: string }> {
  const job = await fetchProductStudioJobByIdPg(partnerId, jobId)
  if (!job) return { ok: false, error: 'job_not_found' }
  const slot = job.studio.currentSlot
  if (!slot?.candidateUrl) return { ok: false, error: 'no_candidate_to_approve' }

  const studio: ProductStudioState = {
    ...job.studio,
    colors: [...job.studio.colors],
    gallery: [...job.studio.gallery],
    detail: [...job.studio.detail],
    refPool: [...job.studio.refPool, { id: randomUUID(), url: slot.candidateUrl, label: slot.name ?? slot.kind, kind: slot.kind }],
    currentSlot: null,
  }

  if (slot.kind === 'color') {
    const color: ProductStudioColorItem = { name: slot.name ?? 'Màu', img: slot.candidateUrl }
    studio.colors.push(color)
    if (!studio.mainImage) studio.mainImage = slot.candidateUrl
  } else if (slot.kind === 'gallery') {
    studio.gallery.push(slot.candidateUrl)
  } else if (slot.kind === 'detail') {
    studio.detail.push(slot.candidateUrl)
  } else if (slot.kind === 'material') {
    studio.materialImage = slot.candidateUrl
  }

  const remaining = computeNextProductStudioSlot(job.payload, studio)
  const updated = await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: remaining ? 'ready_for_review' : 'ready_for_review',
    step: remaining ? `slot_${remaining.kind}` : 'studio_done',
    message: remaining ? null : 'Đã đủ ảnh — có thể đăng sản phẩm.',
    studio,
  })
  if (!updated) return { ok: false, error: 'save_failed' }
  return { ok: true, job: updated, done: !remaining }
}
