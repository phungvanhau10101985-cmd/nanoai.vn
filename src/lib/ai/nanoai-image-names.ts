import type { GptImageQuality } from '@/lib/ai/image-engine'

/** Tên khách thấy. Key nội bộ và log admin vẫn là gpt / gemini. */
export const NANOAI_IMAGE_NAME = {
  low: 'NanoAI 2L',
  medium: 'NanoAI 2M',
  high: 'NanoAI 2H',
  '2K': 'NanoAI 2K',
  '4K': 'NanoAI 2 4K',
} as const

export function publicGptImageName(quality: GptImageQuality): string {
  return NANOAI_IMAGE_NAME[quality]
}

export function publicGeminiImageName(quality: '2K' | '4K'): string {
  return NANOAI_IMAGE_NAME[quality]
}
