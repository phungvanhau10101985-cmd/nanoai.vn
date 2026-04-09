import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** Cache dịch câu mở đầu — `intent-explain`. */
export async function getOpeningTranslationCachePg(cacheKey: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ translation: string }>(
      `select translation from public.language_coach_opening_translation_cache where cache_key = $1 limit 1`,
      [cacheKey]
    )
    return row?.translation ?? null
  } catch (e) {
    console.error('[language-coach-misc-pg] getOpeningTranslationCachePg', e)
    return null
  }
}

export async function upsertOpeningTranslationCachePg(cacheKey: string, translation: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.language_coach_opening_translation_cache (cache_key, translation)
       values ($1, $2)
       on conflict (cache_key) do update set translation = excluded.translation, created_at = now()`,
      [cacheKey, translation]
    )
    return true
  } catch (e) {
    console.error('[language-coach-misc-pg] upsertOpeningTranslationCachePg', e)
    return false
  }
}

/** Từ trong session (và turn nếu có) — `listening-distractors`. */
export async function fetchDailyWordsForSessionListeningPg(params: {
  userId: string
  sessionId: string
  turnIndex?: number
  limit: number
}): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  try {
    const turnOk = params.turnIndex !== undefined && params.turnIndex >= 0
    const rows = await pgQuery<{ word: string | null }>(
      turnOk
        ? `select word from public.language_coach_daily_words
           where user_id = $1::uuid and session_id = $2
             and (turn_index = -1 or turn_index = $4)
           order by updated_at desc
           limit $3`
        : `select word from public.language_coach_daily_words
           where user_id = $1::uuid and session_id = $2
           order by updated_at desc
           limit $3`,
      turnOk
        ? [params.userId, params.sessionId, params.limit, params.turnIndex]
        : [params.userId, params.sessionId, params.limit]
    )
    return rows.map((r) => String(r.word ?? '')).filter(Boolean)
  } catch (e) {
    console.error('[language-coach-misc-pg] fetchDailyWordsForSessionListeningPg', e)
    return null
  }
}

export async function fetchDailyWordsRecentUserListeningPg(userId: string, limit: number): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ word: string | null }>(
      `select word from public.language_coach_daily_words
       where user_id = $1::uuid
       order by updated_at desc
       limit $2`,
      [userId, limit]
    )
    return rows.map((r) => String(r.word ?? '')).filter(Boolean)
  } catch (e) {
    console.error('[language-coach-misc-pg] fetchDailyWordsRecentUserListeningPg', e)
    return null
  }
}

/** Đặt due_at = now cho từ trong review queue — `review-reschedule`. */
export async function rescheduleReviewQueueWordsPg(
  userId: string,
  items: Array<{ word: string; targetLanguage?: string }>
): Promise<number> {
  if (!isPgConfigured()) return 0
  const pool = getPgPool()
  const now = new Date().toISOString()
  let total = 0
  for (const it of items) {
    const w = String(it.word || '').trim()
    if (!w) continue
    const t = String(it.targetLanguage || '').trim()
    try {
      const res = t
        ? await pool.query(
            `update public.language_coach_review_queue
             set due_at = $1::timestamptz, updated_at = $1::timestamptz
             where user_id = $2::uuid and word = $3 and target_language = $4`,
            [now, userId, w, t]
          )
        : await pool.query(
            `update public.language_coach_review_queue
             set due_at = $1::timestamptz, updated_at = $1::timestamptz
             where user_id = $2::uuid and word = $3 and target_language is null`,
            [now, userId, w]
          )
      total += res.rowCount ?? 0
    } catch (e) {
      console.error('[language-coach-misc-pg] rescheduleReviewQueueWordsPg row', e)
    }
  }
  return total
}
