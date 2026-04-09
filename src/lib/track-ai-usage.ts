import { getUserOrBypass } from '@/lib/auth'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import type { UsageMetadata } from '@google/generative-ai'

/** Usage từ API chat/completions kiểu OpenAI (OpenAI, DeepSeek, …). */
export type OpenAiStyleUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export interface ApiUsageLogParams {
  userId?: string | null
  model: string
  feature: string
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
  /** Độ phân giải ảnh trả về: '2K' | '4K' | null (không trả ảnh) */
  imageSize?: '2K' | '4K' | null
}

/**
 * Ghi log từ phản hồi chat/completions (OpenAI, DeepSeek, tương thích).
 * Nếu thiếu `usage`, ước lượng từ độ dài ký tự (≈ 4 ký tự / token).
 */
export function trackOpenAiStyleCompletionUsage(params: {
  userId?: string | null
  model: string
  feature: string
  usage: OpenAiStyleUsage | undefined
  fallbackPromptChars: number
  fallbackOutputChars: number
}): void {
  const promptEst = Math.max(0, Math.ceil(params.fallbackPromptChars / 4))
  const outEst = Math.max(0, Math.ceil(params.fallbackOutputChars / 4))
  const u = params.usage
  const promptTok = u?.prompt_tokens ?? promptEst
  const outTok = u?.completion_tokens ?? (outEst > 0 ? outEst : 1)
  const totalTok = u?.total_tokens ?? promptTok + outTok
  if (totalTok <= 0) return
  void trackApiUsage({
    userId: params.userId,
    model: params.model,
    feature: params.feature,
    promptTokenCount: promptTok,
    candidatesTokenCount: outTok,
    totalTokenCount: Math.max(1, totalTok),
  })
}

/**
 * Ghi log sử dụng API vào DB. Fire-and-forget, không block luồng chính.
 * Chỉ Postgres (`public.api_usage_log`).
 */
export async function trackApiUsage(params: ApiUsageLogParams): Promise<void> {
  const {
    userId,
    model,
    feature,
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount,
    imageSize,
  } = params

  if (totalTokenCount <= 0) return

  try {
    if (!isPgConfigured()) {
      console.warn('[trackApiUsage] skipped: DATABASE_URL not set')
      return
    }

    let effectiveUserId = userId ?? null
    if (effectiveUserId == null) {
      const u = await getUserOrBypass()
      effectiveUserId = u?.id ?? null
    }

    const pool = getPgPool()
    await pool.query(
      `insert into public.api_usage_log (
        user_id, model, feature, prompt_token_count, candidates_token_count, total_token_count, image_size
      ) values ($1::uuid, $2, $3, $4, $5, $6, $7)`,
      [
        effectiveUserId,
        model,
        feature,
        promptTokenCount,
        candidatesTokenCount,
        totalTokenCount,
        imageSize ?? null,
      ]
    )
  } catch (err) {
    console.error('[trackApiUsage]', err)
  }
}

/**
 * Trích xuất usage từ response và gọi trackApiUsage.
 * @param imageSize - Độ phân giải ảnh trả về ('2K' | '4K') nếu là lượt gọi sinh ảnh, undefined nếu không trả ảnh.
 */
export async function trackFromUsageMetadata(
  usageMetadata: UsageMetadata | undefined,
  model: string,
  feature: string,
  userId?: string | null,
  imageSize?: '2K' | '4K' | null
): Promise<void> {
  if (!usageMetadata) return
  const prompt = usageMetadata.promptTokenCount ?? 0
  const candidates = usageMetadata.candidatesTokenCount ?? 0
  const total = usageMetadata.totalTokenCount ?? prompt + candidates
  if (total <= 0) return
  await trackApiUsage({
    userId,
    model,
    feature,
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    totalTokenCount: total,
    imageSize: imageSize ?? null,
  })
}
