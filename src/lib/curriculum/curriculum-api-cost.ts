import { API_COST_PER_1M, calcCostVndSplit } from '@/lib/pricing/api-token-cost'

/** Lượt gọi phục vụ giáo trình: soạn bài, câu hỏi, slide, ảnh infographic. */
export const CURRICULUM_RELATED_API_FEATURE_SQL = `(
  l.feature like 'curriculum%'
  or l.feature like 'worksheet-%'
  or l.feature like 'quiz-%'
  or l.feature like 'slide-generate-quiz%'
  or l.feature like 'slide-verify-quiz%'
  or l.feature like 'slide-quiz%'
)`

export type CurriculumApiCostBucket = 'curriculum' | 'question' | 'slide' | 'image'

export const CURRICULUM_API_COST_BUCKET_SQL = `case
  when l.feature ilike '%infographic%' then 'image'
  when l.feature like 'worksheet-%'
    or l.feature like 'quiz-%'
    or l.feature like 'slide-generate-quiz%'
    or l.feature like 'slide-verify-quiz%'
    or l.feature like 'slide-quiz%' then 'question'
  when l.feature ilike '%slide%' then 'slide'
  else 'curriculum'
end`

const IMAGE_TIERS = new Set(['1K', '2K', '4K'])

export function curriculumApiGroupedCostVnd(row: {
  model: string
  imageSize: string | null
  calls: number
  promptTokens: number
  outputTokens: number
}): number {
  const calls = Math.max(0, Math.round(row.calls))
  const prompt = Math.max(0, row.promptTokens)
  const output = Math.max(0, row.outputTokens)
  const size = row.imageSize && IMAGE_TIERS.has(row.imageSize) ? row.imageSize : null
  const rates = API_COST_PER_1M[row.model]
  if (size && rates?.outputImage != null && calls > 0) {
    const inputVnd = calcCostVndSplit(prompt, 0, row.model, null, { pricingMode: 'aggregate_short' }).inputVnd
    const oneImageVnd = calcCostVndSplit(0, 0, row.model, size).outputVnd
    return inputVnd + oneImageVnd * calls
  }
  return calcCostVndSplit(prompt, output, row.model, row.imageSize, { pricingMode: 'aggregate_short' }).totalVnd
}
