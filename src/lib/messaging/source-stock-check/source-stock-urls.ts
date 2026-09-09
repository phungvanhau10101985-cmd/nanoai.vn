/**
 * Quy đổi URL nguồn + đủ điều kiện worker — khớp import_cssbuy_client / import_batch_url_coercion (188).
 */

import {
  extract1688OfferId,
  extractAbbOfferDigits,
  extractTaobaoTmallItemId,
  normalizeProductImportUrl,
  parseTPrefixedItemId,
} from '@/lib/messaging/listing-import/import-source-ids'
import {
  buildPandamall1688PdpUrl,
  buildPandamallTaobaoPdpUrl,
  buildVipomallPdpUrl,
  extractPandamallDetail,
  extractVipomallOfferId,
  extractVipomallPlatformType,
  resolvePandamallImportUrl,
  resolveVipomallImportUrl,
  VIPOMALL_PLATFORM_1688,
  VIPOMALL_PLATFORM_TAOBAO,
} from '@/lib/messaging/listing-import/listing-import-urls'

const CSSBUY_HOST_OK = /^(?:www\.)?cssbuy\.com$/i

const ELIGIBLE_MARKERS = [
  '1688.com',
  'offer.1688',
  'detail.1688',
  'taobao.com',
  'tmall.com',
  'vipomall.vn',
  'cssbuy.com',
  'pandamall.vn',
] as const

export const SOURCE_STOCK_ELIGIBLE_MARKERS = ELIGIBLE_MARKERS

export function linkEligibleForSourceStockCheck(url: string): boolean {
  const u = (url || '').trim().toLowerCase()
  if (u.length < 12) return false
  return ELIGIBLE_MARKERS.some((m) => u.includes(m))
}

export function sourceStockLinkIlikePatterns(): string[] {
  return [
    '%1688.com%',
    '%offer.1688%',
    '%detail.1688%',
    '%taobao.com%',
    '%tmall.com%',
    '%cssbuy.com%',
    '%vipomall.vn%',
    '%pandamall.vn%',
  ]
}

export function parseCssbuyGoodsDetail(raw: string): { type: '1688' | 'taobao'; id: string } | null {
  try {
    const p = new URL(normalizeProductImportUrl((raw || '').trim()) || (raw || '').trim())
    if (!CSSBUY_HOST_OK.test(p.hostname || '')) return null
    const path = (p.pathname || '').replace(/\/+$/, '').toLowerCase()
    if (!path.endsWith('/shop/goodsdetail') && !path.includes('/goodsdetail')) return null
    const typ = (p.searchParams.get('type') || '').trim().toLowerCase()
    const iid =
      (p.searchParams.get('id') || p.searchParams.get('itemid') || p.searchParams.get('item_id') || '').trim()
    if (!/^\d+$/.test(iid)) return null
    if (typ === 'taobao' || typ === 'tmall' || typ === 'tb') return { type: 'taobao', id: iid }
    return { type: '1688', id: iid }
  } catch {
    return null
  }
}

export function cssbuyGoodsDetailUrl(typ: string, itemId: string): string {
  let t = (typ || '1688').trim().toLowerCase() || '1688'
  if (t === 'alibaba') t = '1688'
  if (t === 'tb' || t === 'tmall') t = 'taobao'
  return `https://www.cssbuy.com/shop/goodsDetail?type=${t}&id=${itemId.trim()}`
}

export function isCssbuyItemUrl(raw: string): boolean {
  try {
    const p = new URL(normalizeProductImportUrl((raw || '').trim()) || (raw || '').trim())
    if (!CSSBUY_HOST_OK.test(p.hostname || '')) return false
    const path = (p.pathname || '').toLowerCase()
    return path.includes('item-') && path.endsWith('.html')
  } catch {
    return false
  }
}

export function cssbuyItemPageToItemSlug(itemPageUrl: string): string | null {
  const gd = parseCssbuyGoodsDetail(itemPageUrl)
  if (gd) return gd.type === '1688' ? `abb-${gd.id}` : gd.id
  try {
    const p = new URL(normalizeProductImportUrl((itemPageUrl || '').trim()) || (itemPageUrl || '').trim())
    const path = (p.pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase()
    if (!path.endsWith('.html')) return null
    const base = path.slice(0, -'.html'.length)
    const parts = base.split('-')
    if (parts.length >= 3 && parts[0] === 'item' && parts[1] === '1688') {
      return /^\d+$/.test(parts[2]) ? `abb-${parts[2]}` : null
    }
    if (parts.length >= 2 && parts[0] === 'item') {
      const tail = parts[parts.length - 1]
      return /^\d+$/.test(tail) ? tail : null
    }
  } catch {
    return null
  }
  return null
}

export function cssbuyPlaywrightPdpUrl(raw: string): string | null {
  const gd = parseCssbuyGoodsDetail(raw)
  if (gd) return cssbuyGoodsDetailUrl(gd.type, gd.id)
  const slug = cssbuyItemPageToItemSlug(raw)
  if (!slug) return null
  const oid = extractAbbOfferDigits(slug)
  if (oid) return cssbuyGoodsDetailUrl('1688', oid)
  if (/^\d+$/.test(slug)) return cssbuyGoodsDetailUrl('taobao', slug)
  return null
}

export function canonicalCssbuyItemUrl(raw: string): string {
  const gd = parseCssbuyGoodsDetail(raw)
  if (gd) {
    return gd.type === '1688'
      ? `https://www.cssbuy.com/item-1688-${gd.id}.html`
      : `https://www.cssbuy.com/item-${gd.id}.html`
  }
  const slug = cssbuyItemPageToItemSlug(raw)
  if (slug) {
    const oid = extractAbbOfferDigits(slug)
    if (oid) return `https://www.cssbuy.com/item-1688-${oid}.html`
    if (/^\d+$/.test(slug)) return `https://www.cssbuy.com/item-${slug}.html`
  }
  return normalizeProductImportUrl(raw) || raw
}

function offerIdFromRemarketing(raw: string | null | undefined): string | null {
  const m = /^A(\d+)(?:a188.*)?$/i.exec((raw || '').trim())
  return m?.[1] ?? null
}

export function resolveNumeric1688OfferIdFromSourceUrl(
  url: string,
  fallbackProductId?: string | null
): string | null {
  const norm = (normalizeProductImportUrl((url || '').trim()) || (url || '').trim()).trim()
  const vm = extractVipomallOfferId(norm)
  if (vm && /^\d+$/.test(vm)) return vm
  const oidUrl = extract1688OfferId(norm)
  if (oidUrl && /^\d+$/.test(oidUrl)) return oidUrl
  const slug = cssbuyItemPageToItemSlug(norm)
  if (slug) {
    const abb = extractAbbOfferDigits(slug)
    if (abb) return abb
  }
  const fromPid = offerIdFromRemarketing(fallbackProductId)
  if (fromPid) return fromPid
  return null
}

export function coerceUrlForSourceStock(
  rawUrl: string,
  fetchTarget: 'cssbuy' | 'vipomall' | 'pandamall'
): { url: string; error: string | null } {
  const norm = normalizeProductImportUrl((rawUrl || '').trim())
  if (!norm) return { url: '', error: 'thiếu hoặc không đọc được URL.' }

  if (fetchTarget === 'cssbuy') {
    if (isCssbuyItemUrl(norm)) return { url: canonicalCssbuyItemUrl(norm), error: null }
    const gd = parseCssbuyGoodsDetail(norm)
    if (gd) {
      return {
        url:
          gd.type === '1688'
            ? `https://www.cssbuy.com/item-1688-${gd.id}.html`
            : `https://www.cssbuy.com/item-${gd.id}.html`,
        error: null,
      }
    }
    const oid = extract1688OfferId(norm)
    if (oid && /^\d+$/.test(oid)) return { url: `https://www.cssbuy.com/item-1688-${oid}.html`, error: null }
    const tid = extractTaobaoTmallItemId(norm) || parseTPrefixedItemId(norm)
    if (tid) return { url: `https://www.cssbuy.com/item-${tid}.html`, error: null }
    const fromPid = offerIdFromRemarketing(norm)
    if (fromPid) return { url: `https://www.cssbuy.com/item-1688-${fromPid}.html`, error: null }
    return {
      url: norm,
      error:
        'không quy đổi được sang CSSBuy — cần link 1688 (offer), Taobao/Tmall (id SP), URL item cssbuy.com, hoặc goodsDetail?type=&id=.',
    }
  }

  if (fetchTarget === 'vipomall') {
    try {
      const resolved = resolveVipomallImportUrl(norm)
      return { url: resolved.url, error: null }
    } catch {
      /* continue */
    }
    const existing = extractVipomallOfferId(norm)
    if (existing) {
      const pt = extractVipomallPlatformType(norm)
      return {
        url: buildVipomallPdpUrl(
          existing,
          pt === VIPOMALL_PLATFORM_TAOBAO ? VIPOMALL_PLATFORM_TAOBAO : VIPOMALL_PLATFORM_1688
        ),
        error: null,
      }
    }
    const oid = extract1688OfferId(norm)
    if (oid && /^\d+$/.test(oid)) return { url: buildVipomallPdpUrl(oid, VIPOMALL_PLATFORM_1688), error: null }
    const gd = parseCssbuyGoodsDetail(norm)
    if (gd) {
      return {
        url: buildVipomallPdpUrl(
          gd.id,
          gd.type === 'taobao' ? VIPOMALL_PLATFORM_TAOBAO : VIPOMALL_PLATFORM_1688
        ),
        error: null,
      }
    }
    const slug = cssbuyItemPageToItemSlug(norm)
    if (slug) {
      const abb = extractAbbOfferDigits(slug)
      if (abb) return { url: buildVipomallPdpUrl(abb, VIPOMALL_PLATFORM_1688), error: null }
      if (/^\d+$/.test(slug)) return { url: buildVipomallPdpUrl(slug, VIPOMALL_PLATFORM_TAOBAO), error: null }
    }
    const tid = extractTaobaoTmallItemId(norm) || parseTPrefixedItemId(norm)
    if (tid) return { url: buildVipomallPdpUrl(tid, VIPOMALL_PLATFORM_TAOBAO), error: null }
    return {
      url: norm,
      error: 'không quy đổi được sang Vipomall — cần offer 1688, Taobao/Tmall, T{id}, hoặc vipomall.vn/san-pham/{id}.',
    }
  }

  try {
    const resolved = resolvePandamallImportUrl(norm)
    return { url: resolved.url, error: null }
  } catch {
    /* continue */
  }
  const detail = extractPandamallDetail(norm)
  if (detail) {
    return {
      url: detail.platform === 'taobao' ? buildPandamallTaobaoPdpUrl(detail.itemId) : buildPandamall1688PdpUrl(detail.itemId),
      error: null,
    }
  }
  const oid = extract1688OfferId(norm)
  if (oid && /^\d+$/.test(oid)) return { url: buildPandamall1688PdpUrl(oid), error: null }
  const gd = parseCssbuyGoodsDetail(norm)
  if (gd) {
    return {
      url: gd.type === 'taobao' ? buildPandamallTaobaoPdpUrl(gd.id) : buildPandamall1688PdpUrl(gd.id),
      error: null,
    }
  }
  const slug = cssbuyItemPageToItemSlug(norm)
  if (slug) {
    const abb = extractAbbOfferDigits(slug)
    if (abb) return { url: buildPandamall1688PdpUrl(abb), error: null }
    if (/^\d+$/.test(slug)) return { url: buildPandamallTaobaoPdpUrl(slug), error: null }
  }
  const tid = extractTaobaoTmallItemId(norm) || parseTPrefixedItemId(norm)
  if (tid) return { url: buildPandamallTaobaoPdpUrl(tid), error: null }
  return {
    url: norm,
    error:
      'không quy đổi được sang PandaMall — cần link Taobao/Tmall, T{id}, offer 1688, hoặc pandamall.vn/taobao|1688/detail/{id}.',
  }
}

export const CSSBUY_SECURITY_BLOCK_NEEDLES = [
  'just a moment',
  'attention required',
  'cf-browser-verification',
  'cf-challenge-running',
  'checking if the site connection is secure',
  'verify you are human',
  'enable javascript and cookies to continue',
  'sorry, you have been blocked',
  'access denied',
  '安全验证',
  '验证码',
] as const

const CSSBUY_PDP_OK_MARKERS = ['add to cart', 'i accept the risks', 'shop_detail', 'purchase quantity']

export function cssbuyHtmlSuggestsSecurityBlock(html: string, title = '', url = ''): boolean {
  const titleL = (title || '').trim().toLowerCase()
  if (titleL.includes('just a moment') || titleL.includes('attention required')) return true
  const blob = `${(html || '').slice(0, 80_000).toLowerCase()} ${titleL} ${(url || '').toLowerCase()}`
  if (CSSBUY_PDP_OK_MARKERS.some((m) => blob.includes(m))) return false
  return CSSBUY_SECURITY_BLOCK_NEEDLES.some((n) => blob.includes(n))
}

export function vipomallHtmlShowsAddToCartCta(html: string): boolean {
  const raw = html || ''
  if (!raw.trim()) return false
  const low = raw.toLowerCase()
  if (low.includes('thêm giỏ hàng') || low.includes('them gio hang')) return true
  if (low.includes('th&ecirc;m giỏ h&agrave;ng')) return true
  if (low.includes('cart_detail.svg') && (low.includes('button') || low.includes('giỏ hàng') || low.includes('spn-color'))) {
    return true
  }
  if (low.includes('class="add-cart"') || low.includes("class='add-cart'")) return true
  if (low.includes('list-btn') && low.includes('spn-color') && low.includes('giỏ')) return true
  return false
}

export function vipomallHtmlSuggestsBlocked(html: string): boolean {
  const blob = (html || '').trim().slice(0, 120_000).toLowerCase()
  if (['thêm giỏ hàng', 'them gio hang', 'cart_detail.svg', 'spn-color'].some((m) => blob.includes(m))) return false
  if (blob.length < 80) return true
  return ['just a moment', 'attention required', 'cf-browser-verification', 'verify you are human', 'captcha', '验证码'].some(
    (m) => blob.includes(m)
  )
}

export function pandamallHtmlShowsCartOrBuyCta(html: string): boolean {
  const low = (html || '').toLowerCase()
  if (!low.trim()) return false
  if (low.includes('btn-addcart') || low.includes('btn-buynow')) return true
  if (low.includes('thêm vào giỏ') || low.includes('them vao gio')) return true
  if (low.includes('group-btn') && (low.includes('mua ngay') || low.includes('giỏ'))) return true
  return false
}

export function pandamallHtmlSuggestsBlocked(html: string, title = ''): boolean {
  const titleL = (title || '').toLowerCase()
  if (titleL.includes('just a moment') || titleL.includes('attention required')) return true
  const blob = (html || '').slice(0, 80_000).toLowerCase()
  if (pandamallHtmlShowsCartOrBuyCta(blob)) return false
  return ['just a moment', 'cf-browser-verification', 'verify you are human', 'captcha', '验证码'].some((n) => blob.includes(n))
}

export function cssbuyHtmlShowsAddToCartButton(html: string): boolean {
  const blob = (html || '').trim().toLowerCase()
  if (!blob) return false
  if (blob.includes('<p class="button">add to cart</p>') || blob.includes("<p class='button'>add to cart</p>")) {
    return true
  }
  if (blob.includes('catbuy') && blob.includes('add to cart') && (blob.includes('<p class="button"') || blob.includes("<p class='button'"))) {
    return true
  }
  const needles = [
    '>add to cart<',
    '> add to cart <',
    'add to cart</button',
    'add to cart</a',
    '>add&nbsp;to&nbsp;cart<',
    '"add to cart"',
    "'add to cart'",
    'add-to-cart',
    '>addtocart<',
    'btn-addtocart',
    'ty_button_btn6',
    'ty_button_btn1',
  ]
  if (needles.some((n) => blob.includes(n))) return true
  return blob.includes('add to cart') && blob.includes('<button')
}

export function classifyCssbuyAddToCartCta(found: boolean, _disabled = false): 'in_stock' | 'out_of_stock' {
  void _disabled
  return found ? 'in_stock' : 'out_of_stock'
}

export function resultIsConclusiveStock(status: string): boolean {
  const s = (status || '').trim().toLowerCase()
  return s === 'in_stock' || s === 'out_of_stock'
}

export function resultShouldFallbackNextPlatform(status: string): boolean {
  const s = (status || '').trim().toLowerCase()
  return s === 'blocked' || s === 'error' || s === 'skipped'
}
