import type { UsageMetadata } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

/** Prefix thống nhất cho `api_usage_log.feature` — lọc báo cáo admin. */
export const ENGLISH_COACH_API_FEATURE_PREFIX = 'english-coach-'

export const EnglishCoachApiFeature = {
  transcribeMixed: 'english-coach-transcribe-mixed',
  tokenize: 'english-coach-tokenize',
  chatRepeatMeaning: 'english-coach-chat-repeat-meaning',
  chatReflex: 'english-coach-chat-reflex',
  chatReflexTransliterate: 'english-coach-chat-reflex-transliterate',
  chatMixedAnalysis: 'english-coach-chat-mixed-analysis',
  chatMain: 'english-coach-chat-main',
  chatRepairJson: 'english-coach-chat-repair-json',
  chatStrictRetry: 'english-coach-chat-strict-retry',
  chatRepairScript: 'english-coach-chat-repair-script',
  chatForceHowToSay: 'english-coach-chat-force-how-to-say',
  chatRepairIntent: 'english-coach-chat-repair-intent',
  chatRepairMainSentence: 'english-coach-chat-repair-main-sentence',
  chatMainSentenceGate: 'english-coach-chat-main-sentence-gate',
  chatPinyin: 'english-coach-chat-pinyin',
  intentExplain: 'english-coach-intent-explain',
  transliterate: 'english-coach-transliterate',
  placementLevel: 'english-coach-placement-level',
  topicNormalize: 'english-coach-topic-normalize',
  topicCurriculum: 'english-coach-topic-curriculum',
  word: 'english-coach-word',
  assessment: 'english-coach-assessment',
  writingEval: 'english-coach-writing-eval',
  fixWordExamples: 'english-coach-fix-word-examples',
} as const

export function isEnglishCoachApiUsageFeature(feature: string | null | undefined): boolean {
  return typeof feature === 'string' && feature.startsWith(ENGLISH_COACH_API_FEATURE_PREFIX)
}

/** Buổi live vs bài có sẵn — ghi vào `feature` để báo cáo admin tách chi phí API. */
export type EnglishCoachUsageContext = 'live' | 'preset' | 'unsessioned'

export function parseCoachUsageContextPayload(v: unknown): EnglishCoachUsageContext {
  if (v === 'preset') return 'preset'
  if (v === 'live') return 'live'
  return 'unsessioned'
}

export function buildEnglishCoachTrackedFeature(
  canonicalFeature: string,
  ctx: EnglishCoachUsageContext
): string {
  if (ctx === 'unsessioned' || !canonicalFeature.startsWith(ENGLISH_COACH_API_FEATURE_PREFIX)) {
    return canonicalFeature
  }
  const rest = canonicalFeature.slice(ENGLISH_COACH_API_FEATURE_PREFIX.length)
  return `${ENGLISH_COACH_API_FEATURE_PREFIX}${ctx}-${rest}`
}

/** Log mới: `english-coach-live-chat-main`; log cũ: `english-coach-chat-main` (legacy). */
export function englishCoachApiUsageBucket(
  feature: string
): 'live' | 'preset' | 'legacy' | 'other' {
  if (!isEnglishCoachApiUsageFeature(feature)) return 'other'
  if (feature.startsWith(`${ENGLISH_COACH_API_FEATURE_PREFIX}live-`)) return 'live'
  if (feature.startsWith(`${ENGLISH_COACH_API_FEATURE_PREFIX}preset-`)) return 'preset'
  return 'legacy'
}

export function trackEnglishCoachGeminiResult(
  result: { response: { usageMetadata?: UsageMetadata } },
  model: string,
  feature: string,
  userId?: string | null,
  context: EnglishCoachUsageContext = 'unsessioned'
): void {
  const f = buildEnglishCoachTrackedFeature(feature, context)
  void trackFromUsageMetadata(result.response.usageMetadata, model, f, userId ?? null)
}
