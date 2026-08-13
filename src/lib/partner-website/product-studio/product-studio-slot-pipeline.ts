import { randomUUID } from 'node:crypto'
import { runStudioImagePipeline } from '@/lib/hub-agent/studio-image-pipeline'
import {
  fetchProductStudioJobByIdPg,
  updateProductStudioJobPg,
} from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import {
  nameColorwayFromReferenceImage,
  nameProductFromReferenceImage,
} from '@/lib/partner-website/product-studio/product-studio-vision-naming'
import type { WebLocale } from '@/lib/i18n/config'
import {
  STUDIO_MATERIAL_ASPECT_RATIO,
  STUDIO_REF_PICKER_MAX,
  firstApprovedColor,
  isWearableProductType,
  studioCanPublish,
  studioColorCount,
  type ProductStudioColorItem,
  type ProductStudioCurrentSlot,
  type ProductStudioJobPayload,
  type ProductStudioJobRow,
  type ProductStudioRefPoolItem,
  type ProductStudioSlotKind,
  type ProductStudioState,
} from '@/lib/partner-website/product-studio/product-studio-types'

/**
 * PS.5 — Studio giống 188: merchant tự chọn mốc (màu / gallery / chất liệu / chi tiết),
 * upload ảnh mẫu từng màu (AI đọc tên), chọn ref rồi Tạo. Duyệt xong KHÔNG auto-nhảy mốc.
 */

function shotStyleBrief(payload: ProductStudioJobPayload): string {
  const style = payload.shotStyle ?? 'studio'
  if (style === 'lifestyle') return 'natural indoor lifestyle setting, soft ambient light'
  if (style === 'outdoor') return 'outdoor natural setting, daylight, realistic environment'
  return 'clean professional studio photography, neutral seamless background, soft even lighting'
}

function modelLookBrief(payload: ProductStudioJobPayload): string {
  if (!isWearableProductType(payload.productType) || payload.modelPresence !== 'model') {
    return 'Product-only packshot — NO human model.'
  }
  const bits = [payload.modelGender, payload.modelAgeGroup, payload.modelEthnicity].filter(Boolean)
  const who = bits.length ? bits.join(' ') : 'natural'
  return `Include a ${who} model wearing/using the product naturally.`
}

function fallbackMaterialCallouts(material: string, locale: WebLocale): string[] {
  const m = material.toLowerCase()
  if (locale === 'vi') {
    if (/lụa|silk|satin/.test(m)) return ['Óng ánh tự nhiên', 'Mát, thoáng da', 'Rũ mềm thanh lịch']
    if (/da|leather|pu/.test(m)) return ['Vân da rõ nét', 'Bền, chắc tay', 'Sang trọng lâu dài']
    if (/cotton|bông/.test(m)) return ['Mềm mại thoáng khí', 'Thấm hút tốt', 'Dễ giặt, bền màu']
    if (/len|wool|knit/.test(m)) return ['Ấm, giữ form', 'Sợi mềm không xù', 'Mặc cả ngày']
    return ['Chất lượng cao', 'Mềm mại thoải mái', 'Bền theo thời gian']
  }
  if (/silk|satin/.test(m)) return ['Natural sheen', 'Cool on skin', 'Elegant drape']
  if (/leather|pu/.test(m)) return ['Clear grain', 'Durable hand-feel', 'Long-lasting look']
  if (/cotton/.test(m)) return ['Soft and breathable', 'Good absorbency', 'Easy care']
  return ['Premium quality', 'Soft and comfortable', 'Long-lasting']
}

export function buildProductStudioSlotPrompt(
  payload: ProductStudioJobPayload,
  kind: ProductStudioSlotKind,
  colorName: string | undefined,
  customPrompt: string | undefined,
  opts?: { colorIndex?: number; materialCallouts?: string[] }
): string {
  const notes = (customPrompt || '').trim()
  const noteBlock = notes ? ` ADMIN NOTE (HIGH PRIORITY): ${notes}.` : ''
  const look = modelLookBrief(payload)
  const shot = shotStyleBrief(payload)
  const gender = payload.gender || 'unisex'
  const material = payload.material || 'as in the sample'
  const wearable = isWearableProductType(payload.productType)
  const colorIndex = opts?.colorIndex ?? 0

  if (kind === 'gallery') {
    return `Create a new e-commerce photo of the exact same product as the attached reference,
but from a different camera angle and composition.
Keep the same product design, colors, print, and all details.
Do not copy the reference photo's viewing angle, crop, or pose.
Photorealistic catalog quality. No watermark, no text overlay, no other brand logos.`
  }
  if (kind === 'detail') {
    return `Create a new product detail close-up of the exact same product as the attached reference,
but from a different angle or zoom/crop.
Keep the same product design, colors, print, and all details.
Do not copy the reference photo's viewing angle or framing.
Photorealistic, macro/close-up framing, soft studio lighting. No watermark, no text overlay.`
  }
  if (kind === 'material') {
    const callouts = (opts?.materialCallouts || []).filter(Boolean).slice(0, 3)
    const benefits = callouts.length ? callouts.join('; ') : material
    return `Create a premium e-commerce MATERIAL DETAILS collage of the EXACT same product as the attached reference.
Layout (mandatory):
- TOP PANEL (~55% of frame height): one wide horizontal crop — the hero material zone.
- BOTTOM ROW: four equal vertical strip panels side-by-side — each a DIFFERENT tight macro crop.
- Thin clean white gutters between every panel; warm neutral beige/sand studio backdrop.
Declared material: ${material}.
Print EXACTLY these callout labels as small elegant badges in outer margins only (verbatim): ${benefits}.
${STUDIO_MATERIAL_ASPECT_RATIO} landscape. No watermark, no extra logos.`
  }

  const colorBrief = colorName ? `Colorway name: "${colorName}".` : 'Match the exact color of the product sample.'
  const faceLock =
    wearable && colorIndex >= 1
      ? ` MODEL FACE LOCK: Image #2 is the approved Color #1 catalog photo — copy ONLY that model's
face, hair, and skin tone. Completely IGNORE the clothing AND neckline/collar on image #2.
Image #1 is the NEW customer product sample — the output MUST match image #1
(may be a totally different style/cut/neckline from Color #1, not a recolor).
Same person from image #2 wearing/using the product from image #1.`
      : ''

  return `GENERATE a professional e-commerce catalog photograph from the admin product sample.
Match the SAME viewing angle, crop/framing, product orientation, and how the item is worn or displayed
as in the attached reference photo (same pose staging when the sample shows a person).
Product identity (design, color, cut, print) must follow the sample exactly.
Use ${shot} — do NOT copy messy backgrounds, hangers, beds, or clutter from the upload.
${colorBrief} Shopper: ${gender}. ${look}${faceLock}${noteBlock}
Photorealistic, professional catalog quality. No watermark, no text overlay, no other brand logos.`
}

/** Gợi ý tab mặc định (không bắt buộc — merchant tự chuyển). */
export function suggestedProductStudioKind(studio: ProductStudioState): ProductStudioSlotKind {
  if (studioColorCount(studio) < 1) return 'color'
  if (studio.gallery.length < 2) return 'gallery'
  if (!(studio.materialImage || '').trim()) return 'material'
  return studio.phase && studio.phase !== 'color' ? studio.phase : 'detail'
}

/** @deprecated Dùng suggestedProductStudioKind — giữ tên cũ cho test/compat. */
export function computeNextProductStudioSlot(
  _payload: ProductStudioJobPayload,
  studio: ProductStudioState
): { kind: ProductStudioSlotKind; name?: string } | null {
  if (studioCanPublish(studio) && studio.phase === 'detail') return null
  return { kind: suggestedProductStudioKind(studio) }
}

function addToRefPool(
  studio: ProductStudioState,
  url: string,
  label: string,
  kind: ProductStudioRefPoolItem['kind']
): void {
  const u = url.trim()
  if (!u) return
  if (studio.refPool.some((p) => p.url === u)) return
  studio.refPool.push({ id: randomUUID(), url: u, label, kind })
}

function resolveGenerateRefs(opts: {
  payload: ProductStudioJobPayload
  studio: ProductStudioState
  kind: ProductStudioSlotKind
  colorIndex: number
  refUrls: string[]
  attachUrl: string
}): string[] {
  const attach = opts.attachUrl.trim()
  const selected = opts.refUrls.map((u) => u.trim()).filter(Boolean)
  if (opts.kind !== 'color') {
    const picked = (attach ? [attach, ...selected] : selected).filter(Boolean)
    return [...new Set(picked)].slice(0, STUDIO_REF_PICKER_MAX)
  }
  const face = firstApprovedColor(opts.studio)?.img || ''
  const wearable = isWearableProductType(opts.payload.productType)
  if (opts.colorIndex >= 1 && wearable && face) {
    const product = attach || selected.find((u) => u !== face) || ''
    return [product, face].filter(Boolean).slice(0, STUDIO_REF_PICKER_MAX)
  }
  const picked = (attach ? [attach, ...selected] : selected).filter(Boolean)
  return [...new Set(picked)].slice(0, STUDIO_REF_PICKER_MAX)
}

export type GenerateStudioSlotOpts = {
  kind: ProductStudioSlotKind
  name?: string
  customPrompt?: string
  refUrls?: string[]
  attachUrl?: string
  aspectRatio?: string
}

export async function generateProductStudioSlot(
  partnerId: string,
  jobId: string,
  opts: GenerateStudioSlotOpts
): Promise<{ ok: true; job: ProductStudioJobRow } | { ok: false; error: string }> {
  const job = await fetchProductStudioJobByIdPg(partnerId, jobId)
  if (!job) return { ok: false, error: 'job_not_found' }
  if (job.mode !== 'ai') return { ok: false, error: 'not_ai_mode' }
  if (!job.createdBy) return { ok: false, error: 'missing_created_by' }
  if (job.status === 'generating' || job.status === 'publishing') {
    return { ok: false, error: 'job_busy' }
  }

  const kind = opts.kind
  const studio: ProductStudioState = {
    ...job.studio,
    colors: [...job.studio.colors],
    gallery: [...job.studio.gallery],
    detail: [...job.studio.detail],
    refPool: [...job.studio.refPool],
    lastRefUrls: { ...(job.studio.lastRefUrls || {}) },
  }

  const colorIndex = kind === 'color' ? studioColorCount(studio) : 0
  const attach = (opts.attachUrl || '').trim()
  const selected = (opts.refUrls || []).map((u) => u.trim()).filter(Boolean)
  // Giống 188: mỗi ảnh màu bắt buộc ảnh mẫu SP mới — không được chỉ dùng face-lock.
  if (kind === 'color' && !attach) return { ok: false, error: 'need_ref_or_attach' }
  const refs = resolveGenerateRefs({
    payload: job.payload,
    studio,
    kind,
    colorIndex,
    refUrls: selected,
    attachUrl: attach,
  })
  if (!refs.length) return { ok: false, error: 'need_ref_or_attach' }

  let colorName = kind === 'color' ? (opts.name || '').trim() : undefined
  let colorPrompt = (opts.customPrompt || '').trim()
  if (kind === 'color') {
    if (colorIndex <= 0) studio.colorUserPrompt = colorPrompt
    else colorPrompt = (studio.colorUserPrompt || '').trim()
  } else {
    colorPrompt = ''
  }

  if (attach) {
    addToRefPool(studio, attach, kind === 'color' ? `sample ${colorIndex + 1}` : 'sample', 'ref')
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const locale = (website?.locale as WebLocale) || 'vi'
  const warnings = [...job.warnings]
  let visionProductName = job.visionProductName
  let visionAnalysis = job.visionAnalysis
  let visionColors = job.visionColors
  let payload = job.payload

  if (kind === 'color' && !colorName) {
    const sampleUrl = attach || refs[0]
    const needProductName = colorIndex === 0 && !payload.productName.trim() && !visionProductName
    if (needProductName) {
      const naming = await nameProductFromReferenceImage(job.createdBy, sampleUrl, payload, locale)
      if (naming?.name) {
        visionProductName = naming.name
        visionAnalysis = naming.analysis
        visionColors = naming.colors
        payload = { ...payload, productName: naming.name }
        colorName = naming.colorName || naming.colors[0] || ''
      }
    } else {
      const colorway = await nameColorwayFromReferenceImage(job.createdBy, sampleUrl, payload.productType, locale)
      if (colorway) colorName = colorway
    }
    if (!colorName) colorName = locale === 'vi' ? `Màu ${colorIndex + 1}` : `Color ${colorIndex + 1}`
  }

  const materialCallouts =
    kind === 'material' ? fallbackMaterialCallouts(payload.material, locale) : studio.materialCallouts
  if (kind === 'material') {
    studio.materialCallouts = materialCallouts
  }

  const prompt = buildProductStudioSlotPrompt(payload, kind, colorName, colorPrompt, {
    colorIndex,
    materialCallouts,
  })
  const aspectRatio =
    kind === 'material' ? STUDIO_MATERIAL_ASPECT_RATIO : opts.aspectRatio || payload.aspectRatio || '1:1'

  const slot: ProductStudioCurrentSlot = {
    kind,
    name: colorName,
    attachUrl: attach || undefined,
    refUrls: selected.slice(0, STUDIO_REF_PICKER_MAX),
    userPrompt: colorPrompt || undefined,
    index: kind === 'color' ? colorIndex : kind === 'gallery' ? studio.gallery.length : kind === 'detail' ? studio.detail.length : 0,
    attempt: (studio.currentSlot?.kind === kind ? (studio.currentSlot.attempt || 0) : 0) + 1,
    promptUsed: prompt,
    approved: false,
  }
  studio.currentSlot = slot
  studio.phase = kind

  await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'generating',
    step: `ai_${kind}`,
    message: 'generating',
    progress: 30,
    payload,
    studio,
    visionProductName,
    visionAnalysis,
    visionColors,
    warnings,
    errorMessage: null,
  })

  const gen = await runStudioImagePipeline({
    userId: job.createdBy,
    kind: 'product_photo',
    screenLabel: `Product Studio — ${kind}${colorName ? ` (${colorName})` : ''}`,
    brief: prompt,
    referenceImageUrls: refs,
    aspectRatio,
    verbatimPrompt: true,
  })

  if (!gen.ok) {
    const updated = await updateProductStudioJobPg({
      partnerId,
      jobId,
      status: 'ready_for_review',
      step: 'awaiting_approval',
      errorMessage: gen.error,
      studio: {
        ...studio,
        currentSlot: { ...slot, error: gen.error },
      },
    })
    return updated ? { ok: true, job: updated } : { ok: false, error: gen.error }
  }

  const updated = await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'ready_for_review',
    step: 'awaiting_approval',
    message: null,
    errorMessage: null,
    progress: 45,
    payload,
    visionProductName,
    visionAnalysis,
    visionColors,
    studio: {
      ...studio,
      currentSlot: { ...slot, candidateUrl: gen.resultUrl, error: undefined },
    },
  })
  if (!updated) return { ok: false, error: 'save_failed' }
  return { ok: true, job: updated }
}

/** Duyệt ảnh hiện tại — commit vào studio, GIỮ nguyên tab (không auto-gen mốc kế). */
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
    refPool: [...job.studio.refPool],
    lastRefUrls: { ...(job.studio.lastRefUrls || {}) },
    currentSlot: null,
  }

  if (slot.kind === 'color') {
    const color: ProductStudioColorItem = { name: slot.name || `Color ${studio.colors.length + 1}`, img: slot.candidateUrl }
    studio.colors.push(color)
    if (!studio.mainImage) studio.mainImage = slot.candidateUrl
    addToRefPool(studio, slot.candidateUrl, color.name, 'color')
  } else if (slot.kind === 'gallery') {
    if (!studio.gallery.includes(slot.candidateUrl)) studio.gallery.push(slot.candidateUrl)
    addToRefPool(studio, slot.candidateUrl, `Gallery ${studio.gallery.length}`, 'gallery')
  } else if (slot.kind === 'detail') {
    if (!studio.detail.includes(slot.candidateUrl)) studio.detail.push(slot.candidateUrl)
    addToRefPool(studio, slot.candidateUrl, `Detail ${studio.detail.length}`, 'detail')
  } else if (slot.kind === 'material') {
    studio.materialImage = slot.candidateUrl
    addToRefPool(studio, slot.candidateUrl, 'Material', 'material')
  }

  studio.phase = slot.kind
  if (slot.kind !== 'color') {
    const picked = (slot.refUrls || []).filter(Boolean).slice(0, STUDIO_REF_PICKER_MAX)
    if (picked.length) studio.lastRefUrls = { ...studio.lastRefUrls, [slot.kind]: picked }
  }
  studio.canPublish = studioCanPublish(studio)

  const updated = await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'draft',
    step: 'awaiting_input',
    message: studio.canPublish ? 'ready_to_publish' : null,
    progress: studio.canPublish ? 70 : 55,
    studio,
    errorMessage: null,
  })
  if (!updated) return { ok: false, error: 'save_failed' }
  return { ok: true, job: updated, done: studio.canPublish }
}

export async function selectProductStudioImages(
  partnerId: string,
  jobId: string,
  kind: 'gallery' | 'detail',
  urls: string[]
): Promise<{ ok: true; job: ProductStudioJobRow } | { ok: false; error: string }> {
  const job = await fetchProductStudioJobByIdPg(partnerId, jobId)
  if (!job) return { ok: false, error: 'job_not_found' }
  if (job.mode !== 'ai') return { ok: false, error: 'not_ai_mode' }
  if (job.status === 'generating' || job.status === 'publishing' || job.status === 'ready_for_review') {
    return { ok: false, error: 'job_busy' }
  }

  const picked = urls.map((u) => u.trim()).filter(Boolean)
  if (kind === 'gallery' && picked.length < 2) return { ok: false, error: 'gallery_min_2' }
  if (kind === 'detail') {
    /* optional — empty allowed */
  }

  const allowed = new Set(collectAllowedStudioUrls(job.studio))
  if (picked.some((u) => !allowed.has(u))) return { ok: false, error: 'only_studio_images' }

  const studio: ProductStudioState = {
    ...job.studio,
    gallery: kind === 'gallery' ? picked : [...job.studio.gallery],
    detail: kind === 'detail' ? picked : [...job.studio.detail],
    phase: kind,
    currentSlot: null,
  }
  studio.canPublish = studioCanPublish(studio)

  const updated = await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'draft',
    step: 'awaiting_input',
    studio,
    errorMessage: null,
  })
  if (!updated) return { ok: false, error: 'save_failed' }
  return { ok: true, job: updated }
}

function collectAllowedStudioUrls(studio: ProductStudioState): string[] {
  const urls = new Set<string>()
  for (const item of studio.refPool) {
    if (item.kind === 'ref') continue
    if (item.url) urls.add(item.url)
  }
  for (const c of studio.colors) if (c.img) urls.add(c.img)
  for (const u of studio.gallery) urls.add(u)
  for (const u of studio.detail) urls.add(u)
  if (studio.materialImage) urls.add(studio.materialImage)
  return [...urls]
}
