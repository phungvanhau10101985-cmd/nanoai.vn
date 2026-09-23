import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

const SHARE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>`

const LINK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>`

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shareMarkup(copyLabel: string, shareLabel: string): { icon: string; actions: string } {
  const icon = `<button type="button" class="pw-pdp-share-icon" data-pw-pdp-share="icon" data-pw-share="native" aria-label="${esc(shareLabel)}">${SHARE_ICON}</button>`
  const actions = `<div class="pw-pdp-share-row" data-pw-pdp-share="actions"><button type="button" class="pw-pdp-share-btn" data-pw-share="copy" aria-label="${esc(copyLabel)}">${LINK_ICON}<span>${esc(copyLabel)}</span></button><button type="button" class="pw-pdp-share-btn is-share" data-pw-share="native" aria-label="${esc(shareLabel)}">${SHARE_ICON}<span>${esc(shareLabel)}</span></button></div>`
  return { icon, actions }
}

/** Nút chia sẻ trên PDP visual: icon trên ảnh + Copy link / Chia sẻ cạnh mã SP. */
export function bindPdpShareControlsToHtml(html: string, locale: WebLocale): string {
  if (/data-pw-pdp-share=/.test(html)) return html
  if (!/data-pw-region=["']pdp-info["']|class="[^"]*\bpw-shop-pdp-info\b/.test(html)) return html
  const shop = getPartnerSiteShopCopy(locale)
  const { icon, actions } = shareMarkup(shop.pdpShareCopy, shop.pdpShare)
  let out = html
  const image = /<img\b[^>]*(?:\bdata-pw-el=["']main-image["']|\bpw-pdp-hero-img\b|\bpw-shop-product-img\b)[^>]*>/i
  if (image.test(out) && !/pw-pdp-share-frame/.test(out)) {
    out = out.replace(image, (img) => `<span class="pw-pdp-share-frame">${img}${icon}</span>`)
  }
  const sku = /<p\b[^>]*(?:\bdata-pw-el=["']sku["']|\bpw-pdp-sku\b)[^>]*>[\s\S]*?<\/p>/i
  if (sku.test(out)) out = out.replace(sku, (block) => `${block}${actions}`)
  else {
    const title = /<h1\b[^>]*\bdata-pw-el=["']title["'][^>]*>[\s\S]*?<\/h1>/i
    if (title.test(out)) out = out.replace(title, (block) => `${block}${actions}`)
  }
  return out
}
