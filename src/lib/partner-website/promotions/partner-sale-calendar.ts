export const PARTNER_SALE_DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'
export const PARTNER_SALE_ODD_MONTH_PERCENT = 6
export const PARTNER_SALE_EVEN_MONTH_PERCENT = 8

export type PartnerSaleCalendarSettings = {
  enabled: boolean
  timezone: string
  teaserDays: number
  oddMonthDiscountPercent: number
  evenMonthDiscountPercent: number
  manualSaleDate: string | null
  manualDiscountPercent: number | null
  monthRules: Partial<Record<number, { enabled: boolean; discountPercent: number | null }>>
}

export type PartnerSaleCalendarState = {
  enabled: boolean
  phase: 'off' | 'teaser' | 'active'
  timezone: string
  localDate: string
  saleDate: string
  daysUntilSale: number
  discountPercent: number
  isManual: boolean
}

type LocalYmd = { year: number; month: number; day: number }

function validTimezone(raw: string): string {
  const value = raw.trim() || PARTNER_SALE_DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return PARTNER_SALE_DEFAULT_TIMEZONE
  }
}

function localYmd(at: Date, timezone: string): LocalYmd {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function ymdText(value: LocalYmd): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
}

function ordinal(value: LocalYmd): number {
  return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 86_400_000)
}

function parseYmd(raw: string | null): LocalYmd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw ?? '')
  if (!match) return null
  const value = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  if (value.month < 1 || value.month > 12 || value.day < 1 || value.day > daysInMonth(value.year, value.month)) {
    return null
  }
  return value
}

function monthSaleDate(year: number, month: number): LocalYmd {
  return { year, month, day: Math.min(month, daysInMonth(year, month)) }
}

export function defaultPartnerSaleCalendarSettings(): PartnerSaleCalendarSettings {
  return {
    enabled: true,
    timezone: PARTNER_SALE_DEFAULT_TIMEZONE,
    teaserDays: 3,
    oddMonthDiscountPercent: PARTNER_SALE_ODD_MONTH_PERCENT,
    evenMonthDiscountPercent: PARTNER_SALE_EVEN_MONTH_PERCENT,
    manualSaleDate: null,
    manualDiscountPercent: null,
    monthRules: {},
  }
}

export function resolvePartnerSaleCalendarState(input: {
  settings?: PartnerSaleCalendarSettings | null
  at?: Date
}): PartnerSaleCalendarState {
  const settings = input.settings ?? defaultPartnerSaleCalendarSettings()
  const timezone = validTimezone(settings.timezone)
  const today = localYmd(input.at ?? new Date(), timezone)
  const localDate = ymdText(today)
  const manualDate = parseYmd(settings.manualSaleDate)
  const manualActive = manualDate != null && ymdText(manualDate) === localDate
  const saleDate = manualActive ? manualDate : monthSaleDate(today.year, today.month)
  const rule = settings.monthRules[today.month]
  const monthEnabled = rule?.enabled !== false
  const fallbackPercent =
    today.month % 2 === 0 ? settings.evenMonthDiscountPercent : settings.oddMonthDiscountPercent
  const discountPercent = Math.max(
    0,
    Math.min(100, manualActive ? (settings.manualDiscountPercent ?? fallbackPercent) : (rule?.discountPercent ?? fallbackPercent))
  )
  const daysUntilSale = ordinal(saleDate) - ordinal(today)
  const active = settings.enabled && discountPercent > 0 && (manualActive || (monthEnabled && daysUntilSale === 0))
  const teaser =
    settings.enabled &&
    monthEnabled &&
    discountPercent > 0 &&
    daysUntilSale > 0 &&
    daysUntilSale <= Math.max(0, settings.teaserDays)

  return {
    enabled: settings.enabled,
    phase: active ? 'active' : teaser ? 'teaser' : 'off',
    timezone,
    localDate,
    saleDate: ymdText(saleDate),
    daysUntilSale,
    discountPercent,
    isManual: manualActive,
  }
}

export function applyPartnerSiteSalePrice(listPrice: number, state: PartnerSaleCalendarState): number {
  const amount = Math.max(0, Math.round(listPrice))
  if (state.phase !== 'active' || state.discountPercent <= 0) return amount
  return Math.max(0, Math.round(amount * (1 - state.discountPercent / 100)))
}
