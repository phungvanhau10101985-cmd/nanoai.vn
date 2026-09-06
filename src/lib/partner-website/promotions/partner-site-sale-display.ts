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
  countdownStarts: string
  countdownLeft: string
  teaserCartHint: string
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
    expectedPrice: 'Giá sale dự kiến',
    expectedSave: 'Sắp giảm {pct}% — tiết kiệm ~{amount}',
    teaserSave: 'Tiết kiệm dự kiến ~{amount}',
    save: 'Tiết kiệm {amount}',
    startsAfter: 'bắt đầu sau',
    remaining: 'còn',
    countdownStarts: '{label} bắt đầu sau',
    countdownLeft: '{label} — còn',
    teaserCartHint: 'Tiết kiệm dự kiến khi sale {label} (-{pct}%)',
    ended: 'Đã kết thúc',
    teaserPill: '{label} — giảm {pct}% trong ngày sale',
    activePill: '{label} — giảm {pct}%',
    teaserFallback: 'Sắp sale',
    activeFallback: 'Sale ngày trùng tháng',
    listPriceLabel: 'Giá gốc',
    offerPriceLabel: 'Giá ưu đãi',
    close: 'Đóng',
    program: 'Chương trình sale',
  },
  en: {
    teaserBanner: '{label} is coming — {pct}% off on sale day',
    activeBanner: '{label} is live — {pct}% off sitewide',
    daysLeft: '{n} days left',
    expectedPrice: 'Expected sale price',
    expectedSave: 'Coming {pct}% off — save ~{amount}',
    teaserSave: 'Expected savings ~{amount}',
    save: 'Save {amount}',
    startsAfter: 'starts in',
    remaining: 'left',
    countdownStarts: '{label} starts in',
    countdownLeft: '{label} —',
    teaserCartHint: 'Expected savings when {label} starts (-{pct}%)',
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
    expectedPrice: '预计促销价',
    expectedSave: '即将减{pct}% — 约省{amount}',
    teaserSave: '预计节省 ~{amount}',
    save: '节省 {amount}',
    startsAfter: '开始倒计时',
    remaining: '剩余',
    countdownStarts: '{label}开始倒计时',
    countdownLeft: '{label} — 剩余',
    teaserCartHint: '{label}开始后预计节省 (-{pct}%)',
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
    expectedPrice: '予定セール価格',
    expectedSave: 'まもなく{pct}%オフ — 約{amount}お得',
    teaserSave: '予定のお得額 ~{amount}',
    save: '{amount} お得',
    startsAfter: '開始まで',
    remaining: '残り',
    countdownStarts: '{label}開始まで',
    countdownLeft: '{label} — 残り',
    teaserCartHint: '{label}開始時の予定節約額 (-{pct}%)',
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
    expectedPrice: '예정 세일가',
    expectedSave: '곧 {pct}% 할인 — 약 {amount} 절약',
    teaserSave: '예상 절약 ~{amount}',
    save: '{amount} 절약',
    startsAfter: '시작까지',
    remaining: '남음',
    countdownStarts: '{label} 시작까지',
    countdownLeft: '{label} — 남은 시간',
    teaserCartHint: '{label} 시작 시 예상 절약 (-{pct}%)',
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
  face: Pick<PartnerProductSaleFace, 'kind' | 'percent' | 'eventLabel'>,
  locale: WebLocale
): string | null {
  if (face.kind !== 'teaser' && face.kind !== 'active') return null
  if (!(face.percent > 0)) return null
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
  '.pw-badge-sale{position:absolute;top:8px;left:8px;z-index:2;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;letter-spacing:.02em;line-height:1.2}',
  '.pw-badge-sale-teaser{background:#d97706}',
  '.pw-badge-sale-active{background:#dc2626}',
  '.pw-sale-chip{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:4px 6px;color:#fff;font:700 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center;font-variant-numeric:tabular-nums;font-feature-settings:"tnum";white-space:nowrap;overflow:hidden;contain:layout style paint;isolation:isolate;transform:translateZ(0);pointer-events:none}',
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
  '[data-pw-sale-hms],.pw-sale-chip,[data-pw-sale-count],[data-pw-sale-calendar-banner],[data-pw-variant-sale-count]'

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
function pwSaleTickChips(remaining,startsAfter){
  document.querySelectorAll('.pw-sale-chip[data-pw-sale-countdown]').forEach(function(el){
    if(el.closest&&el.closest('[data-pw-sale-calendar-banner],[data-pw-variant-sale]'))return;
    if(!pwSaleInView(el))return;
    var iso=el.getAttribute('data-pw-sale-countdown')||'';
    var phase=el.getAttribute('data-pw-sale-phase')||'teaser';
    var left=pwSaleFmtChip(iso);
    if(!left){
      if(!el.hidden)el.hidden=true;
      return;
    }
    if(el.hidden)el.hidden=false;
    var hms=el.querySelector('[data-pw-sale-hms]');
    if(!hms){
      el.textContent='';
      el.appendChild(document.createTextNode(String(phase==='active'?remaining:startsAfter)+' '));
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
