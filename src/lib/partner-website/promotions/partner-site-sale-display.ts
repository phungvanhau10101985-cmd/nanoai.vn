import type { WebLocale } from '@/lib/i18n/config'
import {
  applyPartnerSiteSalePrice,
  type PartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  formatPartnerShopMoneyVnd,
  normalizePartnerSalePriceAmount,
  resolvePartnerEffectiveUnitPrice,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
export type PartnerSiteSaleProductInput = {
  priceAmount?: number | null
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  isClearance?: boolean
}

export type PartnerSiteSalePricing = {
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

export const PARTNER_SITE_SALE_COPY: Record<
  WebLocale,
  {
    teaserBanner: string
    activeBanner: string
    daysLeft: string
    expectedPrice: string
    expectedSave: string
    save: string
    startsAfter: string
    remaining: string
    teaserCartHint: string
    ended: string
  }
> = {
  vi: {
    teaserBanner: '{label} sắp diễn ra — giảm {pct}% trong ngày sale',
    activeBanner: '{label} đang diễn ra — giảm {pct}% toàn website',
    daysLeft: '{n} ngày nữa',
    expectedPrice: 'Giá sale dự kiến',
    expectedSave: 'Sắp giảm {pct}% — tiết kiệm ~{amount}',
    save: 'Tiết kiệm {amount}',
    startsAfter: 'bắt đầu sau',
    remaining: 'còn',
    teaserCartHint: 'Tiết kiệm dự kiến khi sale {label} (-{pct}%)',
    ended: 'Đã kết thúc',
  },
  en: {
    teaserBanner: '{label} is coming — {pct}% off on sale day',
    activeBanner: '{label} is live — {pct}% off sitewide',
    daysLeft: '{n} days left',
    expectedPrice: 'Expected sale price',
    expectedSave: 'Coming {pct}% off — save ~{amount}',
    save: 'Save {amount}',
    startsAfter: 'starts in',
    remaining: 'left',
    teaserCartHint: 'Expected savings when {label} starts (-{pct}%)',
    ended: 'Ended',
  },
  zh: {
    teaserBanner: '{label}即将开始 — 活动日全站减{pct}%',
    activeBanner: '{label}进行中 — 全站减{pct}%',
    daysLeft: '还有{n}天',
    expectedPrice: '预计促销价',
    expectedSave: '即将减{pct}% — 约省{amount}',
    save: '节省 {amount}',
    startsAfter: '开始倒计时',
    remaining: '剩余',
    teaserCartHint: '{label}开始后预计节省 (-{pct}%)',
    ended: '已结束',
  },
  ja: {
    teaserBanner: '{label}まもなく開催 — 当日{pct}%オフ',
    activeBanner: '{label}開催中 — 全品{pct}%オフ',
    daysLeft: 'あと{n}日',
    expectedPrice: '予定セール価格',
    expectedSave: 'まもなく{pct}%オフ — 約{amount}お得',
    save: '{amount} お得',
    startsAfter: '開始まで',
    remaining: '残り',
    teaserCartHint: '{label}開始時の予定節約額 (-{pct}%)',
    ended: '終了しました',
  },
  ko: {
    teaserBanner: '{label} 곧 시작 — 세일 당일 {pct}% 할인',
    activeBanner: '{label} 진행 중 — 전 상품 {pct}% 할인',
    daysLeft: '{n}일 남음',
    expectedPrice: '예정 세일가',
    expectedSave: '곧 {pct}% 할인 — 약 {amount} 절약',
    save: '{amount} 절약',
    startsAfter: '시작까지',
    remaining: '남음',
    teaserCartHint: '{label} 시작 시 예상 절약 (-{pct}%)',
    ended: '종료됨',
  },
}

export function partnerSiteSaleCopy(locale: WebLocale) {
  return PARTNER_SITE_SALE_COPY[locale] ?? PARTNER_SITE_SALE_COPY.en
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

export function partnerSiteSaleDateBadgeLabel(input: {
  percent: number
  eventDate?: string | null
  eventLabel?: string | null
}): string | null {
  const pct = Math.max(0, Math.round(Number(input.percent) || 0))
  if (pct <= 0 || pct >= 100) return null
  const date = String(input.eventDate ?? '').slice(0, 10)
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (ymd) return `${Number(ymd[3])}/${Number(ymd[2])} - ${pct}%`
  const fromLabel = String(input.eventLabel ?? '').match(/(\d{1,2})\/(\d{1,2})/)
  if (fromLabel) return `${fromLabel[1]}/${fromLabel[2]} - ${pct}%`
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
  }
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
  const flash =
    resolvePartnerEffectiveUnitPrice({
      priceAmount: list,
      salePriceAmount: product.salePriceAmount ?? null,
      saleStartsAt: product.saleStartsAt ?? null,
      saleEndsAt: product.saleEndsAt ?? null,
    }) ?? list
  if (clearance && list > 0 && clearancePct > 0) {
    const clearancePrice = Math.max(0, Math.round(list * (1 - clearancePct / 100)))
    return {
      ...product,
      salePriceAmount: clearancePrice < list ? clearancePrice : product.salePriceAmount,
      siteSalePhase: 'off',
      siteSalePercent: clearancePct,
      siteSaleExpectedPrice: null,
      siteSale: null,
    }
  }
  const siteSale = list > 0 ? buildPartnerSiteSalePricing(list, state) : null
  const activePrice =
    state.phase === 'active' && siteSale
      ? Math.min(siteSale.displayPrice, flash)
      : null
  return {
    ...product,
    salePriceAmount: activePrice ?? product.salePriceAmount,
    saleStartsAt: activePrice != null ? null : product.saleStartsAt,
    saleEndsAt: activePrice != null ? null : product.saleEndsAt,
    siteSalePhase: state.phase,
    siteSalePercent: siteSale?.percent ?? state.discountPercent,
    siteSaleExpectedPrice: siteSale?.expectedSalePrice ?? null,
    siteSale,
  }
}

export function resolvePartnerProductSaleFace(product: {
  priceAmount?: number | null
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  isClearance?: boolean
  siteSalePhase?: 'off' | 'teaser' | 'active' | null
  siteSalePercent?: number | null
  siteSaleExpectedPrice?: number | null
  siteSale?: PartnerSiteSalePricing | null
}): PartnerProductSaleFace {
  const list = Math.max(0, Math.round(Number(product.priceAmount) || 0))
  const site = product.siteSale
  const phase = site?.phase ?? product.siteSalePhase ?? 'off'
  const percent = site?.percent ?? product.siteSalePercent ?? 0
  const expected = site?.expectedSalePrice ?? product.siteSaleExpectedPrice ?? null
  const badge = partnerSiteSaleDateBadgeLabel({
    percent,
    eventDate: site?.eventDate,
    eventLabel: site?.eventLabel,
  })
  if (phase === 'teaser' && list > 0 && percent > 0 && expected != null && expected > 0 && expected < list) {
    return {
      kind: 'teaser',
      listPrice: list,
      displayPrice: list,
      comparePrice: null,
      expectedPrice: Math.round(expected),
      percent,
      savings: Math.max(0, list - Math.round(expected)),
      badge,
      countdownTo: site?.countdownTo ?? null,
      eventLabel: site?.eventLabel ?? null,
    }
  }
  const sale = normalizePartnerSalePriceAmount(product.salePriceAmount)
  if (sale != null && list > 0 && sale < list) {
    return {
      kind: 'active',
      listPrice: list,
      displayPrice: sale,
      comparePrice: list,
      expectedPrice: null,
      percent: percent > 0 && percent < 100 ? percent : Math.max(1, Math.round(((list - sale) * 100) / list)),
      savings: list - sale,
      badge: badge ?? `-${Math.max(1, Math.round(((list - sale) * 100) / list))}%`,
      countdownTo: site?.countdownTo ?? null,
      eventLabel: site?.eventLabel ?? null,
    }
  }
  return {
    kind: null,
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
  '.pw-badge-sale{position:absolute;top:8px;left:8px;z-index:2;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;letter-spacing:.02em;line-height:1.2}',
  '.pw-badge-sale-teaser{background:#d97706}',
  '.pw-badge-sale-active{background:#dc2626}',
  '.pw-sale-chip{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:4px 6px;color:#fff;font:700 10px/1.2 system-ui,sans-serif;text-align:center}',
  '.pw-sale-chip-teaser{background:rgba(180,83,9,.95)}',
  '.pw-sale-chip-active{background:rgba(185,28,28,.95)}',
  '.pw-price-sale{color:var(--pw-primary);font-weight:800}',
  '.pw-price-compare{margin-left:6px;color:#9ca3af;font-weight:500;text-decoration:line-through}',
  '.pw-price-expected{display:inline;margin-left:6px;color:#047857;font-weight:700}',
  '.pw-price-teaser,.pw-price-save{display:block;margin-top:2px;font-size:11px;font-weight:600}',
  '.pw-price-teaser{color:#b45309}',
  '.pw-price-save{color:#059669}',
  '.pw-pdp-sale-pill{display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;padding:4px 10px;border-radius:999px;color:#fff;font:700 12px/1.2 system-ui,sans-serif}',
  '.pw-pdp-sale-pill-teaser{background:#d97706}',
  '.pw-pdp-sale-pill-active{background:#dc2626}',
].join('')

export const PW_SITE_SALE_VIEW_JS = `function siteSaleBadge(p,pct){
  var site=p&&p.siteSale||{};
  var date=String(site.eventDate||site.event_date||'');
  var label=String(site.eventLabel||site.event_label||'');
  var m=/^(\\d{4})-(\\d{2})-(\\d{2})/.exec(date);
  if(m)return Number(m[3])+'/'+Number(m[2])+' - '+pct+'%';
  var lm=label.match(/(\\d{1,2})\\/(\\d{1,2})/);
  if(lm)return lm[1]+'/'+lm[2]+' - '+pct+'%';
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
  var badge=pct>0&&pct<100?siteSaleBadge(p,pct):'';
  if(phase==='teaser'&&pct>0&&pct<100&&Number.isFinite(expected)&&expected>0&&expected<list){
    return {kind:'teaser',price:money(list),expected:money(expected),compare:'',percent:pct,badge:badge,savings:money(list-expected),countdown:countdown};
  }
  if(p.salePriceAmount==null||p.salePriceAmount==='')return null;
  var sale=Number(p.salePriceAmount);
  if(!Number.isFinite(sale)||sale<=0||sale>=list)return null;
  var now=Date.now(),start=p.saleStartsAt?Date.parse(p.saleStartsAt):NaN,end=p.saleEndsAt?Date.parse(p.saleEndsAt):NaN;
  if(Number.isFinite(start)&&now<start)return null;
  if(Number.isFinite(end)&&now>end)return null;
  var livePct=pct>0&&pct<100?pct:Math.max(1,Math.round((list-sale)*100/list));
  return {kind:'active',price:money(sale),compare:money(list),expected:'',percent:livePct,badge:badge||('-'+livePct+'%'),savings:money(list-sale),countdown:countdown};
}`
