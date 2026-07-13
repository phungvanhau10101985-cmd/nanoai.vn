import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import type { TryOnHistoryTaskRow, WorksheetJobRow } from '@/lib/dashboard/task-hub'

export type TransactionListRow = {
  id: string
  user_id: string
  amount: number
  type: string
  status: string
  description: string | null
  created_at: string
}

export async function pgListTransactionsForUser(userId: string): Promise<TransactionListRow[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<TransactionListRow>(
      `select id::text, user_id::text, amount::int, type::text, status::text,
              description, created_at::text
       from public.transactions
       where user_id = $1::uuid
       order by created_at desc`,
      [userId]
    )
  } catch (e) {
    console.warn('[pgListTransactionsForUser]', e)
    return []
  }
}

export async function pgGetTryOnHistoryUrlsForUser(
  userId: string,
  historyId: string
): Promise<{ original_image_url: string; garment_image_url: string; result_image_url: string | null } | null> {
  if (!isPgConfigured()) return null
  try {
    const pool = getPgPool()
    const res = await pool.query<{
      original_image_url: string
      garment_image_url: string
      result_image_url: string | null
    }>(
      `select original_image_url, garment_image_url, result_image_url
       from public.try_on_history
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [historyId, userId]
    )
    return res.rows[0] ?? null
  } catch (e) {
    console.warn('[pgGetTryOnHistoryUrlsForUser]', e)
    return null
  }
}

export async function pgDeleteTryOnHistoryForUser(userId: string, historyId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const r = await pool.query(`delete from public.try_on_history where id = $1::uuid and user_id = $2::uuid`, [
      historyId,
      userId,
    ])
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[pgDeleteTryOnHistoryForUser]', e)
    return false
  }
}

/**
 * Lịch sử ảnh đã xử lý (dashboard/history) — completed, loại bỏ `feature = translate`
 * (tương đương lọc `feature.neq.translate` / `feature.is.null` trên REST trước đây).
 */
export async function pgListTryOnHistoryCompletedExcludeTranslate(userId: string): Promise<Record<string, unknown>[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select *
       from public.try_on_history
       where user_id = $1::uuid
         and status = 'completed'
         and (feature is null or feature <> 'translate')
       order by created_at desc`,
      [userId]
    )
    return rows
  } catch (e) {
    console.warn('[pgListTryOnHistoryCompletedExcludeTranslate]', e)
    return []
  }
}

/** Toàn bộ kết quả xử lý ảnh đã hoàn thành, không phân biệt công cụ. */
export async function pgListAllImageHistoryCompleted(userId: string): Promise<Record<string, unknown>[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<Record<string, unknown>>(
      `select *
       from public.try_on_history
       where user_id = $1::uuid
         and status = 'completed'
         and result_image_url is not null
       order by created_at desc`,
      [userId]
    )
  } catch (e) {
    console.warn('[pgListAllImageHistoryCompleted]', e)
    return []
  }
}

/** Lịch sử dịch ảnh (dashboard/history/translate) — `feature = translate`, `status = completed`. */
export async function pgListTryOnHistoryTranslateCompleted(userId: string): Promise<Record<string, unknown>[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select *
       from public.try_on_history
       where user_id = $1::uuid and status = 'completed' and feature = 'translate'
       order by created_at desc`,
      [userId]
    )
    return rows
  } catch (e) {
    console.warn('[pgListTryOnHistoryTranslateCompleted]', e)
    return []
  }
}

function mapTryOnTaskRow(r: Record<string, unknown>): TryOnHistoryTaskRow {
  return {
    id: String(r.id),
    feature: r.feature != null ? String(r.feature) : null,
    status: String(r.status ?? ''),
    batch_id: r.batch_id != null ? String(r.batch_id) : null,
    batch_type: r.batch_type != null ? String(r.batch_type) : null,
    created_at: String(r.created_at ?? ''),
    error_message: r.error_message != null ? String(r.error_message) : null,
  }
}

function mapWsJobRow(r: Record<string, unknown>): WorksheetJobRow {
  return {
    id: String(r.id),
    type: String(r.type ?? ''),
    status: String(r.status ?? ''),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    error_message: r.error_message != null ? String(r.error_message) : null,
  }
}

/**
 * Dữ liệu thô cho Task Hub — tương đương 3 truy vấn song song trong `task-hub-snapshot.ts`.
 */
export async function pgFetchTaskHubRaw(userId: string): Promise<{
  processing: TryOnHistoryTaskRow[]
  recentTail: TryOnHistoryTaskRow[]
  worksheet: WorksheetJobRow[]
} | null> {
  if (!isPgConfigured()) return null
  try {
    const pool = getPgPool()
    const [processingRes, recentTailRes, worksheetRes] = await Promise.all([
      pool.query<Record<string, unknown>>(
        `select id::text, feature, status::text, batch_id::text, batch_type, created_at::text, error_message
         from public.try_on_history
         where user_id = $1::uuid and status = 'processing'`,
        [userId]
      ),
      pool.query<Record<string, unknown>>(
        `select id::text, feature, status::text, batch_id::text, batch_type, created_at::text, error_message
         from public.try_on_history
         where user_id = $1::uuid
         order by created_at desc
         limit 500`,
        [userId]
      ),
      pool.query<Record<string, unknown>>(
        `select id::text, type, status::text, created_at::text, updated_at::text, error_message
         from public.worksheet_jobs
         where user_id = $1::uuid
         order by created_at desc
         limit 100`,
        [userId]
      ),
    ])
    return {
      processing: (processingRes.rows ?? []).map(mapTryOnTaskRow),
      recentTail: (recentTailRes.rows ?? []).map(mapTryOnTaskRow),
      worksheet: (worksheetRes.rows ?? []).map(mapWsJobRow),
    }
  } catch (e) {
    console.warn('[pgFetchTaskHubRaw]', e)
    return null
  }
}

export type DashboardRecentTryOnRow = {
  id: string
  result_image_url: string | null
  created_at: string
}

/** Vài ảnh gần nhất trên dashboard (mọi feature). */
export async function pgListRecentTryOnHistoryForDashboard(
  userId: string,
  limit: number
): Promise<DashboardRecentTryOnRow[]> {
  if (!isPgConfigured()) return []
  const lim = Math.min(20, Math.max(1, Math.floor(limit)))
  try {
    return await pgQuery<DashboardRecentTryOnRow>(
      `select id::text, result_image_url, created_at::text
       from public.try_on_history
       where user_id = $1::uuid
       order by created_at desc
       limit $2`,
      [userId, lim]
    )
  } catch (e) {
    console.warn('[pgListRecentTryOnHistoryForDashboard]', e)
    return []
  }
}
