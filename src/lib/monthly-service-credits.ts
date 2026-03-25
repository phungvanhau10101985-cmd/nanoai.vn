import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'

/**
 * Phí dịch vụ theo tháng chỉ áp dụng **giáo trình / tạo bài** (không gồm credit AI theo lượt).
 * Học tiếng Anh AI: trả theo từng buổi/bài — xem `/api/english-coach/credits`.
 * Tham chiếu: ~110k/tháng giáo trình @ 6k/credit → 18 credit.
 */
export const MONTHLY_SERVICE_CREDITS = {
  curriculum: 18,
} as const

export const MONTHLY_SERVICE_CHARGE_TYPES = {
  curriculum: 'monthly_service_curriculum',
} as const satisfies Record<keyof typeof MONTHLY_SERVICE_CREDITS, string>

/** Chuỗi YYYY-MM theo lịch Việt Nam (Asia/Ho_Chi_Minh). */
export function getVietnamYearMonth(d = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value ?? ''
    const mRaw = parts.find((p) => p.type === 'month')?.value ?? ''
    const m = mRaw.padStart(2, '0')
    if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m)) return `${y}-${m}`
  } catch {
    /* fallback */
  }
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  const vn = new Date(utc + 7 * 3600000)
  const y = vn.getUTCFullYear()
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/

export function isValidYearMonth(ym: string): boolean {
  return YEAR_MONTH_RE.test(String(ym || '').trim())
}

/**
 * Idempotency key — PHẢI gồm userId vì `language_coach_credit_events.event_key` unique toàn bảng,
 * không chỉ theo user. Chỉ dùng cho phí tháng **giáo trình**.
 */
export function curriculumMonthlyEventKey(yearMonth: string, userId: string): string {
  const uid = String(userId || '').trim().toLowerCase()
  return `monthly_service:${uid}:curriculum:${yearMonth}`
}

/** Ước tính VND tương đương (hiển thị), không dùng cho thanh toán. */
export function estimatedVndForMonthlyCredits(credits: number): number {
  return Math.round(credits * CREDIT_UNIT_PRICE_VND)
}
