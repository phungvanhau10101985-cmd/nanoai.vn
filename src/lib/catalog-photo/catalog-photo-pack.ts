import { proposeProductStudioCategoryPath } from '@/lib/partner-website/category/partner-category-taxonomy-propose'
import { studioCanPublish } from '@/lib/partner-website/product-studio/product-studio-types'
import type { ProductStudioJobRow, ProductStudioPublishResult } from '@/lib/partner-website/product-studio/product-studio-types'
import {
  fetchUserCatalogPhotoJobPg,
  updateUserCatalogPhotoJobPg,
} from '@/lib/db/user-catalog-photo-jobs-pg'

function categoryLabel(path: { l1?: { name?: string }; l2?: { name?: string }; l3?: { name?: string } } | null): string {
  return [path?.l1?.name, path?.l2?.name, path?.l3?.name]
    .map((name) => String(name ?? '').trim())
    .filter(Boolean)
    .join(' / ')
}

/** Chốt bộ ảnh: tên + loại để copy. Không tạo sản phẩm trên shop. */
export async function finishUserCatalogPhotoPack(
  userId: string,
  jobId: string
): Promise<{ ok: true; job: ProductStudioJobRow } | { ok: false; error: string }> {
  const job = await fetchUserCatalogPhotoJobPg(userId, jobId)
  if (!job) return { ok: false, error: 'job_not_found' }
  if (job.status === 'done' && job.result) return { ok: true, job }
  if (job.status === 'generating') return { ok: false, error: 'job_busy' }
  if (job.status === 'ready_for_review' && job.studio.currentSlot?.candidateUrl) {
    return { ok: false, error: 'approve_pending' }
  }
  if (!studioCanPublish(job.studio)) return { ok: false, error: 'studio_incomplete' }

  const name = job.payload.productName.trim() || job.visionProductName?.trim() || ''
  const proposed = name
    ? await proposeProductStudioCategoryPath({ ...job.payload, productName: name }, name, [])
    : null
  const result: ProductStudioPublishResult = {
    inventoryId: '',
    name,
    categoryId: null,
    categoryPath: categoryLabel(proposed) || null,
    landingId: null,
    landingSlug: null,
    warnings: [],
  }
  const updated = await updateUserCatalogPhotoJobPg({
    userId,
    jobId,
    status: 'done',
    step: 'pack_ready',
    message: null,
    progress: 100,
    result,
    errorMessage: null,
  })
  if (!updated) return { ok: false, error: 'save_failed' }
  return { ok: true, job: updated }
}
