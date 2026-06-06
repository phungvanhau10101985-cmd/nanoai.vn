/** Ngày/tháng theo lịch Việt Nam (Asia/Ho_Chi_Minh). */
export function getVietnamDateYmd(d = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value ?? ''
    const m = (parts.find((p) => p.type === 'month')?.value ?? '').padStart(2, '0')
    const day = (parts.find((p) => p.type === 'day')?.value ?? '').padStart(2, '0')
    if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m) && /^\d{2}$/.test(day)) return `${y}-${m}-${day}`
  } catch {
    /* fallback */
  }
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  const vn = new Date(utc + 7 * 3600000)
  const y = vn.getUTCFullYear()
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0')
  const day = String(vn.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getVietnamYearMonthFromDateYmd(ymd: string): string {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (!m) return getVietnamYearMonth()
  return `${m[1]}-${m[2]}`
}

/** Chuỗi YYYY-MM theo lịch Việt Nam (Asia/Ho_Chi_Minh). */
export function getVietnamYearMonth(d = new Date()): string {
  return getVietnamYearMonthFromDateYmd(getVietnamDateYmd(d))
}
