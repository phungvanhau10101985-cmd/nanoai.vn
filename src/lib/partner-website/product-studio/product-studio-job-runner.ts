import { assignInventoryToCategoryFromPg, fetchPartnerCategoryByIdFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { insertPartnerInventoryFromProductStudioFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  fetchProductStudioJobByIdPg,
  updateProductStudioJobPg,
} from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { generateProductStudioDescription } from '@/lib/partner-website/product-studio/product-studio-description-ai'
import { bootstrapSingleProductLandingForStudio } from '@/lib/partner-website/product-studio/product-studio-ladipage-bridge'
import { resolveOrCreateProductStudioCategory } from '@/lib/partner-website/product-studio/product-studio-taxonomy-ai'
import {
  studioPublishMissing,
  type ProductStudioJobPayload,
  type ProductStudioJobRow,
  type ProductStudioPublishResult,
} from '@/lib/partner-website/product-studio/product-studio-types'

/**
 * PS.2/PS.3 — job runner cho Product Studio. Mode thủ công publish gần như đồng bộ (không cần AI).
 * PS.7-PS.9 (Phase E) sẽ mở rộng `resolveProductDescription`/gán danh mục AI/bridge Ladipage — giữ
 * đúng seam ở đây để không phải viết lại luồng publish.
 */

export type ProductStudioValidationError = { field: string; message: string }

export function validateProductStudioPayloadForPublish(
  payload: ProductStudioJobPayload
): { ok: true } | { ok: false; errors: ProductStudioValidationError[] } {
  const errors: ProductStudioValidationError[] = []
  if (!payload.price || payload.price <= 0) {
    errors.push({ field: 'price', message: 'price_required' })
  }
  if (!payload.material.trim()) {
    errors.push({ field: 'material', message: 'material_required' })
  }
  if (payload.mode === 'manual') {
    if (!payload.productName.trim()) {
      errors.push({ field: 'productName', message: 'name_required_manual' })
    }
    const hasMainImage = Boolean(payload.mainImage?.trim()) || (payload.colors?.[0]?.img ?? '').trim().length > 0
    if (!hasMainImage) {
      errors.push({ field: 'mainImage', message: 'image_required' })
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true }
}

/**
 * Mô tả hiển thị công khai. Ưu tiên nội dung merchant tự nhập; nếu trống, ghép tạm từ thuộc tính
 * (deterministic, không cần AI) — PS.7 sẽ thay bằng DeepSeek khi mô tả còn trống lúc publish.
 */
export function resolveFallbackProductDescription(payload: ProductStudioJobPayload, name: string): string {
  const bits: string[] = []
  if (payload.material.trim()) bits.push(payload.material.trim())
  if (payload.style.trim()) bits.push(payload.style.trim())
  if (payload.notes.trim()) bits.push(payload.notes.trim())
  return bits.length ? `${name} — ${bits.join(', ')}.` : name
}

function resolveGalleryAndDetailFromPayload(payload: ProductStudioJobPayload): {
  mainImage: string
  gallery: string[]
  detail: string[]
} {
  const colorImgs = (payload.colors ?? []).map((c) => c.img).filter(Boolean)
  const mainImage = (payload.mainImage ?? '').trim() || colorImgs[0] || ''
  const gallery = [...(payload.images ?? []), ...(payload.gallery ?? [])].filter((u) => u && u !== mainImage)
  return { mainImage, gallery, detail: [] }
}

/** PS.5/PS.9 — mode AI: ảnh thật nằm ở `job.studio` (Studio slot pipeline), không phải `payload`. */
function resolveGalleryAndDetailFromStudio(job: ProductStudioJobRow): {
  mainImage: string
  gallery: string[]
  detail: string[]
  colors: { name: string; img: string }[]
  materialImage: string
} {
  const studio = job.studio
  const mainImage = (studio.mainImage ?? '').trim() || studio.colors[0]?.img || ''
  // Giống 188: gallery / chi tiết / chất liệu tách riêng — không nhét ảnh chất liệu vào detail.
  return {
    mainImage,
    gallery: [...studio.gallery],
    detail: [...studio.detail],
    colors: studio.colors,
    materialImage: (studio.materialImage || '').trim(),
  }
}

export async function publishProductStudioJob(
  partnerId: string,
  jobId: string
): Promise<{ ok: true; result: ProductStudioPublishResult } | { ok: false; error: string }> {
  const job = await fetchProductStudioJobByIdPg(partnerId, jobId)
  if (!job) return { ok: false, error: 'job_not_found' }
  if (job.status === 'done' && job.result) return { ok: true, result: job.result }

  const validation = validateProductStudioPayloadForPublish(job.payload)
  if (!validation.ok) {
    const msg = validation.errors.map((e) => `${e.field}:${e.message}`).join(', ')
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: msg })
    return { ok: false, error: msg }
  }

  if (job.payload.mode === 'ai') {
    const missing = studioPublishMissing(job.studio)
    if (missing.length) {
      return { ok: false, error: `studio_incomplete:${missing.join(',')}` }
    }
    if (job.status === 'ready_for_review' && job.studio.currentSlot?.candidateUrl) {
      return { ok: false, error: 'approve_pending' }
    }
  }

  await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'publishing',
    step: 'create_product',
    message: 'Đang tạo sản phẩm…',
    progress: 80,
  })

  const payload = job.payload
  const name = payload.productName.trim() || job.visionProductName?.trim() || 'Sản phẩm mới'
  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const partner = await fetchPartnerProfileForWebsitePg(partnerId)
  const brandName = partner?.brandName?.trim() || partner?.displayName?.trim() || name

  // PS.7 — DeepSeek viết mô tả khi merchant để trống (cả 2 mode) — không hardcode tiếng Việt/brand 188.
  let description = (payload.description ?? '').trim()
  if (!description) {
    const aiDescription = await generateProductStudioDescription(payload, name, website?.locale ?? 'vi', brandName)
    description = aiDescription || resolveFallbackProductDescription(payload, name)
  }

  const { mainImage, gallery, detail, colors, materialImage } =
    payload.mode === 'ai'
      ? resolveGalleryAndDetailFromStudio(job)
      : { ...resolveGalleryAndDetailFromPayload(payload), colors: payload.colors ?? [], materialImage: '' }

  if (!mainImage) {
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: 'missing_main_image' })
    return { ok: false, error: 'missing_main_image' }
  }

  const inventoryId = await insertPartnerInventoryFromProductStudioFromPg(partnerId, {
    name,
    description,
    priceAmount: payload.price,
    colors,
    sizes: payload.noSize ? [] : payload.sizes ?? [],
    mainImage,
    galleryUrls: gallery,
    detailImageUrls: detail,
    material: payload.material ?? '',
    materialDetailImageUrl: materialImage || null,
    stockQty: payload.available ?? 0,
    origin: payload.mode === 'ai' ? 'manual_ai' : 'manual',
    productStudioJobId: jobId,
    productStudioMeta: {
      mode: payload.mode,
      productType: payload.productType,
      gender: payload.gender,
      shotStyle: payload.shotStyle,
      modelPresence: payload.modelPresence,
      imageModel: payload.imageModel,
      visionProductName: job.visionProductName,
      visionAnalysis: job.visionAnalysis,
      createdAt: new Date().toISOString(),
    },
  })

  if (!inventoryId) {
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: 'insert_failed' })
    return { ok: false, error: 'insert_failed' }
  }

  const warnings: string[] = []

  // PS.8 — AI tự resolve/mở rộng cây danh mục của shop khi merchant không tự chọn category.
  let categoryId: string | null = payload.categoryId ?? null
  if (!categoryId) {
    const taxonomy = await resolveOrCreateProductStudioCategory(partnerId, payload, name)
    categoryId = taxonomy.categoryId
    warnings.push(...taxonomy.warnings)
  }
  let categoryPath: string | null = null
  if (categoryId) {
    await assignInventoryToCategoryFromPg(partnerId, inventoryId, categoryId, true)
    const cat = await fetchPartnerCategoryByIdFromPg(partnerId, categoryId)
    categoryPath = cat?.path ?? null
  }

  // PS.9 — bridge: tự tạo + publish 1 Ladipage AI riêng cho sản phẩm này (kết hợp 2 tính năng).
  let landingId: string | null = null
  let landingSlug: string | null = null
  try {
    const bridged = await bootstrapSingleProductLandingForStudio(partnerId, inventoryId, name)
    if (bridged) {
      landingId = bridged.landingId
      landingSlug = bridged.landingSlug
      warnings.push(...bridged.warnings)
    }
  } catch (e) {
    warnings.push(`ladipage_bridge: ${e instanceof Error ? e.message : String(e)}`)
  }

  const result: ProductStudioPublishResult = {
    inventoryId,
    name,
    categoryId,
    categoryPath,
    landingId,
    landingSlug,
    warnings,
  }

  await updateProductStudioJobPg({
    partnerId,
    jobId,
    status: 'done',
    step: 'done',
    message: 'Đăng sản phẩm thành công.',
    progress: 100,
    result,
    errorMessage: null,
  })

  return { ok: true, result }
}

/** PS.2 — cron resume: job kẹt ở generating/publishing quá lâu (crash/restart giữa chừng). */
export async function resumeStuckProductStudioJob(job: ProductStudioJobRow): Promise<void> {
  if (job.status === 'publishing') {
    await publishProductStudioJob(job.partnerId, job.id)
    return
  }
  if (job.status === 'generating') {
    const hasCandidate = Boolean(job.studio.currentSlot?.candidateUrl)
    await updateProductStudioJobPg({
      partnerId: job.partnerId,
      jobId: job.id,
      status: hasCandidate ? 'ready_for_review' : 'draft',
      step: hasCandidate ? 'awaiting_approval' : 'awaiting_input',
      message: 'recovered',
    })
  }
}
