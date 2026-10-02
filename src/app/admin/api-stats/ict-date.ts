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
