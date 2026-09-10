/**
 * Mobile head back — UX 188: previous page, not Home.
 * Engine for every shop. Stamp only on mobile HTML; CSS hides on home.
 */
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export const PW_HEAD_BACK_ATTR = 'data-pw-head-back'
export const PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT_ID = 'pw-shop-mobile-head-back'

const BACK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19l-7-7 7-7"/></svg>'

const HEADER_BLOCK_RE = /<header\b[^>]*>[\s\S]*?<\/header>/i
const HEADER_CAT_OPEN_RE = /<(button|a)\b[^>]*\bdata-pw-chrome-btn=["']categories["'][^>]*>/i

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtml(value: string): string {
  return escapeAttr(value)
}

export function htmlHasMobileHeadBack(html: string): boolean {
  return /\bdata-pw-chrome-btn=["']back["']/i.test(html)
}

export function isMobileHeadBackTarget(html: string, device?: VisualDeviceVariant | null): boolean {
  if (device === 'mobile') return true
  if (device === 'desktop' || device === 'laptop' || device === 'tablet') return false
  return /\bdata-pw-edit-device=["']mobile["']/i.test(html) || /\bdata-pw-scene-lock=["']mobile["']/i.test(html)
}

export function buildMobileHeadBackHtml(input: { locale: WebLocale }): string {
  const label = getPartnerSiteShopCopy(input.locale).navBack
  return `<button type="button" class="pw-head-back pw-chrome-icon-only" data-pw-chrome-btn="back" data-pw-chrome-style="icon" data-pw-chrome-kit="1" ${PW_HEAD_BACK_ATTR}="1" aria-label="${escapeAttr(label)}"><span class="pw-chrome-icon-wrap">${BACK_SVG}</span><span class="pw-chrome-btn-label">${escapeHtml(label)}</span></button>`
}

/** HTML cũ thiếu nút — gắn trước Danh mục trong header. Chỉ file máy mobile. */
export function ensureMobileHeadBackInHtml(
  html: string,
  input: {
    locale?: WebLocale | null
    device?: VisualDeviceVariant | null
  }
): string {
  if (!html.trim()) return html
  if (!isMobileHeadBackTarget(html, input.device)) return html
  if (htmlHasMobileHeadBack(html)) return html
  const header = html.match(HEADER_BLOCK_RE)
  if (!header) return html
  if (!HEADER_CAT_OPEN_RE.test(header[0])) return html
  const btn = buildMobileHeadBackHtml({ locale: input.locale ?? 'vi' })
  const nextHeader = header[0].replace(HEADER_CAT_OPEN_RE, (open) => `${btn}${open}`)
  return html.replace(header[0], nextHeader)
}

const BACK_FACE =
  'display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;padding:0!important;margin:0!important;gap:0!important;border:1.5px solid rgba(255,255,255,.55)!important;background:rgba(255,255,255,.16)!important;color:#fff!important;border-radius:10px!important;box-shadow:none!important;cursor:pointer!important;order:1!important;position:relative!important;z-index:200!important;pointer-events:auto!important'

function mobileHeadBackShowBlock(host: string): string {
  return (
    `${host} [data-pw-chrome-btn="back"]:not([data-pw-hidden="1"]),${host} [data-pw-head-back]:not([data-pw-hidden="1"]){${BACK_FACE}}` +
    `${host} [data-pw-chrome-btn="back"]>span:not(.pw-chrome-icon-wrap),${host} [data-pw-head-back]>span:not(.pw-chrome-icon-wrap){display:none!important}` +
    `${host} [data-pw-chrome-btn="back"] .pw-chrome-icon-wrap,${host} [data-pw-head-back] .pw-chrome-icon-wrap{display:inline-flex!important;width:20px!important;height:20px!important}` +
    `${host} [data-pw-chrome-btn="back"] svg,${host} [data-pw-head-back] svg{display:block!important;width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important;stroke:currentColor!important;fill:none!important}`
  )
}

const PHONE_NOT_HOME = [
  'html[data-pw-edit-device="mobile"]:not([data-pw-page="home"]):not(:has([data-pw-page="home"]))',
  'html[data-pw-scene-lock="mobile"]:not([data-pw-page="home"]):not(:has([data-pw-page="home"]))',
]

/** Mặc định ẩn. Hiện trên máy mobile khi trang không phải home. Không phải nút Home. */
export const PW_MOBILE_HEAD_BACK_CSS = `
[data-pw-chrome-btn="back"],[data-pw-head-back]{display:none!important}
${PHONE_NOT_HOME.map((host) => mobileHeadBackShowBlock(host)).join('')}
@media (max-width:767px){${mobileHeadBackShowBlock('html:not([data-pw-edit-device]):not([data-pw-scene-lock]):not([data-pw-page="home"]):not(:has([data-pw-page="home"]))')}}
`.trim()

/** Click = trang trước. Sửa nhanh không điều hướng. Thiếu history → href logo. */
export const PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT = `(function(){
  if(window.__pwMobileHeadBack)return;window.__pwMobileHeadBack=1;
  document.addEventListener('click',function(e){
    var t=e.target;
    if(!t||!t.closest)return;
    var btn=t.closest('[data-pw-chrome-btn="back"],[data-pw-head-back]');
    if(!btn)return;
    if(document.body&&document.body.classList.contains('nanoai-ve-active'))return;
    e.preventDefault();
    if(e.stopPropagation)e.stopPropagation();
    if(window.history.length>1){window.history.back();return;}
    var home=document.querySelector('header a.pw-brand,header a.pw-shop-brand,header a[data-pw-logo-home],.pw-header a.pw-brand,.pw-shop-header a.pw-shop-brand');
    var href=home&&home.getAttribute('href');
    if(href) window.location.assign(href);
  },true);
})();`
