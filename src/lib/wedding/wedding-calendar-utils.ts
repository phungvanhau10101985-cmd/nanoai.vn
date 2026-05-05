import type { WebLocale } from '@/lib/i18n/config'

export function webLocaleToBcp47(locale: WebLocale): string {
  switch (locale) {
    case 'vi':
      return 'vi-VN'
    case 'zh':
      return 'zh-CN'
    case 'ja':
      return 'ja-JP'
    case 'ko':
      return 'ko-KR'
    default:
      return 'en-US'
  }
}

/** Trích các mốc HH:MM (hoặc H:MM) từ ô «giờ cưới» (có thể có nhiều giờ). */
export function extractClockTimes(text: string): string[] {
  const re = /\b(\d{1,2}:\d{2})\b/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push(m[1])
  }
  return out
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Parse YYYY-MM-DD thành Date local (trưa để tránh lệch ngày). */
export function parseIsoDateLocal(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

/** Lưới tháng: mỗi ô là số ngày hoặc null (ô trống). Thứ 2 đầu hàng — CN cuối. */
export function buildMonthCells(year: number, monthIndex0: number): (number | null)[] {
  const first = new Date(year, monthIndex0, 1)
  const pad = (first.getDay() + 6) % 7
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function formatCalendarHeaderMonth(locale: WebLocale, d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  if (locale === 'vi') {
    return `Tháng ${m} / ${y}`
  }
  const tag = webLocaleToBcp47(locale)
  const parts = new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).formatToParts(d)
  const mapped = parts
    .filter((p) => p.type === 'month' || p.type === 'year' || p.type === 'literal')
    .map((p) => p.value)
    .join('')
    .trim()
  return mapped || `${y}-${pad2(m)}`
}

/** Dòng banner: CHỦ NHẬT | 01 | THÁNG 02 kiểu (locale + Intl). */
export function formatBannerDateLine(locale: WebLocale, d: Date): {
  weekdayUpper: string
  dayPad: string
  monthUpper: string
  yearNum: string
} {
  const tag = webLocaleToBcp47(locale)
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'long' }).format(d)
  let monthLabel: string
  if (locale === 'vi') {
    monthLabel = `THÁNG ${pad2(d.getMonth() + 1)}`
  } else {
    monthLabel = new Intl.DateTimeFormat(tag, { month: 'long' }).format(d).toUpperCase()
  }
  return {
    weekdayUpper: weekday.toLocaleUpperCase(tag),
    dayPad: pad2(d.getDate()),
    monthUpper: monthLabel,
    yearNum: String(d.getFullYear()),
  }
}
