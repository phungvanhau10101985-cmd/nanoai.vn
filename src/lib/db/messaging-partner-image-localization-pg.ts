import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { bumpInventoryCacheLater } from '@/lib/cache/partner-shop-cache'
import type {
  ImageLocJob,
  ImageLocProductReport,
  ImageLocRecentResult,
  ImageLocSkippedReport,
  ImageLocStartPayload,
  ImageLocSummary,
  ImageProcessResult,
  ImageRef,
} from '@/lib/messaging/image-localization/image-localization-types'
import { IMAGE_LOC_TERMINAL_JOB_STATUSES } from '@/lib/messaging/image-localization/image-localization-types'

type JobRow = {
  job_id: string
  partner_id: string
  status: string
  phase: string | null
  message: string | null
  payload_json: unknown
  current: number | null
  total: number | null
  done: number | null
  failed: number | null
  skipped: number | null
  percent: number | null
  current_product_id: string | null
  cancel_requested: boolean | null
  queue_product_ids: unknown
  processed_product_ids: unknown
  job_queue_truncated: boolean | null
  recent_results: unknown
  skipped_product_reports: unknown
  language: string | null
  force: boolean | null
  dry_run: boolean | null
  gemini_mode: string | null
  local_image_only: boolean | null
  resume_count: number | null
  created_at: string | null
  updated_at: string | null
  started_at: string | null
  finished_at: string | null
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function asPayload(raw: unknown): ImageLocStartPayload | Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as ImageLocStartPayload
}

function mapJob(row: JobRow): ImageLocJob {
  const queue = asStringList(row.queue_product_ids)
  return {
    job_id: row.job_id,
    partner_id: row.partner_id,
    status: row.status,
    phase: row.phase,
    message: row.message,
    payload: asPayload(row.payload_json),
    current: Number(row.current || 0),
    total: row.total == null ? null : Number(row.total),
    done: Number(row.done || 0),
    failed: Number(row.failed || 0),
    skipped: Number(row.skipped || 0),
    percent: row.percent == null ? null : Number(row.percent),
    current_product_id: row.current_product_id,
    cancel_requested: Boolean(row.cancel_requested),
    queue_product_ids: queue,
    processed_product_ids: asStringList(row.processed_product_ids),
    job_queue_product_ids: queue,
    job_queue_truncated: Boolean(row.job_queue_truncated),
    recent_results: Array.isArray(row.recent_results) ? (row.recent_results as ImageLocRecentResult[]) : [],
    skipped_product_reports: Array.isArray(row.skipped_product_reports)
      ? (row.skipped_product_reports as ImageLocSkippedReport[])
      : [],
    language: row.language,
    force: Boolean(row.force),
    dry_run: Boolean(row.dry_run),
    gemini_mode: row.gemini_mode,
    local_image_only: Boolean(row.local_image_only),
    resume_count: Number(row.resume_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
  }
}

export async function insertImageLocJobFromPg(job: ImageLocJob): Promise<void> {
  if (!isPgConfigured()) throw new Error('Database not configured')
  await pgQuery(
    `insert into public.messaging_partner_image_localization_jobs (
      job_id, partner_id, status, phase, message, payload_json, current, total, done, failed, skipped, percent,
      current_product_id, cancel_requested, queue_product_ids, processed_product_ids, job_queue_truncated,
      recent_results, skipped_product_reports, language, force, dry_run, gemini_mode, local_image_only,
      resume_count, created_at, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18::jsonb,$19::jsonb,
      $20,$21,$22,$23,$24,$25, now(), now()
    )`,
    [
      job.job_id,
      job.partner_id,
      job.status,
      job.phase,
      job.message,
      JSON.stringify(job.payload || {}),
      job.current,
      job.total,
      job.done,
      job.failed,
      job.skipped,
      job.percent,
      job.current_product_id,
      job.cancel_requested,
      JSON.stringify(job.queue_product_ids),
      JSON.stringify(job.processed_product_ids),
      job.job_queue_truncated,
      JSON.stringify(job.recent_results),
      JSON.stringify(job.skipped_product_reports),
      job.language,
      job.force,
      job.dry_run,
      job.gemini_mode,
      job.local_image_only,
      job.resume_count,
    ]
  )
}

export async function updateImageLocJobFromPg(
  partnerId: string,
  jobId: string,
  patch: Partial<ImageLocJob>
): Promise<void> {
  if (!isPgConfigured()) return
  const sets: string[] = ['updated_at = now()']
  const params: unknown[] = []
  const add = (sql: string, v: unknown) => {
    params.push(v)
    sets.push(sql.replace('?', `$${params.length}`))
  }
  if (patch.status != null) {
    add(
      `status = case when status in ('done','error','cancelled') then status else ? end`,
      patch.status
    )
  }
  if (patch.phase != null) {
    add(
      `phase = case when status in ('done','error','cancelled') then phase else ? end`,
      patch.phase
    )
  }
  if ('message' in patch) add('message = ?', patch.message ?? null)
  if (patch.current != null) add('current = ?', patch.current)
  if ('total' in patch) add('total = ?', patch.total ?? null)
  if (patch.done != null) add('done = ?', patch.done)
  if (patch.failed != null) add('failed = ?', patch.failed)
  if (patch.skipped != null) add('skipped = ?', patch.skipped)
  if ('percent' in patch) add('percent = ?', patch.percent ?? null)
  if ('current_product_id' in patch) add('current_product_id = ?', patch.current_product_id ?? null)
  if (patch.cancel_requested != null) add('cancel_requested = ?', patch.cancel_requested)
  if (patch.queue_product_ids) add('queue_product_ids = ?::jsonb', JSON.stringify(patch.queue_product_ids))
  if (patch.processed_product_ids) add('processed_product_ids = ?::jsonb', JSON.stringify(patch.processed_product_ids))
  if (patch.job_queue_truncated != null) add('job_queue_truncated = ?', patch.job_queue_truncated)
  if (patch.recent_results) add('recent_results = ?::jsonb', JSON.stringify(patch.recent_results))
  if (patch.skipped_product_reports) add('skipped_product_reports = ?::jsonb', JSON.stringify(patch.skipped_product_reports))
  if (patch.resume_count != null) add('resume_count = ?', patch.resume_count)
  if (patch.started_at) add('started_at = ?::timestamptz', patch.started_at)
  if (patch.finished_at) add('finished_at = ?::timestamptz', patch.finished_at)
  params.push(partnerId, jobId)
  await pgQuery(
    `update public.messaging_partner_image_localization_jobs
     set ${sets.join(', ')}
     where partner_id = $${params.length - 1}::uuid and job_id = $${params.length}`,
    params
  )
}

export async function fetchImageLocJobFromPg(partnerId: string, jobId: string): Promise<ImageLocJob | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<JobRow>(
    `select * from public.messaging_partner_image_localization_jobs
     where partner_id = $1::uuid and job_id = $2 limit 1`,
    [partnerId, jobId]
  )
  return row ? mapJob(row) : null
}

export async function listImageLocJobsFromPg(
  partnerId: string,
  opts?: { limit?: number; offset?: number; activeOnly?: boolean }
): Promise<{ jobs: ImageLocJob[]; total: number }> {
  if (!isPgConfigured()) return { jobs: [], total: 0 }
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 40))
  const offset = Math.max(0, opts?.offset ?? 0)
  const active = opts?.activeOnly ? ` and status in ('queued','running')` : ''
  const count = await pgQueryOne<{ n: string }>(
    `select count(*)::text as n from public.messaging_partner_image_localization_jobs where partner_id = $1::uuid${active}`,
    [partnerId]
  )
  const rows = await pgQuery<JobRow>(
    `select * from public.messaging_partner_image_localization_jobs
     where partner_id = $1::uuid${active}
     order by created_at desc
     limit $2 offset $3`,
    [partnerId, limit, offset]
  )
  return { jobs: rows.map(mapJob), total: Number(count?.n || 0) }
}

export async function listResumableImageLocJobsFromPg(): Promise<ImageLocJob[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<JobRow>(
    `select * from public.messaging_partner_image_localization_jobs
     where status in ('queued','running')
     order by created_at asc
     limit 40`
  )
  return rows.map(mapJob)
}

export async function deleteImageLocJobFromPg(partnerId: string, jobId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const row = await pgQueryOne<{ job_id: string }>(
    `delete from public.messaging_partner_image_localization_jobs
     where partner_id = $1::uuid and job_id = $2
     returning job_id`,
    [partnerId, jobId]
  )
  return Boolean(row)
}

export async function deleteTerminalImageLocJobsFromPg(partnerId: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const rows = await pgQuery<{ job_id: string }>(
    `delete from public.messaging_partner_image_localization_jobs
     where partner_id = $1::uuid and status = any($2::text[])
     returning job_id`,
    [partnerId, [...IMAGE_LOC_TERMINAL_JOB_STATUSES]]
  )
  return rows.length
}

export async function imageLocSummaryFromPg(partnerId: string): Promise<ImageLocSummary> {
  if (!isPgConfigured()) return { pending: 0, localized: 0, failed: 0, processing: 0, skipped: 0 }
  const row = await pgQueryOne<{
    pending: string
    localized: string
    failed: string
    processing: string
    skipped: string
  }>(
    `select
       count(*) filter (where coalesce(image_localization_status,'pending') in ('','pending'))::text as pending,
       count(*) filter (where image_localization_status = 'localized')::text as localized,
       count(*) filter (where image_localization_status = 'failed')::text as failed,
       count(*) filter (where image_localization_status = 'processing')::text as processing,
       count(*) filter (where image_localization_status = 'skipped')::text as skipped
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and coalesce(is_active, true) = true`,
    [partnerId]
  )
  return {
    pending: Number(row?.pending || 0),
    localized: Number(row?.localized || 0),
    failed: Number(row?.failed || 0),
    processing: Number(row?.processing || 0),
    skipped: Number(row?.skipped || 0),
  }
}

export async function listPendingImageLocInventoryIdsFromPg(
  partnerId: string,
  opts: { force: boolean; productIds?: string[] | null; limit: number }
): Promise<string[]> {
  if (!isPgConfigured()) return []
  const params: unknown[] = [partnerId]
  let extra = ''
  if (opts.productIds?.length) {
    params.push(opts.productIds)
    extra += ` and id = any($${params.length}::uuid[])`
  }
  if (!opts.force) {
    extra += ` and coalesce(image_localization_status,'pending') in ('','pending','failed')`
  } else {
    extra += ` and coalesce(image_localization_status,'') <> 'processing'`
  }
  params.push(opts.limit)
  const rows = await pgQuery<{ id: string }>(
    `select id::text as id
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and coalesce(is_active, true) = true ${extra}
     order by sort_order nulls last, created_at desc
     limit $${params.length}`,
    params
  )
  return rows.map((r) => r.id)
}

export async function claimInventoryForImageLocFromPg(opts: {
  partnerId: string
  inventoryId: string
  language: string
  force: boolean
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const statusFilter = opts.force
    ? `coalesce(image_localization_status,'') <> 'processing'`
    : `coalesce(image_localization_status,'pending') in ('','pending','failed')`
  const row = await pgQueryOne<{ id: string }>(
    `update public.messaging_partner_inventory
     set image_localization_status = 'processing',
         image_localization_language = $3,
         image_localization_error = null,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid and ${statusFilter}
     returning id::text as id`,
    [opts.partnerId, opts.inventoryId, opts.language]
  )
  return Boolean(row)
}

export async function resetStaleImageLocProcessingFromPg(partnerId: string, inventoryIds?: string[]): Promise<number> {
  if (!isPgConfigured()) return 0
  const params: unknown[] = [partnerId]
  let extra = ''
  if (inventoryIds?.length) {
    params.push(inventoryIds)
    extra = ` and id = any($${params.length}::uuid[])`
  }
  const rows = await pgQuery<{ id: string }>(
    `update public.messaging_partner_inventory
     set image_localization_status = 'pending',
         image_localization_error = null,
         updated_at = now()
     where partner_id = $1::uuid and image_localization_status = 'processing' ${extra}
     returning id::text as id`,
    params
  )
  return rows.length
}

export async function applyImageLocProductResultFromPg(opts: {
  partnerId: string
  inventoryId: string
  language: string
  status: 'localized' | 'failed' | 'skipped'
  error?: string | null
  refs?: ImageRef[]
  results?: Record<string, ImageProcessResult>
  imageUrl?: string | null
  colorsJson?: unknown
  galleryUrls?: unknown
  detailImageUrls?: unknown
  materialDetailImageUrl?: string | null
  productInfoJson?: unknown
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `update public.messaging_partner_inventory set
       image_localization_status = $3,
       image_localization_language = $4,
       image_localization_error = $5,
       image_localized_at = case when $3 = 'localized' then now() else image_localized_at end,
       image_url = coalesce($6, image_url),
       colors_json = coalesce($7::jsonb, colors_json),
       gallery_urls = coalesce($8::jsonb, gallery_urls),
       detail_image_urls = coalesce($9::jsonb, detail_image_urls),
       material_detail_image_url = coalesce($10, material_detail_image_url),
       product_info_json = coalesce($11::jsonb, product_info_json),
       updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [
      opts.partnerId,
      opts.inventoryId,
      opts.status,
      opts.language,
      opts.error ?? null,
      opts.imageUrl ?? null,
      opts.colorsJson != null ? JSON.stringify(opts.colorsJson) : null,
      opts.galleryUrls != null ? JSON.stringify(opts.galleryUrls) : null,
      opts.detailImageUrls != null ? JSON.stringify(opts.detailImageUrls) : null,
      opts.materialDetailImageUrl ?? null,
      opts.productInfoJson != null ? JSON.stringify(opts.productInfoJson) : null,
    ]
  )
  bumpInventoryCacheLater(opts.partnerId)
}

export async function fetchImageLocProductReportFromPg(
  partnerId: string,
  inventoryId: string
): Promise<ImageLocProductReport | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{
    id: string
    image_localization_status: string | null
    image_localization_language: string | null
    image_localized_at: string | null
    image_localization_error: string | null
    product_info_json: unknown
  }>(
    `select id::text as id, image_localization_status, image_localization_language, image_localized_at,
            image_localization_error, product_info_json
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and id = $2::uuid
     limit 1`,
    [partnerId, inventoryId]
  )
  if (!row) return null
  const info = row.product_info_json && typeof row.product_info_json === 'object' ? (row.product_info_json as Record<string, unknown>) : null
  const loc = info && typeof info.image_localization === 'object' ? (info.image_localization as Record<string, unknown>) : null
  return {
    product_id: row.id,
    status: row.image_localization_status,
    language: row.image_localization_language,
    localized_at: row.image_localized_at,
    error: row.image_localization_error,
    image_localization: loc,
  }
}

export async function fetchImageLocSettingsFromPg(partnerId: string): Promise<{ deepseek_off_peak_only: boolean }> {
  if (!isPgConfigured()) return { deepseek_off_peak_only: false }
  const row = await pgQueryOne<{ deepseek_off_peak_only: boolean }>(
    `select deepseek_off_peak_only from public.messaging_partner_image_localization_settings where partner_id = $1::uuid`,
    [partnerId]
  )
  return { deepseek_off_peak_only: Boolean(row?.deepseek_off_peak_only) }
}

export async function upsertImageLocSettingsFromPg(partnerId: string, offPeak: boolean): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `insert into public.messaging_partner_image_localization_settings (partner_id, deepseek_off_peak_only, updated_at)
     values ($1::uuid, $2, now())
     on conflict (partner_id) do update set deepseek_off_peak_only = excluded.deepseek_off_peak_only, updated_at = now()`,
    [partnerId, offPeak]
  )
}

export async function fetchLocalizedIdsInQueueFromPg(partnerId: string, ids: string[]): Promise<string[]> {
  if (!isPgConfigured() || !ids.length) return []
  const rows = await pgQuery<{ id: string }>(
    `select id::text as id from public.messaging_partner_inventory
     where partner_id = $1::uuid and id = any($2::uuid[]) and image_localization_status = 'localized'`,
    [partnerId, ids]
  )
  return rows.map((r) => r.id)
}

export { getPgPool }
