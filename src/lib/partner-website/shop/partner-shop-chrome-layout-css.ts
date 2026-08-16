import { PW_CHROME_COUNT_BADGE_HIDE_CSS } from '@/lib/partner-website/shop/chrome-count-badges'
import {
  PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT,
  PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID,
} from '@/lib/partner-website/shop/pin-chrome-icon-badges'
import {
  PARTNER_SHOP_STICK_HEADER_CSS,
  PARTNER_SHOP_STICK_HEADER_SCRIPT,
  PARTNER_SHOP_STICK_HEADER_SCRIPT_ID,
} from '@/lib/partner-website/shop/stick-header-elements'

/** Persistent chrome layout — same rules Sửa nhanh uses, kept on the live shop. */
export const PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID = 'pw-shop-chrome-layout'

/** Mobile header: search is its own box — width does not follow logo/buttons. */
export const PARTNER_SHOP_MOBILE_HEADER_SEARCH_LOCK_CSS = `@media (max-width:899px){
.pw-header-main,.pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;column-gap:6px!important;padding:8px 10px!important}
.pw-header-main,.pw-shop-header-inner{overflow:visible!important;min-width:0!important}
.pw-brand-cluster,.pw-shop-brand-cluster{flex:0 0 auto!important;width:auto!important;max-width:200px!important;overflow:visible!important}
.pw-header a.pw-brand:not([data-pw-logo-float]),.pw-shop-header a.pw-shop-brand:not([data-pw-logo-float]),.pw-header a[data-pw-logo-home]:not([data-pw-logo-float]),.pw-shop-header a[data-pw-logo-home]:not([data-pw-logo-float]){max-width:none!important;overflow:visible!important}
.pw-header a.pw-brand:has(img) .pw-wordmark,.pw-shop-header a.pw-shop-brand:has(img) .pw-wordmark,.pw-header a[data-pw-logo-home]:has(img) .pw-wordmark{display:none!important}
.pw-header-search,.pw-shop-search-wrap{flex:1 1 0%!important;width:auto!important;min-width:72px!important;max-width:none!important;margin:0!important}
.pw-header-search[data-pw-search-width],.pw-shop-search-wrap[data-pw-search-width]{flex:1 1 0%!important;min-width:72px!important}
.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;display:flex!important;flex-wrap:nowrap!important;width:auto!important;max-width:none!important;overflow:visible!important;margin-left:auto!important}
}`

export const PARTNER_SHOP_CHROME_LAYOUT_CSS = `
.pw-chrome-icon-wrap{position:relative!important;display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;width:22px!important;height:22px!important;flex-shrink:0!important;overflow:visible!important}
.pw-chrome-icon-wrap svg,.pw-chrome-icon-wrap .pw-shop-nav-icon{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;display:block!important;opacity:1!important;visibility:visible!important;stroke:currentColor!important;fill:none!important;flex-shrink:0}
.pw-chrome-icon-wrap .pw-cart-badge,.pw-chrome-icon-wrap .pw-shop-cart-badge{position:absolute!important;top:-5px!important;right:-9px!important;left:auto!important;bottom:auto!important;min-width:16px;height:16px;margin:0!important;z-index:5}
${PW_CHROME_COUNT_BADGE_HIDE_CSS}
.pw-header-actions .pw-icon-btn,.pw-shop-header-actions .pw-icon-btn,.pw-header-actions .pw-shop-icon-btn,.pw-shop-header-actions .pw-shop-icon-btn,.pw-header-actions [data-pw-chrome-btn],.pw-shop-header-actions [data-pw-chrome-btn]{overflow:visible!important}
.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;flex-wrap:nowrap!important;grid-template-columns:none!important;justify-content:space-around;align-items:stretch;overflow:visible;z-index:180!important;isolation:isolate;background:#fff}
.pw-bottom-nav>a,.pw-shop-bottom-nav>a,.pw-bottom-nav .pw-icon-btn,.pw-shop-bottom-nav .pw-icon-btn,.pw-bottom-nav .pw-shop-icon-btn,.pw-shop-bottom-nav .pw-shop-icon-btn{
  flex:1 1 0!important;min-width:0!important;min-height:0!important;width:auto!important;height:auto!important;
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
  gap:2px!important;padding:6px 2px!important;background:transparent!important;position:relative!important;color:#6b7280!important;overflow:visible!important
}
.pw-bottom-nav>a.is-active,.pw-shop-bottom-nav>a.is-active{color:var(--pw-primary)!important}
.pw-bottom-nav>a:not([data-pw-chrome-added]),.pw-shop-bottom-nav>a:not([data-pw-chrome-added]){
  transform:none;left:auto;top:auto;right:auto;bottom:auto
}
.pw-bottom-nav svg,.pw-shop-bottom-nav svg{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;flex-shrink:0;stroke:currentColor!important;fill:none!important}
.pw-bottom-nav .pw-shop-icon-label,.pw-shop-bottom-nav .pw-shop-icon-label,.pw-bottom-nav .pw-chrome-btn-label,.pw-shop-bottom-nav .pw-chrome-btn-label,.pw-bottom-nav .pw-shop-nav-label,.pw-shop-bottom-nav .pw-shop-nav-label,.pw-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge),.pw-shop-bottom-nav>a>span:not(.pw-chrome-icon-wrap):not(.pw-cart-badge):not(.pw-shop-cart-badge){
  display:block!important;max-width:100%!important;white-space:normal!important;overflow:visible!important;text-overflow:unset!important;text-align:center;line-height:1.15;overflow-wrap:break-word;word-break:break-word
}
.pw-header-actions [data-pw-chrome-added],.pw-shop-header-actions [data-pw-chrome-added],
.pw-header-actions .pw-chrome-has-label,.pw-shop-header-actions .pw-chrome-has-label{
  display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;
  gap:6px!important;width:auto!important;height:auto!important;min-width:0!important;min-height:36px!important;
  padding:0 10px!important;background:transparent!important;font-size:13px!important;font-weight:700!important
}
.pw-header-actions [data-pw-chrome-added] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added] .pw-chrome-btn-label,
.pw-header-actions [data-pw-chrome-added] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added] .pw-shop-nav-label{
  display:inline!important;max-width:none!important;overflow:visible!important;white-space:nowrap!important;font-size:13px!important
}
.pw-nav-main [data-pw-chrome-added],.pw-shop-nav-row [data-pw-chrome-added]{
  display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;
  width:auto!important;height:auto!important;min-width:0!important;background:transparent!important;padding:0!important
}
.pw-nav-main>a,.pw-nav-main>a.pw-nav-sale,.pw-nav-main>a.is-sale,.pw-nav-main>button,
.pw-shop-nav-row>a,.pw-shop-nav-row>a.pw-nav-sale,.pw-shop-nav-row>a.is-sale,.pw-shop-nav-row>button,
.pw-cat-panel a,.pw-cat-panel a.pw-nav-sale,.pw-cat-panel a.is-sale,
.pw-shop-cat-panel a,.pw-shop-cat-panel a.pw-nav-sale,.pw-shop-cat-panel a.is-sale{color:#374151!important}
.pw-header,.pw-shop-header{position:sticky!important;top:0!important;z-index:200!important;isolation:isolate}
.pw-topbar,.pw-shop-topbar{position:relative!important;z-index:3!important;isolation:isolate}
.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster{overflow:visible!important}
.pw-header-main,.pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;min-width:0}
.pw-brand-cluster,.pw-shop-brand-cluster,.pw-brand:not([data-pw-logo-float]),.pw-shop-brand:not([data-pw-logo-float]),a[data-pw-logo-home]:not([data-pw-logo-float]){position:relative!important;z-index:120!important;flex:0 0 auto!important;overflow:visible!important}
.pw-brand-cluster,.pw-shop-brand-cluster{pointer-events:none!important}
.pw-brand-cluster > *,.pw-shop-brand-cluster > *,.pw-brand-cluster a,.pw-shop-brand-cluster a,.pw-brand-cluster button,.pw-shop-brand-cluster button,.pw-brand-cluster img,.pw-shop-brand-cluster img,.pw-brand-cluster [data-pw-el],.pw-shop-brand-cluster [data-pw-el],.pw-brand-cluster .pw-logo-frame,.pw-shop-brand-cluster .pw-logo-frame,.pw-brand-cluster [data-pw-logo-frame],.pw-shop-brand-cluster [data-pw-logo-frame]{pointer-events:auto!important}
header [data-pw-logo-float="1"],.pw-header [data-pw-logo-float="1"],.pw-shop-header [data-pw-logo-float="1"]{
  position:absolute!important;margin:0!important;max-width:none!important;max-height:none!important;overflow:visible!important
}
header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-shop-header [data-pw-logo-float="1"]:not([data-pw-z]){z-index:160!important}
header img.pw-logo,header img.pw-shop-logo,.pw-header img.pw-logo,.pw-shop-header img.pw-shop-logo,header [data-pw-logo-added],.pw-header [data-pw-logo-added],.pw-shop-header [data-pw-logo-added]{
  z-index:160!important;overflow:visible!important;object-fit:contain!important;object-position:left center!important;max-width:none!important;max-height:none!important
}
header .pw-logo-frame img,header [data-pw-logo-frame="1"] img,.pw-header .pw-logo-frame img,.pw-shop-header .pw-logo-frame img,header img[data-pw-logo-float],.pw-header img[data-pw-logo-float],.pw-shop-header img[data-pw-logo-float]{
  max-width:none!important;max-height:none!important
}
header,.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster,a.pw-brand,a.pw-shop-brand{background-repeat:no-repeat!important}
body:not(.nanoai-ve-active) [data-pw-logo-empty="1"],body:not(.nanoai-ve-active) .pw-logo-frame:has([data-pw-logo-empty="1"]),body:not(.nanoai-ve-active) [data-pw-logo-frame="1"]:has([data-pw-logo-empty="1"]){display:none!important}
header [data-pw-logo-added],.pw-header [data-pw-logo-added],.pw-shop-header [data-pw-logo-added],header .pw-logo-frame img,header [data-pw-logo-frame="1"] img{
  max-width:none!important;max-height:none!important;opacity:1!important;visibility:visible!important
}
.pw-logo-frame,[data-pw-logo-frame="1"]{display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden!important;flex-shrink:0;position:relative;z-index:160!important;vertical-align:middle;max-width:none!important;max-height:none!important}
.pw-logo-frame img,[data-pw-logo-frame="1"] img{max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;object-fit:contain!important}
header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),header [data-pw-logo-frame="1"]:not([data-pw-logo-float="1"]) ~ [data-pw-logo-frame="1"]:not([data-pw-logo-float="1"]),.pw-header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-shop-header .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-brand-cluster > .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]),.pw-shop-brand-cluster > .pw-logo-frame:not([data-pw-logo-float="1"]) ~ .pw-logo-frame:not([data-pw-logo-float="1"]){display:none!important}
header a.pw-brand img.pw-logo ~ img.pw-logo,header a.pw-shop-brand img.pw-logo ~ img.pw-logo,.pw-header a.pw-brand img.pw-shop-logo ~ img.pw-shop-logo{display:none!important}
.pw-header-search,.pw-shop-search-wrap{flex:1 1 0%!important;min-width:0!important;max-width:none!important;width:100%!important;margin:0!important;position:relative;z-index:1}
.pw-search-form,.pw-shop-search-form,form[data-pw-search-form]{display:flex!important;align-items:stretch!important;width:100%!important;min-width:0!important;box-sizing:border-box}
.pw-search-form input[type="search"],.pw-shop-search-form input[type="search"],input[data-pw-search]{flex:1 1 auto!important;min-width:0!important;width:auto!important;max-width:none!important}
[data-pw-ph]::placeholder,input[style*="--pw-ph"]::placeholder,textarea[style*="--pw-ph"]::placeholder{color:var(--pw-ph)!important}
@media (max-width:899px){
.pw-search-submit::before,.pw-shop-search-submit::before{background-color:currentColor!important;background-image:none!important;-webkit-mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")}
}
.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;margin-left:0!important;z-index:2}
@media (min-width:768px){
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-chrome-count]){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-chrome-count]),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]){display:none!important}
}
@media (min-width:1280px){
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]){display:none!important}
}
@media (max-width:899px){
.pw-bottom-nav,.pw-shop-bottom-nav{position:fixed!important;left:0;right:0;bottom:0;z-index:180!important;isolation:isolate;background:#fff}
}
${PARTNER_SHOP_MOBILE_HEADER_SEARCH_LOCK_CSS}
${PARTNER_SHOP_STICK_HEADER_CSS}
`.trim()

/**
 * Runtime-only classes the editor adds while Sửa nhanh is open. Persisting them breaks two
 * things: `body:not(.nanoai-ve-active)` rules stop matching on the live shop, and the editor
 * refuses to re-arm on a document that already claims to be active.
 */
const VISUAL_EDITOR_RUNTIME_STATE_CLASSES = [
  'nanoai-ve-active',
  'nanoai-ve-selected',
  'nanoai-ve-highlight',
  'nanoai-ve-hover',
  'nanoai-ve-dragging',
  'nanoai-ve-photo-edit',
]

export function stripVisualEditorRuntimeStateClasses(html: string): string {
  if (!VISUAL_EDITOR_RUNTIME_STATE_CLASSES.some((cls) => html.includes(cls))) return html
  return html.replace(/<body\b[^>]*>/i, (bodyTag) =>
    bodyTag.replace(/\sclass=(["'])([\s\S]*?)\1/i, (_attr, quote: string, value: string) => {
      const kept = value
        .split(/\s+/)
        .filter((cls) => cls && !VISUAL_EDITOR_RUNTIME_STATE_CLASSES.includes(cls))
      return kept.length ? ` class=${quote}${kept.join(' ')}${quote}` : ''
    })
  )
}

export function injectPartnerShopChromeLayoutCss(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return html
  let out = stripVisualEditorRuntimeStateClasses(trimmed)
  const styleTag = `<style id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}">${PARTNER_SHOP_CHROME_LAYOUT_CSS}</style>`
  let replaced = false
  out = out.replace(
    new RegExp(`<style id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'),
    () => {
      if (replaced) return ''
      replaced = true
      return styleTag
    }
  )
  if (!replaced) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${styleTag}\n</head>`)
    } else if (/<html[^>]*>/i.test(out)) {
      out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${styleTag}</head>`)
    } else {
      out = `${styleTag}\n${out}`
    }
  }
  if (!out.includes(PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID)) {
    const scriptTag = `<script id="${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID}">${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT}</script>`
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${scriptTag}\n</body>`)
    else out = `${out}\n${scriptTag}`
  }
  out = injectNamedScript(out, PARTNER_SHOP_STICK_HEADER_SCRIPT_ID, PARTNER_SHOP_STICK_HEADER_SCRIPT)
  return out
}

function injectNamedScript(html: string, id: string, body: string): string {
  const tag = `<script id="${id}">${body}</script>`
  let replaced = false
  let out = html.replace(new RegExp(`<script id="${id}">[\\s\\S]*?<\\/script>`, 'gi'), () => {
    if (replaced) return ''
    replaced = true
    return tag
  })
  if (!replaced) {
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${tag}\n</body>`)
    else out = `${out}\n${tag}`
  }
  return out
}
