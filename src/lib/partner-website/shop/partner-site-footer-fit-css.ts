/** Footer + newsletter layout that wins over chrome/look/factory CSS. Fit the viewport; do not clip. */
export const PW_SHOP_FOOTER_FIT_STYLE_ID = 'pw-shop-footer-fit-css'

const NEWSLETTER_FORM = [
  'html .pw-newsletter',
  'html form.pw-newsletter',
  'html [data-pw-newsletter]',
  'html[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter',
  '.pw-shop[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter',
].join(',')

const NEWSLETTER_INPUT = [
  'html .pw-newsletter input',
  'html form.pw-newsletter input',
  'html [data-pw-newsletter] input',
  'html[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter input',
  '.pw-shop[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter input',
].join(',')

const NEWSLETTER_BUTTON = [
  'html .pw-newsletter button',
  'html form.pw-newsletter button',
  'html [data-pw-newsletter] button',
  'html[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter button',
  '.pw-shop[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter button',
].join(',')

export const PW_SHOP_FOOTER_FIT_CSS = `
html .pw-footer,html .pw-shop-footer{
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  overflow-x:visible!important;
  box-sizing:border-box!important;
}
html .pw-footer-grid,html .pw-shop-footer-inner{
  display:grid!important;
  grid-template-columns:minmax(0,1fr)!important;
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box!important;
}
html .pw-shop-footer-brand,html .pw-footer-brand,
html .pw-footer-col,html .pw-shop-footer-col,
html .pw-footer-bottom,html .pw-shop-footer-bar,
html .pw-footer-bottom-inner{
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box!important;
}
html[data-pw-edit-device="tablet"] .pw-footer-grid,
html[data-pw-edit-device="tablet"] .pw-shop-footer-inner,
html[data-pw-scene-lock="tablet"] .pw-footer-grid,
html[data-pw-scene-lock="tablet"] .pw-shop-footer-inner{
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
}
html[data-pw-edit-device="laptop"] .pw-footer-grid,
html[data-pw-edit-device="desktop"] .pw-footer-grid,
html[data-pw-edit-device="laptop"] .pw-shop-footer-inner,
html[data-pw-edit-device="desktop"] .pw-shop-footer-inner,
html[data-pw-scene-lock="laptop"] .pw-footer-grid,
html[data-pw-scene-lock="desktop"] .pw-footer-grid,
html[data-pw-scene-lock="laptop"] .pw-shop-footer-inner,
html[data-pw-scene-lock="desktop"] .pw-shop-footer-inner{
  grid-template-columns:minmax(0,1.25fr) repeat(4,minmax(0,1fr))!important;
}
html .pw-shop-footer-hint,html .pw-shop-footer-name,html .pw-footer-news-hint,
html .pw-footer-col a,html .pw-shop-footer-col a,html .pw-footer-col h3,html .pw-shop-footer-col h3{
  max-width:100%!important;
  min-width:0!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  white-space:normal!important;
}
${NEWSLETTER_FORM}{
  display:flex!important;
  flex-direction:column!important;
  flex-wrap:nowrap!important;
  align-items:stretch!important;
  gap:8px!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  box-sizing:border-box!important;
}
${NEWSLETTER_INPUT}{
  flex:none!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  box-sizing:border-box!important;
  border-radius:6px!important;
  border-right:1px solid var(--pw-border,#e5e7eb)!important;
}
${NEWSLETTER_BUTTON}{
  flex:none!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:unset!important;
  border-radius:6px!important;
  padding:10px 14px!important;
  box-sizing:border-box!important;
}
html[data-pw-edit-device="laptop"] .pw-newsletter,
html[data-pw-edit-device="desktop"] .pw-newsletter,
html[data-pw-scene-lock="laptop"] .pw-newsletter,
html[data-pw-scene-lock="desktop"] .pw-newsletter,
[data-pw-inline-visual-root][data-pw-active-device="laptop"] .pw-newsletter,
[data-pw-inline-visual-root][data-pw-active-device="desktop"] .pw-newsletter,
[data-pw-inline-visual-root][data-pw-edit-device="laptop"] .pw-newsletter,
[data-pw-inline-visual-root][data-pw-edit-device="desktop"] .pw-newsletter{
  flex-direction:row!important;
  flex-wrap:wrap!important;
  max-width:min(100%,360px)!important;
  gap:0!important;
}
html[data-pw-edit-device="laptop"] .pw-newsletter input,
html[data-pw-edit-device="desktop"] .pw-newsletter input,
html[data-pw-scene-lock="laptop"] .pw-newsletter input,
html[data-pw-scene-lock="desktop"] .pw-newsletter input,
[data-pw-inline-visual-root][data-pw-active-device="laptop"] .pw-newsletter input,
[data-pw-inline-visual-root][data-pw-active-device="desktop"] .pw-newsletter input,
[data-pw-inline-visual-root][data-pw-edit-device="laptop"] .pw-newsletter input,
[data-pw-inline-visual-root][data-pw-edit-device="desktop"] .pw-newsletter input{
  flex:1 1 0!important;
  width:auto!important;
  border-radius:6px 0 0 6px!important;
  border-right:none!important;
}
html[data-pw-edit-device="laptop"] .pw-newsletter button,
html[data-pw-edit-device="desktop"] .pw-newsletter button,
html[data-pw-scene-lock="laptop"] .pw-newsletter button,
html[data-pw-scene-lock="desktop"] .pw-newsletter button,
[data-pw-inline-visual-root][data-pw-active-device="laptop"] .pw-newsletter button,
[data-pw-inline-visual-root][data-pw-active-device="desktop"] .pw-newsletter button,
[data-pw-inline-visual-root][data-pw-edit-device="laptop"] .pw-newsletter button,
[data-pw-inline-visual-root][data-pw-edit-device="desktop"] .pw-newsletter button{
  width:auto!important;
  flex:0 0 auto!important;
  white-space:nowrap!important;
  border-radius:0 6px 6px 0!important;
  padding:0 14px!important;
}
@media (min-width:768px) and (max-width:899px){
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="laptop"]):not([data-pw-edit-device="desktop"]) .pw-footer-grid,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="laptop"]):not([data-pw-edit-device="desktop"]) .pw-shop-footer-inner{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
}
@media (min-width:900px){
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-footer-grid,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-shop-footer-inner{
    grid-template-columns:minmax(0,1.25fr) repeat(4,minmax(0,1fr))!important;
  }
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-newsletter,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) form.pw-newsletter,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) [data-pw-newsletter],
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-marketplace-cta .pw-newsletter{
    flex-direction:row!important;
    flex-wrap:wrap!important;
    max-width:min(100%,360px)!important;
    gap:0!important;
  }
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-newsletter input,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) form.pw-newsletter input,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) [data-pw-newsletter] input,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-marketplace-cta .pw-newsletter input{
    flex:1 1 0!important;
    width:auto!important;
    border-radius:6px 0 0 6px!important;
    border-right:none!important;
  }
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-newsletter button,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) form.pw-newsletter button,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) [data-pw-newsletter] button,
  html:not([data-pw-edit-device="mobile"]):not([data-pw-edit-device="tablet"]) .pw-marketplace-cta .pw-newsletter button{
    width:auto!important;
    flex:0 0 auto!important;
    white-space:nowrap!important;
    border-radius:0 6px 6px 0!important;
    padding:0 14px!important;
  }
}
`

export function injectPartnerShopFooterFitCss(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return html
  const tag = `<style id="${PW_SHOP_FOOTER_FIT_STYLE_ID}">${PW_SHOP_FOOTER_FIT_CSS}</style>`
  let replaced = false
  let out = trimmed.replace(
    new RegExp(`<style id="${PW_SHOP_FOOTER_FIT_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'),
    () => {
      if (replaced) return ''
      replaced = true
      return tag
    }
  )
  if (!replaced) {
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${tag}\n</body>`)
    else if (/<\/html>/i.test(out)) out = out.replace(/<\/html>/i, `${tag}\n</html>`)
    else out = `${out}\n${tag}`
  }
  return out
}
