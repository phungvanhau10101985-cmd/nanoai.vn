import { GPT_IMAGE_CREDITS, type GptImageQuality, type ImageEngine } from '@/lib/ai/image-engine'

/**
 * Giá Gemini trên trang dịch ảnh. 1 credit = 6.000đ.
 * 2K = 1,5 credit (9.000đ). 4K = 4 credit (24.000đ).
 * Không dùng 0,5 / 1 / 2 vì đó là giá GPT, và job chỉ lưu 2K hoặc 4K kèm số credit.
 */
export const DOCUMENT_TRANSLATE_GEMINI_CREDITS = { '2K': 1.5, '4K': 4 } as const

export type DocumentTranslateGeminiSize = keyof typeof DOCUMENT_TRANSLATE_GEMINI_CREDITS

function isGptCredit(cost: number): boolean {
  return [GPT_IMAGE_CREDITS.low, GPT_IMAGE_CREDITS.medium, GPT_IMAGE_CREDITS.high].some(
    (value) => Math.abs(value - cost) < 0.05
  )
}

function gptQualityFromCost(cost: number): GptImageQuality {
  if (Math.abs(cost - GPT_IMAGE_CREDITS.low) < 0.05) return 'low'
  if (Math.abs(cost - GPT_IMAGE_CREDITS.high) < 0.05) return 'high'
  return 'medium'
}

/** Job cũ và job mới đều chỉ có image_quality 2K/4K. Model đọc từ số credit. */
export function documentTranslateJobPlan(
  storedQuality: string | null | undefined,
  cost: number
): { engine: ImageEngine; gptQuality: GptImageQuality | null; geminiSize: DocumentTranslateGeminiSize } {
  const stored = String(storedQuality || '').trim().toLowerCase()
  const geminiSize: DocumentTranslateGeminiSize = stored === '4k' || stored === 'gemini-4k' ? '4K' : '2K'
  if (stored.startsWith('gpt-')) {
    const quality = stored.slice(4)
    const gptQuality: GptImageQuality = quality === 'low' || quality === 'high' ? quality : 'medium'
    return { engine: 'gpt', gptQuality, geminiSize }
  }
  if (isGptCredit(cost)) return { engine: 'gpt', gptQuality: gptQualityFromCost(cost), geminiSize }
  return { engine: 'gemini', gptQuality: null, geminiSize }
}
