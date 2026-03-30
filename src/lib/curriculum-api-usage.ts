import type { UsageMetadata } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

/** Prefix thống nhất cho `api_usage_log.feature` — lọc báo cáo admin giáo trình. */
export const CURRICULUM_API_FEATURE_PREFIX = 'curriculum-'

export const CurriculumApiFeature = {
  fromImage: 'curriculum-from-image',
  slidesFromMarkdown: 'curriculum-slides-from-markdown',
  fromPaste: 'curriculum-from-paste',
  lessonSlidesGenerate: 'curriculum-lesson-slides-generate',
  editCheckFull: 'curriculum-edit-check-full',
  editCheckRegion: 'curriculum-edit-check-region',
  createFromForm: 'curriculum-create-from-form',
  lessonTopicsExtract: 'curriculum-lesson-topics-extract',
  topicRerank: 'curriculum-topic-rerank',
  slideProposalVerify: 'curriculum-slide-proposal-verify',
} as const

export function isCurriculumApiUsageFeature(feature: string | null | undefined): boolean {
  return typeof feature === 'string' && feature.startsWith(CURRICULUM_API_FEATURE_PREFIX)
}

export function trackCurriculumGeminiResult(
  result: { response: { usageMetadata?: UsageMetadata } },
  model: string,
  feature: string,
  userId?: string | null
): void {
  void trackFromUsageMetadata(result.response.usageMetadata, model, feature, userId ?? null)
}
