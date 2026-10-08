import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  defaultProductStudioState,
  jsonToProductStudioPayload,
  jsonToProductStudioState,
  type ProductStudioJobPayload,
  type ProductStudioJobRow,
  type ProductStudioJobStatus,
  type ProductStudioPublishResult,
  type ProductStudioState,
} from '@/lib/partner-website/product-studio/product-studio-types'
import type { Json } from '@/types/database.types'
import type { ProductStudioJobPatch } from '@/lib/partner-website/product-studio/product-studio-slot-pipeline'

type JobDbRow = {
  id: string
  user_id: string
  mode: string
  status: string
  step: string | null
  message: string | null
  progress: number
  payload: unknown
  studio: unknown
  vision_product_name: string | null
  vision_analysis: string | null
  vision_colors: unknown
  result: unknown
  error_message: string | null
  warnings: unknown
  created_at: unknown
  updated_at: unknown
}

const SELECT_COLS = `id::text, user_id::text, mode, status, step, message, progress,
  payload, studio, vision_product_name, vision_analysis, vision_colors, result, error_message, warnings,
  created_at, updated_at`

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function mapJobRow(r: JobDbRow): ProductStudioJobRow {
  return {
    id: r.id,
    partnerId: '',
    createdBy: r.user_id,
    mode: 'ai',
    status: r.status as ProductStudioJobStatus,
    step: r.step,
    message: r.message,
    progress: Number(r.progress ?? 0) || 0,
    payload: jsonToProductStudioPayload((r.payload ?? {}) as Json),
    studio: jsonToProductStudioState((r.studio ?? {}) as Json),
    visionProductName: r.vision_product_name,
    visionAnalysis: r.vision_analysis,
    visionColors: asStringArray(r.vision_colors),
    result: (r.result as ProductStudioPublishResult | null) ?? null,
    errorMessage: r.error_message,
    warnings: asStringArray(r.warnings),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

function isMissingTable(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  return err.code === '42P01' && /user_catalog_photo_jobs/i.test(String(err.message ?? ''))
}

export async function insertUserCatalogPhotoJobPg(input: {
  userId: string
  payload: ProductStudioJobPayload
}): Promise<ProductStudioJobRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<JobDbRow>(
      `insert into public.user_catalog_photo_jobs (user_id, mode, status, step, payload, studio)
       values ($1::uuid, 'ai', 'draft', 'awaiting_input', $2::jsonb, $3::jsonb)
       returning ${SELECT_COLS}`,
      [input.userId, JSON.stringify(input.payload), JSON.stringify(defaultProductStudioState())]
    )
    return row ? mapJobRow(row) : null
  } catch (e) {
    if (isMissingTable(e)) return null
    console.error('[user-catalog-photo-jobs-pg] insert', e)
    return null
  }
}

export async function fetchUserCatalogPhotoJobPg(
  userId: string,
  jobId: string
): Promise<ProductStudioJobRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<JobDbRow>(
      `select ${SELECT_COLS} from public.user_catalog_photo_jobs
       where user_id = $1::uuid and id = $2::uuid limit 1`,
      [userId, jobId]
    )
    return row ? mapJobRow(row) : null
  } catch (e) {
    if (isMissingTable(e)) return null
    console.error('[user-catalog-photo-jobs-pg] fetch', e)
    return null
  }
}

export async function listUserCatalogPhotoJobsPg(
  userId: string,
  opts: { activeOnly?: boolean; status?: 'done'; limit?: number } = {}
): Promise<ProductStudioJobRow[]> {
  if (!isPgConfigured()) return []
  const cap = opts.status === 'done' ? 50 : 20
  const limit = Math.min(cap, Math.max(1, opts.limit ?? (opts.status === 'done' ? 50 : 8)))
  try {
    const rows = await pgQuery<JobDbRow>(
      opts.status === 'done'
        ? `select ${SELECT_COLS} from public.user_catalog_photo_jobs
           where user_id = $1::uuid and status = 'done'
           order by updated_at desc limit $2`
        : `select ${SELECT_COLS} from public.user_catalog_photo_jobs
           where user_id = $1::uuid
             and ($2::boolean = false or status not in ('done', 'failed'))
           order by created_at desc limit $3`,
      opts.status === 'done' ? [userId, limit] : [userId, Boolean(opts.activeOnly), limit]
    )
    return rows.map(mapJobRow)
  } catch (e) {
    if (isMissingTable(e)) return []
    console.error('[user-catalog-photo-jobs-pg] list', e)
    return []
  }
}

export async function updateUserCatalogPhotoJobPg(input: {
  userId: string
  jobId: string
} & ProductStudioJobPatch): Promise<ProductStudioJobRow | null> {
  if (!isPgConfigured()) return null
  const existing = await fetchUserCatalogPhotoJobPg(input.userId, input.jobId)
  if (!existing) return null
  const next = {
    status: input.status ?? existing.status,
    step: input.step !== undefined ? input.step : existing.step,
    message: input.message !== undefined ? input.message : existing.message,
    progress: input.progress !== undefined ? Math.max(0, Math.min(100, input.progress)) : existing.progress,
    payload: input.payload ?? existing.payload,
    studio: input.studio ?? existing.studio,
    visionProductName: input.visionProductName !== undefined ? input.visionProductName : existing.visionProductName,
    visionAnalysis: input.visionAnalysis !== undefined ? input.visionAnalysis : existing.visionAnalysis,
    visionColors: input.visionColors ?? existing.visionColors,
    result: input.result !== undefined ? input.result : existing.result,
    errorMessage: input.errorMessage !== undefined ? input.errorMessage : existing.errorMessage,
    warnings: input.warnings ?? existing.warnings,
  }
  try {
    const row = await pgQueryOne<JobDbRow>(
      `update public.user_catalog_photo_jobs set
         status = $3, step = $4, message = $5, progress = $6, payload = $7::jsonb, studio = $8::jsonb,
         vision_product_name = $9, vision_analysis = $10, vision_colors = $11::jsonb, result = $12::jsonb,
         error_message = $13, warnings = $14::jsonb
       where user_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      [
        input.userId,
        input.jobId,
        next.status,
        next.step,
        next.message,
        next.progress,
        JSON.stringify(next.payload),
        JSON.stringify(next.studio),
        next.visionProductName,
        next.visionAnalysis,
        JSON.stringify(next.visionColors),
        next.result ? JSON.stringify(next.result) : null,
        next.errorMessage,
        JSON.stringify(next.warnings),
      ]
    )
    return row ? mapJobRow(row) : null
  } catch (e) {
    console.error('[user-catalog-photo-jobs-pg] update', e)
    return null
  }
}

export async function deleteUserCatalogPhotoJobPg(userId: string, jobId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const rows = await pgQuery<{ id: string }>(
      `delete from public.user_catalog_photo_jobs
       where user_id = $1::uuid and id = $2::uuid
       returning id::text`,
      [userId, jobId]
    )
    return rows.length > 0
  } catch (e) {
    console.error('[user-catalog-photo-jobs-pg] delete', e)
    return false
  }
}
