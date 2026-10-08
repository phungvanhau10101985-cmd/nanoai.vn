import {
  assignInventoryToCategoryFromPg,
  fetchPartnerCategoryByIdFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { listLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import {
  applyPartnerInventoryCatalogPatchFromPg,
  deletePartnerInventoryItemForPartnerFromPg,
  fetchPartnerInventoryByStudioJobFromPg,
  insertPartnerInventoryFromProductStudioFromPg,
  listPartnerInventorySkuCodesFromPg,
  updatePartnerInventoryDescriptionFromPg,
  updatePartnerInventoryFromProductStudioFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  fetchProductStudioJobByIdPg,
  updateProductStudioJobPg,
} from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { generateProductStudioDescription } from '@/lib/partner-website/product-studio/product-studio-description-ai'
import {
  LADIPAGE_REQUIRED_MESSAGE,
  STUDIO_SEO_NAME_MISSING,
  buildStudioInventoryCatalog,
  classifyStudioProductForPublish,
  composeLadipageDescription,
  shouldAdoptLadipageDescription,
} from '@/lib/partner-website/product-studio/product-studio-finalize'
import { bootstrapSingleProductLandingForStudio } from '@/lib/partner-website/product-studio/product-studio-ladipage-bridge'
import { ensurePartnerInventorySkuPrefix, listOtherShopInternalSkusForPrefix } from '@/lib/messaging/partner-inventory-sku-prefix-pg'
import { resolvePartnerImportSku, skuBlockKey } from '@/lib/messaging/partner-inventory-internal-sku'
import {
  studioPublishMissing,
  type ProductStudioJobPayload,
  type ProductStudioJobRow,
  type ProductStudioPublishResult,
} from '@/lib/partner-website/product-studio/product-studio-types'

/**
 * Product Studio publish: taxonomy 14 khóa, catalog, SKU SaaS, Ladipage bắt buộc để job `done`.
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
  const lockedName = payload.productName.trim() || job.visionProductName?.trim() || ''
  if (!lockedName) {
    const message = payload.mode === 'ai' ? STUDIO_SEO_NAME_MISSING : 'name_required_manual'
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: message })
    return { ok: false, error: message }
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const partner = await fetchPartnerProfileForWebsitePg(partnerId)
  const shopName = partner?.brandName?.trim() || partner?.displayName?.trim() || lockedName

  const { mainImage, gallery, detail, colors, materialImage } =
    payload.mode === 'ai'
      ? resolveGalleryAndDetailFromStudio(job)
      : { ...resolveGalleryAndDetailFromPayload(payload), colors: payload.colors ?? [], materialImage: '' }

  if (!mainImage) {
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: 'missing_main_image' })
    return { ok: false, error: 'missing_main_image' }
  }

  const sizes = payload.noSize ? [] : payload.sizes ?? []
  const existing = await fetchPartnerInventoryByStudioJobFromPg(partnerId, jobId)
  const classified = await classifyStudioProductForPublish({
    partnerId,
    payload,
    lockedName,
    colors,
    sizes,
  })
  if (!classified.ok) {
    if (existing?.id) await deletePartnerInventoryItemForPartnerFromPg(partnerId, existing.id)
    const message = classified.error || 'taxonomy_failed'
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: message, warnings: classified.warnings })
    return { ok: false, error: message }
  }

  let description = classified.description
  if (!description) {
    const aiDescription = await generateProductStudioDescription(payload, lockedName, website?.locale ?? 'vi', shopName)
    description = aiDescription || resolveFallbackProductDescription(payload, lockedName)
  }
  classified.productData.description = description
  const name = classified.name
  const warnings = [...classified.warnings]

  const shopPrefix = await ensurePartnerInventorySkuPrefix(partnerId)
  const blocked = new Set<string>()
  for (const code of await listPartnerInventorySkuCodesFromPg(partnerId)) {
    const key = skuBlockKey(code)
    if (key) blocked.add(key)
  }
  for (const code of await listOtherShopInternalSkusForPrefix(partnerId, shopPrefix)) {
    const key = skuBlockKey(code)
    if (key) blocked.add(key)
  }
  const sku =
    resolvePartnerImportSku({
      proposed: '',
      existingSku: existing?.sku || '',
      assignIfEmpty: true,
      shopPrefix,
      blocked,
    }) || ''
  const remarketingId = existing?.remarketingId || `ps-${jobId}`
  const creationOrigin = payload.mode === 'ai' ? 'manual_ai' : 'manual'
  const studioMeta = {
    mode: payload.mode,
    productType: payload.productType,
    gender: payload.gender,
    shotStyle: payload.shotStyle,
    modelPresence: payload.modelPresence,
    imageModel: payload.imageModel,
    visionProductName: job.visionProductName,
    visionAnalysis: job.visionAnalysis,
    createdAt: new Date().toISOString(),
  }
  const core = {
    name,
    description,
    priceAmount: payload.price,
    colors,
    sizes,
    mainImage,
    galleryUrls: gallery,
    detailImageUrls: detail,
    material: payload.material ?? '',
    materialDetailImageUrl: materialImage || null,
    stockQty: payload.available ?? 0,
    origin: creationOrigin as 'manual' | 'manual_ai',
    productStudioMeta: studioMeta,
    sku,
    remarketingId,
  }
  const inventoryId = existing
    ? await updatePartnerInventoryFromProductStudioFromPg(partnerId, existing.id, core)
    : await insertPartnerInventoryFromProductStudioFromPg(partnerId, { ...core, productStudioJobId: jobId })
  if (!inventoryId) {
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: 'insert_failed' })
    return { ok: false, error: 'insert_failed' }
  }

  const catalog = buildStudioInventoryCatalog({
    productData: classified.productData,
    remarketingId,
    sku,
    name,
    description,
    price: payload.price,
    shopName,
    mainImage,
    gallery,
    detail,
    colors,
    sizes,
    stockQty: payload.available ?? 0,
    materialFallback: payload.material ?? '',
    gender: payload.gender,
  })
  const patched = await applyPartnerInventoryCatalogPatchFromPg([
    { id: inventoryId, partnerId, catalog, materialNote: catalog.material_note || payload.material || undefined },
  ])
  if (!patched) {
    await updateProductStudioJobPg({ partnerId, jobId, status: 'failed', errorMessage: 'catalog_patch_failed' })
    return { ok: false, error: 'catalog_patch_failed' }
  }

  const categoryId = classified.categoryId
  let categoryPath: string | null = null
  if (categoryId) {
    const assigned = await assignInventoryToCategoryFromPg(partnerId, inventoryId, categoryId, true)
    if (!assigned && payload.mode === 'ai') {
      await updateProductStudioJobPg({
        partnerId,
        jobId,
        status: 'failed',
        errorMessage: 'category_assign_failed',
        result: {
          inventoryId,
          name,
          categoryId,
          categoryPath: null,
          landingId: null,
          landingSlug: null,
          warnings,
        },
      })
      return { ok: false, error: 'category_assign_failed' }
    }
    if (!assigned) warnings.push('category_assign_failed')
    const cat = await fetchPartnerCategoryByIdFromPg(partnerId, categoryId)
    categoryPath = cat?.path ?? null
  }

  let landingId: string | null = null
  let landingSlug: string | null = null
  let landingPublished = false
  try {
    const bridged = await bootstrapSingleProductLandingForStudio(partnerId, inventoryId, name, {
      materialImageUrl: materialImage || null,
      materialCallouts: job.studio.materialCallouts || [],
      materialBody: payload.material || null,
    })
    if (bridged) {
      landingId = bridged.landingId
      landingSlug = bridged.landingSlug
      landingPublished = bridged.published
      warnings.push(...bridged.warnings)
    }
  } catch (e) {
    warnings.push(`ladipage_bridge: ${e instanceof Error ? e.message : String(e)}`)
  }

  const partial: ProductStudioPublishResult = {
    inventoryId,
    name,
    categoryId,
    categoryPath,
    landingId,
    landingSlug,
    warnings,
  }
  if (!landingPublished) {
    await updateProductStudioJobPg({
      partnerId,
      jobId,
      status: 'failed',
      errorMessage: LADIPAGE_REQUIRED_MESSAGE,
      warnings,
      result: partial,
    })
    return { ok: false, error: LADIPAGE_REQUIRED_MESSAGE }
  }

  if (landingId) {
    const sections = await listLandingSectionsPg(landingId)
    const composed = composeLadipageDescription(
      sections.map((section) => ({
        sectionType: section.sectionType,
        data: (section.data || {}) as Record<string, unknown>,
      }))
    )
    if (shouldAdoptLadipageDescription(description, composed)) {
      description = composed
      await updatePartnerInventoryDescriptionFromPg(partnerId, inventoryId, description)
      const synced = buildStudioInventoryCatalog({
        productData: { ...classified.productData, description },
        remarketingId,
        sku,
        name,
        description,
        price: payload.price,
        shopName,
        mainImage,
        gallery,
        detail,
        colors,
        sizes,
        stockQty: payload.available ?? 0,
        materialFallback: payload.material ?? '',
        gender: payload.gender,
      })
      await applyPartnerInventoryCatalogPatchFromPg([
        { id: inventoryId, partnerId, catalog: synced, materialNote: synced.material_note || payload.material || undefined },
      ])
      partial.warnings = warnings
    }
  }

  const result: ProductStudioPublishResult = { ...partial, name, warnings }

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
