import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type ProcessTranslateJobRowPg = {
  id: string
  user_id: string
  history_id: string
  retry_round: number | null
  source_lang: string | null
  source_lang_2: string | null
  target_lang: string | null
  image_quality: string | null
  cost: number | null
  original_image_url: string
  result_image_url: string | null
}

function mapJobRow(r: Record<string, unknown>): ProcessTranslateJobRowPg {
  return {
    id: String(r.id),
    user_id: String(r.user_id ?? ''),
    history_id: String(r.history_id ?? ''),
    retry_round: r.retry_round != null ? Number(r.retry_round) : null,
    source_lang: r.source_lang != null ? String(r.source_lang) : null,
    source_lang_2: r.source_lang_2 != null ? String(r.source_lang_2) : null,
    target_lang: r.target_lang != null ? String(r.target_lang) : null,
    image_quality: r.image_quality != null ? String(r.image_quality) : null,
    cost: r.cost != null ? Number(r.cost) : null,
    original_image_url: String(r.original_image_url ?? ''),
    result_image_url: r.result_image_url != null ? String(r.result_image_url) : null,
  }
}

export async function fetchTryOnHistoryIdsByBatchIdPg(batchId: string): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string }>(
      `select id::text from public.try_on_history where batch_id = $1::uuid`,
      [batchId]
    )
    return rows.map((x) => x.id)
  } catch (e) {
    console.error('[translate-process-pg] fetchTryOnHistoryIdsByBatchIdPg', e)
    return null
  }
}

export async function resetStaleTranslateJobsForHistoryIdsPg(
  historyIds: string[],
  staleThresholdIso: string
): Promise<void> {
  if (!isPgConfigured() || historyIds.length === 0) return
  try {
    await pgQuery(
      `update public.translate_jobs
       set status = 'pending', processing_started_at = null
       where history_id = any($1::uuid[])
         and status = 'processing'
         and processing_started_at is null`,
      [historyIds]
    )
    await pgQuery(
      `update public.translate_jobs
       set status = 'pending', processing_started_at = null
       where history_id = any($1::uuid[])
         and status = 'processing'
         and processing_started_at < $2::timestamptz`,
      [historyIds, staleThresholdIso]
    )
  } catch (e) {
    console.error('[translate-process-pg] resetStaleTranslateJobsForHistoryIdsPg', e)
  }
}

export async function fetchNextPendingTranslateJobWithHistoryPg(
  historyIds: string[]
): Promise<ProcessTranslateJobRowPg | null> {
  if (!isPgConfigured() || historyIds.length === 0) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select tj.id::text, tj.user_id::text, tj.history_id::text, tj.retry_round, tj.source_lang, tj.source_lang_2,
              tj.target_lang, tj.image_quality, tj.cost,
              h.original_image_url, h.result_image_url
       from public.translate_jobs tj
       inner join public.try_on_history h on h.id = tj.history_id
       where tj.history_id = any($1::uuid[]) and tj.status = 'pending'
       order by tj.created_at asc
       limit 1`,
      [historyIds]
    )
    return row ? mapJobRow(row) : null
  } catch (e) {
    console.error('[translate-process-pg] fetchNextPendingTranslateJobWithHistoryPg', e)
    return null
  }
}

export async function fetchPendingTranslateJobWithHistoryByIdPg(
  jobId: string
): Promise<ProcessTranslateJobRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select tj.id::text, tj.user_id::text, tj.history_id::text, tj.retry_round, tj.source_lang, tj.source_lang_2,
              tj.target_lang, tj.image_quality, tj.cost,
              h.original_image_url, h.result_image_url
       from public.translate_jobs tj
       inner join public.try_on_history h on h.id = tj.history_id
       where tj.id = $1::uuid and tj.status = 'pending'
       limit 1`,
      [jobId]
    )
    return row ? mapJobRow(row) : null
  } catch (e) {
    console.error('[translate-process-pg] fetchPendingTranslateJobWithHistoryByIdPg', e)
    return null
  }
}

export async function updateTryOnHistoryFailedPg(historyId: string, errorMessage: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.try_on_history
       set status = 'failed', error_message = $2
       where id = $1::uuid
       returning id::text`,
      [historyId, errorMessage]
    )
    return row != null
  } catch (e) {
    console.error('[translate-process-pg] updateTryOnHistoryFailedPg', e)
    return null
  }
}

export async function markTranslateJobProcessingPg(jobId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.translate_jobs
       set status = 'processing', processing_started_at = timezone('utc'::text, now())
       where id = $1::uuid
       returning id::text`,
      [jobId]
    )
    return row != null
  } catch (e) {
    console.error('[translate-process-pg] markTranslateJobProcessingPg', e)
    return null
  }
}

export async function markTranslateJobFailedPg(jobId: string, errorMessage: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.translate_jobs
       set status = 'failed', error_message = $2
       where id = $1::uuid
       returning id::text`,
      [jobId, errorMessage]
    )
    return row != null
  } catch (e) {
    console.error('[translate-process-pg] markTranslateJobFailedPg', e)
    return null
  }
}

export async function updateTryOnHistoryResultCompletedPg(
  historyId: string,
  resultImageUrl: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.try_on_history
       set result_image_url = $2, status = 'completed'
       where id = $1::uuid
       returning id::text`,
      [historyId, resultImageUrl]
    )
    return row != null
  } catch (e) {
    console.error('[translate-process-pg] updateTryOnHistoryResultCompletedPg', e)
    return null
  }
}

export async function markTranslateJobCompletedPg(jobId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.translate_jobs set status = 'completed' where id = $1::uuid returning id::text`,
      [jobId]
    )
    return row != null
  } catch (e) {
    console.error('[translate-process-pg] markTranslateJobCompletedPg', e)
    return null
  }
}

/** Cho `notifyTranslateImageSuccessSmart` — batch_id của một history row. */
export async function fetchTryOnHistoryBatchIdPg(
  historyId: string,
  userId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ batch_id: string | null }>(
      `select batch_id::text from public.try_on_history where id = $1::uuid and user_id = $2::uuid limit 1`,
      [historyId, userId]
    )
    return row?.batch_id != null ? String(row.batch_id) : null
  } catch (e) {
    console.error('[translate-process-pg] fetchTryOnHistoryBatchIdPg', e)
    return null
  }
}

export async function fetchTryOnHistoryIdStatusForBatchPg(
  batchId: string,
  userId: string
): Promise<Array<{ id: string; status: string }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, status::text from public.try_on_history
       where batch_id = $1::uuid and user_id = $2::uuid`,
      [batchId, userId]
    )
    return rows.map((r) => ({ id: String(r.id), status: String(r.status ?? '') }))
  } catch (e) {
    console.error('[translate-process-pg] fetchTryOnHistoryIdStatusForBatchPg', e)
    return null
  }
}

/** Ảnh đã dịch xong trong lô — GET batch-download zip. */
export async function fetchTryOnHistoryBatchDownloadRowsPg(
  userId: string,
  batchId: string
): Promise<
  | Array<{
      id: string
      original_image_url: string | null
      result_image_url: string | null
      batch_type: string | null
    }>
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, original_image_url, result_image_url, batch_type
       from public.try_on_history
       where user_id = $1::uuid
         and batch_id = $2::uuid
         and feature = 'translate'
         and status = 'completed'
         and result_image_url is not null
       order by created_at asc`,
      [userId, batchId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      original_image_url: r.original_image_url != null ? String(r.original_image_url) : null,
      result_image_url: r.result_image_url != null ? String(r.result_image_url) : null,
      batch_type: r.batch_type != null ? String(r.batch_type) : null,
    }))
  } catch (e) {
    console.error('[translate-process-pg] fetchTryOnHistoryBatchDownloadRowsPg', e)
    return null
  }
}

export async function countTranslateJobsPendingOrProcessingForHistoryIdsPg(
  historyIds: string[]
): Promise<number | null> {
  if (!isPgConfigured()) return null
  if (historyIds.length === 0) return 0
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c from public.translate_jobs
       where history_id = any($1::uuid[]) and status in ('pending', 'processing')`,
      [historyIds]
    )
    return row ? Number(row.c) : 0
  } catch (e) {
    console.error('[translate-process-pg] countTranslateJobsPendingOrProcessingForHistoryIdsPg', e)
    return null
  }
}

/** Dịch ảnh tài liệu — insert processing (có/không batch). */
export async function insertTryOnHistoryTranslateProcessingPg(params: {
  userId: string
  originalImageUrl: string
  garmentImageUrl: string
  batchId?: string | null
  batchType?: string | null
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.try_on_history (
         user_id, original_image_url, garment_image_url, status, feature, batch_id, batch_type
       ) values (
         $1::uuid, $2, $3, 'processing', 'translate',
         $4::uuid, coalesce(nullif($5::text, ''), 'image')
       )
       returning id::text as id`,
      [params.userId, params.originalImageUrl, params.garmentImageUrl, params.batchId ?? null, params.batchType ?? null]
    )
    return row?.id ? { id: row.id } : null
  } catch (e) {
    console.error('[translate-process-pg] insertTryOnHistoryTranslateProcessingPg', e)
    return null
  }
}

/** Dịch đồng bộ — một bản ghi đã hoàn tất. */
export async function insertTryOnHistoryTranslateCompletedPg(params: {
  userId: string
  originalImageUrl: string
  garmentImageUrl: string
  resultImageUrl: string
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.try_on_history (
         user_id, original_image_url, garment_image_url, result_image_url, status, feature
       ) values ($1::uuid, $2, $3, $4, 'completed', 'translate')
       returning id::text as id`,
      [params.userId, params.originalImageUrl, params.garmentImageUrl, params.resultImageUrl]
    )
    return row?.id ? { id: row.id } : null
  } catch (e) {
    console.error('[translate-process-pg] insertTryOnHistoryTranslateCompletedPg', e)
    return null
  }
}

export async function insertTranslateJobPendingPg(params: {
  userId: string
  historyId: string
  sourceLang: string
  targetLang: string
  imageQuality: '2K' | '4K'
  cost: number
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.translate_jobs (
         user_id, history_id, source_lang, target_lang, image_quality, cost, status
       ) values ($1::uuid, $2::uuid, $3, $4, $5, $6::numeric, 'pending')
       returning id::text as id`,
      [
        params.userId,
        params.historyId,
        params.sourceLang,
        params.targetLang,
        params.imageQuality,
        params.cost,
      ]
    )
    return row?.id ? { id: row.id } : null
  } catch (e) {
    console.error('[translate-process-pg] insertTranslateJobPendingPg', e)
    return null
  }
}

export async function fetchTryOnHistoryIdsByBatchIdAndUserPg(
  batchId: string,
  userId: string
): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string }>(
      `select id::text from public.try_on_history
       where batch_id = $1::uuid and user_id = $2::uuid`,
      [batchId, userId]
    )
    return rows.map((x) => x.id)
  } catch (e) {
    console.error('[translate-process-pg] fetchTryOnHistoryIdsByBatchIdAndUserPg', e)
    return null
  }
}

export type TranslateBatchProgressRowPg = {
  id: string
  status: string
  original_image_url: string | null
  result_image_url: string | null
  error_message: string | null
  batch_type: string | null
  job_status: string | null
}

export async function fetchTryOnHistoryBatchProgressRowsPg(
  userId: string,
  batchId: string
): Promise<TranslateBatchProgressRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select h.id::text, h.status::text, h.original_image_url, h.result_image_url, h.error_message,
              h.batch_type, tj.status as job_status
       from public.try_on_history h
       left join lateral (
         select status
         from public.translate_jobs
         where history_id = h.id
         order by created_at desc
         limit 1
       ) tj on true
       where h.user_id = $1::uuid and h.batch_id = $2::uuid and h.feature = 'translate'
       order by h.created_at asc`,
      [userId, batchId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      status: String(r.status ?? ''),
      original_image_url: r.original_image_url != null ? String(r.original_image_url) : null,
      result_image_url: r.result_image_url != null ? String(r.result_image_url) : null,
      error_message: r.error_message != null ? String(r.error_message) : null,
      batch_type: r.batch_type != null ? String(r.batch_type) : null,
      job_status: r.job_status != null ? String(r.job_status) : null,
    }))
  } catch (e) {
    console.error('[translate-process-pg] fetchTryOnHistoryBatchProgressRowsPg', e)
    return null
  }
}

export async function fetchTryOnHistoryBatchRowsForCancelPg(
  userId: string,
  batchId: string
): Promise<Array<{ id: string; status: string; result_image_url: string | null }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, status::text, result_image_url
       from public.try_on_history
       where user_id = $1::uuid and batch_id = $2::uuid and feature = 'translate'
       order by created_at asc`,
      [userId, batchId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      status: String(r.status ?? ''),
      result_image_url: r.result_image_url != null ? String(r.result_image_url) : null,
    }))
  } catch (e) {
    console.error('[translate-process-pg] fetchTryOnHistoryBatchRowsForCancelPg', e)
    return null
  }
}

/** Đưa trang lỗi về hàng chờ. Trang đã xong không bị dịch lại và không bị trừ credit lần nữa. */
export async function reopenFailedTranslateBatchPg(userId: string, batchId: string): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.translate_jobs tj
       set status = 'pending', error_message = null, processing_started_at = null
       from public.try_on_history h
       where tj.history_id = h.id
         and h.user_id = $1::uuid
         and h.batch_id = $2::uuid
         and h.feature = 'translate'
         and h.status = 'failed'
         and tj.status = 'failed'
       returning tj.id::text`,
      [userId, batchId]
    )
    if (rows.length === 0) return 0
    await pgQuery(
      `update public.try_on_history
       set status = 'processing', error_message = null
       where user_id = $1::uuid
         and batch_id = $2::uuid
         and feature = 'translate'
         and status = 'failed'`,
      [userId, batchId]
    )
    return rows.length
  } catch (e) {
    console.error('[translate-process-pg] reopenFailedTranslateBatchPg', e)
    return null
  }
}

/** Hủy job pending + bản ghi history đang processing trong một batch. */
export async function cancelTranslateBatchPendingPg(userId: string, batchId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.translate_jobs tj
       set status = 'cancelled', error_message = $3
       from public.try_on_history h
       where tj.history_id = h.id
         and h.user_id = $1::uuid
         and h.batch_id = $2::uuid
         and h.feature = 'translate'
         and h.status = 'processing'
         and tj.status = 'pending'`,
      [userId, batchId, 'Đã hủy bởi người dùng']
    )
    await pgQuery(
      `update public.try_on_history
       set status = 'cancelled'
       where user_id = $1::uuid
         and batch_id = $2::uuid
         and feature = 'translate'
         and status = 'processing'`,
      [userId, batchId]
    )
    return true
  } catch (e) {
    console.error('[translate-process-pg] cancelTranslateBatchPendingPg', e)
    return false
  }
}

export type PdfCheckpointDbRow = {
  historyId: string
  jobId: string | null
  batchId: string
  originalImageUrl: string
  historyStatus: string
  jobStatus: string | null
  hasResult: boolean
  createdAt: string
  processingFresh: boolean
}

/** Trang PDF đã lưu theo mã file. Dùng để chạy tiếp, không tạo batch mới. */
export async function fetchPdfCheckpointRowsPg(userId: string, likePattern: string): Promise<PdfCheckpointDbRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select h.id::text as history_id, h.batch_id::text as batch_id, h.status::text as history_status,
              h.original_image_url, h.result_image_url, h.created_at::text as created_at,
              tj.id::text as job_id, tj.status as job_status,
              (tj.status = 'processing'
                and tj.processing_started_at is not null
                and tj.processing_started_at >= timezone('utc'::text, now()) - interval '8 minutes') as processing_fresh
       from public.try_on_history h
       left join lateral (
         select id, status, processing_started_at
         from public.translate_jobs
         where history_id = h.id
         order by created_at desc
         limit 1
       ) tj on true
       where h.user_id = $1::uuid
         and h.feature = 'translate'
         and h.batch_type = 'pdf'
         and h.original_image_url like $2
       order by h.created_at asc`,
      [userId, likePattern]
    )
    return rows.map((r) => ({
      historyId: String(r.history_id),
      jobId: r.job_id != null ? String(r.job_id) : null,
      batchId: String(r.batch_id ?? ''),
      originalImageUrl: String(r.original_image_url ?? ''),
      historyStatus: String(r.history_status ?? ''),
      jobStatus: r.job_status != null ? String(r.job_status) : null,
      hasResult: r.result_image_url != null && String(r.result_image_url).length > 0,
      createdAt: String(r.created_at ?? ''),
      processingFresh: r.processing_fresh === true,
    }))
  } catch (e) {
    console.error('[translate-process-pg] fetchPdfCheckpointRowsPg', e)
    return null
  }
}

/** Đưa đúng các job chưa xong về hàng chờ và cập nhật ngôn ngữ cho lần chạy này. */
export async function requeueTranslateJobsPg(params: {
  userId: string
  jobIds: string[]
  sourceLang: string
  targetLang: string
  imageQuality: '2K' | '4K'
  cost: number
}): Promise<number | null> {
  if (!isPgConfigured()) return null
  if (params.jobIds.length === 0) return 0
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.translate_jobs
       set status = 'pending', error_message = null, processing_started_at = null,
           source_lang = $3, target_lang = $4, image_quality = $5, cost = $6::numeric
       where user_id = $1::uuid
         and id = any($2::uuid[])
         and status <> 'completed'
       returning id::text`,
      [params.userId, params.jobIds, params.sourceLang, params.targetLang, params.imageQuality, params.cost]
    )
    return rows.length
  } catch (e) {
    console.error('[translate-process-pg] requeueTranslateJobsPg', e)
    return null
  }
}

/** Mở lại bản ghi chưa có ảnh kết quả. Bản đã xong giữ nguyên. */
export async function markUnfinishedTranslateHistoriesProcessingPg(userId: string, historyIds: string[]): Promise<number | null> {
  if (!isPgConfigured()) return null
  if (historyIds.length === 0) return 0
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.try_on_history
       set status = 'processing', error_message = null
       where user_id = $1::uuid
         and id = any($2::uuid[])
         and feature = 'translate'
         and status <> 'completed'
         and result_image_url is null
       returning id::text`,
      [userId, historyIds]
    )
    return rows.length
  } catch (e) {
    console.error('[translate-process-pg] markUnfinishedTranslateHistoriesProcessingPg', e)
    return null
  }
}

/** Dừng hàng chờ. Trang đang dịch vẫn chạy nốt và lưu. Trang đã xong không đổi. */
export async function pauseTranslateBatchPg(userId: string, batchId: string): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.translate_jobs tj
       set status = 'paused'
       from public.try_on_history h
       where tj.history_id = h.id
         and h.user_id = $1::uuid
         and h.batch_id = $2::uuid
         and h.feature = 'translate'
         and h.result_image_url is null
         and h.status <> 'completed'
         and tj.status = 'pending'
       returning tj.id::text`,
      [userId, batchId]
    )
    return rows.length
  } catch (e) {
    console.error('[translate-process-pg] pauseTranslateBatchPg', e)
    return null
  }
}

/**
 * Chạy tiếp: trang tạm dừng, lỗi hoặc đã hủy mà chưa có kết quả trở lại hàng chờ.
 * Trang completed không bị mở lại.
 * Trả về số job pending sẽ chạy, kể cả job pending sẵn mà chuỗi bị đứt.
 */
export async function continueTranslateBatchPg(userId: string, batchId: string): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `update public.translate_jobs tj
       set status = 'pending', error_message = null, processing_started_at = null
       from public.try_on_history h
       where tj.history_id = h.id
         and h.user_id = $1::uuid
         and h.batch_id = $2::uuid
         and h.feature = 'translate'
         and h.status <> 'completed'
         and h.result_image_url is null
         and tj.status in ('paused', 'failed', 'cancelled')`,
      [userId, batchId]
    )
    await pgQuery(
      `update public.try_on_history
       set status = 'processing', error_message = null
       where user_id = $1::uuid
         and batch_id = $2::uuid
         and feature = 'translate'
         and status in ('failed', 'cancelled')
         and result_image_url is null`,
      [userId, batchId]
    )
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c
       from public.translate_jobs tj
       inner join public.try_on_history h on h.id = tj.history_id
       where h.user_id = $1::uuid
         and h.batch_id = $2::uuid
         and h.feature = 'translate'
         and h.status <> 'completed'
         and h.result_image_url is null
         and tj.status = 'pending'`,
      [userId, batchId]
    )
    return row ? Number(row.c) : 0
  } catch (e) {
    console.error('[translate-process-pg] continueTranslateBatchPg', e)
    return null
  }
}

/** Chuyển các trang chạy lại sang đúng đợt vừa bấm Dịch. */
export async function moveTranslateHistoriesToBatchPg(userId: string, historyIds: string[], batchId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  if (historyIds.length === 0) return true
  try {
    await pgQuery(
      `update public.try_on_history
       set batch_id = $3::uuid, created_at = now()
       where user_id = $1::uuid
         and id = any($2::uuid[])
         and feature = 'translate'`,
      [userId, historyIds, batchId]
    )
    return true
  } catch (e) {
    console.error('[translate-process-pg] moveTranslateHistoriesToBatchPg', e)
    return false
  }
}

const TRANSLATE_RUN_GAP_MS = 3 * 60 * 1000

/** Mỗi lần bấm Dịch là một đợt. Đợt cũ bị gộp chung batch thì tách theo khoảng cách lúc tạo. */
export async function listRecentTranslateBatchesPg(
  userId: string,
  limit = 8
): Promise<Array<{ batchId: string; startedAt: string; memberIds: string[] }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string; batch_id: string; created_at: string }>(
      `select id::text, batch_id::text, created_at::text
       from public.try_on_history
       where user_id = $1::uuid
         and feature = 'translate'
         and batch_id is not null
       order by created_at desc
       limit 240`,
      [userId]
    )
    const byBatch = new Map<string, Array<{ id: string; createdAt: string; at: number }>>()
    for (const row of rows) {
      const createdAt = String(row.created_at)
      const at = new Date(createdAt).getTime()
      const list = byBatch.get(String(row.batch_id)) ?? []
      list.push({ id: String(row.id), createdAt, at: Number.isFinite(at) ? at : 0 })
      byBatch.set(String(row.batch_id), list)
    }
    const runs: Array<{ batchId: string; startedAt: string; memberIds: string[]; at: number }> = []
    for (const [batchId, list] of byBatch) {
      list.sort((a, b) => a.at - b.at)
      let current: typeof list = []
      for (const row of list) {
        const prev = current[current.length - 1]
        if (prev && row.at - prev.at > TRANSLATE_RUN_GAP_MS) {
          runs.push({
            batchId,
            startedAt: current[0].createdAt,
            memberIds: current.map((item) => item.id),
            at: current[0].at,
          })
          current = []
        }
        current.push(row)
      }
      if (current.length > 0) {
        runs.push({
          batchId,
          startedAt: current[0].createdAt,
          memberIds: current.map((item) => item.id),
          at: current[0].at,
        })
      }
    }
    runs.sort((a, b) => b.at - a.at)
    return runs.slice(0, limit).map(({ batchId, startedAt, memberIds }) => ({ batchId, startedAt, memberIds }))
  } catch (e) {
    console.error('[translate-process-pg] listRecentTranslateBatchesPg', e)
    return null
  }
}

export async function countRunnableTranslateJobsPg(
  userId: string,
  batchId: string,
  freshAfterIso: string
): Promise<{ pending: number; processingFresh: number } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ pending: string; processing_fresh: string }>(
      `select
         count(*) filter (where tj.status = 'pending')::text as pending,
         count(*) filter (
           where tj.status = 'processing'
             and tj.processing_started_at is not null
             and tj.processing_started_at >= $3::timestamptz
         )::text as processing_fresh
       from public.translate_jobs tj
       inner join public.try_on_history h on h.id = tj.history_id
       where h.user_id = $1::uuid
         and h.batch_id = $2::uuid
         and h.feature = 'translate'`,
      [userId, batchId, freshAfterIso]
    )
    if (!row) return { pending: 0, processingFresh: 0 }
    return { pending: Number(row.pending) || 0, processingFresh: Number(row.processing_fresh) || 0 }
  } catch (e) {
    console.error('[translate-process-pg] countRunnableTranslateJobsPg', e)
    return null
  }
}

/** Nhận đúng một job pending của batch. Nếu đã có trang đang chạy còn hạn thì không nhận thêm. */
export async function claimNextPendingTranslateJobPg(
  historyIds: string[],
  batchId: string,
  freshAfterIso: string
): Promise<{ job: ProcessTranslateJobRowPg | null; busy: boolean } | null> {
  if (!isPgConfigured()) return null
  if (historyIds.length === 0) return { job: null, busy: false }
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    await client.query('select pg_advisory_xact_lock(hashtext($1::text))', [batchId])
    const active = await client.query(
      `select 1
       from public.translate_jobs
       where history_id = any($1::uuid[])
         and status = 'processing'
         and processing_started_at is not null
         and processing_started_at >= $2::timestamptz
       limit 1`,
      [historyIds, freshAfterIso]
    )
    if ((active.rowCount ?? 0) > 0) {
      await client.query('commit')
      return { job: null, busy: true }
    }
    const claimed = await client.query<{ id: string }>(
      `update public.translate_jobs
       set status = 'processing', processing_started_at = timezone('utc'::text, now())
       where id = (
         select id
         from public.translate_jobs
         where history_id = any($1::uuid[])
           and status = 'pending'
         order by created_at asc, id asc
         limit 1
         for update skip locked
       )
       returning id::text`,
      [historyIds]
    )
    const claimedId = claimed.rows[0]?.id
    if (!claimedId) {
      await client.query('commit')
      return { job: null, busy: false }
    }
    const selected = await client.query<Record<string, unknown>>(
      `select tj.id::text, tj.user_id::text, tj.history_id::text, tj.retry_round, tj.source_lang, tj.source_lang_2,
              tj.target_lang, tj.image_quality, tj.cost,
              h.original_image_url, h.result_image_url
       from public.translate_jobs tj
       inner join public.try_on_history h on h.id = tj.history_id
       where tj.id = $1::uuid
       limit 1`,
      [claimedId]
    )
    await client.query('commit')
    const row = selected.rows[0]
    return { job: row ? mapJobRow(row) : null, busy: false }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    console.error('[translate-process-pg] claimNextPendingTranslateJobPg', e)
    return null
  } finally {
    client.release()
  }
}
