import { getPgPool, isPgConfigured } from '@/lib/db/pool'

/** Mỗi lần range — tránh một response quá lớn; lặp cho đến hết khoảng ngày. */
const PAGE_SIZE = 5000

export type ApiUsageLogRow = {
  id: string
  user_id: string | null
  model: string
  feature: string
  prompt_token_count: number | null
  candidates_token_count: number | null
  total_token_count: number | null
  image_size?: string | null
  created_at: string
}

export type FetchApiUsageLogsOptions = {
  /** SQL `LIKE` trên cột feature, ví dụ `curriculum-%` */
  featureLike?: string
}

/**
 * Tải toàn bộ `api_usage_log` trong [fromIso, toIso] (phân trang server-side).
 * Chỉ Postgres — cần `DATABASE_URL`.
 */
export async function fetchAllApiUsageLogsInRange(
  fromIso: string,
  toIso: string,
  options?: FetchApiUsageLogsOptions
): Promise<{ data: ApiUsageLogRow[]; error: { message: string } | null; count: number | null }> {
  if (!isPgConfigured()) {
    return { data: [], error: { message: 'DATABASE_URL not set' }, count: 0 }
  }

  const pool = getPgPool()
  const featurePattern = options?.featureLike?.trim() || null

  try {
    const countRes = await pool.query<{ c: string }>(
      `select count(*)::text as c from public.api_usage_log
       where created_at >= $1::timestamptz and created_at <= $2::timestamptz
         and ($3::text is null or feature like $3)`,
      [fromIso, toIso, featurePattern]
    )
    const totalCount = Number(countRes.rows[0]?.c ?? 0)
    const totalCountFinal = Number.isFinite(totalCount) ? totalCount : null

    const all: ApiUsageLogRow[] = []
    let offset = 0
    for (;;) {
      const res = await pool.query<{
        id: string
        user_id: string | null
        model: string
        feature: string
        prompt_token_count: number | null
        candidates_token_count: number | null
        total_token_count: number | null
        image_size: string | null
        created_at: string
      }>(
        `select id::text, user_id::text, model, feature,
                prompt_token_count, candidates_token_count, total_token_count,
                image_size, created_at::text
         from public.api_usage_log
         where created_at >= $1::timestamptz and created_at <= $2::timestamptz
           and ($3::text is null or feature like $3)
         order by created_at asc, id asc
         limit $4 offset $5`,
        [fromIso, toIso, featurePattern, PAGE_SIZE, offset]
      )
      const batch = res.rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        model: r.model,
        feature: r.feature,
        prompt_token_count: r.prompt_token_count,
        candidates_token_count: r.candidates_token_count,
        total_token_count: r.total_token_count,
        image_size: r.image_size,
        created_at: r.created_at,
      }))
      all.push(...batch)
      if (batch.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    return { data: all, error: null, count: totalCountFinal ?? all.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { data: [], error: { message: msg }, count: null }
  }
}

export function sortApiUsageLogsNewestFirst(logs: ApiUsageLogRow[]): ApiUsageLogRow[] {
  return [...logs].sort((a, b) => {
    const ca = String(a.created_at ?? '')
    const cb = String(b.created_at ?? '')
    if (cb !== ca) return cb.localeCompare(ca)
    return String(b.id).localeCompare(String(a.id))
  })
}
