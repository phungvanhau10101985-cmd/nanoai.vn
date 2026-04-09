import { isPgConfigured } from '@/lib/db/pool'
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
}

export async function fetchTryOnHistoryBatchProgressRowsPg(
  userId: string,
  batchId: string
): Promise<TranslateBatchProgressRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, status::text, original_image_url, result_image_url, error_message,
              batch_type
       from public.try_on_history
       where user_id = $1::uuid and batch_id = $2::uuid and feature = 'translate'
       order by created_at asc`,
      [userId, batchId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      status: String(r.status ?? ''),
      original_image_url: r.original_image_url != null ? String(r.original_image_url) : null,
      result_image_url: r.result_image_url != null ? String(r.result_image_url) : null,
      error_message: r.error_message != null ? String(r.error_message) : null,
      batch_type: r.batch_type != null ? String(r.batch_type) : null,
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
