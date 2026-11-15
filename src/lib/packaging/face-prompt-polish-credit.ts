import { isBagKitPreset } from '@/lib/hub-chat/bag-kit-shared'
import { isBagFaceStepKey } from '@/lib/packaging/bag-dimensions'
import { isPackagingFaceStepKey } from '@/lib/packaging/hub-face-steps'

/** Một lần tối ưu câu mô tả mặt in. 1 credit = 6.000₫. Chưa tạo ảnh. */
export const PACKAGING_FACE_PROMPT_POLISH_CREDIT = 0.1

export const PACKAGING_FACE_PROMPT_POLISH_MAX_CHARS = 4000

const SKIP_ONLY_DRAFT =
  /^(bỏ trống|bo trong|để trống|de trong|blank|empty|không in|khong in|no print|leave blank|giống mặt (trước|sau|trên|dưới|trái|phải)|same as (front|back|top|bottom|left|right))$/i

/** Bước gõ mô tả rồi tạo ảnh mặt in (hộp hoặc túi). */
export function isPackagingFacePolishStep(
  presetId: string | null | undefined,
  stepKey: string | null | undefined
): boolean {
  if (!stepKey) return false
  if (presetId === 'packaging_kit') return isPackagingFaceStepKey(stepKey)
  if (isBagKitPreset(presetId)) return isBagFaceStepKey(stepKey)
  return false
}

/** Lệnh bỏ trống / sao chép mặt — không viết lại thành brief thiết kế. */
export function isFacePolishSkipDraft(draft: string): boolean {
  return SKIP_ONLY_DRAFT.test(draft.trim())
}

const QUOTED_PRINT = /[«“"「『]([^«»“”"」』\n]{2,240})[»”"」』]/g

/** Chuỗi người dùng đã đặt trong ngoặc — phải còn nguyên sau khi viết lại. */
export function quotedPrintSpans(text: string): string[] {
  const spans: string[] = []
  for (const match of text.matchAll(QUOTED_PRINT)) {
    const value = match[1]?.trim()
    if (value) spans.push(value)
  }
  return spans
}

export function missingQuotedPrintSpans(draft: string, polished: string): string[] {
  return quotedPrintSpans(draft).filter((span) => !polished.includes(span))
}
