import { slugifyPartnerCategoryName } from '@/lib/partner-website/category/partner-category-types'

/** So khớp tên danh mục: không dấu, chữ thường, gộp khoảng trắng. */
export function partnerCategoryNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const GENDER_TOKEN_RE = /\b(nam|nu|men|women|male|female|mens|womens|unisex)\b/g

export type PartnerCategoryGenderToken = 'nam' | 'nu' | 'unisex' | null

export function partnerCategoryGenderToken(nameKey: string): PartnerCategoryGenderToken {
  const key = partnerCategoryNameKey(nameKey)
  if (/\bunisex\b/.test(key)) return 'unisex'
  const hasNam = /\b(nam|men|male|mens)\b/.test(key)
  const hasNu = /\b(nu|women|female|womens)\b/.test(key)
  if (hasNam && hasNu) return 'unisex'
  if (hasNam) return 'nam'
  if (hasNu) return 'nu'
  return null
}

/** Bỏ token giới tính để so gốc loại hàng (áo thun nam → ao thun). */
export function partnerCategoryIntentStem(name: string): string {
  return partnerCategoryNameKey(name).replace(GENDER_TOKEN_RE, ' ').replace(/\s+/g, ' ').trim()
}

export function partnerCategorySlugKey(name: string): string {
  return slugifyPartnerCategoryName(name)
}
