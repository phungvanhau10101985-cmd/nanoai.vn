import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { UI_MOCKUP_CREDIT } from '@/lib/hub-chat/hub-studio-types'

/**
 * Credit / ảnh theo model Gemini đang gọi.
 * Pro 2K giữ 1,5 (giá studio hiện tại).
 * Flash 3.1 2K và Flash 2.5 theo tỉ lệ token ảnh trong `api-token-cost.ts`
 * (Pro 1120×$120, Flash 3.1 1680×$60, Flash 2.5 ≈ $0,039/ảnh), làm tròn 0,1.
 */
const STUDIO_IMAGE_CREDIT_BY_MODEL: Record<string, number> = {
  [GEMINI_3_PRO_IMAGE.model]: UI_MOCKUP_CREDIT,
  'gemini-3-pro-image-preview': UI_MOCKUP_CREDIT,
  'gemini-3.1-flash-image': 1.1,
  'gemini-3.1-flash-image-preview': 1.1,
  'gemini-2.5-flash-image': 0.4,
}

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

/** Credit sẽ trừ cho đúng một lần tạo / tạo lại. Chất liệu luôn giá Pro. */
export function productStudioSlotImageCredit(kind: string, choice: string | null | undefined): number {
  return productStudioGeminiImageCredit(resolveProductStudioGeminiImage(kind, choice).model)
}

export function productStudioGeminiImageCredit(model: string | null | undefined): number {
  const id = (model || '').trim()
  if (!id) return UI_MOCKUP_CREDIT
  return STUDIO_IMAGE_CREDIT_BY_MODEL[id] ?? UI_MOCKUP_CREDIT
}
