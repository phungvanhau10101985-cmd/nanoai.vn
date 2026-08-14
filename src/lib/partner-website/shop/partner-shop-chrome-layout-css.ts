import {
  PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT,
  PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID,
} from '@/lib/partner-website/shop/pin-chrome-icon-badges'

/** Persistent chrome layout — same rules Sửa nhanh uses, kept on the live shop. */
export const PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID = 'pw-shop-chrome-layout'

export const PARTNER_SHOP_CHROME_LAYOUT_CSS = `
.pw-chrome-icon-wrap{position:relative!important;display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;width:22px!important;height:22px!important;flex-shrink:0!important;overflow:visible!important}
.pw-chrome-icon-wrap svg,.pw-chrome-icon-wrap .pw-shop-nav-icon{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;display:block!important;opacity:1!important;visibility:visible!important;stroke:currentColor!important;fill:none!important;flex-shrink:0}
.pw-chrome-icon-wrap .pw-cart-badge,.pw-chrome-icon-wrap .pw-shop-cart-badge{position:absolute!important;top:-5px!important;right:-9px!important;left:auto!important;bottom:auto!important;min-width:16px;height:16px;margin:0!important;z-index:2}
.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;flex-wrap:nowrap!important;grid-template-columns:none!important;justify-content:space-around;align-items:stretch;overflow:visible}
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
@media (min-width:768px){
[data-pw-chrome-added][data-pw-device="mobile"],
.pw-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-shop-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-topbar [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-shop-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]{display:none!important}
}
`.trim()

export function injectPartnerShopChromeLayoutCss(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return html
  let out = trimmed
  const styleTag = `<style id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}">${PARTNER_SHOP_CHROME_LAYOUT_CSS}</style>`
  if (out.includes(PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID)) {
    out = out.replace(
      new RegExp(`<style id="${PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'i'),
      styleTag
    )
  } else if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${styleTag}\n</head>`)
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${styleTag}</head>`)
  } else {
    out = `${styleTag}\n${out}`
  }
  if (!out.includes(PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID)) {
    const scriptTag = `<script id="${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID}">${PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT}</script>`
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${scriptTag}\n</body>`)
    else out = `${out}\n${scriptTag}`
  }
  return out
}
