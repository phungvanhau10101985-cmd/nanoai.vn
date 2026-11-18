import type { FluxImageQuality, GptImageQuality, ImageEngine } from '@/lib/ai/image-engine'

/** Tên khách thấy. Key gọi API vẫn là gpt / gemini / flux. */
export const NANOAI_IMAGE_NAME = {
  low: 'NanoAI 2L',
  medium: 'NanoAI 2M',
  high: 'NanoAI 2H',
  '2K': 'NanoAI 2K',
  '4K': 'NanoAI 4K',
} as const

export const FLUX_IMAGE_NAME = {
  '1.5K': 'NanoAI F1.5K',
  '2K': 'NanoAI F2K',
  '4K': 'NanoAI F4K',
} as const

export function publicGptImageName(quality: GptImageQuality): string {
  return NANOAI_IMAGE_NAME[quality]
}

export function publicGeminiImageName(quality: '2K' | '4K'): string {
  return NANOAI_IMAGE_NAME[quality]
}

export function publicFluxImageName(quality: FluxImageQuality): (typeof FLUX_IMAGE_NAME)[FluxImageQuality] {
  return FLUX_IMAGE_NAME[quality]
}

export function publicImageEngineName(
  engine: ImageEngine,
  geminiQuality: FluxImageQuality,
  gptQuality: GptImageQuality,
): string {
  if (engine === 'gpt') return publicGptImageName(gptQuality)
  if (engine === 'flux') return publicFluxImageName(geminiQuality)
  return publicGeminiImageName(geminiQuality === '4K' ? '4K' : '2K')
}

/** Cùng bộ tỷ lệ gemini-3-pro-image. Khách thấy tên này, không thấy Gemini. */
export const NANOAI_GEMINI_ASPECT_MODELS = `${NANOAI_IMAGE_NAME['2K']} / ${NANOAI_IMAGE_NAME['4K']}`

/** Cùng bộ tỷ lệ gpt-image-2 (1:1, 2:3, 3:2). Khách thấy tên này, không thấy GPT. */
export const NANOAI_GPT_ASPECT_MODELS = `${NANOAI_IMAGE_NAME.low} / ${NANOAI_IMAGE_NAME.medium} / ${NANOAI_IMAGE_NAME.high}`
