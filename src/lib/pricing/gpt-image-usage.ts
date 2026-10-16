import { GPT_IMAGE_MODEL } from '@/lib/ai/image-engine'

/**
 * GPT Image 2 (API chuẩn, 2026): text input $5 / 1M, image input $8 / 1M, image output $30 / 1M.
 * Sổ `api_usage_log` chỉ có một giá input, nên token ảnh đầu vào được quy về token chữ: × 8/5.
 * Giá output công bố (chỉ phần ảnh, 1024) quy ra token ở $30/1M khi API không trả `usage`.
 */
export const GPT_IMAGE_LOG_MODEL = GPT_IMAGE_MODEL

const OUTPUT_USD_PER_1M = 30
const IMAGE_INPUT_PER_TEXT = 8 / 5

/** 1024×1024: low $0.006, medium $0.053, high $0.211. */
const SQUARE_OUTPUT_TOKENS = { low: 200, medium: 1767, high: 7033 } as const
/** 1024×1536 và 1536×1024: low $0.005, medium $0.041, high $0.165. */
const TALL_OUTPUT_TOKENS = { low: 167, medium: 1367, high: 5500 } as const

export type GptImageUsageQuality = 'low' | 'medium' | 'high' | 'auto'

export type OpenAiImageUsage = {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: { text_tokens?: number; image_tokens?: number }
}

export type GptImageLoggedUsage = {
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
  logModel: typeof GPT_IMAGE_LOG_MODEL
  logImageSize: 'gpt-low' | 'gpt-medium' | 'gpt-high' | 'gpt-auto'
}

function customSizePixelScale(size: string): number | null {
  const match = /^(\d+)x(\d+)$/.exec(size)
  if (!match) return null
  if (size === '1024x1024' || size === '1024x1536' || size === '1536x1024') return null
  const pixels = Number(match[1]) * Number(match[2])
  if (!Number.isFinite(pixels) || pixels <= 0) return null
  return pixels / (1024 * 1024)
}

export function gptImageOutputFallbackTokens(quality: GptImageUsageQuality, size: string): number {
  const table = size === '1024x1536' || size === '1536x1024' ? TALL_OUTPUT_TOKENS : SQUARE_OUTPUT_TOKENS
  const base = quality === 'low' || quality === 'high' ? table[quality] : table.medium
  const scale = customSizePixelScale(size)
  if (scale == null) return base
  return Math.max(1, Math.round(base * scale))
}

export function billGptImageUsage(input: {
  quality: GptImageUsageQuality
  size: string
  prompt: string
  usage?: OpenAiImageUsage | null
}): GptImageLoggedUsage {
  const usage = input.usage
  const details = usage?.input_tokens_details
  const hasCounts = usage != null && (usage.output_tokens != null || usage.input_tokens != null || details != null)
  let promptTokenCount: number
  let candidatesTokenCount: number
  if (hasCounts && usage) {
    if (details && (details.text_tokens != null || details.image_tokens != null)) {
      const text = Math.max(0, details.text_tokens ?? 0)
      const image = Math.max(0, details.image_tokens ?? 0)
      promptTokenCount = Math.round(text + image * IMAGE_INPUT_PER_TEXT)
    } else {
      promptTokenCount = Math.max(0, usage.input_tokens ?? 0)
    }
    candidatesTokenCount = Math.max(0, usage.output_tokens ?? gptImageOutputFallbackTokens(input.quality, input.size))
  } else {
    promptTokenCount = Math.max(0, Math.ceil(input.prompt.length / 4))
    candidatesTokenCount = gptImageOutputFallbackTokens(input.quality, input.size)
  }
  const quality = input.quality === 'low' || input.quality === 'high' || input.quality === 'auto' ? input.quality : 'medium'
  return {
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount: promptTokenCount + candidatesTokenCount,
    logModel: GPT_IMAGE_LOG_MODEL,
    logImageSize: `gpt-${quality}`,
  }
}

/** $30/1M × token fallback = USD công bố cho một ảnh output. */
export function gptImageFallbackOutputUsd(quality: 'low' | 'medium' | 'high', size: string): number {
  return (gptImageOutputFallbackTokens(quality, size) / 1_000_000) * OUTPUT_USD_PER_1M
}
