import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import {
  isMarketplaceLook,
  htmlHasMarketplaceLook,
  resolvePartnerWebsiteLook,
  stampPartnerWebsiteLookInHtml,
  PARTNER_WEBSITE_LOOK_SHOP,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'

export const PARTNER_SHOP_LOOK_STYLE_ID = 'pw-shop-look-css'

/** Live inlines body into Next.js — look also lives on the visual root until `<html>` is stamped. */
export const SHOP_LOOK_SCOPE =
  ':is(html[data-pw-look="shop"],.pw-shop[data-pw-look="shop"],[data-pw-inline-visual-root][data-pw-look="shop"])'

export function scopeShopLookCss(css: string): string {
  if (!css) return css
  return css.replace(/html\[data-pw-look=(["'])shop\1\]/g, SHOP_LOOK_SCOPE)
}

function shouldPaintShopLook(theme?: Pick<PartnerWebsiteTheme, 'look'> | null, html?: string): boolean {
  if (isMarketplaceLook(theme) || htmlHasMarketplaceLook(html || '')) return false
  return resolvePartnerWebsiteLook(theme, html) === PARTNER_WEBSITE_LOOK_SHOP
}

/** Stamp `data-pw-look="shop"` + boutique chrome CSS after chrome layout so white-head polish wins. */
export function injectShopLookIntoHtml(
  html: string,
  theme?: Pick<PartnerWebsiteTheme, 'look'> | null
): string {
  const trimmed = html.trim()
  if (!trimmed || !shouldPaintShopLook(theme, trimmed)) return html
  let out = stampPartnerWebsiteLookInHtml(trimmed, PARTNER_WEBSITE_LOOK_SHOP)
  const tag = `<style id="${PARTNER_SHOP_LOOK_STYLE_ID}">${buildShopLookCss()}</style>`
  let replaced = false
  out = out.replace(new RegExp(`<style id="${PARTNER_SHOP_LOOK_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'), () => {
    if (replaced) return ''
    replaced = true
    return tag
  })
  if (!replaced) {
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${tag}\n</head>`)
    else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${tag}</head>`)
    else out = `${tag}\n${out}`
  }
  return out
}

/**
 * Boutique shop chrome (GD02 / look=shop): white head, easy-tap search/nav, photo hero.
 * Tokens only — color picker still drives the face. Does not change logo slot physics.
 */
export function buildShopLookCss(): string {
  const css = `
html[data-pw-look="shop"]{
  --pw-font-ui:"Be Vietnam Pro","Segoe UI",system-ui,sans-serif;
}
html[data-pw-look="shop"],html[data-pw-look="shop"] body{
  background:var(--pw-bg)!important;
  font-family:var(--pw-font-ui),"Be Vietnam Pro","Segoe UI",system-ui,sans-serif;
}
html[data-pw-look="shop"] .pw-topbar,
html[data-pw-look="shop"] .pw-shop-topbar,
html[data-pw-look="shop"] [data-pw-region="topbar"]{
  min-height:34px!important;
}
html[data-pw-look="shop"] .pw-topbar-inner,
html[data-pw-look="shop"] .pw-shop-topbar-inner{
  justify-content:flex-end!important;
  align-items:center!important;
  gap:var(--pw-kit-gap, 18px)!important;
  min-height:34px!important;
  font-size:13px!important;
  font-weight:600!important;
}
html[data-pw-look="shop"] .pw-slogan:not([hidden]){
  margin-right:auto!important;
  max-width:min(52%, 640px);
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  opacity:.96;
  font-weight:600;
  letter-spacing:.01em;
}
html[data-pw-look="shop"] .pw-topbar a,
html[data-pw-look="shop"] .pw-shop-topbar a,
html[data-pw-look="shop"] [data-pw-region="topbar"] a{
  min-height:28px;
  display:inline-flex;
  align-items:center;
  opacity:.92;
}
html[data-pw-look="shop"] .pw-topbar a:hover,
html[data-pw-look="shop"] .pw-shop-topbar a:hover,
html[data-pw-look="shop"] [data-pw-region="topbar"] a:hover{
  opacity:1;
  text-decoration:underline;
  text-underline-offset:3px;
}
html[data-pw-look="shop"] [data-pw-region="header"],
html[data-pw-look="shop"] .pw-header,
html[data-pw-look="shop"] .pw-shop-header{
  background:#fff!important;
  border-bottom:1px solid var(--pw-border,#f3f4f6)!important;
  box-shadow:0 1px 0 color-mix(in srgb,var(--pw-border,#e5e7eb) 80%,transparent),0 10px 28px rgba(15,23,42,.045)!important;
}
html[data-pw-look="shop"] .pw-wordmark{
  font-size:1.22rem!important;
  letter-spacing:-.02em;
  font-weight:800!important;
  color:var(--pw-primary)!important;
}
html[data-pw-look="shop"] .pw-header .pw-cat-btn:not([data-pw-chrome-added]),
html[data-pw-look="shop"] .pw-shop-header .pw-shop-cat-btn:not([data-pw-chrome-added]),
html[data-pw-look="shop"] .pw-shop-header .pw-cat-btn:not([data-pw-chrome-added]){
  height:40px!important;
  padding:0 14px!important;
  border:1px solid var(--pw-border,#e5e7eb)!important;
  background:var(--pw-surface,#fff)!important;
  color:#374151!important;
  box-shadow:0 1px 2px rgba(15,23,42,.04);
}
html[data-pw-look="shop"] .pw-header .pw-cat-btn:not([data-pw-chrome-added]):hover,
html[data-pw-look="shop"] .pw-shop-header .pw-cat-btn:not([data-pw-chrome-added]):hover,
html[data-pw-look="shop"] .pw-shop-header .pw-shop-cat-btn:not([data-pw-chrome-added]):hover{
  border-color:var(--pw-primary)!important;
  color:var(--pw-primary)!important;
  background:#fff!important;
}
html[data-pw-look="shop"] .pw-search-form,
html[data-pw-look="shop"] .pw-shop-search-form{
  height:42px!important;
  border:1px solid var(--pw-border,#e5e7eb)!important;
  border-radius:999px!important;
  background:color-mix(in srgb,var(--pw-surface,#fff) 70%,#fff)!important;
  box-shadow:0 1px 2px rgba(15,23,42,.05);
}
html[data-pw-look="shop"] .pw-search-form:focus-within,
html[data-pw-look="shop"] .pw-shop-search-form:focus-within{
  border-color:var(--pw-primary)!important;
  background:#fff!important;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--pw-primary) 16%,transparent);
}
html[data-pw-look="shop"] .pw-search-compose span,
html[data-pw-look="shop"] .pw-shop-search-compose span{
  font-size:14px;
  color:var(--pw-muted,#6b7280);
}
html[data-pw-look="shop"] .pw-search-form .pw-search-submit,
html[data-pw-look="shop"] .pw-shop-search-form .pw-search-submit,
html[data-pw-look="shop"] .pw-search-submit,
html[data-pw-look="shop"] .pw-shop-search-submit{
  min-width:64px!important;
  padding:0 16px!important;
  font-size:12px!important;
  font-weight:800!important;
  letter-spacing:.04em;
  text-transform:uppercase;
  background:var(--pw-primary)!important;
  color:#fff!important;
}
html[data-pw-look="shop"] .pw-header-actions [data-pw-chrome-kit="1"]:hover,
html[data-pw-look="shop"] .pw-shop-header-actions [data-pw-chrome-kit="1"]:hover,
html[data-pw-look="shop"] .pw-header-actions .pw-account-btn:hover,
html[data-pw-look="shop"] .pw-shop-header-actions .pw-account-btn:hover{
  background:var(--pw-surface,#fff7ed)!important;
  color:var(--pw-primary)!important;
  border-radius:12px;
}
html[data-pw-look="shop"] .pw-nav-main,
html[data-pw-look="shop"] .pw-shop-nav-row{
  gap:6px!important;
  padding:0 0 10px!important;
  justify-content:center!important;
}
html[data-pw-look="shop"] .pw-nav-main>a,
html[data-pw-look="shop"] .pw-nav-main>button,
html[data-pw-look="shop"] .pw-shop-nav-row>a,
html[data-pw-look="shop"] .pw-shop-nav-row>button{
  display:inline-flex!important;
  align-items:center!important;
  min-height:32px!important;
  padding:6px 12px!important;
  border-radius:999px!important;
  font-size:13px!important;
  font-weight:700!important;
  letter-spacing:.02em!important;
  text-transform:none!important;
  color:#374151!important;
}
html[data-pw-look="shop"] .pw-nav-main>a:hover,
html[data-pw-look="shop"] .pw-shop-nav-row>a:hover,
html[data-pw-look="shop"] .pw-nav-main .pw-nav-row-scroll>a:hover,
html[data-pw-look="shop"] .pw-shop-nav-row .pw-nav-row-scroll>a:hover,
html[data-pw-look="shop"] .pw-nav-main .pw-nav-pill>a:hover,
html[data-pw-look="shop"] .pw-shop-nav-row .pw-nav-pill>a:hover,
html[data-pw-look="shop"] .pw-nav-main .pw-nav-pill:hover>a,
html[data-pw-look="shop"] .pw-shop-nav-row .pw-nav-pill:hover>a{
  color:var(--pw-primary)!important;
  background:color-mix(in srgb,var(--pw-primary) 10%,#fff);
}
html[data-pw-look="shop"] .pw-nav-main>a.pw-nav-sale,
html[data-pw-look="shop"] .pw-shop-nav-row>a.pw-nav-sale,
html[data-pw-look="shop"] .pw-nav-main a.is-sale,
html[data-pw-look="shop"] .pw-shop-nav-row a.is-sale{
  color:var(--pw-buy)!important;
  font-weight:800!important;
}
html[data-pw-look="shop"] .pw-hero:not([data-pw-slider]):not([data-pw-personalize-banner]){
  min-height:min(52vh,520px)!important;
  display:flex;
  align-items:center;
  overflow:hidden;
}
html[data-pw-look="shop"] .pw-hero-inner{
  position:relative!important;
  inset:auto!important;
  height:auto!important;
  z-index:2;
}
html[data-pw-look="shop"] .pw-hero [data-pw-el="media"],
html[data-pw-look="shop"] .pw-hero-media{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;display:block;
}
html[data-pw-look="shop"] .pw-hero::after{
  z-index:1;
  background:linear-gradient(100deg,color-mix(in srgb,#111 56%,transparent) 0%,color-mix(in srgb,#111 20%,transparent) 55%,transparent 100%);
}
html[data-pw-look="shop"] .pw-section-title{
  letter-spacing:.04em!important;
  font-size:clamp(1.15rem,2vw,1.45rem)!important;
}
html[data-pw-look="shop"] .pw-cat-media{
  border:1px solid var(--pw-border,#e5e7eb)!important;
  border-radius:16px!important;
  overflow:hidden;
  transition:border-color .2s ease,transform .2s ease,box-shadow .2s ease;
}
html[data-pw-look="shop"] .pw-cat-card:hover .pw-cat-media{
  border-color:var(--pw-primary)!important;
  transform:translateY(-3px);
  box-shadow:0 12px 24px -16px color-mix(in srgb,var(--pw-primary) 55%,transparent);
}
html[data-pw-look="shop"] .pw-cat-label{
  font-weight:700;
  color:#374151;
}
html[data-pw-look="shop"] .pw-product-card-media{
  aspect-ratio:1!important;
}
html[data-pw-look="shop"] .pw-badge-new{
  background:var(--pw-primary)!important;
  color:#fff!important;
  border-radius:6px;
}
html[data-pw-look="shop"] .pw-band-orange{
  background:color-mix(in srgb,var(--pw-primary) 8%,var(--pw-bg,#fff))!important;
}
html[data-pw-look="shop"] .pw-band-orange .pw-section-title-light{
  color:var(--pw-primary)!important;
}
html[data-pw-look="shop"] .pw-product-card-body h3,
html[data-pw-look="shop"] .pw-product-card [data-pw-el="card-name"]{
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}
html[data-pw-edit-device="desktop"][data-pw-look="shop"] .pw-search-submit .pw-shop-search-submit-label,
html[data-pw-edit-device="laptop"][data-pw-look="shop"] .pw-search-submit .pw-shop-search-submit-label,
html[data-pw-scene-lock="desktop"][data-pw-look="shop"] .pw-search-submit .pw-shop-search-submit-label,
html[data-pw-scene-lock="laptop"][data-pw-look="shop"] .pw-search-submit .pw-shop-search-submit-label{
  display:inline!important;
  font-size:12px!important;
  color:#fff!important;
}
html[data-pw-edit-device="desktop"][data-pw-look="shop"] .pw-search-submit svg,
html[data-pw-edit-device="laptop"][data-pw-look="shop"] .pw-search-submit svg,
html[data-pw-scene-lock="desktop"][data-pw-look="shop"] .pw-search-submit svg,
html[data-pw-scene-lock="laptop"][data-pw-look="shop"] .pw-search-submit svg{
  display:none!important;
}
@media (min-width:1280px){
html[data-pw-look="shop"]:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-search-submit .pw-shop-search-submit-label{
  display:inline!important;font-size:12px!important;color:#fff!important
}
html[data-pw-look="shop"]:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-search-submit svg{display:none!important}
}
html[data-pw-edit-device="mobile"][data-pw-look="shop"] .pw-header,
html[data-pw-edit-device="tablet"][data-pw-look="shop"] .pw-header,
html[data-pw-scene-lock="mobile"][data-pw-look="shop"] .pw-header,
html[data-pw-scene-lock="tablet"][data-pw-look="shop"] .pw-header{
  background:var(--pw-primary)!important;
  border-bottom:none!important;
  box-shadow:0 6px 18px color-mix(in srgb,var(--pw-primary) 35%,transparent)!important;
}
html[data-pw-edit-device="mobile"][data-pw-look="shop"] .pw-wordmark,
html[data-pw-edit-device="tablet"][data-pw-look="shop"] .pw-wordmark,
html[data-pw-scene-lock="mobile"][data-pw-look="shop"] .pw-wordmark,
html[data-pw-scene-lock="tablet"][data-pw-look="shop"] .pw-wordmark{
  color:#fff!important;
}
@media (max-width:1279px){
html[data-pw-look="shop"]:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-header{
  background:var(--pw-primary)!important;
  border-bottom:none!important;
  box-shadow:0 6px 18px color-mix(in srgb,var(--pw-primary) 35%,transparent)!important;
}
html[data-pw-look="shop"]:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-wordmark{color:#fff!important}
html[data-pw-look="shop"]:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-hero{min-height:240px}
}
`.trim()
  return scopeShopLookCss(css)
}
