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

/** PS.1/PS.2 — job table CRUD (đăng sản phẩm thủ công/AI). Xem docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md nhóm PS.*. */

type JobDbRow = {
  id: string
  partner_id: string
  created_by: string | null
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

const SELECT_COLS = `id::text, partner_id::text, created_by::text, mode, status, step, message, progress,
  payload, studio, vision_product_name, vision_analysis, vision_colors, result, error_message, warnings,
  created_at, updated_at`

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function mapJobRow(r: JobDbRow): ProductStudioJobRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    createdBy: r.created_by,
    mode: r.mode === 'ai' ? 'ai' : 'manual',
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

function isMissingProductStudioJobsTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  if (err.code !== '42P01') return false
  return /messaging_partner_product_studio_jobs/i.test(String(err.message ?? ''))
}

export async function insertProductStudioJobPg(input: {
  partnerId: string
  createdBy: string | null
  mode: 'manual' | 'ai'
  payload: ProductStudioJobPayload
  status?: ProductStudioJobStatus
  step?: string
  message?: string
}): Promise<ProductStudioJobRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<JobDbRow>(
      `insert into public.messaging_partner_product_studio_jobs (
         partner_id, created_by, mode, status, step, message, payload, studio
       ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       returning ${SELECT_COLS}`,
      [
        input.partnerId,
        input.createdBy,
        input.mode,
        input.status ?? 'draft',
        input.step ?? null,
        input.message ?? null,
        JSON.stringify(input.payload),
        JSON.stringify(defaultProductStudioState()),
      ]
    )
    return row ? mapJobRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-product-studio-jobs-pg] insertProductStudioJobPg', e)
    return null
  }
}

export async function fetchProductStudioJobByIdPg(
  partnerId: string,
  jobId: string
): Promise<ProductStudioJobRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<JobDbRow>(
      `select ${SELECT_COLS} from public.messaging_partner_product_studio_jobs
       where partner_id = $1::uuid and id = $2::uuid limit 1`,
      [partnerId, jobId]
    )
    return row ? mapJobRow(row) : null
  } catch (e) {
    if (isMissingProductStudioJobsTableError(e)) return null
    console.error('[messaging-partner-product-studio-jobs-pg] fetchProductStudioJobByIdPg', e)
    return null
  }
}

export async function listProductStudioJobsPg(
  partnerId: string,
  opts: { activeOnly?: boolean; limit?: number } = {}
): Promise<ProductStudioJobRow[]> {
  if (!isPgConfigured()) return []
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
  try {
    const rows = opts.activeOnly
      ? await pgQuery<JobDbRow>(
          `select ${SELECT_COLS} from public.messaging_partner_product_studio_jobs
           where partner_id = $1::uuid and status not in ('done', 'failed')
           order by created_at desc limit $2`,
          [partnerId, limit]
        )
      : await pgQuery<JobDbRow>(
          `select ${SELECT_COLS} from public.messaging_partner_product_studio_jobs
           where partner_id = $1::uuid
           order by created_at desc limit $2`,
          [partnerId, limit]
        )
    return rows.map(mapJobRow)
  } catch (e) {
    if (isMissingProductStudioJobsTableError(e)) return []
    console.error('[messaging-partner-product-studio-jobs-pg] listProductStudioJobsPg', e)
    return []
  }
}

/** Cron resume (PS.2) — job kẹt ở generating/publishing quá lâu (crash/restart giữa chừng). */
export async function listStuckProductStudioJobsPg(olderThanMinutes: number, limit = 20): Promise<ProductStudioJobRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<JobDbRow>(
      `select ${SELECT_COLS} from public.messaging_partner_product_studio_jobs
       where status in ('generating', 'publishing')
         and updated_at < now() - ($1::text || ' minutes')::interval
       order by updated_at asc limit $2`,
      [String(Math.max(1, olderThanMinutes)), limit]
    )
    return rows.map(mapJobRow)
  } catch (e) {
    if (isMissingProductStudioJobsTableError(e)) return []
    console.error('[messaging-partner-product-studio-jobs-pg] listStuckProductStudioJobsPg', e)
    return []
  }
}

export async function updateProductStudioJobPg(input: {
  partnerId: string
  jobId: string
  status?: ProductStudioJobStatus
  step?: string | null
  message?: string | null
  progress?: number
  payload?: ProductStudioJobPayload
  studio?: ProductStudioState
  visionProductName?: string | null
  visionAnalysis?: string | null
  visionColors?: string[]
  result?: ProductStudioPublishResult | null
  errorMessage?: string | null
  warnings?: string[]
}): Promise<ProductStudioJobRow | null> {
  if (!isPgConfigured()) return null
  const existing = await fetchProductStudioJobByIdPg(input.partnerId, input.jobId)
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
      `update public.messaging_partner_product_studio_jobs set
         status = $3, step = $4, message = $5, progress = $6, payload = $7::jsonb, studio = $8::jsonb,
         vision_product_name = $9, vision_analysis = $10, vision_colors = $11::jsonb, result = $12::jsonb,
         error_message = $13, warnings = $14::jsonb
       where partner_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      [
        input.partnerId,
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
    console.error('[messaging-partner-product-studio-jobs-pg] updateProductStudioJobPg', e)
    return null
  }
}

export async function deleteProductStudioJobPg(partnerId: string, jobId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const rows = await pgQuery<{ id: string }>(
      `delete from public.messaging_partner_product_studio_jobs
       where partner_id = $1::uuid and id = $2::uuid
       returning id::text`,
      [partnerId, jobId]
    )
    return rows.length > 0
  } catch (e) {
    console.error('[messaging-partner-product-studio-jobs-pg] deleteProductStudioJobPg', e)
    return false
  }
}
