import type { WebLocale } from '@/lib/i18n/config'
import {
  fetchPartnerHolidayOccasionRowsFromPg,
  fetchPartnerHolidayPreviewFromPg,
  type PartnerHolidayOccasionDbRow,
} from '@/lib/db/messaging-partner-holiday-theme-pg'
import { findLatestPartnerMarketingBannerFromPg } from '@/lib/db/messaging-partner-marketing-banner-pg'
import {
  applyPartnerHolidayOverride,
  holidayYmdLabel,
  holidayYmdText,
  isPartnerHolidayThemeId,
  PARTNER_HOLIDAY_CATALOG,
  PARTNER_HOLIDAY_THEME_IDS,
  partnerHolidayBannerCampaignKey,
  partnerHolidayBannerHeadline,
  partnerHolidayNextCore,
  partnerHolidaySaleSpan,
  resolvePartnerHolidaySale,
  resolveVisiblePartnerHoliday,
  validHolidayMonthDay,
  vnHolidayToday,
  type PartnerHolidayRule,
  type PartnerHolidayThemeId,
  type PartnerHolidayYmd,
  type PartnerVisibleHoliday,
} from '@/lib/partner-website/promotions/partner-holiday-schedule'
import { partnerHolidayLook, partnerHolidayLookCopy } from '@/lib/partner-website/promotions/partner-holiday-looks'
import { parsePartnerHolidayPreviewToken } from '@/lib/partner-website/promotions/partner-holiday-preview'
import {
  partnerLocalDateEndIso,
  partnerLocalDateStartIso,
  PARTNER_SALE_DEFAULT_TIMEZONE,
  type PartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'

export type PartnerHolidayOccasionAdmin = {
  code: PartnerHolidayThemeId
  name: string
  calendar: 'solar' | 'lunar'
  calendarLabel: string
  tagline: string
  summary: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  leadDays: number
  afterDays: number
  salePercent: number
  saleLeadDays: number | null
  saleDays: number | null
  enabled: boolean
  priority: number
  solarLabel: string
  startYear: number | null
  endYear: number | null
  windowOnLabel: string
  windowOffLabel: string
  saleOnLabel: string
  saleOffLabel: string
  bannerHeadline: string
  bannerUrl: string | null
  bannerStatus: string | null
  bannerError: string | null
  showingToday: boolean
}

export type PartnerHolidayThemeAdminState = {
  activeTheme: PartnerHolidayThemeId | null
  activeLabel: string | null
  scheduleNote: string
  occasions: PartnerHolidayOccasionAdmin[]
}

export type PartnerHolidayThemePublicState = {
  activeTheme: PartnerHolidayThemeId | null
  eventYear: number | null
  eventYearEnd: number | null
  occasionYears: Record<string, number>
  preview: boolean
  previewExpiresAt: number | null
  look: {
    id: PartnerHolidayThemeId
    ribbonTitle: string
    ribbonBody: string
    preview: string
    kicker: string
    themeColor: string
    vars: Record<string, string>
  } | null
}

export type PartnerHolidayOccasionUpdate = {
  code: PartnerHolidayThemeId
  enabled?: boolean
  startMonth?: number
  startDay?: number
  endMonth?: number
  endDay?: number
  leadDays?: number
  afterDays?: number
  salePercent?: number
  saleLeadDays?: number | null
  saleDays?: number | null
}

export class PartnerHolidayScheduleError extends Error {}

function calendarLabel(kind: 'solar' | 'lunar', locale: WebLocale): string {
  if (kind === 'lunar') {
    if (locale === 'en') return 'Lunar calendar'
    if (locale === 'zh') return '农历'
    if (locale === 'ja') return '旧暦'
    if (locale === 'ko') return '음력'
    return 'Âm lịch'
  }
  if (locale === 'en') return 'Solar calendar'
  if (locale === 'zh') return '阳历'
  if (locale === 'ja') return '太陽暦'
  if (locale === 'ko') return '양력'
  return 'Dương lịch'
}

function scheduleNote(visible: PartnerVisibleHoliday | null, locale: WebLocale): string {
  if (!visible) {
    if (locale === 'en') return 'The shop uses the regular theme today. Holiday dates are day/month and repeat every year.'
    if (locale === 'zh') return '今天店铺使用日常界面。节日只存日/月，每年重复。'
    if (locale === 'ja') return '本日は通常テーマです。祝日は月日のみ保存し、毎年繰り返します。'
    if (locale === 'ko') return '오늘은 일반 테마입니다. 명절은 월/일만 저장되며 매년 반복됩니다.'
    return 'Hôm nay cửa hàng dùng giao diện thường. Mốc lễ chỉ lưu ngày và tháng, tự lặp mỗi năm.'
  }
  if (visible.mode === 'active') {
    if (locale === 'en') return `Shoppers see ${visible.name} today. On the holiday itself this theme covers a longer overlapping festival.`
    if (locale === 'zh') return `今天顾客看到${visible.name}。正日会覆盖更长的重叠节日。`
    if (locale === 'ja') return `本日は${visible.name}です。当日はこのテーマが長い祝日を上書きします。`
    if (locale === 'ko') return `오늘은 고객이 ${visible.name}을(를) 봅니다. 당일에는 더 긴 명절을 덮습니다.`
    return `Hôm nay khách thấy ${visible.name}. Đúng ngày lễ nên giao diện dịp này phủ lên dịp lớn hơn nếu hai kỳ trùng.`
  }
  if (visible.mode === 'teaser') {
    if (visible.salePhase === 'active') {
      if (locale === 'en') return `Shoppers see ${visible.name}. Holiday sale is already on (until ${holidayYmdLabel(visible.saleEnd)}).`
      if (locale === 'zh') return `顾客看到${visible.name}。节日促销已开始（至 ${holidayYmdLabel(visible.saleEnd)}）。`
      if (locale === 'ja') return `${visible.name}を表示中。セールは実施中（${holidayYmdLabel(visible.saleEnd)}まで）。`
      if (locale === 'ko') return `${visible.name} 표시 중. 명절 세일이 이미 진행 중입니다(${holidayYmdLabel(visible.saleEnd)}까지).`
      return `Hôm nay khách thấy ${visible.name}. Đang sale trước ngày lễ (đến hết ${holidayYmdLabel(visible.saleEnd)}).`
    }
    if (locale === 'en') return `Shoppers see ${visible.name}. These are the days before the holiday.`
    if (locale === 'zh') return `顾客看到${visible.name}。现在是节日前几天。`
    if (locale === 'ja') return `${visible.name}を表示中。祝日前の期間です。`
    if (locale === 'ko') return `${visible.name} 표시 중. 명절 전 기간입니다.`
    return `Hôm nay khách thấy ${visible.name}. Đang những ngày trước lễ, báo sắp giảm giá.`
  }
  if (visible.salePhase === 'active') {
    if (locale === 'en') return `Shoppers still see ${visible.name}. Sale continues until ${holidayYmdLabel(visible.saleEnd)}.`
    if (locale === 'zh') return `顾客仍看到${visible.name}。促销持续到 ${holidayYmdLabel(visible.saleEnd)}。`
    if (locale === 'ja') return `${visible.name}を継続表示。セールは${holidayYmdLabel(visible.saleEnd)}まで。`
    if (locale === 'ko') return `${visible.name}을(를) 유지합니다. 세일은 ${holidayYmdLabel(visible.saleEnd)}까지입니다.`
    return `Hôm nay khách thấy ${visible.name}. Đang giữ giao diện sau lễ, sale còn đến hết ${holidayYmdLabel(visible.saleEnd)}.`
  }
  if (locale === 'en') return `Shoppers still see ${visible.name}. The holiday sale has ended.`
  if (locale === 'zh') return `顾客仍看到${visible.name}。节日促销已结束。`
  if (locale === 'ja') return `${visible.name}を継続表示。セールは終了しています。`
  if (locale === 'ko') return `${visible.name}을(를) 유지합니다. 명절 세일은 끝났습니다.`
  return `Hôm nay khách thấy ${visible.name}. Đang giữ giao diện sau lễ, sale lễ đã tắt.`
}

export function mergePartnerHolidayRules(rows: PartnerHolidayOccasionDbRow[]): PartnerHolidayRule[] {
  const byCode = new Map(rows.map((row) => [row.code, row]))
  return PARTNER_HOLIDAY_THEME_IDS.map((code) =>
    applyPartnerHolidayOverride(PARTNER_HOLIDAY_CATALOG[code], byCode.get(code))
  )
}

export async function loadPartnerHolidayRules(partnerId: string): Promise<PartnerHolidayRule[]> {
  const rows = await fetchPartnerHolidayOccasionRowsFromPg(partnerId)
  return mergePartnerHolidayRules(rows)
}

export function validatePartnerHolidayOccasionUpdate(input: PartnerHolidayOccasionUpdate): PartnerHolidayOccasionUpdate {
  if (!isPartnerHolidayThemeId(input.code)) {
    throw new PartnerHolidayScheduleError('Dịp lễ không có trong danh sách')
  }
  const rule = PARTNER_HOLIDAY_CATALOG[input.code]
  const startMonth = input.startMonth ?? rule.startMonth
  const startDay = input.startDay ?? rule.startDay
  const endMonth = input.endMonth ?? rule.endMonth
  const endDay = input.endDay ?? rule.endDay
  if (!validHolidayMonthDay(rule.calendar, startMonth, startDay)) {
    throw new PartnerHolidayScheduleError('Ngày bắt đầu không hợp lệ với loại lịch của dịp này')
  }
  if (!validHolidayMonthDay(rule.calendar, endMonth, endDay)) {
    throw new PartnerHolidayScheduleError('Ngày kết thúc không hợp lệ với loại lịch của dịp này')
  }
  if (input.leadDays != null && (!Number.isInteger(input.leadDays) || input.leadDays < 0 || input.leadDays > 60)) {
    throw new PartnerHolidayScheduleError('Số ngày bật trước phải từ 0 đến 60.')
  }
  if (input.afterDays != null && (!Number.isInteger(input.afterDays) || input.afterDays < 0 || input.afterDays > 60)) {
    throw new PartnerHolidayScheduleError('Số ngày tắt sau lễ phải từ 0 đến 60.')
  }
  if (input.salePercent != null && (!Number.isFinite(input.salePercent) || input.salePercent < 0 || input.salePercent > 50)) {
    throw new PartnerHolidayScheduleError('% sale phải từ 0 đến 50.')
  }
  if (
    input.saleLeadDays != null &&
    (!Number.isInteger(input.saleLeadDays) || input.saleLeadDays < 0 || input.saleLeadDays > 60)
  ) {
    throw new PartnerHolidayScheduleError('Sale trước lễ phải để trống hoặc 0–60 ngày.')
  }
  if (input.saleDays != null && (!Number.isInteger(input.saleDays) || input.saleDays < 0 || input.saleDays > 60)) {
    throw new PartnerHolidayScheduleError('Số ngày sale phải để trống hoặc 0–60 ngày.')
  }
  return input
}

function holidaySaleState(
  visible: PartnerVisibleHoliday,
  timezone: string
): PartnerSaleCalendarState | null {
  if (visible.salePhase !== 'teaser' && visible.salePhase !== 'active') return null
  if (!(visible.salePercent > 0)) return null
  const saleStart = holidayYmdText(visible.saleStart)
  const saleEnd = holidayYmdText(visible.saleEnd)
  const today = holidayYmdText(vnHolidayToday())
  const daysUntilSale = Math.max(
    0,
    Math.floor(
      (Date.UTC(visible.saleStart.year, visible.saleStart.month - 1, visible.saleStart.day) -
        Date.UTC(
          vnHolidayToday().year,
          vnHolidayToday().month - 1,
          vnHolidayToday().day
        )) /
        86_400_000
    )
  )
  const phase = visible.salePhase === 'active' ? 'active' : 'teaser'
  const countdownTo =
    phase === 'teaser'
      ? partnerLocalDateStartIso(saleStart, timezone)
      : partnerLocalDateEndIso(saleEnd, timezone)
  return {
    enabled: true,
    phase,
    timezone,
    localDate: today,
    saleDate: saleStart,
    daysUntilSale: phase === 'active' ? 0 : daysUntilSale,
    discountPercent: visible.salePercent,
    isManual: false,
    isTest: false,
    eventLabel: `${visible.saleLabel} ${visible.coreStart.year}`,
    eventDate: saleStart,
    countdownTo,
    kind: 'holiday',
    holidayCode: visible.code,
  }
}

export async function applyPartnerHolidaySaleToCalendar(input: {
  partnerId: string
  fallback: PartnerSaleCalendarState
  at?: Date
}): Promise<PartnerSaleCalendarState> {
  if (input.fallback.isTest) return input.fallback
  const today = vnHolidayToday(input.at)
  const rules = await loadPartnerHolidayRules(input.partnerId)
  const sale = resolvePartnerHolidaySale(rules, today)
  const visible = resolveVisiblePartnerHoliday(rules, today)
  const picked =
    sale ??
    (visible && (visible.salePhase === 'teaser' || visible.salePhase === 'active') ? visible : null)
  if (!picked) return input.fallback
  return holidaySaleState(picked, input.fallback.timezone || PARTNER_SALE_DEFAULT_TIMEZONE) ?? input.fallback
}

function publicLook(
  code: PartnerHolidayThemeId | null,
  locale: WebLocale
): PartnerHolidayThemePublicState['look'] {
  if (!code) return null
  const item = partnerHolidayLook(code)
  const copy = partnerHolidayLookCopy(code, locale)
  if (!item || !copy) return null
  return {
    id: item.id,
    ribbonTitle: copy.ribbonTitle,
    ribbonBody: copy.ribbonBody,
    preview: copy.preview,
    kicker: copy.kicker,
    themeColor: item.themeColor,
    vars: {
      '--h-strong': item.strong,
      '--h-deep': item.deep,
      '--h-mid': item.mid,
      '--h-gold': item.gold,
      '--h-gold-soft': item.goldSoft,
      '--h-paper': item.paper,
      '--h-ink': item.ink,
      '--h-dark': item.dark,
      '--pw-primary': item.strong,
      '--pw-accent': item.mid,
      '--pw-buy': item.strong,
      '--pw-cart': item.deep,
      '--pw-footer': item.deep,
    },
  }
}

export function buildPartnerHolidayPublicState(input: {
  rules: PartnerHolidayRule[]
  locale?: WebLocale
  today?: PartnerHolidayYmd
  previewCode?: PartnerHolidayThemeId | null
  previewExpiresAt?: number | null
}): PartnerHolidayThemePublicState {
  const locale = input.locale ?? 'vi'
  const today = input.today ?? vnHolidayToday()
  const visible = resolveVisiblePartnerHoliday(input.rules, today)
  const previewCode = input.previewCode && isPartnerHolidayThemeId(input.previewCode) ? input.previewCode : null
  const active = previewCode ?? visible?.code ?? null
  const years: Record<string, number> = {}
  for (const rule of input.rules) {
    const span = partnerHolidayNextCore(rule, today)
    if (span) years[rule.code] = span[0].year
  }
  const core = active
    ? input.rules.find((row) => row.code === active)
    : null
  const span = core ? partnerHolidayNextCore(core, today) : null
  return {
    activeTheme: active,
    eventYear: span?.[0].year ?? visible?.coreStart.year ?? null,
    eventYearEnd: span?.[1].year ?? visible?.coreEnd.year ?? null,
    occasionYears: years,
    preview: Boolean(previewCode),
    previewExpiresAt: previewCode ? input.previewExpiresAt ?? null : null,
    look: publicLook(active, locale),
  }
}

export async function resolvePartnerHolidayPublicState(input: {
  partnerId: string
  locale?: WebLocale
  previewToken?: string | null
  previewCode?: string | null
  canSeeAdminPreview?: boolean
  at?: Date
}): Promise<PartnerHolidayThemePublicState> {
  const [rules, stored] = await Promise.all([
    loadPartnerHolidayRules(input.partnerId),
    fetchPartnerHolidayPreviewFromPg(input.partnerId),
  ])
  let previewCode: PartnerHolidayThemeId | null = null
  let previewExpiresAt: number | null = null
  const token = String(input.previewToken || '').trim()
  const requested = String(input.previewCode || '').trim()
  if (token) {
    const parsed = parsePartnerHolidayPreviewToken(token)
    if (
      parsed &&
      stored?.code === parsed.code &&
      (!requested || requested === parsed.code)
    ) {
      previewCode = parsed.code
      previewExpiresAt = parsed.expiresAt
    }
  } else if (input.canSeeAdminPreview && stored?.code) {
    previewCode = stored.code
    previewExpiresAt = stored.expiresAt
  }
  return buildPartnerHolidayPublicState({
    rules,
    locale: input.locale,
    today: vnHolidayToday(input.at),
    previewCode,
    previewExpiresAt,
  })
}

export async function buildPartnerHolidayAdminState(input: {
  partnerId: string
  locale?: WebLocale
  at?: Date
}): Promise<PartnerHolidayThemeAdminState> {
  const locale = input.locale ?? 'vi'
  const today = vnHolidayToday(input.at)
  const rules = await loadPartnerHolidayRules(input.partnerId)
  const visible = resolveVisiblePartnerHoliday(rules, today)
  const banners = await Promise.all(
    rules.map(async (rule) => {
      const row = await findLatestPartnerMarketingBannerFromPg({
        partnerId: input.partnerId,
        kind: 'holiday',
        campaignKey: partnerHolidayBannerCampaignKey(rule.code),
      })
      return [rule.code, row] as const
    })
  )
  const bannerByCode = new Map(banners)
  const occasions: PartnerHolidayOccasionAdmin[] = rules.map((rule) => {
    const span = partnerHolidayNextCore(rule, today)
    let solarLabel =
      locale === 'en'
        ? span
          ? `Year ${span[0].year}`
          : 'Year not computed'
        : span
          ? `Năm ${span[0].year}`
          : 'Chưa tính được năm'
    if (span && span[0].year !== span[1].year) {
      solarLabel = locale === 'en' ? `Years ${span[0].year}–${span[1].year}` : `Năm ${span[0].year}–${span[1].year}`
    }
    let windowOn = ''
    let windowOff = ''
    let saleOn = ''
    let saleOff = ''
    if (span) {
      const lead = Math.max(0, Math.min(60, rule.leadDays || 0))
      const after = Math.max(0, Math.min(60, rule.afterDays || 0))
      const windowStart = new Date(Date.UTC(span[0].year, span[0].month - 1, span[0].day - lead))
      const windowEnd = new Date(Date.UTC(span[1].year, span[1].month - 1, span[1].day + after))
      windowOn = holidayYmdLabel({
        year: windowStart.getUTCFullYear(),
        month: windowStart.getUTCMonth() + 1,
        day: windowStart.getUTCDate(),
      })
      windowOff = holidayYmdLabel({
        year: windowEnd.getUTCFullYear(),
        month: windowEnd.getUTCMonth() + 1,
        day: windowEnd.getUTCDate(),
      })
      const [saleStart, saleEnd] = partnerHolidaySaleSpan(rule, span[0], span[1])
      saleOn = holidayYmdLabel(saleStart)
      saleOff = holidayYmdLabel(saleEnd)
    }
    const banner = bannerByCode.get(rule.code)
    return {
      code: rule.code,
      name: rule.name,
      calendar: rule.calendar,
      calendarLabel: calendarLabel(rule.calendar, locale),
      tagline: rule.tagline,
      summary: rule.summary,
      startMonth: rule.startMonth,
      startDay: rule.startDay,
      endMonth: rule.endMonth,
      endDay: rule.endDay,
      leadDays: rule.leadDays,
      afterDays: rule.afterDays,
      salePercent: rule.salePercent,
      saleLeadDays: rule.saleLeadDays || null,
      saleDays: rule.saleDays,
      enabled: rule.enabled,
      priority: rule.priority,
      solarLabel,
      startYear: span?.[0].year ?? null,
      endYear: span?.[1].year ?? null,
      windowOnLabel: windowOn,
      windowOffLabel: windowOff,
      saleOnLabel: saleOn,
      saleOffLabel: saleOff,
      bannerHeadline: partnerHolidayBannerHeadline(rule.code),
      bannerUrl: banner?.image_url ?? null,
      bannerStatus: banner?.status ?? null,
      bannerError: banner?.error_message ?? null,
      showingToday: Boolean(visible && visible.code === rule.code),
    }
  })
  return {
    activeTheme: visible?.code ?? null,
    activeLabel: visible?.name ?? null,
    scheduleNote: scheduleNote(visible, locale),
    occasions,
  }
}
