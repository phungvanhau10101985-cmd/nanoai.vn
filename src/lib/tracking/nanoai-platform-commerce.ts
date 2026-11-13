import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'

/** Cùng cột `id` feed: gói học sinh không suy ra từ href. */
export const STUDENT_PLAN_CONTENT_ID = 'feature_goi_hoc_sinh'
export const CURRICULUM_CONTENT_ID = toNanoAiFeatureCatalogIdFromHref('/tao-giao-trinh')

export const NANO_PLATFORM_PURCHASE_COOKIE = 'nano_feat_buy'

/** Tính năng tạo ảnh / thiết kế có trang catalog. Trừ credit ở đây vẫn là mua hàng. */
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
  'wedding-couple-photo-restyle': 'tao-thiep-moi-cuoi-ai',
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

/** Href catalog nếu lần trừ credit thuộc một tính năng ảnh/thiết kế đã có trang. */
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

/** Mọi lần trừ credit đều là mua hàng. Tính năng có catalog thì dùng id catalog. */
export function creditPurchaseContent(feature: string): { contentId: string; contentName: string } | null {
  const name = String(feature || '').trim()
  if (!name) return null
  const href = designPurchaseHref(name)
  if (href) return { contentId: toNanoAiFeatureCatalogIdFromHref(href), contentName: href }
  const key = name.toLowerCase()
  if (key.includes('student') || key.includes('hoc-sinh') || key.includes('hoc_sinh')) {
    return { contentId: STUDENT_PLAN_CONTENT_ID, contentName: 'Gói học sinh' }
  }
  if (key.includes('curriculum') || key.includes('giao-trinh') || key.includes('giao_trinh')) {
    return { contentId: CURRICULUM_CONTENT_ID, contentName: 'Tạo giáo trình AI' }
  }
  const slug = key.split('/')[0] || key
  return { contentId: toNanoAiFeatureCatalogIdFromHref(slug), contentName: slug.slice(0, 80) }
}

const CREATE_EXCLUDE =
  /(hủy|huỷ|cancel|xóa|xoá|delete|đóng|close|sao chép|copy|xem nhanh|xem thiệp|khách mời|nâng gói|chọn gói|nạp credit|nạp tiền|đăng nhập|sign in|quay lại|\bback\b|xuất bản|publish|mở trang|open exam|open homework|打开|を開く|열기)/i

const CREATE_INCLUDE =
  /(tạo|generate|create|生成|创建|作成|생성|만들기|thử đồ|phục dựng|làm nét|làm đẹp|ghép|xóa nền|xoá nền|xóa vật|xoá vật|dịch|thiết kế|sinh ảnh|sinh anh)/i

function cartLabel(label: string): string {
  return String(label || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Nút bấm tạo ảnh, thiết kế, dịch… = thêm giỏ trên các trang ảnh. */
export function isFeatureCreateLabel(label: string): boolean {
  const text = cartLabel(label)
  if (text.length < 2 || text.length > 80) return false
  if (CREATE_EXCLUDE.test(text)) return false
  return CREATE_INCLUDE.test(text)
}

const LANGUAGE_CART_ROUTES = new Set([
  '/hoc-tieng-anh-ai',
  '/hoc-tieng-viet',
  '/hoc-tieng-trung',
  '/hoc-tieng-nhat',
  '/hoc-tieng-han',
])

const LANGUAGE_ROUTE_BY_HOC: Record<string, string> = {
  en: '/hoc-tieng-anh-ai',
  vi: '/hoc-tieng-viet',
  zh: '/hoc-tieng-trung',
  ja: '/hoc-tieng-nhat',
  ko: '/hoc-tieng-han',
}

const SEND_CART_ROUTES = new Set(['/ho-tro-lam-bai', '/gia-su-ai'])
const EXAM_CART_ROUTES = new Set(['/tao-bai-thi', '/tao-bai-tap-ve-nha'])
const CURRICULUM_CART_ROUTES = new Set(['/tao-giao-trinh', '/giao-trinh'])

function isLanguageStartLabel(text: string): boolean {
  return (
    text.includes('bắt đầu buổi học') ||
    text.includes('start lesson') ||
    text.includes('开始学习') ||
    text.includes('レッスン開始') ||
    text.includes('수업 시작') ||
    text.includes('เริ่มบทเรียน') ||
    text.includes('पाठ शुरू')
  )
}

function isMeetingReportLabel(text: string): boolean {
  if (text.includes('cuộc họp mới') || text.includes('new meeting')) return false
  if (/tạo báo cáo/.test(text)) return true
  if (/generate/.test(text) && /report/.test(text)) return true
  return text.includes('纪要') || text.includes('議事録') || text.includes('회의록')
}

function isStudySendLabel(text: string): boolean {
  return /^(gửi|send|发送|送信|送る|보내기)$/.test(text)
}

function isExamCreateLabel(text: string): boolean {
  if (/khác|another|再建|再创建|別の|다른/.test(text)) return false
  if (CREATE_EXCLUDE.test(text)) return false
  return (
    /tạo bài thi/.test(text) ||
    /tạo bài tập/.test(text) ||
    /create exam/.test(text) ||
    /create homework/.test(text) ||
    text.includes('创建测验') ||
    text.includes('创建家庭作业') ||
    text.includes('テストを作成') ||
    text.includes('宿題を作成') ||
    text.includes('시험 만들기') ||
    text.includes('숙제 만들기')
  )
}

/**
 * Thêm giỏ = khách bắt đầu dùng tính năng.
 * Ảnh/thiết kế: nút chạy. Thiệp: không (chỉ khi tạo thiệp thành công).
 * Giáo trình: chỉ nút có data-nano-cart="1". Lớp học: không.
 * Học ngoại ngữ: Bắt đầu buổi học. Ghi âm: Tạo báo cáo AI.
 * Hỗ trợ làm bài / gia sư: Gửi. Bài thi / bài tập: nút tạo bài.
 */
export function isFeatureCartAction(featureRoute: string, label: string): boolean {
  const route = String(featureRoute || '').trim()
  const text = cartLabel(label)
  if (!route || !text || text.length > 80) return false
  if (route === '/lop' || route === '/tao-thiep-moi-cuoi-ai') return false
  if (LANGUAGE_CART_ROUTES.has(route)) return isLanguageStartLabel(text)
  if (route === '/ghi-am-bao-cao-cuoc-hop') return isMeetingReportLabel(text)
  if (SEND_CART_ROUTES.has(route)) return isStudySendLabel(text)
  if (EXAM_CART_ROUTES.has(route)) return isExamCreateLabel(text)
  if (CURRICULUM_CART_ROUTES.has(route)) return false
  return isFeatureCreateLabel(label)
}

/** Buổi học nằm ở /luyen-noi hoặc /hoc-bai-hoc-co-san. Giỏ gắn đúng trang tiếng theo ?hoc=. */
export function languageCartRouteForLocation(pathname: string, search: string): string | null {
  const path = String(pathname || '').trim() || '/'
  const practice = path.startsWith('/hoc-bai-hoc-co-san') || path.includes('/luyen-noi')
  if (!practice) return null
  const query = String(search || '').replace(/^\?/, '')
  const hoc = new URLSearchParams(query).get('hoc') || 'en'
  return LANGUAGE_ROUTE_BY_HOC[hoc] || '/hoc-tieng-anh-ai'
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
