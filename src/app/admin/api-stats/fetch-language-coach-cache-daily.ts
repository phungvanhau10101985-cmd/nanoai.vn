import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import {
  emptyLanguageCoachCacheDailyTotals,
  type LanguageCoachCacheDailyTotals,
} from './language-coach-cache-savings'

export type LanguageCoachCacheDailyLoad = {
  totals: LanguageCoachCacheDailyTotals
  error: string | null
}

/** Cộng hit/miss TTS và tra từ theo `stat_date` (ngày lịch Việt Nam). */
export async function fetchLanguageCoachCacheDailyTotals(
  fromYmd: string,
  toYmd: string
): Promise<LanguageCoachCacheDailyLoad> {
  const empty = emptyLanguageCoachCacheDailyTotals()
  if (!isPgConfigured()) {
    return { totals: empty, error: 'DATABASE_URL not set' }
  }
  try {
    const row = await pgQueryOne<{
      tts_hit: string | null
      tts_miss: string | null
      word_hit: string | null
      word_miss: string | null
    }>(
      `select
         coalesce(sum(tts_hit), 0)::text as tts_hit,
         coalesce(sum(tts_miss), 0)::text as tts_miss,
         coalesce(sum(word_hit), 0)::text as word_hit,
         coalesce(sum(word_miss), 0)::text as word_miss
       from public.language_coach_cache_daily_stats
       where stat_date >= $1::date and stat_date <= $2::date`,
      [fromYmd, toYmd]
    )
    const n = (value: string | null | undefined) => {
      const parsed = Number(value ?? 0)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return {
      totals: {
        ttsHit: n(row?.tts_hit),
        ttsMiss: n(row?.tts_miss),
        wordHit: n(row?.word_hit),
        wordMiss: n(row?.word_miss),
      },
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api-stats] fetchLanguageCoachCacheDailyTotals', e)
    return { totals: empty, error: message }
  }
}
