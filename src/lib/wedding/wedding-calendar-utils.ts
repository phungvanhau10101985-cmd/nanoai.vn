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

/** Lấy mốc HH:MM đầu tiên từ chuỗi giờ (ô đón khách / khai tiệc). */
export function firstClockTime(text: string): string {
  const parsed = parseWeddingTimeClockAndWeekday(text)
  if (parsed.time) return parsed.time
  return extractClockTimes(text)[0] ?? text.trim()
}

/** Giờ đón khách + giờ khai tiệc — ưu tiên ô riêng, tương thích chuỗi cũ nhiều mốc. */
export function resolveWeddingReceptionAndPartyTimes(
  weddingTime: string,
  partyStartTime?: string | null,
): { receptionTime: string; partyTime: string } {
  const times = extractClockTimes(weddingTime)
  const reception = firstClockTime(weddingTime) || times[0] || ''
  const partyExplicit = partyStartTime?.trim() ? firstClockTime(partyStartTime) : ''
  const party = partyExplicit || (times.length >= 2 ? times[1] : '') || reception
  return { receptionTime: reception, partyTime: party }
}

/** Giờ hiển thị cho khách (ưu tiên khai tiệc). */
export function resolveWeddingDisplayTime(weddingTime: string, partyStartTime?: string | null): string {
  const { partyTime, receptionTime } = resolveWeddingReceptionAndPartyTimes(weddingTime, partyStartTime)
  return partyTime || receptionTime
}

/** Trích các mốc HH:MM (hoặc H:MM) từ chuỗi giờ (có thể có nhiều mốc). */
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

export const WEDDING_WEEKDAY_LABELS: Record<WebLocale, string[]> = {
  vi: ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  zh: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  ja: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
}

/** Chỉ số 0=CN … 6=T7 theo ngày ISO local. */
export function weekdayIndexFromIsoDate(iso: string | null | undefined): string {
  const d = parseIsoDateLocal(iso)
  return d ? String(d.getDay()) : ''
}

export function parseWeddingTimeClockAndWeekday(value: string) {
  const time = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0] ?? ''
  const normalized = value.toLowerCase()
  const weekdayIndex = WEDDING_WEEKDAY_LABELS.vi.findIndex((_, index) =>
    Object.values(WEDDING_WEEKDAY_LABELS).some((labels) => normalized.includes(labels[index].toLowerCase())),
  )
  return { time, weekdayIndex: weekdayIndex >= 0 ? String(weekdayIndex) : '' }
}

/** Ngày + giờ hiển thị dưới dòng địa điểm mời (ví dụ: Thứ 4, 24 thg 6, 2026 · 16:30). */
export function formatGuestInviteVenueDateTime(dateLabel?: string, weddingTime?: string): string {
  const date = dateLabel?.trim() ?? ''
  const parsed = parseWeddingTimeClockAndWeekday(weddingTime ?? '')
  const time = parsed.time || weddingTime?.trim() || ''
  if (date && time) return `${date} · ${time}`
  return date || time
}

/** Khi đổi ngày cưới, cập nhật thứ trong chuỗi giờ cưới (nếu có). */
export function syncWeddingTimeWeekday(iso: string, weddingTime: string, locale: WebLocale): string {
  const idx = weekdayIndexFromIsoDate(iso)
  if (!idx) return weddingTime
  const labels = WEDDING_WEEKDAY_LABELS[locale] ?? WEDDING_WEEKDAY_LABELS.vi
  const newLabel = labels[Number(idx)]
  const allLabels = Object.values(WEDDING_WEEKDAY_LABELS).flat()
  for (const old of allLabels) {
    if (weddingTime.toLowerCase().includes(old.toLowerCase())) {
      return weddingTime.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), newLabel)
    }
  }
  const parsed = parseWeddingTimeClockAndWeekday(weddingTime)
  if (parsed.time) return `${parsed.time}, ${newLabel}`
  return weddingTime
}
