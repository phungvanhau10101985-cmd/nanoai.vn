import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchUserCatalogPhotoJobPg,
  updateUserCatalogPhotoJobPg,
} from '@/lib/db/user-catalog-photo-jobs-pg'
import {
  approveProductStudioSlotOnJob,
  generateProductStudioSlotOnJob,
  selectProductStudioImagesOnJob,
  type GenerateStudioSlotOpts,
} from '@/lib/partner-website/product-studio/product-studio-slot-pipeline'
import type { WebLocale } from '@/lib/i18n/config'

export async function requireCatalogPhotoUser(): Promise<
  { userId: string } | { error: string; status: number }
> {
  if (!isPgConfigured()) return { error: 'Database not configured', status: 503 }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error, status: 401 }
  return { userId: auth.user.id }
}

export async function generateUserCatalogPhotoSlot(
  userId: string,
  jobId: string,
  opts: GenerateStudioSlotOpts,
  locale: WebLocale
) {
  const job = await fetchUserCatalogPhotoJobPg(userId, jobId)
  if (!job) return { ok: false as const, error: 'job_not_found' }
  return generateProductStudioSlotOnJob(job, opts, locale, (patch) =>
    updateUserCatalogPhotoJobPg({ userId, jobId, ...patch })
  )
}

export async function approveUserCatalogPhotoSlot(userId: string, jobId: string) {
  const job = await fetchUserCatalogPhotoJobPg(userId, jobId)
  if (!job) return { ok: false as const, error: 'job_not_found' }
  return approveProductStudioSlotOnJob(job, (patch) => updateUserCatalogPhotoJobPg({ userId, jobId, ...patch }))
}

export async function selectUserCatalogPhotoImages(
  userId: string,
  jobId: string,
  kind: 'gallery' | 'detail',
  urls: string[]
) {
  const job = await fetchUserCatalogPhotoJobPg(userId, jobId)
  if (!job) return { ok: false as const, error: 'job_not_found' }
  return selectProductStudioImagesOnJob(job, kind, urls, (patch) =>
    updateUserCatalogPhotoJobPg({ userId, jobId, ...patch })
  )
}
