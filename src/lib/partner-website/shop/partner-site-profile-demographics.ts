/**
 * Hồ sơ shop — giới tính + ngày sinh (UX 188).
 * Khóa ngày/tháng sau lần lưu đầu; cohort dùng năm sinh + giới tính.
 */

export type PartnerShopGender = 'male' | 'female'

export const PARTNER_SHOP_DOB_ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function parsePartnerShopGender(raw: unknown): PartnerShopGender | null {
  const g = String(raw ?? '')
    .trim()
    .toLowerCase()
  return g === 'male' || g === 'female' ? g : null
}

export function parseDobParts(iso: string): { year: string; month: string; day: string } | null {
  const s = String(iso || '').trim().slice(0, 10)
  if (!PARTNER_SHOP_DOB_ISO_RE.test(s)) return null
  const [year, month, day] = s.split('-')
  return { year, month, day }
}

export function birthYearFromIso(iso: string | null | undefined): number | null {
  const y = Number.parseInt(String(iso || '').slice(0, 4), 10)
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null
}

export function parseIsoDateOfBirth(raw: unknown, now = new Date()): string | null {
  const iso = String(raw ?? '').trim().slice(0, 10)
  if (!PARTNER_SHOP_DOB_ISO_RE.test(iso)) return null
  const parts = parseDobParts(iso)
  if (!parts) return null
  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const currentYear = now.getUTCFullYear()
  if (year < currentYear - 100 || year > currentYear) return null
  const todayIso = now.toISOString().slice(0, 10)
  if (iso > todayIso) return null
  return iso
}

export function composeDobWithYear(savedIso: string, year: string): string | null {
  const parts = parseDobParts(savedIso)
  if (!parts || !/^\d{4}$/.test(year)) return null
  return `${year}-${parts.month}-${parts.day}`
}

export function assertDobChangeAllowed(
  existingIso: string | null | undefined,
  nextIso: string
): { ok: true } | { ok: false; code: 'DOB_INVALID' | 'DOB_DAY_LOCKED' } {
  if (!parseIsoDateOfBirth(nextIso)) return { ok: false, code: 'DOB_INVALID' }
  const existing = String(existingIso || '').trim().slice(0, 10)
  if (!existing) return { ok: true }
  const oldP = parseDobParts(existing)
  const newP = parseDobParts(nextIso)
  if (!oldP || !newP) return { ok: false, code: 'DOB_INVALID' }
  if (oldP.month !== newP.month || oldP.day !== newP.day) {
    return { ok: false, code: 'DOB_DAY_LOCKED' }
  }
  return { ok: true }
}

export function partnerShopBirthYearOptions(now = new Date()): number[] {
  const currentYear = now.getUTCFullYear()
  const years: number[] = []
  for (let y = currentYear; y >= currentYear - 100; y -= 1) years.push(y)
  return years
}

export function daysInCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const max = daysInCalendarMonth(year, month)
  if (day > max) return false
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

export function partnerShopNeedsBirthOrGender(input: {
  gender?: unknown
  date_of_birth?: unknown
} | null | undefined): boolean {
  if (!input) return false
  const hasDob = Boolean(parseIsoDateOfBirth(input.date_of_birth))
  const hasGender = Boolean(parsePartnerShopGender(input.gender))
  return !hasDob || !hasGender
}
