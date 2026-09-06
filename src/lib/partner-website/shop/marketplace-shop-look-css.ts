import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

export const PARTNER_WEBSITE_LOOK_MARKETPLACE = 'marketplace' as const

export type PartnerWebsiteLook = typeof PARTNER_WEBSITE_LOOK_MARKETPLACE

export function isMarketplaceLook(theme: Pick<PartnerWebsiteTheme, 'look'> | null | undefined): boolean {
  return String(theme?.look || '').trim() === PARTNER_WEBSITE_LOOK_MARKETPLACE
}

export function htmlHasMarketplaceLook(html: string): boolean {
  return /\bdata-pw-look=["']marketplace["']/i.test(html)
}

export function isMarketplaceTemplateId(templateId: string | null | undefined): boolean {
  return String(templateId || '').trim() === 'fashion-marketplace'
}

export const PARTNER_MARKETPLACE_LOOK_STYLE_ID = 'pw-marketplace-look-css'

export const MARKETPLACE_GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap'

export function stampPartnerWebsiteLookInHtml(html: string, look?: string | null): string {
  const value = String(look || '').trim()
  if (!html.trim() || !value) return html
  if (!/<html\b/i.test(html)) return html
  return html.replace(/<html\b([^>]*)>/i, (_full, attrs: string) => {
    if (/\bdata-pw-look=/.test(attrs)) {
      return `<html${attrs.replace(/\sdata-pw-look=(["'])[^"']*\1/i, ` data-pw-look="${value}"`)}>`
    }
    return `<html${attrs} data-pw-look="${value}">`
  })
}

/** Stamp `data-pw-look` + look CSS after chrome so desktop white header cannot win. */
export function injectMarketplaceLookIntoHtml(
  html: string,
  theme?: Pick<PartnerWebsiteTheme, 'look'> | null
): string {
  const trimmed = html.trim()
  if (!trimmed || !(isMarketplaceLook(theme) || htmlHasMarketplaceLook(trimmed))) return html
  let out = stampPartnerWebsiteLookInHtml(trimmed, PARTNER_WEBSITE_LOOK_MARKETPLACE)
  const tag = `<style id="${PARTNER_MARKETPLACE_LOOK_STYLE_ID}">${buildMarketplaceLookCss()}</style>`
  let replaced = false
  out = out.replace(
    new RegExp(`<style id="${PARTNER_MARKETPLACE_LOOK_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'),
    () => {
      if (replaced) return ''
      replaced = true
      return tag
    }
  )
  if (!replaced) {
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${tag}\n</head>`)
    else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${tag}</head>`)
    else out = `${tag}\n${out}`
  }
  if (!/family=Nunito/i.test(out)) {
    const font = `<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link rel="stylesheet" href="${MARKETPLACE_GOOGLE_FONTS_HREF}"/>`
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${font}\n</head>`) : `${font}\n${out}`
  }
  return out
}

/**
 * Dense marketplace chrome + cards. Only injected when `theme.look === marketplace`.
 * Uses `--pw-*` so the color picker still drives the look.
 */
export function buildMarketplaceLookCss(): string {
  return `
html[data-pw-look="marketplace"]{
  --pw-font-ui:"Nunito","Be Vietnam Pro","Segoe UI",system-ui,sans-serif;
  --pw-font-display:"Nunito","Be Vietnam Pro","Segoe UI",system-ui,sans-serif;
}
html[data-pw-look="marketplace"],html[data-pw-look="marketplace"] body{
  background:var(--pw-bg)!important;
  font-family:var(--pw-font-ui),"Nunito","Be Vietnam Pro","Segoe UI",system-ui,sans-serif;
}
html[data-pw-look="marketplace"] .pw-header,
html[data-pw-look="marketplace"] .pw-shop-header,
html[data-pw-look="marketplace"][data-pw-edit-device] .pw-header,
html[data-pw-look="marketplace"][data-pw-edit-device] .pw-shop-header,
html[data-pw-look="marketplace"][data-pw-scene-lock] .pw-header,
html[data-pw-look="marketplace"][data-pw-scene-lock] .pw-shop-header{
  background:var(--pw-primary)!important;
  border-bottom:none!important;
  box-shadow:0 2px 10px color-mix(in srgb,var(--pw-primary) 35%,transparent)!important;
  color:#fff;
}
html[data-pw-look="marketplace"] .pw-header .pw-wordmark,
html[data-pw-look="marketplace"] .pw-header .pw-brand,
html[data-pw-look="marketplace"] .pw-shop-header .pw-shop-brand,
html[data-pw-look="marketplace"] .pw-shop-header .pw-wordmark{
  color:#fff!important;
  text-shadow:0 1px 1px rgba(0,0,0,.18);
}
html[data-pw-look="marketplace"] .pw-header-actions .pw-icon-btn:not([data-pw-chrome-float]),
html[data-pw-look="marketplace"] .pw-header-actions .pw-account-btn,
html[data-pw-look="marketplace"] .pw-header .pw-account-btn,
html[data-pw-look="marketplace"] .pw-shop-header-actions .pw-icon-btn:not([data-pw-chrome-float]),
html[data-pw-look="marketplace"] .pw-shop-header-actions .pw-account-btn,
html[data-pw-look="marketplace"] .pw-shop-header .pw-account-btn{
  color:#fff!important;
}
html[data-pw-look="marketplace"] .pw-header .pw-cat-btn:not([data-pw-chrome-added]),
html[data-pw-look="marketplace"] .pw-shop-header .pw-shop-cat-btn:not([data-pw-chrome-added]),
html[data-pw-look="marketplace"] .pw-shop-header .pw-cat-btn:not([data-pw-chrome-added]){
  background:rgba(255,255,255,.16)!important;
  border:1.5px solid rgba(255,255,255,.55)!important;
  color:#fff!important;
}
html[data-pw-look="marketplace"] .pw-search-form,
html[data-pw-look="marketplace"] .pw-shop-search-form{
  border:none!important;
  background:#fff!important;
  border-radius:8px!important;
  box-shadow:0 2px 8px rgba(15,23,42,.1);
}
html[data-pw-look="marketplace"] .pw-search-form .pw-search-submit,
html[data-pw-look="marketplace"] .pw-shop-search-form .pw-search-submit,
html[data-pw-look="marketplace"] .pw-search-submit,
html[data-pw-look="marketplace"] .pw-shop-search-submit{
  background:var(--pw-buy)!important;
  color:#fff!important;
}
html[data-pw-look="marketplace"] .pw-nav-main a,
html[data-pw-look="marketplace"] .pw-nav-main button,
html[data-pw-look="marketplace"] .pw-shop-nav-row a,
html[data-pw-look="marketplace"] .pw-shop-nav-row button{
  color:#fff!important;
}
html[data-pw-look="marketplace"] .pw-nav-main a:hover,
html[data-pw-look="marketplace"] .pw-nav-main button:hover,
html[data-pw-look="marketplace"] .pw-shop-nav-row a:hover{
  color:#fff!important;
  opacity:.88;
}
html[data-pw-look="marketplace"] .pw-shop-main,
html[data-pw-look="marketplace"] .pw-page-shell,
html[data-pw-look="marketplace"] .pw-shop{
  background:var(--pw-bg)!important;
}
html[data-pw-look="marketplace"] .pw-shop{
  background:var(--pw-bg)!important;
}
html[data-pw-look="marketplace"] .pw-catalog,
html[data-pw-look="marketplace"] .pw-featured-cat,
html[data-pw-look="marketplace"] .pw-hero.pw-banner,
html[data-pw-look="marketplace"] .pw-marketplace-cta{
  background:#fff;
  border:1px solid var(--pw-border,#e5e7eb);
  border-radius:12px;
  overflow:hidden;
}
html[data-pw-look="marketplace"] .pw-product-card{
  border:1px solid var(--pw-border,#f3f4f6);
  border-radius:8px;
  box-shadow:none;
  background:#fff;
}
html[data-pw-look="marketplace"] .pw-product-card:hover{
  border-color:color-mix(in srgb,var(--pw-primary) 45%,var(--pw-border,#e5e7eb));
  box-shadow:0 8px 20px -12px rgba(15,23,42,.18);
  transform:none;
}
html[data-pw-look="marketplace"] .pw-price,
html[data-pw-look="marketplace"] [data-pw-el="card-price"]{
  color:var(--pw-buy)!important;
  font-weight:800;
}
html[data-pw-look="marketplace"] .pw-footer,
html[data-pw-look="marketplace"] .pw-shop-footer{
  background:var(--pw-footer,#111827)!important;
  color:#e5e7eb;
  border-top:none;
}
html[data-pw-look="marketplace"] .pw-footer h3,
html[data-pw-look="marketplace"] .pw-footer .pw-footer-col h3,
html[data-pw-look="marketplace"] .pw-shop-footer h3{
  color:#fff;
}
html[data-pw-look="marketplace"] .pw-footer a,
html[data-pw-look="marketplace"] .pw-footer p,
html[data-pw-look="marketplace"] .pw-footer-col a,
html[data-pw-look="marketplace"] .pw-shop-footer a{
  color:#d1d5db;
}
html[data-pw-look="marketplace"] .pw-footer a:hover,
html[data-pw-look="marketplace"] .pw-shop-footer a:hover{
  color:#fff;
}
.pw-marketplace-home-main,
html[data-pw-look="marketplace"] .pw-marketplace-home-main{
  display:flex;
  flex-direction:column;
  gap:16px;
  padding:16px var(--pw-page-gutter,20px) 28px;
  box-sizing:border-box;
}
.pw-marketplace-trust,[data-pw-trust-bar="1"],
html[data-pw-look="marketplace"] .pw-marketplace-trust{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
  padding:12px;
  background:#fff;
  border:1px solid var(--pw-border,#e5e7eb);
  border-radius:12px;
  overflow:visible;
  animation:none!important;
  transform:none!important;
}
.pw-marketplace-trust .pw-marketplace-trust-item,
.pw-marketplace-trust [data-pw-trust-item],
[data-pw-trust-bar="1"] .pw-marketplace-trust-item,
html[data-pw-look="marketplace"] .pw-marketplace-trust-item{
  display:flex;
  align-items:center;
  gap:10px;
  padding:6px;
  animation:none!important;
  transform:none!important;
}
.pw-marketplace-trust-icon,
html[data-pw-look="marketplace"] .pw-marketplace-trust-icon{
  width:36px;height:36px;border-radius:999px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--pw-primary) 12%,#fff);
  color:var(--pw-primary);
}
.pw-marketplace-trust-item strong,
html[data-pw-look="marketplace"] .pw-marketplace-trust-item strong{
  display:block;font-size:12px;color:var(--pw-text);
}
.pw-marketplace-trust-item [data-pw-el="subtitle"],
html[data-pw-look="marketplace"] .pw-marketplace-trust-item [data-pw-el="subtitle"]{
  display:block;font-size:11px;color:var(--pw-muted);
}
html[data-pw-look="marketplace"] .pw-marketplace-cta{
  background:linear-gradient(90deg,var(--pw-primary),var(--pw-accent));
  color:#fff;
  text-align:center;
  padding:28px 20px;
  border:none;
}
html[data-pw-look="marketplace"] .pw-marketplace-cta h2{margin:0 0 6px;color:#fff;font-size:1.35rem}
html[data-pw-look="marketplace"] .pw-marketplace-cta p{margin:0 0 14px;color:rgba(255,255,255,.88);font-size:14px}
html[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter{
  max-width:420px;margin:0 auto;display:flex;gap:8px;
}
html[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter input{
  flex:1;border:none;border-radius:8px;padding:10px 12px;font:inherit;
}
html[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter button{
  border:none;border-radius:8px;background:#fff;color:var(--pw-primary);font-weight:800;padding:0 16px;cursor:pointer;
}
html[data-pw-look="marketplace"] .pw-featured-cat-inner{padding:16px}
html[data-pw-look="marketplace"] .pw-marketplace-block-title{
  margin:0 0 12px;font-size:1.05rem;font-weight:800;color:var(--pw-text);
}
@media (max-width:767px){
  .pw-marketplace-trust,[data-pw-trust-bar="1"],
  html[data-pw-look="marketplace"] .pw-marketplace-trust{grid-template-columns:1fr;gap:6px}
  html[data-pw-look="marketplace"] .pw-marketplace-cta .pw-newsletter{flex-direction:column}
}
`.trim()
}
