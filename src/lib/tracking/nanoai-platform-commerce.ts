import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'

/** Cùng cột `id` feed: gói học sinh không suy ra từ href. */
export const STUDENT_PLAN_CONTENT_ID = 'feature_goi_hoc_sinh'
export const CURRICULUM_CONTENT_ID = toNanoAiFeatureCatalogIdFromHref('/tao-giao-trinh')

export const NANO_PLATFORM_PURCHASE_COOKIE = 'nano_feat_buy'

/** Tính năng tạo ảnh / thiết kế: trừ credit thành công = mua hàng. */
const DESIGN_SLUGS = new Set([
  'thu-do-online',
  'phuc-dung-anh',
  'lam-net-anh',
  'lam-dep-anh',
  'ghep-anh',
  'tao-banner',
  'tao-anh-ban-hang',
  'tao-thiep-moi-cuoi-ai',
  'tao-anh-tu-chu',
  'du-anh-tu-phac-thao',
  'tao-infographic-tu-sach',
  'ke-chuyen-bang-hinh-anh',
  'tao-anh-the',
  'thiet-ke-logo',
  'tao-nhan-gian',
  'tao-nhan-gioi-thieu-san-pham',
  'tao-tem-niem-phong-bao-hanh',
  'thiet-ke-con-dau',
  'thiet-ke-bao-bi',
  'thiet-ke-tui-dung',
  'mockup-cylinder-wrap',
  'che-anh',
  'xoa-vat-the',
  'xoa-nen-png',
  'thay-nen-san-pham',
  'sua-anh-theo-yeu-cau',
  'tao-anh-3d',
  'tao-mo-hinh-3d-tu-anh',
  'thiet-ke-noi-ngoai-that',
  'xay-nha-tu-dat-nen',
  'tao-anh-chain-dung',
  'mo-rong-khung-hinh',
  'hoan-doi-khuon-mat',
  'dich-anh-tai-lieu',
])

const SPEND_ALIAS: Record<string, string> = {
  'xay-nha-3d': 'xay-nha-tu-dat-nen',
  'xay-nha-floorplan': 'xay-nha-tu-dat-nen',
  'xay-nha-structural': 'xay-nha-tu-dat-nen',
  'thiet-ke-noi-ngoai-that-analyze': 'thiet-ke-noi-ngoai-that',
  'thiet-ke-noi-ngoai-that-process': 'thiet-ke-noi-ngoai-that',
  'tao-nhan-gioi-thieu-san-pham-mockup': 'tao-nhan-gioi-thieu-san-pham',
  'wedding-card-text-polish': 'tao-thiep-moi-cuoi-ai',
  'wedding-card-sample-compose': 'tao-thiep-moi-cuoi-ai',
  'hub-studio-banner': 'tao-banner',
  'hub-studio-packaging': 'thiet-ke-bao-bi',
  'hub-studio-packaging-outpaint': 'thiet-ke-bao-bi',
  'tao-anh-chain-dung': 'tao-anh-chain-dung',
}

export type PlatformPurchaseRow = {
  contentId: string
  valueVnd: number
  orderId: string
  contentName: string
}

/** Href catalog nếu lần trừ credit này là mua hàng của tính năng ảnh/thiết kế. */
export function designPurchaseHref(feature: string): string | null {
  const raw = String(feature || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .split('/')[0]
  if (!raw) return null
  const slug = SPEND_ALIAS[raw] || raw
  if (!DESIGN_SLUGS.has(slug)) return null
  return `/${slug}`
}

const CREATE_EXCLUDE =
  /(hủy|huỷ|cancel|xóa|xoá|delete|đóng|close|sao chép|copy|xem nhanh|xem thiệp|khách mời|nâng gói|chọn gói|nạp credit|nạp tiền|đăng nhập|sign in|quay lại|\bback\b|xuất bản|publish)/i

const CREATE_INCLUDE =
  /(tạo|generate|create|生成|创建|作成|생성|만들기|thử đồ|phục dựng|làm nét|làm đẹp|ghép|xóa nền|xoá nền|xóa vật|xoá vật|dịch|thiết kế|sinh ảnh|sinh anh)/i

/** Nút bấm tạo ảnh, tạo giáo trình, tạo thiệp… = thêm giỏ. */
export function isFeatureCreateLabel(label: string): boolean {
  const text = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (text.length < 2 || text.length > 80) return false
  if (CREATE_EXCLUDE.test(text)) return false
  return CREATE_INCLUDE.test(text)
}

export function serializePlatformPurchases(rows: PlatformPurchaseRow[]): string {
  return rows
    .map((row) =>
      [row.contentId, String(row.valueVnd), row.orderId, row.contentName]
        .map((part) => encodeURIComponent(part))
        .join('~'),
    )
    .join('|')
}

export function parsePlatformPurchases(raw: string): PlatformPurchaseRow[] {
  const text = String(raw || '').trim()
  if (!text) return []
  const out: PlatformPurchaseRow[] = []
  for (const piece of text.split('|')) {
    const parts = piece.split('~')
    if (parts.length < 3) continue
    const contentId = decodeURIComponent(parts[0] || '')
    const valueVnd = Math.round(Number(decodeURIComponent(parts[1] || '')) || 0)
    const orderId = decodeURIComponent(parts[2] || '')
    const contentName = decodeURIComponent(parts.slice(3).join('~') || contentId)
    if (!contentId || valueVnd <= 0 || !orderId) continue
    out.push({ contentId, valueVnd, orderId, contentName })
  }
  return out
}
