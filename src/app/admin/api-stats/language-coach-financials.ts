import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { englishCoachApiUsageBucket } from '@/lib/english-coach-api-usage'
import { calcCostVnd, USD_TO_VND } from './api-cost'

export type LanguageCoachCreditEventRow = {
  charge_type: string
  amount: number | string | null
}

/**
 * Gộp sự kiện trừ credit (mirror `api/english-coach/credits` — charge_type trong DB).
 */
export function aggregateLanguageCoachCredits(rows: LanguageCoachCreditEventRow[]) {
  let liveCredits = 0
  let presetCredits = 0
  let liveStartCount = 0
  let liveUnlockCount = 0
  let presetStartCount = 0
  for (const r of rows) {
    const a = Number(r.amount ?? 0)
    if (!Number.isFinite(a) || a <= 0) continue
    if (r.charge_type === 'english_coach_live_start') {
      liveCredits += a
      liveStartCount += 1
    } else if (r.charge_type === 'english_coach_live_unlock') {
      liveCredits += a
      liveUnlockCount += 1
    } else if (r.charge_type === 'english_coach_preset_start') {
      presetCredits += a
      presetStartCount += 1
    }
  }
  return {
    liveCredits,
    presetCredits,
    liveCreditsVnd: Math.round(liveCredits * CREDIT_UNIT_PRICE_VND),
    presetCreditsVnd: Math.round(presetCredits * CREDIT_UNIT_PRICE_VND),
    liveStartCount,
    liveUnlockCount,
    presetStartCount,
  }
}

type UsageLogRow = {
  model: string
  feature: string
  prompt_token_count: number | null
  candidates_token_count: number | null
  image_size?: string | null
}

/** Chi phí Gemini (ước tính ₫) theo buổi live / bài có sẵn / log cũ chưa gắn nhãn. */
export function aggregateEnglishCoachApiCostByLessonKind(logs: UsageLogRow[]) {
  let liveVnd = 0
  let presetVnd = 0
  let legacyVnd = 0
  let liveUsd = 0
  let presetUsd = 0
  let legacyUsd = 0
  for (const log of logs) {
    const img = (log as { image_size?: string | null }).image_size
    const vnd = calcCostVnd(log.prompt_token_count || 0, log.candidates_token_count || 0, log.model, img)
    const usd = vnd / USD_TO_VND
    const bucket = englishCoachApiUsageBucket(log.feature)
    if (bucket === 'live') {
      liveVnd += vnd
      liveUsd += usd
    } else if (bucket === 'preset') {
      presetVnd += vnd
      presetUsd += usd
    } else if (bucket === 'legacy') {
      legacyVnd += vnd
      legacyUsd += usd
    }
  }
  return {
    liveVnd: Math.round(liveVnd),
    presetVnd: Math.round(presetVnd),
    legacyVnd: Math.round(legacyVnd),
    liveUsd,
    presetUsd,
    legacyUsd,
  }
}
