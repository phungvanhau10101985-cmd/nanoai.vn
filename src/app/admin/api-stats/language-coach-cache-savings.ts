import { calcCostVnd } from './api-cost'

/** Đọc câu: `english-coach-tts-*` và bản có tiền tố live/preset. */
export function isLanguageCoachTtsFeature(feature: string): boolean {
  return /^english-coach-(?:live-|preset-)?tts-/.test(feature)
}

/** Tra từ: `english-coach-word` và bản live/preset. Không gồm sửa ví dụ admin. */
export function isLanguageCoachWordLookupFeature(feature: string): boolean {
  return /^english-coach-(?:live-|preset-)?word$/.test(feature)
}

export type LanguageCoachCacheDailyTotals = {
  ttsHit: number
  ttsMiss: number
  wordHit: number
  wordMiss: number
}

export type LanguageCoachCacheCostLog = {
  model: string
  feature: string
  prompt_token_count: number | null
  candidates_token_count: number | null
  image_size?: string | null
}

export type LanguageCoachCacheBucketId = 'tts' | 'word'

export type LanguageCoachCacheBucket = {
  id: LanguageCoachCacheBucketId
  hits: number
  misses: number
  lookups: number
  /** null khi chưa có hit lẫn miss trong khoảng ngày. */
  hitRate: number | null
  spentVnd: number
  loggedCalls: number
  savedVnd: number
  wouldHaveSpentVnd: number
}

export type LanguageCoachCacheReport = {
  buckets: LanguageCoachCacheBucket[]
  hits: number
  misses: number
  lookups: number
  hitRate: number | null
  spentVnd: number
  savedVnd: number
  wouldHaveSpentVnd: number
}

/**
 * Tiết kiệm = hit × đơn giá một lượt gọi API thật.
 * Đơn giá = tổng ₫ các log miss trong cùng khoảng / số log.
 * Hit không ghi `api_usage_log`, nên không có đơn giá khi khoảng ngày không có log.
 */
export function estimateLanguageCoachCacheBucket(input: {
  id: LanguageCoachCacheBucketId
  hits: number
  misses: number
  spentVnd: number
  loggedCalls: number
}): LanguageCoachCacheBucket {
  const hits = Math.max(0, Math.floor(input.hits))
  const misses = Math.max(0, Math.floor(input.misses))
  const spentVnd = Math.max(0, Math.round(input.spentVnd))
  const loggedCalls = Math.max(0, Math.floor(input.loggedCalls))
  const lookups = hits + misses
  const savedVnd = loggedCalls > 0 ? Math.round((spentVnd * hits) / loggedCalls) : 0
  return {
    id: input.id,
    hits,
    misses,
    lookups,
    hitRate: lookups > 0 ? hits / lookups : null,
    spentVnd,
    loggedCalls,
    savedVnd,
    wouldHaveSpentVnd: spentVnd + savedVnd,
  }
}

function spentFor(
  logs: LanguageCoachCacheCostLog[],
  match: (feature: string) => boolean
): { spentVnd: number; loggedCalls: number } {
  let spentVnd = 0
  let loggedCalls = 0
  for (const log of logs) {
    if (!match(log.feature)) continue
    loggedCalls += 1
    spentVnd += calcCostVnd(
      log.prompt_token_count || 0,
      log.candidates_token_count || 0,
      log.model,
      log.image_size
    )
  }
  return { spentVnd, loggedCalls }
}

export function buildLanguageCoachCacheReport(
  daily: LanguageCoachCacheDailyTotals,
  logs: LanguageCoachCacheCostLog[]
): LanguageCoachCacheReport {
  const ttsSpend = spentFor(logs, isLanguageCoachTtsFeature)
  const wordSpend = spentFor(logs, isLanguageCoachWordLookupFeature)
  const buckets = [
    estimateLanguageCoachCacheBucket({
      id: 'tts',
      hits: daily.ttsHit,
      misses: daily.ttsMiss,
      spentVnd: ttsSpend.spentVnd,
      loggedCalls: ttsSpend.loggedCalls,
    }),
    estimateLanguageCoachCacheBucket({
      id: 'word',
      hits: daily.wordHit,
      misses: daily.wordMiss,
      spentVnd: wordSpend.spentVnd,
      loggedCalls: wordSpend.loggedCalls,
    }),
  ]
  const hits = buckets.reduce((sum, row) => sum + row.hits, 0)
  const misses = buckets.reduce((sum, row) => sum + row.misses, 0)
  const lookups = hits + misses
  const spentVnd = buckets.reduce((sum, row) => sum + row.spentVnd, 0)
  const savedVnd = buckets.reduce((sum, row) => sum + row.savedVnd, 0)
  return {
    buckets,
    hits,
    misses,
    lookups,
    hitRate: lookups > 0 ? hits / lookups : null,
    spentVnd,
    savedVnd,
    wouldHaveSpentVnd: spentVnd + savedVnd,
  }
}

export function emptyLanguageCoachCacheDailyTotals(): LanguageCoachCacheDailyTotals {
  return { ttsHit: 0, ttsMiss: 0, wordHit: 0, wordMiss: 0 }
}
