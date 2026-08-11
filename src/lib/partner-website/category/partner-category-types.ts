import type { WebLocale } from '@/lib/i18n/config'
import { WEB_LOCALES } from '@/lib/i18n/config'

/**
 * W4.1/W4.2 — danh mục sản phẩm per-tenant (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md).
 * Một nguồn dữ liệu duy nhất cho admin/storefront/nav/SEO — không suy từ text sản phẩm như 188.
 * Xem docs/188_BEHAVIOR_SPEC.md mục A cho spec hành vi đầy đủ.
 */

export const PARTNER_CATEGORY_MAX_DEPTH = 6
export const PARTNER_CATEGORY_NAME_MAX_LEN = 200
export const PARTNER_CATEGORY_SLUG_MAX_LEN = 100
export const PARTNER_CATEGORY_PATH_MAX_LEN = 600

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidPartnerCategorySlug(slug: string): boolean {
  const s = slug.trim()
  return s.length > 0 && s.length <= PARTNER_CATEGORY_SLUG_MAX_LEN && SLUG_RE.test(s)
}

/** Tự sinh slug từ tên (bỏ dấu, hạ thường, khoảng trắng -> gạch ngang). Không đảm bảo duy nhất — caller kiểm tra trùng. */
export function slugifyPartnerCategoryName(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PARTNER_CATEGORY_SLUG_MAX_LEN)
  return slug || 'danh-muc'
}

export type PartnerCategoryNameI18n = Partial<Record<WebLocale, string>>

export type PartnerCategoryRow = {
  id: string
  partnerId: string
  parentId: string | null
  name: string
  nameI18n: PartnerCategoryNameI18n
  slug: string
  path: string
  depth: number
  sortOrder: number
  isActive: boolean
  imageUrl: string
  description: string
  descriptionI18n: PartnerCategoryNameI18n
  seoTitle: string
  seoDescription: string
  seoIndex: boolean
  /** Đoạn văn SEO 150-300 từ hiển thị cuối trang danh mục — AI sinh hoặc merchant tự viết. */
  seoBody: string
  seoBodyGeneratedAt: string | null
  seoBodyGeneratedLocale: string | null
  /** W1.5 — ảnh bảng size (PDP modal); rỗng = fallback trang /size-guide. */
  sizeGuideImageUrl: string
  /** PS.8 — true nếu Product Studio AI tự tạo node này khi đăng sản phẩm (không phải merchant tạo tay). */
  aiGenerated: boolean
  createdAt: string
  updatedAt: string
}

export type PartnerCategoryTreeNode = PartnerCategoryRow & {
  children: PartnerCategoryTreeNode[]
  /** Số sản phẩm gán trực tiếp (không gộp con) — điền khi caller cần đếm. */
  productCount?: number
}

export type PartnerCategoryCreateInput = {
  partnerId: string
  parentId: string | null
  name: string
  nameI18n?: PartnerCategoryNameI18n
  slug?: string
  sortOrder?: number
  isActive?: boolean
  imageUrl?: string
  description?: string
  descriptionI18n?: PartnerCategoryNameI18n
  seoTitle?: string
  seoDescription?: string
  seoIndex?: boolean
  seoBody?: string
  /** PS.8 — đánh dấu node do AI tự tạo (Product Studio) — badge "cần xem lại" trong admin panel. */
  aiGenerated?: boolean
}

export type PartnerCategoryUpdateInput = Partial<
  Omit<PartnerCategoryCreateInput, 'partnerId' | 'parentId'>
>

/** Chuẩn hoá bản đồ i18n: chỉ giữ locale hợp lệ + chuỗi không rỗng. */
export function normalizePartnerCategoryI18nMap(raw: unknown): PartnerCategoryNameI18n {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  const out: PartnerCategoryNameI18n = {}
  for (const locale of WEB_LOCALES) {
    const v = obj[locale]
    if (typeof v === 'string' && v.trim()) out[locale] = v.trim()
  }
  return out
}

/** Nhãn hiển thị theo locale: ưu tiên name_i18n[locale] -> name mặc định. */
export function resolvePartnerCategoryDisplayName(row: PartnerCategoryRow, locale: WebLocale): string {
  return row.nameI18n[locale]?.trim() || row.name
}

export function resolvePartnerCategoryDisplayDescription(row: PartnerCategoryRow, locale: WebLocale): string {
  return row.descriptionI18n[locale]?.trim() || row.description
}

/** Build path đầy đủ từ path của cha (hoặc null nếu root) + slug hiện tại. */
export function buildPartnerCategoryPath(parentPath: string | null, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : slug
}

/** Dựng cây lồng nhau từ danh sách phẳng (đã sort theo sort_order). */
export function buildPartnerCategoryTree(rows: PartnerCategoryRow[]): PartnerCategoryTreeNode[] {
  const byId = new Map<string, PartnerCategoryTreeNode>()
  for (const r of rows) byId.set(r.id, { ...r, children: [] })

  const roots: PartnerCategoryTreeNode[] = []
  for (const r of rows) {
    const node = byId.get(r.id)!
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** Tách path "/" thành mảng segment slug — dùng để resolve route `/site/{slug}/c/{...path}`. */
export function splitPartnerCategoryPath(path: string): string[] {
  return path
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Chuỗi tổ tiên (root -> cha trực tiếp) của 1 danh mục, dựng từ danh sách phẳng đã fetch sẵn.
 * Dùng chung cho breadcrumb ở cả trang danh mục và PDP (S0.6) — tránh lặp lại logic đi bộ path.
 */
export function resolvePartnerCategoryAncestors(
  flat: PartnerCategoryRow[],
  category: PartnerCategoryRow
): PartnerCategoryRow[] {
  const ancestors: PartnerCategoryRow[] = []
  const segs = splitPartnerCategoryPath(category.path)
  for (let i = 1; i < segs.length; i += 1) {
    const prefix = segs.slice(0, i).join('/')
    const found = flat.find((c) => c.path === prefix)
    if (found) ancestors.push(found)
  }
  return ancestors
}
