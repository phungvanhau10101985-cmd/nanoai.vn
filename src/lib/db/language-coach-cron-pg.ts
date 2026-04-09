import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

/** Số mục SRS đến hạn theo user — cron nhắc ôn. */
export async function fetchReviewQueueDueCountsByUserPg(
  nowIso: string
): Promise<Array<{ user_id: string; cnt: number }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ user_id: string; cnt: string }>(
      `select user_id::text, count(*)::text as cnt
       from public.language_coach_review_queue
       where due_at <= $1::timestamptz
       group by user_id`,
      [nowIso]
    )
    return rows.map((r) => ({ user_id: r.user_id, cnt: Number(r.cnt) || 0 }))
  } catch (e) {
    console.error('[language-coach-cron-pg] fetchReviewQueueDueCountsByUserPg', e)
    return null
  }
}
