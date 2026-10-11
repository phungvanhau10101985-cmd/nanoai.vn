import { inferOutfitRole } from '@/lib/partner-website/shop/pdp-outfit-roles'
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

const EXTRA_APPAREL_KEYS = [
  '半身裙',
  '短裙',
  '长裙',
  '长裤',
  '短裤',
  '卫衣',
  '外套',
  '大衣',
  '风衣',
  '羽绒服',
  '针织',
  '吊带',
  '背心',
  '马甲',
  '套装',
  '衬衫',
  't恤',
  '毛衣',
]

/**
 * Shop thời trang, sản phẩm là áo / quần / váy.
 * Giày, túi, phụ kiện và shop ngành khác trả false.
 * `industryKey` trống coi là fashion, cùng cách dashboard.
 */
export function isApparelImageLocProduct(opts: {
  industryKey: string | null | undefined
  labels: unknown[]
}): boolean {
  const industry = String(opts.industryKey || 'fashion').trim().toLowerCase()
  if (industry !== 'fashion') return false
  const blob = opts.labels.map((label) => String(label ?? '').trim().toLowerCase()).filter(Boolean).join(' ')
  if (/鞋|靴/.test(blob)) return false
  const role = inferOutfitRole(...opts.labels)
  if (role === 'shoes' || role === 'bag' || role === 'accessory') return false
  if (role === 'top' || role === 'bottom' || role === 'dress') return true
  return EXTRA_APPAREL_KEYS.some((key) => blob.includes(key))
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
