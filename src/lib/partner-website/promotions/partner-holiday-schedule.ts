/**
 * Lịch lễ lặp mỗi năm theo ngày/tháng. Không lưu năm.
 * Khi nhiều dịp trùng một ngày, ngày chính của dịp ngắn hơn được hiện.
 */

import { lunarToSolar } from '@/lib/partner-website/promotions/partner-lunar-calendar'

export const PARTNER_HOLIDAY_THEME_IDS = [
  'duong-lich',
  'tao-quan',
  'tet',
  'valentine',
  'nguyen-tieu',
  'phu-nu-83',
  'gio-to',
  'dai-le',
  'thieu-nhi',
  'doan-ngo',
  'vu-lan',
  'quoc-khanh',
  'trung-thu',
  'phu-nu-2010',
  'nha-giao',
  'giang-sinh',
] as const

export type PartnerHolidayThemeId = (typeof PARTNER_HOLIDAY_THEME_IDS)[number]
export type PartnerHolidayCalendarKind = 'solar' | 'lunar'

export type PartnerHolidayRule = {
  code: PartnerHolidayThemeId
  name: string
  calendar: PartnerHolidayCalendarKind
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  leadDays: number
  afterDays: number
  salePercent: number
  priority: number
  saleLabel: string
  tagline: string
  summary: string
  enabled: boolean
  saleLeadDays: number
  saleDays: number | null
}

export type PartnerHolidayYmd = { year: number; month: number; day: number }

export type PartnerHolidayWindow = {
  rule: PartnerHolidayRule
  coreStart: PartnerHolidayYmd
  coreEnd: PartnerHolidayYmd
  windowStart: PartnerHolidayYmd
  windowEnd: PartnerHolidayYmd
}

export type PartnerVisibleHoliday = {
  code: PartnerHolidayThemeId
  name: string
  mode: 'active' | 'teaser' | 'after'
  salePhase: 'active' | 'teaser' | null
  salePercent: number
  saleLabel: string
  leadDays: number
  coreStart: PartnerHolidayYmd
  coreEnd: PartnerHolidayYmd
  windowStart: PartnerHolidayYmd
  windowEnd: PartnerHolidayYmd
  saleStart: PartnerHolidayYmd
  saleEnd: PartnerHolidayYmd
}

function rule(
  code: PartnerHolidayThemeId,
  name: string,
  calendar: PartnerHolidayCalendarKind,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
  leadDays: number,
  afterDays: number,
  salePercent: number,
  priority: number,
  saleLabel: string,
  tagline: string,
  summary: string
): PartnerHolidayRule {
  return {
    code,
    name,
    calendar,
    startMonth,
    startDay,
    endMonth,
    endDay,
    leadDays,
    afterDays,
    salePercent,
    priority,
    saleLabel,
    tagline,
    summary,
    enabled: true,
    saleLeadDays: 0,
    saleDays: null,
  }
}

const CATALOG_LIST: PartnerHolidayRule[] = [
  rule('duong-lich', 'Tết Dương lịch', 'solar', 1, 1, 1, 1, 5, 2, 6, 4, 'Sale Tết dương', 'Năm mới', 'Đầu năm dương lịch.'),
  rule('tao-quan', 'Ông Công Ông Táo', 'lunar', 12, 23, 12, 23, 0, 0, 6, 5, 'Sale Ông Táo', 'Đưa Táo về trời', 'Đúng 23 tháng Chạp.'),
  rule('tet', 'Tết Nguyên Đán', 'lunar', 1, 1, 1, 5, 7, 3, 12, 1, 'Sale Tết', 'Tết đang về', 'Mùng 1 đến mùng 5. Bật trước 7 ngày nên trùng ngày Ông Táo.'),
  rule('valentine', 'Valentine', 'solar', 2, 14, 2, 14, 0, 0, 8, 4, 'Sale Valentine', 'Mùa yêu', 'Đúng 14/2.'),
  rule('nguyen-tieu', 'Tết Nguyên Tiêu', 'lunar', 1, 15, 1, 15, 3, 1, 6, 5, 'Sale Nguyên Tiêu', 'Rằm tháng Giêng', 'Rằm tháng Giêng.'),
  rule('phu-nu-83', 'Quốc tế Phụ nữ', 'solar', 3, 8, 3, 8, 5, 1, 8, 4, 'Sale 8/3', '8/3', 'Quốc tế Phụ nữ.'),
  rule('gio-to', 'Giỗ Tổ Hùng Vương', 'lunar', 3, 10, 3, 10, 5, 2, 6, 5, 'Sale Giỗ Tổ', 'Giỗ Tổ', '10 tháng 3 âm lịch.'),
  rule('dai-le', '30/4 và 1/5', 'solar', 4, 30, 5, 1, 7, 2, 8, 3, 'Sale 30/4', 'Đại lễ', '30/4 đến 1/5.'),
  rule('thieu-nhi', 'Quốc tế Thiếu nhi', 'solar', 6, 1, 6, 1, 4, 0, 6, 5, 'Sale 1/6', '1/6', 'Quốc tế Thiếu nhi.'),
  rule('doan-ngo', 'Tết Đoan Ngọ', 'lunar', 5, 5, 5, 5, 4, 1, 6, 5, 'Sale Đoan Ngọ', 'Đoan Ngọ', '5 tháng 5 âm lịch.'),
  rule('vu-lan', 'Lễ Vu Lan', 'lunar', 7, 15, 7, 15, 5, 2, 5, 5, 'Sale Vu Lan', 'Vu Lan', 'Rằm tháng 7.'),
  rule('quoc-khanh', 'Quốc khánh', 'solar', 9, 2, 9, 3, 7, 2, 8, 3, 'Sale Quốc khánh', 'Quốc khánh', '2/9 và 3/9.'),
  rule('trung-thu', 'Tết Trung thu', 'lunar', 8, 15, 8, 15, 7, 3, 10, 2, 'Sale Trung thu', 'Trung thu', 'Rằm tháng 8.'),
  rule('phu-nu-2010', 'Phụ nữ Việt Nam', 'solar', 10, 20, 10, 20, 7, 2, 8, 4, 'Sale 20/10', '20/10', 'Phụ nữ Việt Nam.'),
  rule('nha-giao', 'Nhà giáo Việt Nam', 'solar', 11, 20, 11, 20, 7, 2, 8, 4, 'Sale 20/11', '20/11', 'Nhà giáo Việt Nam.'),
  rule('giang-sinh', 'Giáng sinh', 'solar', 12, 24, 12, 25, 10, 6, 10, 2, 'Sale Giáng sinh', 'Mùa Giáng sinh', '24 và 25/12.'),
]

export const PARTNER_HOLIDAY_CATALOG: Record<PartnerHolidayThemeId, PartnerHolidayRule> =
  Object.fromEntries(CATALOG_LIST.map((row) => [row.code, row])) as Record<
    PartnerHolidayThemeId,
    PartnerHolidayRule
  >

export const PARTNER_HOLIDAY_BANNER_HEADLINES: Record<PartnerHolidayThemeId, string> = {
  'duong-lich': 'SALE TẾT DƯƠNG',
  'tao-quan': 'SALE ÔNG TÁO',
  tet: 'SALE TẾT',
  valentine: 'SALE VALENTINE',
  'nguyen-tieu': 'SALE NGUYÊN TIÊU',
  'phu-nu-83': 'SALE PHỤ NỮ',
  'gio-to': 'SALE GIỖ TỔ',
  'dai-le': 'SALE ĐẠI LỄ',
  'thieu-nhi': 'SALE THIẾU NHI',
  'doan-ngo': 'SALE ĐOAN NGỌ',
  'vu-lan': 'SALE VU LAN',
  'quoc-khanh': 'SALE QUỐC KHÁNH',
  'trung-thu': 'SALE TRUNG THU',
  'phu-nu-2010': 'SALE PHỤ NỮ VIỆT NAM',
  'nha-giao': 'SALE NHÀ GIÁO',
  'giang-sinh': 'SALE GIÁNG SINH',
}

export const PARTNER_HOLIDAY_BANNER_ART: Record<PartnerHolidayThemeId, string> = {
  'duong-lich': 'đồng hồ năm mới, confetti navy',
  'tao-quan': 'cá chép, lửa bếp, sắc cam',
  tet: 'hoa mai đào, lì xì đỏ vàng',
  valentine: 'hoa hồng, quà tặng, sắc hồng',
  'nguyen-tieu': 'đèn lồng, trăng rằm',
  'phu-nu-83': 'hoa tươi, quà, sắc hồng',
  'gio-to': 'hương khói, sắc vàng đồng',
  'dai-le': 'cờ đỏ sao vàng, năng lượng lễ',
  'thieu-nhi': 'bóng bay, vui nhộn, xanh trời',
  'doan-ngo': 'lá xanh, giữa năm',
  'vu-lan': 'sen tím, ấm gia đình',
  'quoc-khanh': 'cờ đỏ, tự hào',
  'trung-thu': 'đèn ông sao, trăng, bánh',
  'phu-nu-2010': 'hoa hồng, duyên dáng',
  'nha-giao': 'hoa cúc, sách, xanh dương',
  'giang-sinh': 'thông Noel, đèn ấm, đỏ xanh',
}

export function isPartnerHolidayThemeId(value: string | null | undefined): value is PartnerHolidayThemeId {
  return Boolean(value && value in PARTNER_HOLIDAY_CATALOG)
}

export function partnerHolidayBannerHeadline(code: string): string {
  return isPartnerHolidayThemeId(code) ? PARTNER_HOLIDAY_BANNER_HEADLINES[code] : 'SALE NGÀY LỄ'
}

export function partnerHolidayBannerArt(code: string): string {
  return isPartnerHolidayThemeId(code) ? PARTNER_HOLIDAY_BANNER_ART[code] : 'lễ hội thời trang cao cấp'
}

export function partnerHolidayBannerCampaignKey(code: string): string {
  return `holiday-${String(code || '').trim()}`
}

export function holidayCodeFromCampaignKey(campaignKey: string): PartnerHolidayThemeId | null {
  const match = /^holiday-(.+)$/.exec(String(campaignKey || '').trim())
  const code = match?.[1] ?? ''
  return isPartnerHolidayThemeId(code) ? code : null
}

function daysInSolarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function validHolidayMonthDay(kind: PartnerHolidayCalendarKind, month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) return false
  if (kind === 'lunar') return day >= 1 && day <= 30
  if (month === 2) return day >= 1 && day <= 29
  return day >= 1 && day <= daysInSolarMonth(2023, month)
}

function ymd(year: number, month: number, day: number): PartnerHolidayYmd {
  return { year, month, day }
}

export function holidayYmdText(value: PartnerHolidayYmd): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
}

export function holidayYmdLabel(value: PartnerHolidayYmd): string {
  return `${value.day}/${value.month}/${value.year}`
}

function holidayOrdinal(value: PartnerHolidayYmd): number {
  return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 86_400_000)
}

function addHolidayDays(value: PartnerHolidayYmd, days: number): PartnerHolidayYmd {
  const utc = new Date(Date.UTC(value.year, value.month - 1, value.day + days))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

function compareHolidayYmd(a: PartnerHolidayYmd, b: PartnerHolidayYmd): number {
  return holidayOrdinal(a) - holidayOrdinal(b)
}

function inHolidayRange(today: PartnerHolidayYmd, start: PartnerHolidayYmd, end: PartnerHolidayYmd): boolean {
  return compareHolidayYmd(start, today) <= 0 && compareHolidayYmd(today, end) <= 0
}

function holidaySpanDays(start: PartnerHolidayYmd, end: PartnerHolidayYmd): number {
  return holidayOrdinal(end) - holidayOrdinal(start)
}

function anchor(
  kind: PartnerHolidayCalendarKind,
  month: number,
  day: number,
  year: number
): PartnerHolidayYmd | null {
  if (kind === 'solar') {
    try {
      const probe = new Date(Date.UTC(year, month - 1, day))
      if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
        return null
      }
      return ymd(year, month, day)
    } catch {
      return null
    }
  }
  const solar = lunarToSolar(day, month, year, 0)
  return solar ? ymd(solar.year, solar.month, solar.day) : null
}

function coreSpan(rule: PartnerHolidayRule, year: number): [PartnerHolidayYmd, PartnerHolidayYmd] | null {
  const start = anchor(rule.calendar, rule.startMonth, rule.startDay, year)
  let end = anchor(rule.calendar, rule.endMonth, rule.endDay, year)
  if (!start || !end) return null
  if (compareHolidayYmd(end, start) < 0) {
    const endNext = anchor(rule.calendar, rule.endMonth, rule.endDay, year + 1)
    if (!endNext) return null
    end = endNext
  }
  return [start, end]
}

export function partnerHolidaySaleSpan(
  rule: PartnerHolidayRule,
  coreStart: PartnerHolidayYmd,
  coreEnd: PartnerHolidayYmd
): [PartnerHolidayYmd, PartnerHolidayYmd] {
  const lead = Math.max(0, Math.min(60, Math.trunc(rule.saleLeadDays || 0)))
  const start = addHolidayDays(coreStart, -lead)
  const rawDays = rule.saleDays
  let end: PartnerHolidayYmd
  if (rawDays == null || Math.trunc(rawDays) <= 0) {
    end = coreEnd
  } else {
    end = addHolidayDays(start, Math.max(1, Math.min(60, Math.trunc(rawDays))) - 1)
  }
  if (compareHolidayYmd(end, start) < 0) end = start
  return [start, end]
}

function salePhaseFor(
  rule: PartnerHolidayRule,
  today: PartnerHolidayYmd,
  saleStart: PartnerHolidayYmd,
  saleEnd: PartnerHolidayYmd
): 'active' | 'teaser' | null {
  if (!(Number(rule.salePercent) > 0)) return null
  if (inHolidayRange(today, saleStart, saleEnd)) return 'active'
  if (compareHolidayYmd(today, saleStart) < 0) return 'teaser'
  return null
}

export function partnerHolidayWindowsCovering(rule: PartnerHolidayRule, today: PartnerHolidayYmd): PartnerHolidayWindow[] {
  const lead = Math.max(0, Math.min(60, Math.trunc(rule.leadDays || 0)))
  const after = Math.max(0, Math.min(60, Math.trunc(rule.afterDays || 0)))
  const found: PartnerHolidayWindow[] = []
  for (const year of [today.year - 1, today.year, today.year + 1]) {
    const span = coreSpan(rule, year)
    if (!span) continue
    const [coreStart, coreEnd] = span
    const windowStart = addHolidayDays(coreStart, -lead)
    const windowEnd = addHolidayDays(coreEnd, after)
    if (!inHolidayRange(today, windowStart, windowEnd)) continue
    found.push({ rule, coreStart, coreEnd, windowStart, windowEnd })
  }
  return found
}

export function partnerHolidayNextCore(
  rule: PartnerHolidayRule,
  today: PartnerHolidayYmd
): [PartnerHolidayYmd, PartnerHolidayYmd] | null {
  let best: [PartnerHolidayYmd, PartnerHolidayYmd] | null = null
  for (let year = today.year - 1; year <= today.year + 2; year += 1) {
    const span = coreSpan(rule, year)
    if (!span || compareHolidayYmd(span[1], today) < 0) continue
    if (!best || compareHolidayYmd(span[0], best[0]) < 0) best = span
  }
  return best
}

export function resolveVisiblePartnerHoliday(
  rules: PartnerHolidayRule[],
  today: PartnerHolidayYmd
): PartnerVisibleHoliday | null {
  const hits: PartnerHolidayWindow[] = []
  for (const item of rules) {
    if (!item.enabled) continue
    hits.push(...partnerHolidayWindowsCovering(item, today))
  }
  if (!hits.length) return null
  const primary = hits.filter((item) => inHolidayRange(today, item.coreStart, item.coreEnd))
  let chosen: PartnerHolidayWindow
  if (primary.length) {
    primary.sort(
      (a, b) =>
        holidaySpanDays(a.coreStart, a.coreEnd) - holidaySpanDays(b.coreStart, b.coreEnd) ||
        a.rule.priority - b.rule.priority ||
        a.rule.code.localeCompare(b.rule.code)
    )
    chosen = primary[0]!
  } else {
    hits.sort(
      (a, b) =>
        a.rule.priority - b.rule.priority ||
        holidaySpanDays(b.windowStart, b.windowEnd) - holidaySpanDays(a.windowStart, a.windowEnd) ||
        a.rule.code.localeCompare(b.rule.code)
    )
    chosen = hits[0]!
  }
  const [saleStart, saleEnd] = partnerHolidaySaleSpan(chosen.rule, chosen.coreStart, chosen.coreEnd)
  const mode = inHolidayRange(today, chosen.coreStart, chosen.coreEnd)
    ? 'active'
    : compareHolidayYmd(today, chosen.coreStart) < 0
      ? 'teaser'
      : 'after'
  return {
    code: chosen.rule.code,
    name: chosen.rule.name,
    mode,
    salePhase: salePhaseFor(chosen.rule, today, saleStart, saleEnd),
    salePercent: chosen.rule.salePercent,
    saleLabel: chosen.rule.saleLabel,
    leadDays: chosen.rule.leadDays,
    coreStart: chosen.coreStart,
    coreEnd: chosen.coreEnd,
    windowStart: chosen.windowStart,
    windowEnd: chosen.windowEnd,
    saleStart,
    saleEnd,
  }
}

export function resolvePartnerHolidaySale(
  rules: PartnerHolidayRule[],
  today: PartnerHolidayYmd
): PartnerVisibleHoliday | null {
  const hits: PartnerVisibleHoliday[] = []
  for (const item of rules) {
    if (!item.enabled || !(Number(item.salePercent) > 0)) continue
    for (const year of [today.year - 1, today.year, today.year + 1]) {
      const span = coreSpan(item, year)
      if (!span) continue
      const [coreStart, coreEnd] = span
      const [saleStart, saleEnd] = partnerHolidaySaleSpan(item, coreStart, coreEnd)
      if (!inHolidayRange(today, saleStart, saleEnd)) continue
      const lead = Math.max(0, Math.min(60, Math.trunc(item.leadDays || 0)))
      const after = Math.max(0, Math.min(60, Math.trunc(item.afterDays || 0)))
      const mode = inHolidayRange(today, coreStart, coreEnd)
        ? 'active'
        : compareHolidayYmd(today, coreStart) < 0
          ? 'teaser'
          : 'after'
      hits.push({
        code: item.code,
        name: item.name,
        mode,
        salePhase: 'active',
        salePercent: item.salePercent,
        saleLabel: item.saleLabel,
        leadDays: item.leadDays,
        coreStart,
        coreEnd,
        windowStart: addHolidayDays(coreStart, -lead),
        windowEnd: addHolidayDays(coreEnd, after),
        saleStart,
        saleEnd,
      })
    }
  }
  if (!hits.length) return null
  hits.sort(
    (a, b) =>
      holidaySpanDays(a.saleStart, a.saleEnd) - holidaySpanDays(b.saleStart, b.saleEnd) ||
      holidaySpanDays(a.coreStart, a.coreEnd) - holidaySpanDays(b.coreStart, b.coreEnd) ||
      a.code.localeCompare(b.code)
  )
  return hits[0] ?? null
}

export type PartnerHolidayOverrideRow = {
  enabled?: boolean | null
  startMonth?: number | null
  startDay?: number | null
  endMonth?: number | null
  endDay?: number | null
  leadDays?: number | null
  afterDays?: number | null
  salePercent?: number | null
  saleLeadDays?: number | null
  saleDays?: number | null
}

function intOr(value: number | null | undefined, fallback: number): number {
  return value == null || !Number.isFinite(Number(value)) ? fallback : Math.trunc(Number(value))
}

export function applyPartnerHolidayOverride(
  base: PartnerHolidayRule,
  row: PartnerHolidayOverrideRow | null | undefined
): PartnerHolidayRule {
  if (!row) return base
  const saleDaysRaw = row.saleDays
  const saleDays =
    saleDaysRaw == null ? base.saleDays : Math.trunc(Number(saleDaysRaw)) <= 0 ? null : Math.max(0, Math.min(60, Math.trunc(Number(saleDaysRaw))))
  return {
    ...base,
    enabled: row.enabled == null ? base.enabled : Boolean(row.enabled),
    startMonth: intOr(row.startMonth, base.startMonth),
    startDay: intOr(row.startDay, base.startDay),
    endMonth: intOr(row.endMonth, base.endMonth),
    endDay: intOr(row.endDay, base.endDay),
    leadDays: intOr(row.leadDays, base.leadDays),
    afterDays: intOr(row.afterDays, base.afterDays),
    salePercent: Math.max(0, Math.min(50, Number(row.salePercent ?? base.salePercent) || 0)),
    saleLeadDays: Math.max(0, Math.min(60, intOr(row.saleLeadDays, base.saleLeadDays))),
    saleDays,
  }
}

export function vnHolidayToday(at = new Date()): PartnerHolidayYmd {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), day: get('day') }
}

export function holidayYmdFromDate(value: Date): PartnerHolidayYmd {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() }
}

export function parseHolidayYmd(raw: string): PartnerHolidayYmd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}
