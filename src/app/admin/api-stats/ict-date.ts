/** Lịch thống kê admin = giờ Việt Nam (ICT, +07), không phụ thuộc timezone máy chủ. */

export const API_STATS_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export function ictYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: API_STATS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Cộng/trừ ngày trên lịch ICT (không dùng giờ địa phương của process). */
export function ictShiftDays(days: number, from = new Date()): string {
  const [y, m, d] = ictYmd(from).split('-').map((part) => Number.parseInt(part, 10))
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function ictMonthStartYmd(from = new Date()): string {
  return `${ictYmd(from).slice(0, 8)}01`
}

export function ictYearStartYmd(from = new Date()): string {
  return `${ictYmd(from).slice(0, 4)}-01-01`
}

/** Thứ Hai của tuần chứa `from`, theo lịch ICT. */
export function ictWeekStartYmd(from = new Date()): string {
  const [y, m, d] = ictYmd(from).split('-').map((part) => Number.parseInt(part, 10))
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7))
  return utc.toISOString().slice(0, 10)
}

function ictNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+07:00`)
}

export type PartnerAiUsagePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'all'

/** `fromDay`/`toDay` null = toàn bộ lịch sử. Cả hai mốc là ngày lịch ICT. */
export function resolvePartnerAiUsagePresetRange(
  preset: PartnerAiUsagePreset,
  now = new Date()
): { fromDay: string | null; toDay: string | null } {
  const today = ictYmd(now)
  if (preset === 'all') return { fromDay: null, toDay: null }
  if (preset === 'today') return { fromDay: today, toDay: today }
  if (preset === 'yesterday') {
    const day = ictShiftDays(-1, now)
    return { fromDay: day, toDay: day }
  }
  if (preset === 'this_week') return { fromDay: ictWeekStartYmd(now), toDay: today }
  if (preset === 'last_week') {
    const thisMonday = ictWeekStartYmd(now)
    return {
      fromDay: ictShiftDays(-7, ictNoon(thisMonday)),
      toDay: ictShiftDays(-1, ictNoon(thisMonday)),
    }
  }
  if (preset === 'this_month') return { fromDay: ictMonthStartYmd(now), toDay: today }
  if (preset === 'last_month') {
    const thisStart = ictMonthStartYmd(now)
    const prevEnd = ictShiftDays(-1, ictNoon(thisStart))
    return { fromDay: `${prevEnd.slice(0, 8)}01`, toDay: prevEnd }
  }
  return { fromDay: ictYearStartYmd(now), toDay: today }
}

/** Ngày ICT của một timestamp (ISO / Date PG). */
export function ictYmdFromTimestamp(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return ictYmd(d)
}

/** Cận query timestamptz: cả ngày ICT, có offset để Postgres không đoán session TimeZone. */
export function ictDayStartIso(ymd: string): string {
  return `${ymd}T00:00:00.000+07:00`
}

export function ictDayEndIso(ymd: string): string {
  return `${ymd}T23:59:59.999+07:00`
}

export function formatIctYmdVi(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}
