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
  isTest: boolean
  eventLabel: string
  eventDate: string | null
  countdownTo: string | null
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

function addLocalDays(value: LocalYmd, days: number): LocalYmd {
  const utc = new Date(Date.UTC(value.year, value.month - 1, value.day + days))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

function saleEventLabel(saleDate: LocalYmd, isTest: boolean): string {
  const label = `Sale ${saleDate.day}/${saleDate.month}`
  return isTest ? `[Test] ${label}` : label
}

function tzOffsetMs(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - at.getTime()
}

function localMidnightUtc(value: LocalYmd, timezone: string): Date {
  const guess = Date.UTC(value.year, value.month - 1, value.day, 0, 0, 0)
  return new Date(guess - tzOffsetMs(new Date(guess), timezone))
}

function saleCountdownTo(phase: PartnerSaleCalendarState['phase'], saleDate: LocalYmd, timezone: string): string | null {
  if (phase === 'off') return null
  const start = localMidnightUtc(saleDate, timezone)
  if (phase === 'teaser') return start.toISOString()
  return new Date(start.getTime() + 86_400_000 - 1).toISOString()
}

function testMonthDiscountPercent(settings: PartnerSaleCalendarSettings, month: number): number {
  const rule = settings.monthRules[month]
  const fallback = month % 2 === 0 ? settings.evenMonthDiscountPercent : settings.oddMonthDiscountPercent
  return Math.max(0, Math.min(100, rule?.discountPercent ?? fallback))
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

  const phase: PartnerSaleCalendarState['phase'] = active ? 'active' : teaser ? 'teaser' : 'off'
  return {
    enabled: settings.enabled,
    phase,
    timezone,
    localDate,
    saleDate: ymdText(saleDate),
    daysUntilSale,
    discountPercent,
    isManual: manualActive,
    isTest: false,
    eventLabel: saleEventLabel(saleDate, false),
    eventDate: phase === 'off' ? null : ymdText(saleDate),
    countdownTo: saleCountdownTo(phase, saleDate, timezone),
  }
}

/** 188 `_build_site_sale_test_state`: teaser = T-N, active = hôm nay. Không đụng feed. */
export function buildPartnerSiteSaleTestState(input: {
  settings?: PartnerSaleCalendarSettings | null
  phase: 'teaser' | 'active'
  at?: Date
}): PartnerSaleCalendarState {
  const settings = input.settings ?? defaultPartnerSaleCalendarSettings()
  const timezone = validTimezone(settings.timezone)
  const today = localYmd(input.at ?? new Date(), timezone)
  const teaserDays = Math.max(1, Math.min(14, settings.teaserDays || 3))
  const phase = input.phase === 'teaser' ? 'teaser' : 'active'
  const saleDate = phase === 'active' ? today : addLocalDays(today, teaserDays)
  const discountPercent = testMonthDiscountPercent(settings, saleDate.month)
  return {
    enabled: true,
    phase,
    timezone,
    localDate: ymdText(today),
    saleDate: ymdText(saleDate),
    daysUntilSale: phase === 'active' ? 0 : teaserDays,
    discountPercent,
    isManual: false,
    isTest: true,
    eventLabel: saleEventLabel(saleDate, true),
    eventDate: ymdText(saleDate),
    countdownTo: saleCountdownTo(phase, saleDate, timezone),
  }
}

export function applyPartnerFeatureTestToSaleCalendar(input: {
  settings?: PartnerSaleCalendarSettings | null
  testPhase?: 'teaser' | 'active' | null
  at?: Date
}): PartnerSaleCalendarState {
  if (input.testPhase === 'teaser' || input.testPhase === 'active') {
    return buildPartnerSiteSaleTestState({
      settings: input.settings,
      phase: input.testPhase,
      at: input.at,
    })
  }
  return resolvePartnerSaleCalendarState({ settings: input.settings, at: input.at })
}

export function applyPartnerSiteSalePrice(listPrice: number, state: PartnerSaleCalendarState): number {
  const amount = Math.max(0, Math.round(listPrice))
  if (state.phase !== 'active' || state.discountPercent <= 0) return amount
  return Math.max(0, Math.round(amount * (1 - state.discountPercent / 100)))
}

export type PartnerSaleUpcomingEvent = {
  eventDate: string
  day: number
  month: number
  discountPercent: number
  sameDayMonth: boolean
}

export function partnerSalePercentForMonth(
  settings: PartnerSaleCalendarSettings | null | undefined,
  month: number
): number {
  const cfg = settings ?? defaultPartnerSaleCalendarSettings()
  if (month < 1 || month > 12) return 0
  const rule = cfg.monthRules[month]
  if (rule?.enabled === false) return 0
  const fallback = month % 2 === 0 ? cfg.evenMonthDiscountPercent : cfg.oddMonthDiscountPercent
  return Math.max(0, Math.min(100, rule?.discountPercent ?? fallback))
}

/** Banner sale AI chỉ cho ngày trùng tháng (1/1 … 12/12). */
export function partnerSalePercentForSameDayMonth(
  settings: PartnerSaleCalendarSettings | null | undefined,
  day: number,
  month: number
): number | null {
  if (day !== month || day < 1 || day > 12) return null
  const percent = partnerSalePercentForMonth(settings, month)
  return percent > 0 ? percent : null
}

export function listUpcomingPartnerSaleEvents(input: {
  settings?: PartnerSaleCalendarSettings | null
  at?: Date
  limit?: number
}): PartnerSaleUpcomingEvent[] {
  const settings = input.settings ?? defaultPartnerSaleCalendarSettings()
  if (!settings.enabled) return []
  const timezone = validTimezone(settings.timezone)
  const today = localYmd(input.at ?? new Date(), timezone)
  const limit = Math.max(1, Math.min(24, input.limit ?? 12))
  const out: PartnerSaleUpcomingEvent[] = []
  for (let i = 0; i < 16 && out.length < limit; i++) {
    const year = today.year + Math.floor((today.month - 1 + i) / 12)
    const month = ((today.month - 1 + i) % 12) + 1
    const discountPercent = partnerSalePercentForMonth(settings, month)
    if (discountPercent <= 0) continue
    const sale = monthSaleDate(year, month)
    if (ordinal(sale) < ordinal(today)) continue
    out.push({
      eventDate: ymdText(sale),
      day: sale.day,
      month: sale.month,
      discountPercent,
      sameDayMonth: sale.day === sale.month,
    })
  }
  return out
}
