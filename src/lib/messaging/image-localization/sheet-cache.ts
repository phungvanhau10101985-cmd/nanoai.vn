import type { ImageLocOcrBlock } from './image-localization-types'
import { hasSizeTableContext, isLaundryInstructionImage } from './image-localization-classifier'

export type ImageLocSheetKind = 'size' | 'laundry'

export function normalizeImageLocSheetKey(value: string | null | undefined): string {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function imageLocSheetKinds(blocks: ImageLocOcrBlock[]): ImageLocSheetKind[] {
  const kinds: ImageLocSheetKind[] = []
  if (hasSizeTableContext(blocks)) kinds.push('size')
  if (isLaundryInstructionImage(blocks)) kinds.push('laundry')
  return kinds
}

/** Chỉ dùng ảnh đã lưu khi mỗi loại trên ảnh này đều đã có URL, và các URL trùng nhau. */
export function resolveStoredImageLocSheet(
  kinds: ImageLocSheetKind[],
  stored: Partial<Record<ImageLocSheetKind, string>>
): string | null {
  if (!kinds.length) return null
  const urls = kinds.map((kind) => String(stored[kind] || '').trim())
  if (urls.some((url) => !url)) return null
  const unique = [...new Set(urls)]
  return unique.length === 1 ? unique[0] : null
}
