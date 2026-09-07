import type { WebLocale } from '@/lib/i18n/config'
import {
  applyPartnerSiteSalePrice,
  type PartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  formatPartnerShopMoneyVnd,
  isPartnerFlashSaleActive,
  normalizePartnerSalePriceAmount,
  resolvePartnerEffectiveUnitPrice,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { resolvePartnerSaleDiscountBreakdown } from '@/lib/partner-website/promotions/partner-sale-pricing'
export type PartnerSiteSaleProductInput = {
  priceAmount?: number | null
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  isClearance?: boolean
}

export type PartnerSiteSalePromoKind = 'flash' | 'calendar' | 'clearance'

export type PartnerSiteSalePricing = {
  kind?: PartnerSiteSalePromoKind | null
  listPrice: number
  displayPrice: number
  savingsAmount: number
  percent: number
  phase: 'teaser' | 'active'
  expectedSalePrice: number | null
  eventLabel: string | null
  eventDate: string | null
  countdownTo: string | null
}

export type PartnerProductSaleFace = {
  kind: 'teaser' | 'active' | null
  promoKind: PartnerSiteSalePromoKind | null
  listPrice: number
  displayPrice: number
  comparePrice: number | null
  expectedPrice: number | null
  percent: number
  savings: number
  badge: string | null
  countdownTo: string | null
  eventLabel: string | null
}

export type PartnerSiteSaleCopy = {
  teaserBanner: string
  activeBanner: string
  daysLeft: string
  expectedPrice: string
  expectedSave: string
  teaserSave: string
  save: string
  startsAfter: string
  remaining: string
  flashRemaining: string
  countdownStarts: string
  countdownLeft: string
  teaserCartHint: string
  birthdayCheckoutHint: string
  birthdayBanner: string
  birthdayBadge: string
  birthdayAtCheckout: string
  birthdaySave: string
  birthdayEndsAfter: string
  flashBadge: string
  flashName: string
  clearanceBadge: string
  calendarBadge: string
  clearanceName: string
  googleName: string
  comingSoonBadge: string
  currentPrice: string
  capNotePdp: string
  ended: string
  teaserPill: string
  activePill: string
  teaserFallback: string
  activeFallback: string
  listPriceLabel: string
  offerPriceLabel: string
  close: string
  program: string
}

export const PARTNER_SITE_SALE_COPY: Record<WebLocale, PartnerSiteSaleCopy> = {
  vi: {
    teaserBanner: '{label} sắp diễn ra — giảm {pct}% trong ngày sale',
    activeBanner: '{label} đang diễn ra — giảm {pct}% toàn website',
    daysLeft: '{n} ngày nữa',
    expectedPrice: 'Giá {program} dự kiến',
    expectedSave: 'Sắp {program} — tiết kiệm ~{amount}',
    teaserSave: '{program}: tiết kiệm dự kiến ~{amount}',
    save: '{program}: tiết kiệm {amount}',
    startsAfter: 'bắt đầu sau',
    remaining: 'còn',
    flashRemaining: 'Flash sale — còn',
    countdownStarts: '{label} bắt đầu sau',
    countdownLeft: '{label} — còn',
    teaserCartHint: 'Tiết kiệm dự kiến khi sale {label} (-{pct}%)',
    birthdayCheckoutHint: 'CMSN {pct}% khi thanh toán',
    birthdayBanner: 'Sale CMSN {pct}% — áp dụng tự động khi thanh toán, không cộng voucher',
    birthdayBadge: 'CMSN -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% ở tổng đơn',
    birthdaySave: 'CMSN: tiết kiệm {amount}',
    birthdayEndsAfter: 'CMSN hết hạn sau',
    flashBadge: 'Flash sale -{pct}%',
    flashName: 'Flash sale',
    clearanceBadge: 'Sale thanh lý kho -{pct}%',
    calendarBadge: 'Sale {date} - {pct}%',
    clearanceName: 'Sale thanh lý kho',
    googleName: 'Google Shopping',
    comingSoonBadge: 'Sắp {program} -{pct}%',
    currentPrice: 'Giá hiện tại',
    capNotePdp: 'Tổng ưu đãi tối đa 15% giá gốc — giá đang hiển thị đã khớp lúc thanh toán.',
    ended: 'Đã kết thúc',
    teaserPill: '{label} — giảm {pct}% trong ngày sale',
    activePill: '{label} — giảm {pct}%',
    teaserFallback: 'Sắp sale',
    activeFallback: 'Sale cùng ngày tháng',
    listPriceLabel: 'Giá gốc',
    offerPriceLabel: 'Giá ưu đãi',
    close: 'Đóng',
    program: 'Chương trình sale',
  },
  en: {
    teaserBanner: '{label} is coming — {pct}% off on sale day',
    activeBanner: '{label} is live — {pct}% off sitewide',
    daysLeft: '{n} days left',
    expectedPrice: 'Expected {program} price',
    expectedSave: 'Coming {program} — save ~{amount}',
    teaserSave: '{program}: expected savings ~{amount}',
    save: '{program}: save {amount}',
    startsAfter: 'starts in',
    remaining: 'left',
    flashRemaining: 'Flash sale —',
    countdownStarts: '{label} starts in',
    countdownLeft: '{label} —',
    teaserCartHint: 'Expected savings when {label} starts (-{pct}%)',
    birthdayCheckoutHint: 'CMSN {pct}% off at checkout',
    birthdayBanner: 'CMSN {pct}% off — applied automatically at checkout, not stacked with a voucher',
    birthdayBadge: 'CMSN -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% at checkout',
    birthdaySave: 'CMSN: save {amount}',
    birthdayEndsAfter: 'CMSN ends in',
    flashBadge: 'Flash sale -{pct}%',
    flashName: 'Flash sale',
    clearanceBadge: 'Warehouse sale -{pct}%',
    calendarBadge: 'Sale {date} - {pct}%',
    clearanceName: 'Warehouse sale',
    googleName: 'Google Shopping',
    comingSoonBadge: 'Coming {program} -{pct}%',
    currentPrice: 'Current price',
    capNotePdp: 'Total offers are capped at 15% of list price — the price shown already matches checkout.',
    ended: 'Ended',
    teaserPill: '{label} — {pct}% off on sale day',
    activePill: '{label} — {pct}% off',
    teaserFallback: 'Sale coming',
    activeFallback: 'Same-day sale',
    listPriceLabel: 'List price',
    offerPriceLabel: 'Sale price',
    close: 'Close',
    program: 'Site sale',
  },
  zh: {
    teaserBanner: '{label}即将开始 — 活动日全站减{pct}%',
    activeBanner: '{label}进行中 — 全站减{pct}%',
    daysLeft: '还有{n}天',
    expectedPrice: '预计{program}价',
    expectedSave: '即将 {program} — 约省{amount}',
    teaserSave: '{program}：预计节省 ~{amount}',
    save: '{program}：节省 {amount}',
    startsAfter: '开始倒计时',
    remaining: '剩余',
    flashRemaining: 'Flash sale — 剩余',
    countdownStarts: '{label}开始倒计时',
    countdownLeft: '{label} — 剩余',
    teaserCartHint: '{label}开始后预计节省 (-{pct}%)',
    birthdayCheckoutHint: 'CMSN 结账再减 {pct}%',
    birthdayBanner: 'CMSN {pct}% — 结账自动减免，不与优惠券叠加',
    birthdayBadge: 'CMSN -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% 结账减免',
    birthdaySave: 'CMSN: 节省 {amount}',
    birthdayEndsAfter: 'CMSN 截止',
    flashBadge: 'Flash sale -{pct}%',
    flashName: 'Flash sale',
    clearanceBadge: '仓库清仓 -{pct}%',
    calendarBadge: 'Sale {date} - {pct}%',
    clearanceName: '仓库清仓',
    googleName: 'Google Shopping',
    comingSoonBadge: '即将 {program} -{pct}%',
    currentPrice: '当前价格',
    capNotePdp: '优惠合计不超过原价 15% — 当前显示价已与结账一致。',
    ended: '已结束',
    teaserPill: '{label} — 活动日减{pct}%',
    activePill: '{label} — 减{pct}%',
    teaserFallback: '即将促销',
    activeFallback: '同日促销',
    listPriceLabel: '原价',
    offerPriceLabel: '优惠价',
    close: '关闭',
    program: '全站促销',
  },
  ja: {
    teaserBanner: '{label}まもなく開催 — 当日{pct}%オフ',
    activeBanner: '{label}開催中 — 全品{pct}%オフ',
    daysLeft: 'あと{n}日',
    expectedPrice: '予定の{program}価格',
    expectedSave: 'まもなく {program} — 約{amount}お得',
    teaserSave: '{program}：予定のお得額 ~{amount}',
    save: '{program}：{amount} お得',
    startsAfter: '開始まで',
    remaining: '残り',
    flashRemaining: 'Flash sale — 残り',
    countdownStarts: '{label}開始まで',
    countdownLeft: '{label} — 残り',
    teaserCartHint: '{label}開始時の予定節約額 (-{pct}%)',
    birthdayCheckoutHint: 'CMSN 会計時 {pct}% オフ',
    birthdayBanner: 'CMSN {pct}% — 会計時に自動適用（クーポンと併用不可）',
    birthdayBadge: 'CMSN -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}%（会計時）',
    birthdaySave: 'CMSN：{amount} お得',
    birthdayEndsAfter: 'CMSN 終了まで',
    flashBadge: 'Flash sale -{pct}%',
    flashName: 'Flash sale',
    clearanceBadge: '倉庫セール -{pct}%',
    calendarBadge: 'Sale {date} - {pct}%',
    clearanceName: '倉庫セール',
    googleName: 'Google Shopping',
    comingSoonBadge: 'まもなく {program} -{pct}%',
    currentPrice: '現在の価格',
    capNotePdp: '優待合計は定価の15%が上限 — 表示価格は会計時と同じです。',
    ended: '終了しました',
    teaserPill: '{label} — 当日{pct}%オフ',
    activePill: '{label} — {pct}%オフ',
    teaserFallback: 'まもなくセール',
    activeFallback: '同日セール',
    listPriceLabel: '定価',
    offerPriceLabel: 'セール価格',
    close: '閉じる',
    program: 'サイトセール',
  },
  ko: {
    teaserBanner: '{label} 곧 시작 — 세일 당일 {pct}% 할인',
    activeBanner: '{label} 진행 중 — 전 상품 {pct}% 할인',
    daysLeft: '{n}일 남음',
    expectedPrice: '예정 {program} 가격',
    expectedSave: '곧 {program} — 약 {amount} 절약',
    teaserSave: '{program}: 예상 절약 ~{amount}',
    save: '{program}: {amount} 절약',
    startsAfter: '시작까지',
    remaining: '남음',
    flashRemaining: 'Flash sale — 남은 시간',
    countdownStarts: '{label} 시작까지',
    countdownLeft: '{label} — 남은 시간',
    teaserCartHint: '{label} 시작 시 예상 절약 (-{pct}%)',
    birthdayCheckoutHint: 'CMSN 결제 시 {pct}% 할인',
    birthdayBanner: 'CMSN {pct}% — 결제 시 자동 적용, 쿠폰과 중복 불가',
    birthdayBadge: 'CMSN -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% 결제 시',
    birthdaySave: 'CMSN: {amount} 절약',
    birthdayEndsAfter: 'CMSN 종료까지',
    flashBadge: 'Flash sale -{pct}%',
    flashName: 'Flash sale',
    clearanceBadge: '창고 세일 -{pct}%',
    calendarBadge: 'Sale {date} - {pct}%',
    clearanceName: '창고 세일',
    googleName: 'Google Shopping',
    comingSoonBadge: '곧 {program} -{pct}%',
    currentPrice: '현재 가격',
    capNotePdp: '혜택 합계는 정가의 15% 한도 — 표시 가격은 결제와 같습니다.',
    ended: '종료됨',
    teaserPill: '{label} — 세일 당일 {pct}% 할인',
    activePill: '{label} — {pct}% 할인',
    teaserFallback: '세일 예정',
    activeFallback: '동일 날짜 세일',
    listPriceLabel: '정가',
    offerPriceLabel: '할인가',
    close: '닫기',
    program: '사이트 세일',
  },
}

export function partnerSiteSaleCopy(locale: WebLocale) {
  return PARTNER_SITE_SALE_COPY[locale] ?? PARTNER_SITE_SALE_COPY.en
}

export function partnerSiteSaleFill(
  template: string,
  vars: { program?: string | null; pct?: number | string | null; amount?: string | null; date?: string | null; label?: string | null }
): string {
  return String(template || '')
    .replace('{program}', String(vars.program ?? '').trim())
    .replace('{pct}', String(vars.pct ?? ''))
    .replace('{amount}', String(vars.amount ?? ''))
    .replace('{date}', String(vars.date ?? ''))
    .replace('{label}', String(vars.label ?? vars.program ?? '').trim())
}

export function partnerSiteSaleProgramName(
  input: {
    promoKind?: PartnerSiteSalePromoKind | string | null
    eventLabel?: string | null
    kind?: PartnerProductSaleFace['kind']
  },
  locale: WebLocale = 'vi'
): string {
  const copy = partnerSiteSaleCopy(locale)
  const promo = partnerSiteSalePromoKindOf({
    kind: input.promoKind,
    eventLabel: input.eventLabel,
  })
  if (promo === 'flash') return copy.flashName
  if (promo === 'clearance') return copy.clearanceName
  const label = String(input.eventLabel || '').trim()
  if (label) return label
  return input.kind === 'teaser' ? copy.teaserFallback : copy.activeFallback
}

export function partnerSiteStackedSaleProgramLabel(
  input: {
    promoKind?: PartnerSiteSalePromoKind | string | null
    eventLabel?: string | null
    kind?: PartnerProductSaleFace['kind']
    birthday?: boolean
  },
  locale: WebLocale = 'vi'
): string {
  const main = partnerSiteSaleProgramName(input, locale)
  if (input.birthday && partnerSiteSalePromoKindOf(input) !== 'clearance') {
    return `${main} + CMSN`
  }
  return main
}

export function partnerSiteSaleSaveText(
  face: Pick<PartnerProductSaleFace, 'kind' | 'promoKind' | 'eventLabel' | 'savings'>,
  locale: WebLocale,
  opts?: { amount?: number; surface?: 'card' | 'detail'; birthday?: boolean }
): string {
  const copy = partnerSiteSaleCopy(locale)
  const program = partnerSiteStackedSaleProgramLabel(
    { ...face, birthday: opts?.birthday === true },
    locale
  )
  const amount = formatPartnerSaleMoney(opts?.amount ?? face.savings, locale)
  if (face.kind === 'teaser') {
    const tpl = opts?.surface === 'card' ? copy.expectedSave : copy.teaserSave
    return partnerSiteSaleFill(tpl, { program, amount })
  }
  return partnerSiteSaleFill(copy.save, { program, amount })
}

export function partnerSiteSaleExpectedPriceText(
  program: string,
  amount: number,
  locale: WebLocale
): string {
  const copy = partnerSiteSaleCopy(locale)
  return `${partnerSiteSaleFill(copy.expectedPrice, { program })} ${formatPartnerSaleMoney(amount, locale)}`
}

export function partnerSiteSaleCountdownPrefix(
  input: {
    phase: 'teaser' | 'active'
    promoKind?: PartnerSiteSalePromoKind | string | null
    eventLabel?: string | null
  },
  locale: WebLocale
): string {
  const copy = partnerSiteSaleCopy(locale)
  if (input.promoKind === 'flash') return copy.flashRemaining
  const program = partnerSiteSaleProgramName(
    { promoKind: input.promoKind, eventLabel: input.eventLabel, kind: input.phase },
    locale
  )
  const tpl = input.phase === 'active' ? copy.countdownLeft : copy.countdownStarts
  return partnerSiteSaleFill(tpl, { label: program, program })
}

export function normalizePartnerBirthdayOfferPercent(value: unknown): number {
  const n = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  return n > 0 && n < 100 ? n : 0
}

export function partnerSiteBirthdayBadgeText(percent: unknown, locale: WebLocale): string | null {
  const pct = normalizePartnerBirthdayOfferPercent(percent)
  if (!pct) return null
  return partnerSiteSaleCopy(locale).birthdayBadge.replace('{pct}', String(pct))
}

export function partnerSiteBirthdayCheckoutHint(percent: unknown, locale: WebLocale): string | null {
  const pct = normalizePartnerBirthdayOfferPercent(percent)
  if (!pct) return null
  return partnerSiteSaleCopy(locale).birthdayCheckoutHint.replace('{pct}', String(pct))
}

export function partnerSiteBirthdayBannerText(percent: unknown, locale: WebLocale): string | null {
  const pct = normalizePartnerBirthdayOfferPercent(percent)
  if (!pct) return null
  return partnerSiteSaleCopy(locale).birthdayBanner.replace('{pct}', String(pct))
}

export function normalizePartnerBirthdayOfferCountdownTo(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) && ms > Date.now() - 60_000 ? new Date(ms).toISOString() : null
}

export type PartnerSiteBirthdayOfferJson = {
  percent: number
  countdownTo: string | null
}

export function partnerSiteBirthdayOfferJson(input: {
  percent?: unknown
  countdownTo?: string | null
  birthdayOfferPercent?: number | null
  birthdayOfferEndsAt?: string | null
  isClearance?: boolean
} | null | undefined): PartnerSiteBirthdayOfferJson | null {
  if (!input || input.isClearance === true) return null
  const pct = normalizePartnerBirthdayOfferPercent(input.percent ?? input.birthdayOfferPercent)
  if (!pct) return null
  return {
    percent: pct,
    countdownTo: normalizePartnerBirthdayOfferCountdownTo(input.countdownTo ?? input.birthdayOfferEndsAt),
  }
}

/** CMSN stacked on one line after Flash/calendar, then 15% list cap. Teaser uses list (not expected sale). */
export function partnerSiteBirthdayDisplaySavings(input: {
  listUnitPrice: number
  chargedUnitPrice: number
  quantity?: number
  percent: unknown
  isClearance?: boolean
  siteSalePhase?: 'off' | 'teaser' | 'active' | null
}): number {
  if (input.isClearance === true) return 0
  const pct = normalizePartnerBirthdayOfferPercent(input.percent)
  if (!pct) return 0
  const list = Math.max(0, Math.round(Number(input.listUnitPrice) || 0))
  const chargedRaw = Math.max(0, Math.round(Number(input.chargedUnitPrice) || 0))
  const charged =
    input.siteSalePhase === 'teaser' || chargedRaw <= 0
      ? list
      : Math.min(list > 0 ? list : chargedRaw, chargedRaw)
  if (list <= 0 && charged <= 0) return 0
  const qty = Math.max(1, Math.min(99, Math.floor(Number(input.quantity) || 1)))
  return resolvePartnerSaleDiscountBreakdown({
    lines: [
      {
        inventoryId: null,
        quantity: qty,
        listUnitPrice: list || charged,
        effectiveUnitPrice: charged || list,
      },
    ],
    birthdayDiscountPercent: pct,
  }).birthdayDiscountAmount
}

export function partnerSiteBirthdaySaveText(amount: unknown, locale: WebLocale): string | null {
  const n = Math.max(0, Math.round(Number(amount) || 0))
  if (!(n > 0)) return null
  return partnerSiteSaleFill(partnerSiteSaleCopy(locale).birthdaySave, {
    amount: formatPartnerSaleMoney(n, locale),
  })
}

export function resolvePartnerBirthdayOfferFace(input: {
  percent?: unknown
  countdownTo?: string | null
  birthdayOfferPercent?: number | null
  birthdayOfferEndsAt?: string | null
  birthdayOffer?: { percent?: unknown; countdownTo?: string | null } | null
  isClearance?: boolean
  listUnitPrice: number
  chargedUnitPrice: number
  quantity?: number
  siteSalePhase?: 'off' | 'teaser' | 'active' | null
  locale: WebLocale
}): {
  percent: number
  hint: string | null
  saveText: string | null
  savings: number
  countdownTo: string | null
} | null {
  if (input.isClearance === true) return null
  const pct = normalizePartnerBirthdayOfferPercent(
    input.percent ?? input.birthdayOfferPercent ?? input.birthdayOffer?.percent
  )
  if (!pct) return null
  const savings = partnerSiteBirthdayDisplaySavings({
    listUnitPrice: input.listUnitPrice,
    chargedUnitPrice: input.chargedUnitPrice,
    quantity: input.quantity,
    percent: pct,
    isClearance: false,
    siteSalePhase: input.siteSalePhase,
  })
  return {
    percent: pct,
    hint: partnerSiteBirthdayCheckoutHint(pct, input.locale),
    saveText: partnerSiteBirthdaySaveText(savings, input.locale),
    savings,
    countdownTo: normalizePartnerBirthdayOfferCountdownTo(
      input.countdownTo ?? input.birthdayOfferEndsAt ?? input.birthdayOffer?.countdownTo
    ),
  }
}

export function attachPartnerBirthdayOffer<T extends { isClearance?: boolean }>(
  product: T,
  percentOrOffer: unknown,
  countdownTo?: string | null
): T & {
  birthdayOfferPercent: number
  birthdayOfferEndsAt: string | null
  birthdayOffer: PartnerSiteBirthdayOfferJson | null
} {
  let percent: unknown = percentOrOffer
  let ends = countdownTo ?? null
  if (percentOrOffer && typeof percentOrOffer === 'object' && !Array.isArray(percentOrOffer)) {
    const offer = percentOrOffer as { percent?: unknown; countdownTo?: string | null }
    percent = offer.percent
    ends = offer.countdownTo ?? ends
  }
  const pct = product.isClearance === true ? 0 : normalizePartnerBirthdayOfferPercent(percent)
  const countdown = pct > 0 ? normalizePartnerBirthdayOfferCountdownTo(ends) : null
  return {
    ...product,
    birthdayOfferPercent: pct,
    birthdayOfferEndsAt: countdown,
    birthdayOffer: pct > 0 ? { percent: pct, countdownTo: countdown } : null,
  }
}

export function formatPartnerSaleCountdownParts(targetIso: string | null | undefined, nowMs = Date.now()) {
  if (!targetIso) return null
  const target = Date.parse(targetIso)
  if (!Number.isFinite(target)) return null
  const diff = target - nowMs
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  const totalSec = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    expired: false,
  }
}

export function formatPartnerSaleCountdownCompact(targetIso: string | null | undefined, nowMs = Date.now()) {
  const parts = formatPartnerSaleCountdownParts(targetIso, nowMs)
  if (!parts || parts.expired) return ''
  const hms = `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}:${String(parts.seconds).padStart(2, '0')}`
  return parts.days > 0 ? `${parts.days}d ${hms}` : hms
}

export function formatPartnerSaleDayMonth(
  eventDate?: string | null,
  eventLabel?: string | null
): string | null {
  const date = String(eventDate ?? '').slice(0, 10)
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (ymd) return `${Number(ymd[3])}/${Number(ymd[2])}`
  const fromLabel = String(eventLabel ?? '').match(/(\d{1,2})\/(\d{1,2})/)
  if (fromLabel) return `${fromLabel[1]}/${fromLabel[2]}`
  return null
}

export function partnerSiteSalePromoKindOf(input: {
  kind?: string | null
  eventLabel?: string | null
  isClearance?: boolean
}): PartnerSiteSalePromoKind | null {
  const kind = String(input.kind || '').toLowerCase()
  if (kind === 'flash' || kind === 'calendar' || kind === 'clearance') return kind
  if (input.isClearance === true) return 'clearance'
  if (String(input.eventLabel || '').trim().toLowerCase() === 'flash sale') return 'flash'
  if (formatPartnerSaleDayMonth(null, input.eventLabel)) return 'calendar'
  return null
}

export function partnerSiteSaleDateBadgeLabel(input: {
  percent: number
  eventDate?: string | null
  eventLabel?: string | null
  kind?: string | null
  isClearance?: boolean
  locale?: WebLocale
}): string | null {
  const pct = Math.max(0, Math.round(Number(input.percent) || 0))
  if (pct <= 0 || pct >= 100) return null
  const copy = partnerSiteSaleCopy(input.locale ?? 'vi')
  const promo = partnerSiteSalePromoKindOf(input)
  if (promo === 'flash') return copy.flashBadge.replace('{pct}', String(pct))
  if (promo === 'clearance') return copy.clearanceBadge.replace('{pct}', String(pct))
  const date = formatPartnerSaleDayMonth(input.eventDate, input.eventLabel)
  if (date) return copy.calendarBadge.replace('{date}', date).replace('{pct}', String(pct))
  return `-${pct}%`
}

export function buildPartnerSiteSalePricing(
  listPrice: number,
  state: PartnerSaleCalendarState
): PartnerSiteSalePricing | null {
  if (state.phase === 'off' || state.discountPercent <= 0) return null
  const list = Math.max(0, Math.round(listPrice))
  if (list <= 0) return null
  const sale = applyPartnerSiteSalePrice(list, { ...state, phase: 'active' })
  const savings = Math.max(0, list - sale)
  if (savings <= 0 || sale <= 0) return null
  return {
    listPrice: list,
    displayPrice: state.phase === 'active' ? sale : list,
    savingsAmount: savings,
    percent: state.discountPercent,
    phase: state.phase,
    expectedSalePrice: state.phase === 'teaser' ? sale : null,
    eventLabel: state.eventLabel,
    eventDate: state.eventDate ?? state.saleDate,
    countdownTo: state.countdownTo,
    kind: 'calendar',
  }
}

function earliestIsoTimestamp(values: Array<string | null | undefined>): string | null {
  let best: number | null = null
  let bestIso: string | null = null
  for (const raw of values) {
    const t = Date.parse(String(raw || ''))
    if (!Number.isFinite(t)) continue
    if (best == null || t < best) {
      best = t
      bestIso = new Date(t).toISOString()
    }
  }
  return bestIso
}

export function applyPartnerSiteSaleToShopProduct<T extends PartnerSiteSaleProductInput>(
  product: T,
  state: PartnerSaleCalendarState,
  opts?: { clearanceEnabled?: boolean; clearancePercent?: number }
): T & {
  siteSale: PartnerSiteSalePricing | null
  siteSalePhase: PartnerSaleCalendarState['phase'] | 'off'
  siteSalePercent: number
  siteSaleExpectedPrice: number | null
} {
  const list = Math.max(0, Math.round(product.priceAmount ?? 0))
  const clearance = product.isClearance === true && opts?.clearanceEnabled !== false
  const clearancePct = Math.max(0, Math.round(opts?.clearancePercent ?? 0))
  const inventoryEffective =
    resolvePartnerEffectiveUnitPrice({
      priceAmount: list,
      salePriceAmount: product.salePriceAmount ?? null,
      saleStartsAt: product.saleStartsAt ?? null,
      saleEndsAt: product.saleEndsAt ?? null,
    }) ?? list
  const inventoryOnSale = inventoryEffective > 0 && inventoryEffective < list
  if (clearance && list > 0 && clearancePct > 0) {
    const clearancePrice = Math.max(0, Math.round(list * (1 - clearancePct / 100)))
    const display = clearancePrice < list ? clearancePrice : list
    const savings = Math.max(0, list - display)
    return {
      ...product,
      salePriceAmount: display < list ? display : null,
      saleStartsAt: null,
      saleEndsAt: null,
      siteSalePhase: 'off',
      siteSalePercent: clearancePct,
      siteSaleExpectedPrice: null,
      siteSale:
        savings > 0
          ? {
              kind: 'clearance',
              listPrice: list,
              displayPrice: display,
              savingsAmount: savings,
              percent: clearancePct,
              phase: 'active',
              expectedSalePrice: null,
              eventLabel: null,
              eventDate: null,
              countdownTo: null,
            }
          : null,
    }
  }
  const siteSale = list > 0 ? buildPartnerSiteSalePricing(list, state) : null
  const calendarCharging =
    state.phase === 'active' && Boolean(siteSale) && (siteSale?.displayPrice ?? list) < list
  const charged = calendarCharging && siteSale
    ? Math.min(siteSale.displayPrice, inventoryEffective)
    : inventoryEffective
  const chargedOnSale = charged > 0 && charged < list
  const endCandidates: Array<string | null | undefined> = []
  if (calendarCharging) endCandidates.push(state.countdownTo)
  if (inventoryOnSale) endCandidates.push(product.saleEndsAt)
  const saleEndsAt = chargedOnSale ? earliestIsoTimestamp(endCandidates) : null
  return {
    ...product,
    salePriceAmount: chargedOnSale ? charged : null,
    saleStartsAt: calendarCharging ? null : inventoryOnSale ? product.saleStartsAt ?? null : null,
    saleEndsAt,
    siteSalePhase: state.phase,
    siteSalePercent: siteSale?.percent ?? state.discountPercent,
    siteSaleExpectedPrice: siteSale?.expectedSalePrice ?? null,
    siteSale,
  }
}

export function resolvePartnerProductSaleFace(
  product: {
    priceAmount?: number | null
    salePriceAmount?: number | null
    saleStartsAt?: string | null
    saleEndsAt?: string | null
    isClearance?: boolean
    siteSalePhase?: 'off' | 'teaser' | 'active' | null
    siteSalePercent?: number | null
    siteSaleExpectedPrice?: number | null
    siteSale?: PartnerSiteSalePricing | null
  },
  locale: WebLocale = 'vi'
): PartnerProductSaleFace {
  const list = Math.max(0, Math.round(Number(product.priceAmount) || 0))
  const site = product.siteSale
  const promoKind = partnerSiteSalePromoKindOf({
    kind: site?.kind,
    eventLabel: site?.eventLabel,
    isClearance: product.isClearance === true,
  })
  const phase = site?.phase ?? product.siteSalePhase ?? 'off'
  const percent = site?.percent ?? product.siteSalePercent ?? 0
  const expected = site?.expectedSalePrice ?? product.siteSaleExpectedPrice ?? null
  const copy = partnerSiteSaleCopy(locale)
  const programLabel =
    promoKind === 'clearance'
      ? copy.clearanceName
      : promoKind === 'flash'
        ? 'Flash sale'
        : site?.eventLabel ?? null
  const badge = partnerSiteSaleDateBadgeLabel({
    percent,
    eventDate: site?.eventDate,
    eventLabel: site?.eventLabel,
    kind: site?.kind ?? promoKind,
    isClearance: product.isClearance === true,
    locale,
  })
  if (
    promoKind !== 'clearance' &&
    phase === 'teaser' &&
    list > 0 &&
    percent > 0 &&
    expected != null &&
    expected > 0 &&
    expected < list
  ) {
    return {
      kind: 'teaser',
      promoKind: promoKind ?? 'calendar',
      listPrice: list,
      displayPrice: list,
      comparePrice: null,
      expectedPrice: Math.round(expected),
      percent,
      savings: Math.max(0, list - Math.round(expected)),
      badge,
      countdownTo: site?.countdownTo ?? null,
      eventLabel: programLabel,
    }
  }
  const sale = normalizePartnerSalePriceAmount(product.salePriceAmount)
  const nowMs = Date.now()
  const countdownMs = site?.countdownTo ? Date.parse(String(site.countdownTo)) : NaN
  const overlayRunning =
    phase === 'active' &&
    (promoKind === 'flash' || promoKind === 'calendar') &&
    (!Number.isFinite(countdownMs) || nowMs < countdownMs)
  const overlayExpired =
    (promoKind === 'flash' || promoKind === 'calendar') &&
    Number.isFinite(countdownMs) &&
    nowMs >= countdownMs
  const inventoryRunning = isPartnerFlashSaleActive(
    {
      priceAmount: list,
      salePriceAmount: product.salePriceAmount ?? null,
      saleStartsAt: product.saleStartsAt ?? null,
      saleEndsAt: product.saleEndsAt ?? null,
    },
    nowMs
  )
  const canChargeSale =
    promoKind === 'clearance' ||
    overlayRunning ||
    (inventoryRunning && !overlayExpired && promoKind !== 'flash')
  if (sale != null && list > 0 && sale < list && canChargeSale) {
    const livePct =
      percent > 0 && percent < 100 ? percent : Math.max(1, Math.round(((list - sale) * 100) / list))
    return {
      kind: 'active',
      promoKind: promoKind,
      listPrice: list,
      displayPrice: sale,
      comparePrice: list,
      expectedPrice: null,
      percent: livePct,
      savings: list - sale,
      badge:
        badge ??
        partnerSiteSaleDateBadgeLabel({
          percent: livePct,
          eventDate: site?.eventDate,
          eventLabel: site?.eventLabel,
          kind: site?.kind ?? promoKind,
          isClearance: product.isClearance === true,
          locale,
        }) ??
        `-${livePct}%`,
      countdownTo:
        promoKind === 'clearance' ? null : site?.countdownTo ?? product.saleEndsAt ?? null,
      eventLabel: programLabel,
    }
  }
  return {
    kind: null,
    promoKind: null,
    listPrice: list,
    displayPrice: list,
    comparePrice: null,
    expectedPrice: null,
    percent: 0,
    savings: 0,
    badge: null,
    countdownTo: null,
    eventLabel: null,
  }
}

export function partnerSiteSaleBannerText(state: PartnerSaleCalendarState, locale: WebLocale): string | null {
  if (!state.enabled || state.phase === 'off' || state.discountPercent <= 0) return null
  const copy = partnerSiteSaleCopy(locale)
  const template = state.phase === 'active' ? copy.activeBanner : copy.teaserBanner
  return template.replace('{label}', state.eventLabel).replace('{pct}', String(state.discountPercent))
}

const SALE_BANNER_PAGES = new Set(['home', 'listing', 'product', 'cart', 'account', 'info'])

/** Thanh thông báo dưới head — mọi trang shop kể cả trang chủ. Landing chiến dịch không dùng strip. */
export function partnerSiteSaleBannerShowsOnPage(page: string | null | undefined): boolean {
  return SALE_BANNER_PAGES.has(String(page || '').trim().toLowerCase())
}

export function partnerSiteSaleBannerStorageKey(state: {
  eventDate?: string | null
  phase?: string | null
}): string {
  const date = String(state.eventDate || 'none').slice(0, 10)
  const phase = String(state.phase || 'off')
  return `pw_site_sale_banner_${date}_${phase}`
}

export function partnerSiteSalePillText(
  face: Pick<PartnerProductSaleFace, 'kind' | 'promoKind' | 'percent' | 'eventLabel' | 'badge'>,
  locale: WebLocale
): string | null {
  if (face.kind !== 'teaser' && face.kind !== 'active') return null
  if (!(face.percent > 0)) return null
  if (face.promoKind === 'flash' || face.promoKind === 'clearance') {
    return String(face.badge || '').trim() || null
  }
  const copy = partnerSiteSaleCopy(locale)
  const label =
    String(face.eventLabel || '').trim() || (face.kind === 'teaser' ? copy.teaserFallback : copy.activeFallback)
  const tpl = face.kind === 'active' ? copy.activePill : copy.teaserPill
  return tpl.replace('{label}', label).replace('{pct}', String(face.percent))
}

export function formatPartnerSaleMoney(amount: number, locale: WebLocale) {
  try {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale, {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(amount)))
  } catch {
    return formatPartnerShopMoneyVnd(amount)
  }
}

export const PW_SITE_SALE_CARD_CSS = [
  '.pw-badge-sale{position:absolute;top:8px;left:8px;z-index:2;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;letter-spacing:.02em;line-height:1.2;max-width:calc(100% - 52px);white-space:normal}',
  '.pw-badge-sale-teaser{background:#d97706}',
  '.pw-badge-sale-active{background:#dc2626}',
  '.pw-badge-sale-flash,.pw-pdp-sale-pill-flash{background:#e11d48}',
  '.pw-badge-sale-clearance,.pw-pdp-sale-pill-clearance{background:#b45309}',
  '.pw-sale-chip{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:4px 6px;color:#fff;font:700 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";white-space:nowrap;overflow:hidden;contain:layout style paint;isolation:isolate;transform:translateZ(0);pointer-events:none}',
  '.pw-sale-chip-teaser{background:rgba(180,83,9,.95)}',
  '.pw-sale-chip-active{background:rgba(185,28,28,.95)}',
  '.pw-sale-chip-flash{background:rgba(225,29,72,.95)}',
  '.pw-price-sale{color:var(--pw-primary);font-weight:800}',
  '.pw-price-compare{margin-left:6px;color:#9ca3af;font-weight:500;text-decoration:line-through}',
  '.pw-price-expected{display:inline;margin-left:6px;color:#047857;font-weight:700}',
  '.pw-price-teaser,.pw-price-save{display:block;margin-top:2px;font-size:11px;font-weight:600}',
  '.pw-price-teaser{color:#b45309}',
  '.pw-price-save{color:#059669}',
  '.pw-pdp-sale-pill{display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;padding:4px 10px;border-radius:999px;color:#fff;font:700 12px/1.2 system-ui,sans-serif}',
  '.pw-pdp-sale-pill-teaser{background:#d97706}',
  '.pw-pdp-sale-pill-active{background:#dc2626}',
  '.pw-pdp-sale-timer{display:flex;align-items:center;gap:6px;margin:0 0 8px;padding:8px 10px;border-radius:10px;font:600 12px/1.35 system-ui,sans-serif}',
  '.pw-pdp-sale-timer-teaser{border:1px solid #fde68a;background:#fffbeb;color:#78350f}',
  '.pw-pdp-sale-timer-active{border:1px solid #fecaca;background:#fef2f2;color:#7f1d1d}',
  '.pw-pdp-sale-timer-flash{border:1px solid #fecdd3;background:#fff1f2;color:#9f1239}',
  '.pw-pdp-price-kicker{margin:0 0 4px;font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#6b7280}',
  '.pw-pdp-cap-note{margin:0 0 8px;font:500 11px/1.4 system-ui,sans-serif;color:#92400e}',
  '.pw-badge-birthday{position:absolute;top:8px;right:8px;z-index:2;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;letter-spacing:.02em;line-height:1.2;background:#db2777}',
  '.pw-price-birthday{display:block;margin-top:2px;font-size:11px;font-weight:600;color:#db2777}',
  '.pw-pdp-birthday-hint{display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin:0 0 8px;padding:8px 10px;border-radius:10px;background:#fdf2f8;color:#be185d;border:1px solid #fbcfe8;font:700 12px/1.35 system-ui,sans-serif}',
  '.pw-pdp-birthday-count,[data-pw-variant-birthday-count]{display:inline-flex;align-items:center;gap:4px;font:600 12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;color:#9d174d}',
  '[data-pw-variant-birthday]{display:flex;flex-direction:column;gap:4px;margin:6px 0 0;font:600 12px/1.35 system-ui,sans-serif;color:#be185d}',
  '[data-pw-variant-birthday-save],[data-pw-variant-total-birthday],.pw-pdp-birthday-hint span{font-weight:700;color:#be185d}',
  '.pw-pdp-birthday-hint{display:flex;flex-direction:column;gap:4px;margin:6px 0 0}',
  '[data-pw-sale-calendar-banner]{position:relative;z-index:2;display:block;width:100%;box-sizing:border-box;padding:8px 40px 8px 12px;border-bottom:1px solid #fde68a;font:400 13px/1.4 system-ui,sans-serif;contain:layout style paint;isolation:isolate;transform:translateZ(0);flex-shrink:0}',
  '[data-pw-sale-calendar-banner][data-pw-sale-phase="teaser"]{background:linear-gradient(90deg,#fffbeb,#fff7ed);color:#78350f;border-color:#fde68a}',
  '[data-pw-sale-calendar-banner][data-pw-sale-phase="active"]{background:linear-gradient(90deg,#ffedd5,#fef2f2);color:#7c2d12;border-color:#fdba74}',
  '[data-pw-sale-calendar-banner] [data-pw-sale-title]{margin:0;font:700 13px/1.35 system-ui,sans-serif}',
  '[data-pw-sale-calendar-banner] [data-pw-sale-msg]{margin:2px 0 0;font-size:12px;opacity:.92}',
  '[data-pw-sale-calendar-banner] [data-pw-sale-count]{margin:4px 0 0;display:block;min-height:1.3em;font:600 12px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";white-space:nowrap;overflow:hidden;contain:layout style paint}',
  '[data-pw-sale-hms]{display:inline-block;min-width:11ch;font:inherit;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";white-space:nowrap;contain:layout style paint}',
  '.pw-sale-count,[data-pw-variant-sale-count]{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
  '[data-pw-sale-calendar-banner] [data-pw-sale-close]{position:absolute;right:6px;top:6px;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:inherit;opacity:.7;cursor:pointer;font:600 18px/1 system-ui,sans-serif}',
  '[data-pw-sale-calendar-banner] [data-pw-sale-close]:hover{background:rgba(255,255,255,.55);opacity:1}',
].join('')

export const PW_SITE_SALE_VIEW_JS = `function kindOfSale(site,p){
  var kind=String((site&&site.kind)||'');
  var label=String((site&&(site.eventLabel||site.event_label))||'');
  if(kind==='flash'||label.toLowerCase()==='flash sale')return 'flash';
  if(kind==='clearance'||(p&&p.isClearance===true))return 'clearance';
  if(kind==='calendar')return 'calendar';
  if(/(\\d{1,2})\\/(\\d{1,2})/.test(label))return 'calendar';
  return '';
}
function siteSaleBadge(p,pct){
  var site=p&&p.siteSale||{};
  var kind=kindOfSale(site,p);
  var date=String(site.eventDate||site.event_date||'');
  var label=String(site.eventLabel||site.event_label||'');
  if(kind==='flash')return String((typeof COPY==='object'&&COPY&&COPY.flashBadge)||'Flash sale -{pct}%').replace('{pct}',pct);
  if(kind==='clearance')return String((typeof COPY==='object'&&COPY&&COPY.clearanceBadge)||'Sale thanh lý kho -{pct}%').replace('{pct}',pct);
  var m=/^(\\d{4})-(\\d{2})-(\\d{2})/.exec(date);
  var dm=m?Number(m[3])+'/'+Number(m[2]):'';
  if(!dm){var lm=label.match(/(\\d{1,2})\\/(\\d{1,2})/);if(lm)dm=lm[1]+'/'+lm[2];}
  if(dm)return String((typeof COPY==='object'&&COPY&&COPY.calendarBadge)||'Sale {date} - {pct}%').replace('{date}',dm).replace('{pct}',pct);
  return pct>0?'-'+pct+'%':'';
}
function saleView(p){
  var list=Number(p&&p.priceAmount);
  if(!Number.isFinite(list)||list<=0)return null;
  var site=p&&p.siteSale||{};
  var phase=site.phase||p.siteSalePhase||'';
  var pct=Math.max(0,Math.round(Number(site.percent||p.siteSalePercent||0)||0));
  var expected=Number(site.expectedSalePrice||site.expected_sale_price||p.siteSaleExpectedPrice);
  var countdown=site.countdownTo||site.countdown_to||'';
  var promoKind=kindOfSale(site,p);
  var badge=pct>0&&pct<100?siteSaleBadge(p,pct):'';
  var program=promoKind==='flash'?String((typeof COPY==='object'&&COPY&&COPY.flashName)||'Flash sale')
    :promoKind==='clearance'?String((typeof COPY==='object'&&COPY&&COPY.clearanceName)||'Sale thanh lý kho')
    :String(site.eventLabel||site.event_label||'');
  if(!program)program=phase==='teaser'?String((typeof COPY==='object'&&COPY&&COPY.teaserFallback)||'Sắp sale'):String((typeof COPY==='object'&&COPY&&COPY.activeFallback)||'Sale cùng ngày tháng');
  if(promoKind!=='clearance'&&phase==='teaser'&&pct>0&&pct<100&&Number.isFinite(expected)&&expected>0&&expected<list){
    return {kind:'teaser',promoKind:promoKind||'calendar',program:program,price:money(list),expected:money(expected),compare:'',percent:pct,badge:badge,savings:money(list-expected),countdown:countdown};
  }
  if(p.salePriceAmount==null||p.salePriceAmount==='')return null;
  var sale=Number(p.salePriceAmount);
  if(!Number.isFinite(sale)||sale<=0||sale>=list)return null;
  var now=Date.now();
  if(promoKind!=='clearance'&&phase==='active'&&countdown){
    var ct=Date.parse(countdown);
    if(Number.isFinite(ct)&&now>=ct)return null;
  }
  if(promoKind!=='clearance'){
    var start=p.saleStartsAt?Date.parse(p.saleStartsAt):NaN,end=p.saleEndsAt?Date.parse(p.saleEndsAt):NaN;
    if(Number.isFinite(start)&&now<start)return null;
    if(Number.isFinite(end)&&now>=end)return null;
  }
  var livePct=pct>0&&pct<100?pct:Math.max(1,Math.round((list-sale)*100/list));
  return {kind:'active',promoKind:promoKind,program:program,price:money(sale),compare:money(list),expected:'',percent:livePct,badge:badge||siteSaleBadge(p,livePct)||('-'+livePct+'%'),savings:money(list-sale),countdown:promoKind==='clearance'?'':countdown||p.saleEndsAt||''};
}`

/** Update countdown digits without childList (avoids shop hydrate / chrome flicker each second). */
export function writePartnerSaleCountdownNode(el: Element | null | undefined, next: string) {
  if (!el) return
  const text = String(next || '')
  const node = el.firstChild
  if (node && node.nodeType === 3 && !node.nextSibling) {
    if (node.nodeValue !== text) node.nodeValue = text
    return
  }
  if ((el.textContent || '') !== text) el.textContent = text
}

export const PW_SITE_SALE_MO_SKIP_SEL =
  '[data-pw-sale-hms],.pw-sale-chip,[data-pw-sale-count],[data-pw-sale-calendar-banner],[data-pw-variant-sale-count],.pw-pdp-sale-timer,.pw-shop-cart-line-count'

export const PW_SITE_SALE_TICK_CHIPS_JS = `function pwSaleSetText(el,next){
  if(!el)return;
  next=String(next||'');
  var n=el.firstChild;
  if(n&&n.nodeType===3&&!n.nextSibling){
    if(n.nodeValue!==next)n.nodeValue=next;
    return;
  }
  if((el.textContent||'')===next)return;
  el.textContent=next;
}
function pwSaleFmtChip(iso){
  if(!iso)return '';
  var t=Date.parse(iso);if(!Number.isFinite(t))return '';
  var d=t-Date.now();if(d<=0)return '';
  var s=Math.floor(d/1000),days=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60;
  var hms=('0'+h).slice(-2)+':'+('0'+m).slice(-2)+':'+('0'+sec).slice(-2);
  return days>0?days+'d '+hms:hms;
}
function pwSaleInView(el){
  if(!el||!el.getBoundingClientRect)return true;
  var r=el.getBoundingClientRect();
  var h=window.innerHeight||0,w=window.innerWidth||0;
  return r.bottom>0&&r.right>0&&r.top<h&&r.left<w;
}
function pwSaleTickChips(remaining,startsAfter,flashRemaining,countdownStarts,countdownLeft){
  document.querySelectorAll('.pw-sale-chip[data-pw-sale-countdown],.pw-pdp-sale-timer[data-pw-sale-countdown],.pw-shop-cart-line-count[data-pw-sale-countdown],.pw-pdp-birthday-count[data-pw-sale-countdown],[data-pw-variant-birthday-count][data-pw-sale-countdown]').forEach(function(el){
    if(el.closest&&el.closest('[data-pw-sale-calendar-banner],[data-pw-variant-sale]'))return;
    if(!pwSaleInView(el))return;
    var iso=el.getAttribute('data-pw-sale-countdown')||'';
    var phase=el.getAttribute('data-pw-sale-phase')||'teaser';
    var promo=el.getAttribute('data-pw-sale-kind')||'';
    var label=el.getAttribute('data-pw-sale-label')||'';
    var left=pwSaleFmtChip(iso);
    if(!left){
      if(!el.hidden)el.hidden=true;
      return;
    }
    if(el.hidden)el.hidden=false;
    var bdayEnds=typeof COPY==='object'&&COPY&&COPY.birthdayEndsAfter?String(COPY.birthdayEndsAfter):'';
    var prefix=promo==='birthday'&&bdayEnds?bdayEnds
      :promo==='flash'&&flashRemaining?flashRemaining
      :(label&&countdownStarts&&countdownLeft?String(phase==='active'?countdownLeft:countdownStarts).replace('{label}',label)
      :String(phase==='active'?remaining:startsAfter));
    var hms=el.querySelector('[data-pw-sale-hms]');
    if(!hms){
      el.textContent='';
      el.appendChild(document.createTextNode(prefix+' '));
      hms=document.createElement('span');
      hms.setAttribute('data-pw-sale-hms','1');
      hms.appendChild(document.createTextNode(left));
      el.appendChild(hms);
      return;
    }
    pwSaleSetText(hms,left);
  });
}`

export const PW_SITE_SALE_MO_SKIP_JS = `function pwSaleMoSkip(recs){
  if(!recs||!recs.length)return false;
  var sel=${JSON.stringify(PW_SITE_SALE_MO_SKIP_SEL)};
  for(var i=0;i<recs.length;i++){
    var tg=recs[i].target;
    var el=tg&&(tg.nodeType===1?tg:tg.parentElement||tg.parentNode);
    if(!el||!el.closest||!el.closest(sel))return false;
  }
  return true;
}`
