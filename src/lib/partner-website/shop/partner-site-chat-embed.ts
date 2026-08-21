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

  const sku = (ctx.sku ?? '').trim().slice(0, 128)
  const imageUrl = (ctx.imageUrl ?? '').trim()
  const imageUrl2 = (ctx.imageUrl2 ?? '').trim()
  const productUrl = (ctx.productUrl ?? '').trim()
  const inventoryId = (ctx.inventoryId ?? '').trim()

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
  const gallery = input.galleryImages?.filter((u) => /^https?:\/\//i.test(u.trim())) ?? []
  return {
    inventoryId: input.id,
    sku: (input.sku ?? '').trim() || input.id,
    imageUrl: input.imageUrl.trim(),
    imageUrl2: gallery.find((u) => u !== input.imageUrl.trim())?.trim(),
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

/** Same-document click → open shop chat (inline HTML / React chrome). */
function consultContextFromNearestProduct(el: Element): PartnerSiteConsultContext {
  const host =
    el.closest(
      '[data-inventory-id],[data-pw-inventory-id],article,.pw-product-card,.pw-shop-card,[data-pw-region="pdp-info"],[data-pw-region="gallery"]'
    ) || (el.closest('[data-pw-page="product"]') ? el.ownerDocument?.body || null : null)
  if (!host) return {}
  const inventoryId =
    (host.getAttribute('data-inventory-id') || host.getAttribute('data-pw-inventory-id') || '').trim()
  const img = host.querySelector('img')
  const link = host.querySelector('a[href*="/products/"]')
  const href = link?.getAttribute('href') || ''
  return {
    inventoryId: UUID_RE.test(inventoryId) ? inventoryId : '',
    imageUrl: img?.getAttribute('src') || '',
    productUrl: href,
  }
}

function mergeConsultContext(primary: PartnerSiteConsultContext, fallback: PartnerSiteConsultContext): PartnerSiteConsultContext {
  return {
    inventoryId: primary.inventoryId || fallback.inventoryId,
    sku: primary.sku || fallback.sku,
    imageUrl: primary.imageUrl || fallback.imageUrl,
    imageUrl2: primary.imageUrl2 || fallback.imageUrl2,
    productUrl: primary.productUrl || fallback.productUrl,
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
  const ctx = consultContextFromChatOpenEl(el)
  return {
    mode,
    ctx: mode === 'try_on' ? mergeConsultContext(ctx, consultContextFromNearestProduct(el)) : ctx,
  }
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
function ctxFromEl(el){
  if(!el||!el.getAttribute)return {};
  return {
    inventoryId:el.getAttribute('data-nanoai-inventory')||'',
    sku:el.getAttribute('data-nanoai-sku')||'',
    imageUrl:el.getAttribute('data-nanoai-image')||'',
    imageUrl2:el.getAttribute('data-nanoai-image-2')||'',
    productUrl:el.getAttribute('data-nanoai-product-url')||'',
  };
}
function ctxFromNearestProduct(el){
  if(!el||!el.closest)return {};
  var host=el.closest('[data-inventory-id],[data-pw-inventory-id],article,.pw-product-card,.pw-shop-card,[data-pw-region="pdp-info"],[data-pw-region="gallery"]');
  if(!host&&el.closest('[data-pw-page="product"]'))host=document.body;
  if(!host)return {};
  var id=(host.getAttribute('data-inventory-id')||host.getAttribute('data-pw-inventory-id')||'').trim();
  var img=host.querySelector?host.querySelector('img'):null;
  var a=host.querySelector?host.querySelector('a[href*="/products/"]'):null;
  var href=a?a.getAttribute('href')||'':'';
  return {inventoryId:id,imageUrl:img?img.getAttribute('src')||'':'',productUrl:href};
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
  if(mode==='try_on'){
    var near=ctxFromNearestProduct(el);
    if(!ctx.inventoryId)ctx.inventoryId=near.inventoryId||'';
    if(!ctx.imageUrl)ctx.imageUrl=near.imageUrl||'';
    if(!ctx.productUrl)ctx.productUrl=near.productUrl||'';
  }
  postOpen({mode:mode,inventoryId:ctx.inventoryId,sku:ctx.sku,imageUrl:ctx.imageUrl,imageUrl2:ctx.imageUrl2,productUrl:ctx.productUrl});
},true);
})();</script>`
}
