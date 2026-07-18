import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

export const CREDIT_TRIAL_ROUTE_PREFIXES = [
  '/thu-do-online',
  '/lam-net-anh',
  '/xoa-nen-png',
  '/xoa-vat-the',
  '/lam-dep-anh',
  '/mo-rong-khung-hinh',
  '/sua-anh-theo-yeu-cau',
  '/phuc-dung-anh',
  '/tao-anh-3d',
  '/tao-anh-chain-dung',
  '/tao-anh-the',
  '/tao-anh-tu-chu',
  '/tao-banner',
  '/tao-giao-trinh',
  '/tao-infographic-tu-sach',
  '/tao-mo-hinh-3d-tu-anh',
  '/tao-nhan-gian',
  '/tao-nhan-gioi-thieu-san-pham',
  '/tao-tem-niem-phong-bao-hanh',
  '/tao-video-tu-anh',
  '/thay-nen-san-pham',
  '/thiet-ke-con-dau',
  '/thiet-ke-logo',
  '/thiet-ke-noi-ngoai-that',
  '/che-anh',
  '/dich-anh-tai-lieu',
  '/du-anh-tu-phac-thao',
  '/flow-nhac-video-veo',
  '/ghep-anh',
  '/hoan-doi-khuon-mat',
  '/ke-chuyen-bang-hinh-anh',
  '/xay-nha-tu-dat-nen',
  '/ghi-am-bao-cao-cuoc-hop',
] as const

export function isCreditTrialRoute(pathname: string): boolean {
  const p = sanitizeLoginNext(pathname || '/')
  return CREDIT_TRIAL_ROUTE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))
}
