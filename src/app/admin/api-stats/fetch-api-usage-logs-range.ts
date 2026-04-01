import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/** Mỗi lần range — tránh một response quá lớn; lặp cho đến hết khoảng ngày. */
const PAGE_SIZE = 5000

export type ApiUsageLogRow = {
  id: string
  model: string
  feature: string
  prompt_token_count: number | null
  candidates_token_count: number | null
  total_token_count: number | null
  image_size?: string | null
  created_at: string
}

export type FetchApiUsageLogsOptions = {
  /** PostgREST `like` trên cột feature, ví dụ `curriculum-%` */
  featureLike?: string
}

/**
 * Tải toàn bộ `api_usage_log` trong [fromIso, toIso] (phân trang server-side).
 * Thứ tự tăng dần theo `created_at`, `id` — dùng `sortApiUsageLogsNewestFirst` khi cần “mới nhất trước”.
 */
export async function fetchAllApiUsageLogsInRange(
  admin: SupabaseClient<Database>,
  fromIso: string,
  toIso: string,
  options?: FetchApiUsageLogsOptions
): Promise<{ data: ApiUsageLogRow[]; error: { message: string } | null; count: number | null }> {
  const columns =
    'id, model, feature, prompt_token_count, candidates_token_count, total_token_count, image_size, created_at'

  const all: ApiUsageLogRow[] = []
  let offset = 0
  let totalCount: number | null = null

  for (;;) {
    const withCount = offset === 0
    let q = admin
      .from('api_usage_log')
      .select(columns, withCount ? ({ count: 'exact' } as const) : undefined)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)

    if (options?.featureLike) {
      q = q.like('feature', options.featureLike)
    }

    const { data, error, count } = await q
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      return { data: all, error: { message: error.message }, count: totalCount }
    }

    if (withCount && typeof count === 'number') {
      totalCount = count
    }

    const batch = (data ?? []) as unknown as ApiUsageLogRow[]
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { data: all, error: null, count: totalCount ?? all.length }
}

export function sortApiUsageLogsNewestFirst(logs: ApiUsageLogRow[]): ApiUsageLogRow[] {
  return [...logs].sort((a, b) => {
    const ca = String(a.created_at ?? '')
    const cb = String(b.created_at ?? '')
    if (cb !== ca) return cb.localeCompare(ca)
    return String(b.id).localeCompare(String(a.id))
  })
}
