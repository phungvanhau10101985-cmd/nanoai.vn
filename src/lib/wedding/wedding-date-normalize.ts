import { pad2, parseIsoDateLocal } from '@/lib/wedding/wedding-calendar-utils'

function toLocalYmd(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  const day = d.getDate()
  if (y < 1900 || y > 2100) return null
  return `${y}-${pad2(mo)}-${pad2(day)}`
}

/**
 * Chuẩn hóa ngày cưới cho Postgres (DATE). Chuẩn vào DB: YYYY-MM-DD.
 * Không tin Date("Fri Feb 20") của V8 (hay ra năm 2001); chuỗi thiếu năm sẽ thử ghép năm hiện tại / +1 / −1.
 */
export function normalizeWeddingDateToIso(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return parseIsoDateLocal(t) ? t : ''
  }

  // Chỉ tin Date(chuỗi) một lần khi có năm 1900–2099 trong text.
  if (/\b(19|20)\d{2}\b/.test(t)) {
    const y0 = toLocalYmd(new Date(t))
    if (y0) return y0
  }

  const yy = new Date().getFullYear()
  for (const yTry of [yy, yy + 1, yy - 1]) {
    const ymd = toLocalYmd(new Date(`${t} ${yTry}`))
    if (ymd) return ymd
  }

  return ''
}
