import { AsyncLocalStorage } from 'node:async_hooks'
import { getUserOrBypass } from '@/lib/auth'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import type { UsageMetadata } from '@google/generative-ai'

const CURRICULUM_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CurriculumApiCostStore = { curriculumId: string }

const curriculumApiCostStorage = new AsyncLocalStorage<CurriculumApiCostStore>()

export function normalizeCurriculumApiCostId(value: string | null | undefined): string | null {
  const id = String(value ?? '').trim()
  return CURRICULUM_ID_RE.test(id) ? id : null
}

/**
 * Gắn các lượt ghi `api_usage_log` phía sau trong cùng request vào giáo trình này.
 * Cột không có khóa ngoại: lượt tạo giáo trình được ghi trước khi dòng giáo trình tồn tại.
 */
export function bindCurriculumApiCost(curriculumId: string | null | undefined): void {
  const id = normalizeCurriculumApiCostId(curriculumId)
  if (!id) return
  curriculumApiCostStorage.enterWith({ curriculumId: id })
}

function curriculumIdForUsageLog(explicit: string | null | undefined): string | null {
  return normalizeCurriculumApiCostId(explicit) ?? curriculumApiCostStorage.getStore()?.curriculumId ?? null
}

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
  /** 1K/2K/4K, gpt-low/medium/high/auto, hoặc null khi không trả ảnh. */
  imageSize?: string | null
  /** Giáo trình mà lượt gọi này phục vụ. Trống thì lấy từ `bindCurriculumApiCost`. */
  curriculumId?: string | null
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
    curriculumId,
  } = params

  if (totalTokenCount <= 0) return

  try {
    if (!isPgConfigured()) {
      console.warn('[trackApiUsage] skipped: DATABASE_URL not set')
      return
    }

    let effectiveUserId = userId ?? null
    if (effectiveUserId == null) {
      try {
        const u = await getUserOrBypass()
        effectiveUserId = u?.id ?? null
      } catch {
        // Cron và worker không có request store. Vẫn ghi usage, user để trống.
        effectiveUserId = null
      }
    }

    const pool = getPgPool()
    const values = [
      effectiveUserId,
      model,
      feature,
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount,
      imageSize ?? null,
      curriculumIdForUsageLog(curriculumId),
    ]
    try {
      await pool.query(
        `insert into public.api_usage_log (
          user_id, model, feature, prompt_token_count, candidates_token_count, total_token_count, image_size, curriculum_id
        ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)`,
        values,
      )
    } catch (insertErr) {
      const message = insertErr instanceof Error ? insertErr.message : String(insertErr)
      if (!/curriculum_id/i.test(message)) throw insertErr
      await pool.query(
        `insert into public.api_usage_log (
          user_id, model, feature, prompt_token_count, candidates_token_count, total_token_count, image_size
        ) values ($1::uuid, $2, $3, $4, $5, $6, $7)`,
        values.slice(0, 7),
      )
    }
  } catch (err) {
    console.error('[trackApiUsage]', err)
  }
}

/**
 * Trích xuất usage từ response và gọi trackApiUsage.
 * @param imageSize - Độ phân giải ảnh trả về ('2K' | '4K') nếu là lượt gọi sinh ảnh, undefined nếu không trả ảnh.
 * GPT Image gắn `logModel` và `logImageSize` trên usage để không bị ghi nhầm model Gemini và size 2K/4K.
 */
export async function trackFromUsageMetadata(
  usageMetadata: (Partial<UsageMetadata> & { logModel?: string; logImageSize?: string | null }) | undefined,
  model: string,
  feature: string,
  userId?: string | null,
  imageSize?: string | null
): Promise<void> {
  if (!usageMetadata) return
  const prompt = usageMetadata.promptTokenCount ?? 0
  const candidates = usageMetadata.candidatesTokenCount ?? 0
  const total = usageMetadata.totalTokenCount ?? prompt + candidates
  if (total <= 0) return
  const loggedModel = usageMetadata.logModel?.trim() || model
  const loggedSize = usageMetadata.logImageSize !== undefined ? usageMetadata.logImageSize : (imageSize ?? null)
  await trackApiUsage({
    userId,
    model: loggedModel,
    feature,
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    totalTokenCount: total,
    imageSize: loggedSize,
    curriculumId: curriculumIdForUsageLog(null),
  })
}
