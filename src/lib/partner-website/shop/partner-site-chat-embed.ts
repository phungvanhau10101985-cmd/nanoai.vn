import type { WebLocale } from '@/lib/i18n/config'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'

export const PARTNER_SITE_CHAT_MSG_SOURCE = 'nanoai-partner-site'

export type PartnerSiteChatOpenMessage = {
  source: typeof PARTNER_SITE_CHAT_MSG_SOURCE
  type: 'OPEN_CHAT'
  mode?: 'default' | 'consult' | 'try_on'
  inventoryId?: string
  sku?: string
  imageUrl?: string
  imageUrl2?: string
  productUrl?: string
}

export type PartnerSiteConsultContext = {
  inventoryId?: string
  sku?: string
  imageUrl?: string
  imageUrl2?: string
  productUrl?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TRY_ON_VIDEO_URL_RE = /\.(mp4|webm|m3u8|mov|mkv|ogv|ogg|avi)(\?|#|$)/i
const PDP_MAIN_IMG_SEL =
  '[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img,[data-pw-el="main-image"]'
const CHROME_IMG_HOST_SEL =
  'header,.pw-header,.pw-shop-header,.pw-brand,.pw-footer,.pw-bottom-nav,[data-pw-chrome-kit="float"],[data-pw-chrome-kit="dock"],[data-pw-el="logo"]'

export function isPartnerTryOnVideoUrl(raw: string): boolean {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return false
  const pathOnly = s.split(/[?#]/)[0] || s
  if (TRY_ON_VIDEO_URL_RE.test(pathOnly)) return true
  return /(?:youtube\.com|youtu\.be|vimeo\.com)\//i.test(s)
}

/** Absolute http(s) image for `ctx_image` — same as 188 / widget `toHttpUrl`. */
export function resolvePartnerTryOnImageUrl(raw: string, baseHref?: string): string {
  let next = String(raw || '').trim()
  if (!next || isPartnerTryOnVideoUrl(next)) return ''
  if (next.startsWith('//')) next = `https:${next}`
  if (/^https?:\/\//i.test(next)) return next
  const base = String(baseHref || '').trim()
  if (!base) return ''
  try {
    const abs = new URL(next, base).href
    return /^https?:\/\//i.test(abs) && !isPartnerTryOnVideoUrl(abs) ? abs : ''
  } catch {
    return ''
  }
}

export function withAbsolutePartnerTryOnContext(
  ctx: PartnerSiteConsultContext,
  baseHref?: string
): PartnerSiteConsultContext {
  const base =
    baseHref ||
    (typeof window !== 'undefined' && window.location ? window.location.href : '')
  return {
    inventoryId: ctx.inventoryId,
    sku: ctx.sku,
    imageUrl: resolvePartnerTryOnImageUrl(ctx.imageUrl || '', base),
    imageUrl2: resolvePartnerTryOnImageUrl(ctx.imageUrl2 || '', base),
    productUrl: resolvePartnerTryOnImageUrl(ctx.productUrl || '', base) || ctx.productUrl,
  }
}

function chatPathToUrl(chatPath: string): URL {
  const trimmed = chatPath.trim()
  if (!trimmed) return new URL('http://local.invalid/messaging/p/x')
  if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed)
  return new URL(trimmed, 'http://local.invalid')
}

/** Embed iframe URL — same as external shop widget (`?embed=1`). */
export function buildPartnerSiteChatEmbedPath(chatPath: string, locale?: WebLocale): string {
  const u = chatPathToUrl(chatPath)
  u.searchParams.set('embed', '1')
  if (locale) u.searchParams.set('ui_locale', locale)
  return `${u.pathname}${u.search}`
}

export function buildPartnerSiteConsultEmbedPath(
  chatPath: string,
  ctx: PartnerSiteConsultContext,
  mode: 'consult' | 'try_on',
  locale?: WebLocale
): string {
  const u = chatPathToUrl(chatPath)
  u.searchParams.set('embed', '1')
  if (locale) u.searchParams.set('ui_locale', locale)

  for (const k of [
    'ctx_sku',
    'ctx_image',
    'ctx_image_2',
    'ctx_product_url',
    'ctx_inventory',
    'ctx_source',
    'ctx_gateway',
    'open_try_on',
    'auto_consult',
  ]) {
    u.searchParams.delete(k)
  }

  const abs = withAbsolutePartnerTryOnContext(ctx)
  const sku = (abs.sku ?? '').trim().slice(0, 128)
  const imageUrl = (abs.imageUrl ?? '').trim()
  const imageUrl2 = (abs.imageUrl2 ?? '').trim()
  const productUrl = (abs.productUrl ?? '').trim()
  const inventoryId = (abs.inventoryId ?? ctx.inventoryId ?? '').trim()

  if (sku) u.searchParams.set('ctx_sku', sku)
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) u.searchParams.set('ctx_image', imageUrl)
  if (imageUrl2 && /^https?:\/\//i.test(imageUrl2)) u.searchParams.set('ctx_image_2', imageUrl2)
  if (UUID_RE.test(inventoryId)) u.searchParams.set('ctx_inventory', inventoryId)
  if (productUrl && /^https?:\/\//i.test(productUrl)) u.searchParams.set('ctx_product_url', productUrl)

  if (mode === 'try_on') {
    u.searchParams.set('open_try_on', '1')
    u.searchParams.set('ctx_gateway', 'try_on')
    u.searchParams.set('ctx_source', 'widget_try_on')
  } else {
    u.searchParams.set('ctx_gateway', 'consult')
    u.searchParams.set('ctx_source', 'widget_page')
  }

  return `${u.pathname}${u.search}`
}

export function productToConsultContext(input: {
  id: string
  sku?: string | null
  imageUrl: string
  productUrl: string
  galleryImages?: string[]
}): PartnerSiteConsultContext {
  const primary = resolvePartnerTryOnImageUrl(input.imageUrl) || input.imageUrl.trim()
  const gallery = (input.galleryImages ?? [])
    .map((u) => resolvePartnerTryOnImageUrl(u) || u.trim())
    .filter((u) => u && !isPartnerTryOnVideoUrl(u))
  return {
    inventoryId: input.id,
    sku: (input.sku ?? '').trim() || input.id,
    imageUrl: primary,
    imageUrl2: gallery.find((u) => u !== primary)?.trim(),
    productUrl: input.productUrl.trim(),
  }
}

/** Chat mua chrome + CTA hooks that must open the shop messaging widget. */
export const PARTNER_SITE_CHAT_OPEN_SELECTOR =
  '[data-pw-chrome-btn="chat"],[data-pw-chrome-btn="try-on"],[data-nanoai-open-chat],[data-nanoai-consult],[data-nanoai-try-on],a[href*="/messaging/p/"],.pw-fab-chat,.pw-chat-open'

function consultContextFromChatOpenEl(el: {
  getAttribute: (name: string) => string | null
}): PartnerSiteConsultContext {
  return {
    inventoryId: el.getAttribute('data-nanoai-inventory') || '',
    sku: el.getAttribute('data-nanoai-sku') || '',
    imageUrl: el.getAttribute('data-nanoai-image') || '',
    imageUrl2: el.getAttribute('data-nanoai-image-2') || '',
    productUrl: el.getAttribute('data-nanoai-product-url') || '',
  }
}

export function partnerSiteChatOpenModeFromEl(el: {
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => string | null
  classList?: { contains: (token: string) => boolean }
}): 'default' | 'consult' | 'try_on' {
  if (el.hasAttribute('data-nanoai-try-on') || el.getAttribute('data-pw-chrome-btn') === 'try-on') return 'try_on'
  if (el.hasAttribute('data-nanoai-consult')) return 'consult'
  if (el.getAttribute('data-pw-chrome-btn') === 'chat') return 'default'
  if (el.classList?.contains('pw-fab-chat') || el.hasAttribute('data-nanoai-open-chat')) return 'default'
  return 'consult'
}

export type PartnerSiteChatOpenRequest = {
  mode: 'default' | 'consult' | 'try_on'
  ctx: PartnerSiteConsultContext
}

function isChromeOrLogoImg(img: Element): boolean {
  if (img.getAttribute('data-pw-el') === 'logo') return true
  const cls = ` ${img.className || ''} `
  if (cls.includes(' pw-logo ') || cls.includes(' pw-chrome-chat-logo ')) return true
  return Boolean(img.closest(CHROME_IMG_HOST_SEL))
}

function imgUrlFromEl(img: Element, baseHref: string): string {
  const src = img.getAttribute('src') || ''
  const deferred = img.getAttribute('data-pw-deferred-src') || ''
  const dataSrc = img.getAttribute('data-src') || ''
  for (const raw of [src, deferred, dataSrc]) {
    const url = resolvePartnerTryOnImageUrl(raw, baseHref)
    if (url) return url
  }
  return ''
}

function collectPdpImageUrls(doc: Document, baseHref: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const push = (url: string) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }
  const colorImg = doc.querySelector('[data-pw-pdp-option="color"] .pw-pdp-pill.is-active img')
  if (colorImg && !isChromeOrLogoImg(colorImg)) push(imgUrlFromEl(colorImg, baseHref))
  doc.querySelectorAll(PDP_MAIN_IMG_SEL).forEach((img) => {
    if (isChromeOrLogoImg(img)) return
    push(imgUrlFromEl(img, baseHref))
  })
  doc.querySelectorAll('[data-pw-region="gallery"] [data-pw-el="thumb"] img').forEach((img) => {
    if (isChromeOrLogoImg(img)) return
    push(imgUrlFromEl(img, baseHref))
  })
  return urls
}

function skuFromPdpDocument(doc: Document): string {
  const stamped = doc.querySelector('[data-nanoai-sku]')?.getAttribute('data-nanoai-sku') || ''
  if (stamped.trim()) return stamped.trim().slice(0, 128)
  const skuEl = doc.querySelector('[data-pw-region="pdp-info"] [data-pw-el="sku"],.pw-pdp-sku strong')
  const text = (skuEl?.textContent || '').replace(/\s+/g, ' ').trim()
  return text.replace(/^(sku|mã\s*sp)\s*[:：-]?\s*/i, '').slice(0, 128)
}

function inventoryIdFromPdpDocument(doc: Document, clickEl?: Element | null): string {
  const hosts = [
    clickEl?.closest('[data-inventory-id],[data-pw-inventory-id]') || null,
    doc.querySelector('[data-pw-region="gallery"][data-inventory-id],[data-pw-region="pdp-info"][data-inventory-id]'),
    doc.body,
    doc.documentElement,
  ]
  for (const host of hosts) {
    if (!host?.getAttribute) continue
    const id = (host.getAttribute('data-inventory-id') || host.getAttribute('data-pw-inventory-id') || '').trim()
    if (UUID_RE.test(id)) return id
  }
  return ''
}

/** PDP đang xem — ảnh gallery / màu đang chọn, không lấy logo header. */
export function consultContextFromPdpDocument(
  doc: Document | null | undefined,
  clickEl?: Element | null
): PartnerSiteConsultContext {
  if (!doc) return {}
  const win = doc.defaultView
  const baseHref = win?.location?.href || ''
  const images = collectPdpImageUrls(doc, baseHref)
  const isProduct =
    doc.documentElement.getAttribute('data-pw-page') === 'product' ||
    doc.body?.getAttribute('data-pw-page') === 'product' ||
    Boolean(doc.querySelector('[data-pw-region="gallery"],[data-pw-region="pdp-info"]'))
  const pageUrl = isProduct ? resolvePartnerTryOnImageUrl(baseHref, baseHref) : ''
  const cardHost = clickEl?.closest(
    '[data-inventory-id],[data-pw-inventory-id],article,.pw-product-card,.pw-shop-card'
  )
  if (!isProduct && cardHost) {
    const cardImg = [...cardHost.querySelectorAll('img')].find((img) => !isChromeOrLogoImg(img))
    const href = cardHost.querySelector('a[href*="/products/"]')?.getAttribute('href') || ''
    const inventoryId = (
      cardHost.getAttribute('data-inventory-id') ||
      cardHost.getAttribute('data-pw-inventory-id') ||
      ''
    ).trim()
    return {
      inventoryId: UUID_RE.test(inventoryId) ? inventoryId : '',
      imageUrl: cardImg ? imgUrlFromEl(cardImg, baseHref) : '',
      productUrl: resolvePartnerTryOnImageUrl(href, baseHref) || href,
    }
  }
  return {
    inventoryId: inventoryIdFromPdpDocument(doc, clickEl),
    sku: skuFromPdpDocument(doc),
    imageUrl: images[0] || '',
    imageUrl2: images[1] || '',
    productUrl: pageUrl,
  }
}

export function mergeConsultContext(primary: PartnerSiteConsultContext, fallback: PartnerSiteConsultContext): PartnerSiteConsultContext {
  return {
    inventoryId: primary.inventoryId || fallback.inventoryId,
    sku: primary.sku || fallback.sku,
    imageUrl: primary.imageUrl || fallback.imageUrl,
    imageUrl2: primary.imageUrl2 || fallback.imageUrl2,
    productUrl: primary.productUrl || fallback.productUrl,
  }
}

export function hasPartnerSiteConsultContext(ctx: PartnerSiteConsultContext | null | undefined): boolean {
  if (!ctx) return false
  return Boolean((ctx.sku ?? '').trim() || (ctx.imageUrl ?? '').trim() || (ctx.inventoryId ?? '').trim())
}

/** Trang chi tiết SP — Chat mua / Thử đồ đọc gallery + SKU đang xem, giống 188. */
export function isPartnerPdpDocument(doc: Document | null | undefined): boolean {
  if (!doc) return false
  const page =
    doc.documentElement?.getAttribute?.('data-pw-page') ||
    doc.body?.getAttribute?.('data-pw-page') ||
    ''
  if (page === 'product') return true
  try {
    return Boolean(
      doc.querySelector?.('[data-pw-region="gallery"]') &&
        doc.querySelector?.('[data-pw-region="pdp-info"]')
    )
  } catch {
    return false
  }
}

export function resolvePartnerSiteChatOpenFromEventTarget(
  target: EventTarget | null
): PartnerSiteChatOpenRequest | null {
  let node: Element | null = null
  if (target instanceof Element) node = target
  else if (target instanceof Node) node = target.parentElement
  if (!node?.closest) return null
  const el = node.closest(PARTNER_SITE_CHAT_OPEN_SELECTOR)
  if (!el) return null
  if (el.closest('[data-pw-chrome-btn="chat-zalo"],[data-pw-chrome-btn="chat-facebook"]')) return null
  const mode = partnerSiteChatOpenModeFromEl(el)
  const fromBtn = consultContextFromChatOpenEl(el)
  const doc = el.ownerDocument
  const onPdp = isPartnerPdpDocument(doc)
  const fromPage =
    mode === 'try_on' || mode === 'consult' || onPdp ? consultContextFromPdpDocument(doc, el) : {}
  const ctx = withAbsolutePartnerTryOnContext(mergeConsultContext(fromPage, fromBtn))
  const resolvedMode: PartnerSiteChatOpenRequest['mode'] =
    mode === 'try_on'
      ? 'try_on'
      : onPdp && hasPartnerSiteConsultContext(ctx)
        ? 'consult'
        : mode
  return { mode: resolvedMode, ctx }
}

/** Saved Sửa nhanh HTML may drop `data-nanoai-open-chat` after move/clone — stamp it at serve. */
export function stampPartnerSiteChatOpenAttrsInHtml(html: string): string {
  if (!html.trim()) return html
  return html.replace(
    /<(button|a)\b([^>]*\bdata-pw-chrome-btn=["']chat["'][^>]*)>/gi,
    (_full, tag: string, attrs: string) => {
      let next = attrs
      if (!/\bdata-nanoai-open-chat\b/i.test(next)) next += ' data-nanoai-open-chat'
      if (!/\bpw-chat-open\b/i.test(next)) {
        if (/\bclass\s*=\s*(["'])([\s\S]*?)\1/i.test(next)) {
          next = next.replace(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i, (_m, q: string, cls: string) => {
            return `class=${q}${String(cls).trim()} pw-chat-open${q}`
          })
        } else {
          next += ' class="pw-chat-open"'
        }
      }
      return `<${tag}${next}>`
    }
  )
}

/** Inline script for landing HTML in srcDoc iframe — forwards chat clicks to parent widget. */
export function buildPartnerSiteLandingChatBridgeScript(): string {
  return `<script data-pw-chat-bridge>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var SRC=${JSON.stringify(PARTNER_SITE_CHAT_MSG_SOURCE)};
var SEL=${JSON.stringify(PARTNER_SITE_CHAT_OPEN_SELECTOR)};
function postOpen(opts){
  opts=opts||{};
  var msg=Object.assign({source:SRC,type:'OPEN_CHAT'},opts);
  try{
    if(window.parent&&window.parent!==window){
      window.parent.postMessage(msg,'*');
    }else{
      window.postMessage(msg,'*');
    }
  }catch(e){}
}
function toHttpUrl(raw){
  var t=String(raw||'').trim();
  if(!t)return '';
  if(/\\.(mp4|webm|m3u8|mov)(\\?|#|$)/i.test(t)||/(?:youtube\\.com|youtu\\.be)\\//i.test(t))return '';
  if(t.indexOf('//')===0)t=location.protocol+t;
  try{t=new URL(t,location.href).toString();}catch(e){return '';}
  return /^https?:\\/\\//i.test(t)?t:'';
}
function isChromeImg(img){
  if(!img)return true;
  if(img.getAttribute&&img.getAttribute('data-pw-el')==='logo')return true;
  var cls=' '+(img.className||'')+' ';
  if(cls.indexOf(' pw-logo ')>=0||cls.indexOf(' pw-chrome-chat-logo ')>=0)return true;
  return !!(img.closest&&img.closest('header,.pw-header,.pw-shop-header,.pw-brand,.pw-footer,.pw-bottom-nav,[data-pw-chrome-kit="float"],[data-pw-chrome-kit="dock"]'));
}
function imgUrl(img){
  if(!img||!img.getAttribute)return '';
  return toHttpUrl(img.getAttribute('src')||'')||toHttpUrl(img.getAttribute('data-pw-deferred-src')||'')||toHttpUrl(img.getAttribute('data-src')||'');
}
function ctxFromEl(el){
  if(!el||!el.getAttribute)return {};
  return {
    inventoryId:el.getAttribute('data-nanoai-inventory')||'',
    sku:el.getAttribute('data-nanoai-sku')||'',
    imageUrl:toHttpUrl(el.getAttribute('data-nanoai-image')||''),
    imageUrl2:toHttpUrl(el.getAttribute('data-nanoai-image-2')||''),
    productUrl:toHttpUrl(el.getAttribute('data-nanoai-product-url')||''),
  };
}
function isPdpPage(){
  var page=(document.documentElement&&document.documentElement.getAttribute('data-pw-page'))||(document.body&&document.body.getAttribute('data-pw-page'))||'';
  if(page==='product')return true;
  return !!(document.querySelector('[data-pw-region="gallery"]')&&document.querySelector('[data-pw-region="pdp-info"]'));
}
function ctxFromPdp(){
  var urls=[],seen={};
  function push(u){if(!u||seen[u])return;seen[u]=1;urls.push(u);}
  var color=document.querySelector('[data-pw-pdp-option="color"] .pw-pdp-pill.is-active img');
  if(color&&!isChromeImg(color))push(imgUrl(color));
  document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img,[data-pw-el="main-image"]').forEach(function(img){
    if(!isChromeImg(img))push(imgUrl(img));
  });
  document.querySelectorAll('[data-pw-region="gallery"] [data-pw-el="thumb"] img').forEach(function(img){
    if(!isChromeImg(img))push(imgUrl(img));
  });
  var inv='';
  var hosts=document.querySelectorAll('[data-pw-region="gallery"],[data-pw-region="pdp-info"],body,html');
  for(var i=0;i<hosts.length;i++){
    var id=(hosts[i].getAttribute('data-inventory-id')||hosts[i].getAttribute('data-pw-inventory-id')||'').trim();
    if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){inv=id;break;}
  }
  var skuEl=document.querySelector('[data-pw-region="pdp-info"] [data-pw-el="sku"],.pw-pdp-sku strong');
  var sku=skuEl?String(skuEl.textContent||'').replace(/\\s+/g,' ').replace(/^(sku|mã\\s*sp)\\s*[:：-]?\\s*/i,'').trim():'';
  var isPdp=isPdpPage();
  return {inventoryId:inv,sku:sku,imageUrl:urls[0]||'',imageUrl2:urls[1]||'',productUrl:isPdp?toHttpUrl(location.href):''};
}
function hasCtx(ctx){
  return !!(ctx&&((ctx.sku||'').trim()||(ctx.imageUrl||'').trim()||(ctx.inventoryId||'').trim()));
}
function mergeCtx(page,btn){
  return {
    inventoryId:page.inventoryId||btn.inventoryId||'',
    sku:page.sku||btn.sku||'',
    imageUrl:page.imageUrl||btn.imageUrl||'',
    imageUrl2:page.imageUrl2||btn.imageUrl2||'',
    productUrl:page.productUrl||btn.productUrl||'',
  };
}
document.addEventListener('click',function(ev){
  if(pwShopLiveUiOff())return;
  var t=ev.target;
  if(!t||!t.closest)return;
  var el=t.closest(SEL);
  if(!el)return;
  if(el.closest&&el.closest('[data-pw-chrome-btn="chat-zalo"],[data-pw-chrome-btn="chat-facebook"]'))return;
  ev.preventDefault();
  ev.stopPropagation();
  var mode='default';
  if(el.hasAttribute('data-nanoai-try-on')||el.getAttribute('data-pw-chrome-btn')==='try-on')mode='try_on';
  else if(el.hasAttribute('data-nanoai-consult'))mode='consult';
  else if(el.getAttribute('data-pw-chrome-btn')==='chat')mode='default';
  else if(el.classList.contains('pw-fab-chat')||el.hasAttribute('data-nanoai-open-chat'))mode='default';
  else mode='consult';
  var ctx=ctxFromEl(el);
  var onPdp=isPdpPage();
  if(mode==='try_on'||mode==='consult'||onPdp){
    ctx=mergeCtx(ctxFromPdp(),ctx);
  }
  if(mode!=='try_on'&&onPdp&&hasCtx(ctx))mode='consult';
  postOpen({mode:mode,inventoryId:ctx.inventoryId,sku:ctx.sku,imageUrl:ctx.imageUrl,imageUrl2:ctx.imageUrl2,productUrl:ctx.productUrl});
},true);
})();</script>`
}
