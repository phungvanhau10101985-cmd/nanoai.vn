import { pad2, parseIsoDateLocal, webLocaleToBcp47 } from '@/lib/wedding/wedding-calendar-utils'
import type { WebLocale } from '@/lib/i18n/config'

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

  // DD/MM/YYYY hoặc DD-MM-YYYY (Việt Nam: ngày trước, tháng sau)
  const dmy4 = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  if (dmy4) {
    const day = Number(dmy4[1])
    const month = Number(dmy4[2])
    const year = Number(dmy4[3])
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const iso = `${year}-${pad2(month)}-${pad2(day)}`
      if (parseIsoDateLocal(iso)) return iso
    }
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

/** Đọc cột DATE từ Postgres — luôn trả YYYY-MM-DD (ngày dương lịch, không lệch múi giờ). */
export function weddingDateFromPg(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    // node-pg DATE = nửa đêm theo TZ máy chủ; dùng local getters, không getUTC*.
    const y = raw.getFullYear()
    const mo = raw.getMonth() + 1
    const d = raw.getDate()
    const iso = `${y}-${pad2(mo)}-${pad2(d)}`
    return parseIsoDateLocal(iso) ? iso : null
  }
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && parseIsoDateLocal(s)) return s
  const normalized = normalizeWeddingDateToIso(s)
  return normalized || null
}

/** ISO YYYY-MM-DD dùng cho lịch / đếm ngược; chấp nhận cả chuỗi ngày hiển thị đã lưu. */
export function resolveWeddingDateIso(raw: string | null | undefined): string | null {
  return weddingDateFromPg(raw)
}

export function formatWeddingDateForDisplay(iso: string | null | undefined, locale: WebLocale): string {
  const resolved = weddingDateFromPg(iso)
  const d = parseIsoDateLocal(resolved)
  if (!d) return String(iso ?? '').trim()
  return new Intl.DateTimeFormat(webLocaleToBcp47(locale), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}
