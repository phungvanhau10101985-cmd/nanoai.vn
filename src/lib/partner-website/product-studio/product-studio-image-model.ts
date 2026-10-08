import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'

export type ProductStudioGeminiImageChoice = {
  model: string
  /** `null` = gửi aspectRatio, không gửi imageSize (Flash 2.5). */
  imageSize: '2K' | null
}

/** Chất liệu luôn Pro 2K. Các slot khác theo lựa chọn trên Studio. */
export function resolveProductStudioGeminiImage(
  kind: string,
  choice: string | null | undefined
): ProductStudioGeminiImageChoice {
  if (kind === 'material') {
    return { model: GEMINI_3_PRO_IMAGE.model, imageSize: '2K' }
  }
  const raw = (choice || 'pro').trim().toLowerCase()
  if (raw === 'flash' || raw === 'flash-2.5' || raw === 'gemini-2.5-flash-image') {
    return { model: 'gemini-2.5-flash-image', imageSize: null }
  }
  if (raw === 'flash3' || raw === 'flash-3' || raw === 'gemini-3.1-flash-image') {
    return { model: 'gemini-3.1-flash-image', imageSize: '2K' }
  }
  return { model: GEMINI_3_PRO_IMAGE.model, imageSize: '2K' }
}
