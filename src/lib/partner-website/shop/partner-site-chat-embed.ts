import type { WebLocale } from '@/lib/i18n/config'

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

/** Inline script for landing HTML in srcDoc iframe — forwards chat clicks to parent widget. */
export function buildPartnerSiteLandingChatBridgeScript(): string {
  return `<script data-pw-chat-bridge>(function(){
var SRC=${JSON.stringify(PARTNER_SITE_CHAT_MSG_SOURCE)};
function postOpen(opts){
  opts=opts||{};
  try{
    if(window.parent&&window.parent!==window){
      window.parent.postMessage(Object.assign({source:SRC,type:'OPEN_CHAT'},opts),'*');
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
document.addEventListener('click',function(ev){
  var t=ev.target;
  if(!t||!t.closest)return;
  var el=t.closest('[data-nanoai-open-chat],[data-nanoai-consult],[data-nanoai-try-on],a[href*="/messaging/p/"],.pw-fab-chat,.pw-chat-open');
  if(!el)return;
  ev.preventDefault();
  ev.stopPropagation();
  var mode='default';
  if(el.hasAttribute('data-nanoai-try-on'))mode='try_on';
  else if(el.hasAttribute('data-nanoai-consult'))mode='consult';
  else if(el.classList.contains('pw-fab-chat')||el.hasAttribute('data-nanoai-open-chat'))mode='default';
  else mode='consult';
  var ctx=ctxFromEl(el);
  postOpen({mode:mode,inventoryId:ctx.inventoryId,sku:ctx.sku,imageUrl:ctx.imageUrl,imageUrl2:ctx.imageUrl2,productUrl:ctx.productUrl});
},true);
})();</script>`
}
