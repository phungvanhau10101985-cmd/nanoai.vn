import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  getPartnerSiteCategoryNavLabels,
  getPartnerSiteShopNavPaths,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  PW_CHROME_KIT_ATTR,
  buildChromeKitDockHtml,
  buildChromeKitHeadActionHtml,
} from '@/lib/partner-website/shop/partner-site-chrome-kit'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { searchGlyphSvg } from '@/lib/partner-website/visual-editor/search-cluster-icons'

export type PartnerSiteHeaderHtmlInput = {
  locale: WebLocale
  title: string
  logoUrl?: string | null
  /** Logo icon Chat mua dùng chung mọi máy — ưu tiên hơn logo shop. */
  chatIconLogoUrl?: string | null
  /** When set, header links target React shop routes under /site/{slug}/… */
  siteSlug?: string
  /** Gallery / static sample — show shop chrome without live slug */
  samplePreview?: boolean
  /** Seed ẩn/hiện kit theo máy (desktop+laptop = pc). */
  device?: VisualDeviceVariant | null
}

export type PartnerSiteHeaderHtmlOutput = {
  header: string
  bottomNav: string
  scripts: string
}

type HtmlIconName = 'menu'

function svgPdpIcon(name: 'home' | 'try-on' | 'heart'): string {
  if (name === 'try-on') {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>`
  }
  if (name === 'heart') {
    return `<svg class="pw-pdp-like-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`
  }
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`
}

function stickyTwoLine(line1: string, line2?: string): string {
  const a = escapeHtml(line1)
  const b = (line2 || '').trim()
  if (!b) return `<span class="pw-pdp-sticky-copy"><span>${a}</span></span>`
  return `<span class="pw-pdp-sticky-copy"><span>${a}</span><span>${escapeHtml(b)}</span></span>`
}

function svgIcon(name: HtmlIconName): string {
  const paths: Record<HtmlIconName, string> = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`
}

function searchLabels(locale: WebLocale) {
  const t = getPartnerSiteShopCopy(locale)
  return {
    placeholder: t.searchPlaceholder,
    button: t.searchButton,
    image: t.searchByImage,
  }
}

function buildCategoryLinks(productsHref: string, saleHref: string, locale: WebLocale): string {
  const n = getPartnerSiteCategoryNavLabels(locale)
  return `<a href="${productsHref}" ${pwElAttr(PW_EL.navLink)}>${escapeHtml(n.newArrivals)}</a>
    <a href="${productsHref}" ${pwElAttr(PW_EL.navLink)}>${escapeHtml(n.clothing)}</a>
    <a href="${productsHref}" ${pwElAttr(PW_EL.navLink)}>${escapeHtml(n.bags)}</a>
    <a href="${productsHref}" ${pwElAttr(PW_EL.navLink)}>${escapeHtml(n.shoes)}</a>
    <a href="${productsHref}" ${pwElAttr(PW_EL.navLink)}>${escapeHtml(n.accessories)}</a>
    <a class="pw-nav-sale" href="${saleHref}" ${pwElAttr(PW_EL.navLink)}>${escapeHtml(n.sale)}</a>`
}

function buildHeaderInteractionScripts(): string {
  return `<script data-pw-header-toggle>(function(){
  var catBtn=document.querySelector('[data-pw-cat-toggle]');
  var catPanel=document.querySelector('[data-pw-cat-panel]');
  function closeCat(){
    if(!catPanel||!catBtn)return;
    catPanel.classList.remove('is-open');
    catBtn.setAttribute('aria-expanded','false');
  }
  if(catBtn&&catPanel){
    catBtn.addEventListener('click',function(e){
      if(document.body&&document.body.classList.contains('nanoai-ve-active'))return;
      e.stopPropagation();
      var open=catPanel.classList.toggle('is-open');
      catBtn.setAttribute('aria-expanded',open?'true':'false');
    });
  }
  document.addEventListener('click',function(e){
    if(catPanel&&(catPanel.contains(e.target)||(catBtn&&catBtn.contains(e.target))))return;
    closeCat();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){closeCat();}
  });
})();</script>`
}

/** CSS snippet for account dropdown — inject into template `buildStyles`. */
export function buildPartnerSiteAccountPanelCss(): string {
  return `.pw-account-wrap{position:relative}
.pw-account-panel{display:none;position:absolute;right:0;top:calc(100% + 8px);z-index:60;min-width:220px;padding:6px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-account-panel.is-open{display:grid;gap:2px}
.pw-account-panel a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#374151;text-decoration:none}
.pw-account-panel a:hover{background:var(--pw-surface);color:var(--pw-primary)}
.pw-account-panel a.is-header{background:#eff6ff;color:#2563eb;border-left:3px solid #2563eb;border-radius:8px 8px 8px 6px;font-weight:700}
.pw-account-panel a.is-header:hover{background:#dbeafe;color:#1d4ed8}
.pw-account-panel a.is-accent{background:var(--pw-surface);color:var(--pw-accent);border-left:3px solid var(--pw-primary);border-radius:8px 8px 8px 6px;font-weight:700}
.pw-account-panel a.is-accent:hover{background:var(--pw-surface);color:var(--pw-primary)}
.pw-account-panel svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.pw-account-panel a.is-header svg{color:#2563eb}
.pw-account-panel a.is-accent svg{color:var(--pw-accent)}
.pw-account-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border-radius:999px;border:none;background:transparent;color:#374151;font:inherit;font-size:13px;font-weight:700;cursor:pointer;position:relative}
.pw-account-btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2}
@media(min-width:900px){.pw-account-btn-label{display:inline}}
@media(max-width:899px){
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-account-wrap{display:none}
html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-account-btn-label{display:none}
}`
}

/**
 * Shared HTML header + bottom nav for every shop page (template preview + gallery samples).
 * Links point to React shop when `siteSlug` is set.
 * See `docs/PARTNER_WEBSITE_SHARED_CHROME.md`.
 */
export function buildPartnerSiteHeaderHtml(input: PartnerSiteHeaderHtmlInput): PartnerSiteHeaderHtmlOutput {
  const siteSlug = input.siteSlug?.trim() ?? ''
  const showShopChrome = Boolean(siteSlug) || Boolean(input.samplePreview)
  if (!showShopChrome) {
    return { header: '', bottomNav: '', scripts: '' }
  }

  const shop = getPartnerSiteShopCopy(input.locale)
  const n = getPartnerSiteCategoryNavLabels(input.locale)
  const paths = siteSlug
    ? getPartnerSiteShopNavPaths(siteSlug)
    : {
        home: '#top',
        products: '#products',
        sale: '#products',
        wishlist: '#products',
        cart: '#products',
        orders: '#lead-form',
        account: '#lead-form',
        login: '#lead-form',
        addresses: '#lead-form',
        recentlyViewed: '#products',
        contact: '#lead-form',
      }

  const homeHref = escapeAttr(paths.home)
  const productsHref = escapeAttr(paths.products)
  const wishlistHref = escapeAttr(paths.wishlist)
  const saleHref = escapeAttr(paths.sale)
  const contactHref = escapeAttr(paths.contact)
  const loginHref = escapeAttr(paths.login)
  const search = searchLabels(input.locale)
  const logo = input.logoUrl?.trim() ?? ''

  const topbar = `<div class="pw-topbar" ${pwRegionAttr(PW_REGION.topbar)}><div class="pw-container pw-topbar-inner">
      <a href="${contactHref}" ${pwElAttr(PW_EL.link)} data-pw-chrome-btn="contact">${escapeHtml(n.contact)}</a>
      <a href="${wishlistHref}" ${pwElAttr(PW_EL.link)} data-pw-chrome-btn="favorites-link">${escapeHtml(shop.navFavorites)}</a>
      <a href="${loginHref}" ${pwElAttr(PW_EL.link)} data-pw-chrome-btn="login">${escapeHtml(n.login)}</a>
    </div></div>`

  const brandBlock = logo
    ? `<a class="pw-brand" href="${homeHref}"><img class="pw-logo" ${pwElAttr(PW_EL.logo)} src="${escapeAttr(logo)}" alt="${escapeAttr(input.title)}"/><span class="pw-wordmark" ${pwElAttr(PW_EL.wordmark)}>${escapeHtml(input.title)}</span></a>`
    : `<a class="pw-brand" href="${homeHref}"><span class="pw-wordmark" ${pwElAttr(PW_EL.wordmark)}>${escapeHtml(input.title)}</span></a>`

  const searchBar = `<div class="pw-header-search" ${pwElAttr(PW_EL.search)}>
    <form class="pw-search-form" data-pw-search-form role="search">
      <input data-pw-search type="search" name="q" placeholder="${escapeAttr(search.placeholder)}" aria-label="${escapeAttr(search.placeholder)}" autocomplete="off"/>
      <button type="button" class="pw-search-image-btn" data-pw-image-search data-pw-search-glyph="camera" aria-label="${escapeAttr(search.image)}" title="${escapeAttr(search.image)}"><span class="pw-chrome-icon-wrap">${searchGlyphSvg('camera')}</span></button>
      <button type="submit" class="pw-search-submit" data-pw-search-glyph="lens">${searchGlyphSvg('lens')}<span class="pw-shop-search-submit-label">${escapeHtml(search.button)}</span></button>
    </form>
  </div>`

  const categoryLinks = buildCategoryLinks(productsHref, saleHref, input.locale)

  const header = `<header class="pw-header" ${pwRegionAttr(PW_REGION.header)}>
  ${topbar}
  <div class="pw-container pw-header-main">
    <div class="pw-brand-cluster">
      <button type="button" class="pw-cat-btn" ${pwElAttr(PW_EL.catToggle)} data-pw-chrome-btn="categories" data-pw-cat-toggle ${PW_CHROME_KIT_ATTR}="1" aria-expanded="false" aria-controls="pw-cat-panel" aria-label="${escapeAttr(shop.navCategories)}">${svgIcon('menu')}<span>${escapeHtml(shop.navCategories)}</span></button>
      ${brandBlock}
      <nav id="pw-cat-panel" class="pw-cat-panel" data-pw-cat-panel aria-label="${escapeAttr(shop.navCategories)}">
        ${categoryLinks}
      </nav>
    </div>
    ${searchBar}
    <div class="pw-header-actions" ${PW_CHROME_KIT_ATTR}="actions">
      ${buildChromeKitHeadActionHtml({
        locale: input.locale,
        siteSlug: siteSlug || null,
        device: input.device,
        logoUrl: logo,
        chatIconLogoUrl: input.chatIconLogoUrl,
      })}
    </div>
  </div>
  <nav class="pw-container pw-seo-row" data-pw-seo-row hidden aria-label=""></nav>
  <nav class="pw-container pw-nav-main" ${pwRegionAttr(PW_REGION.nav)} aria-label="Shop">
    ${categoryLinks}
  </nav>
</header>`

  const bottomNav = `<nav class="pw-bottom-nav" ${pwRegionAttr(PW_REGION.nav)} ${PW_CHROME_KIT_ATTR}="dock" aria-label="Mobile">
    ${buildChromeKitDockHtml({
      locale: input.locale,
      siteSlug: siteSlug || null,
      logoUrl: logo,
      chatIconLogoUrl: input.chatIconLogoUrl,
    })}
  </nav>`

  return {
    header,
    bottomNav,
    scripts: buildHeaderInteractionScripts(),
  }
}

/**
 * Mobile PDP bottom bar — Home, try-on, favorite, add to cart, buy.
 * Kept off the shared shop nav so Sửa nhanh can edit it without copying onto other pages.
 */
export function buildPartnerSitePdpBottomNavHtml(input: {
  locale: WebLocale
  homeHref: string
  /** Tablet/desktop overlay — not the shared `pw-bottom-nav`. */
  stickyOnly?: boolean
}): string {
  const t = getPartnerSiteShopCopy(input.locale)
  const homeHref = escapeAttr(input.homeHref)
  const inner = `<div class="pw-pdp-sticky-nav">
      <a href="${homeHref}" ${pwElAttr(PW_EL.navLink)} data-pw-chrome-btn="home">${svgPdpIcon('home')}${stickyTwoLine(t.pdpStickyHomeL1, t.pdpStickyHomeL2)}</a>
      <button type="button" class="is-try" data-pw-chrome-btn="try-on" data-nanoai-try-on>${svgPdpIcon('try-on')}${stickyTwoLine(t.pdpStickyTryOnL1, t.pdpStickyTryOnL2)}</button>
      <button type="button" class="is-fav" data-pw-chrome-btn="favorite-product" ${pwElAttr(PW_EL.wishlist)} data-pw-favorite data-pw-pdp-favorite="1" data-pw-like-base="0" aria-pressed="false">${svgPdpIcon('heart')}<span class="pw-pdp-like-copy"><span>${escapeHtml(t.pdpStickyLikeLabel)}</span><span class="pw-pdp-like-count" data-pw-like-count>0</span></span></button>
    </div>
    <div class="pw-pdp-sticky-ctas">
      <button type="button" class="pw-shop-btn pw-shop-btn-cart" data-pw-chrome-btn="add-cart" ${pwElAttr(PW_EL.cardCart)} data-pw-add-cart data-pw-pdp-add-cart="1">${escapeHtml(t.pdpAddToCartShort)}</button>
      <button type="button" class="pw-shop-btn pw-shop-btn-buy" data-pw-chrome-btn="buy-now" ${pwElAttr(PW_EL.buy)} data-pw-buy data-pw-pdp-buy-now="1">${escapeHtml(t.pdpBuyNowShort)}</button>
    </div>`
  if (input.stickyOnly) {
    return `<div class="pw-pdp-sticky">${inner}</div>`
  }
  return `<nav class="pw-bottom-nav pw-shop-bottom-nav pw-pdp-sticky" ${pwRegionAttr(PW_REGION.nav)} data-pw-pdp-bottom="1" aria-label="${escapeAttr(t.pdpStickyHome)}">${inner}</nav>`
}

const PDP_BOTTOM_OPEN_RE =
  /<(nav|div)\b(?=[^>]*?(?:data-pw-pdp-bottom=["']1["']|class=["'][^"']*\bpw-pdp-sticky\b))[^>]*>/i

function extractPdpBottomNavRange(html: string): { start: number; end: number; html: string } | null {
  const masked = html.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (block) => ' '.repeat(block.length)
  )
  const open = PDP_BOTTOM_OPEN_RE.exec(masked)
  if (!open || open.index == null) return null
  const tag = (open[1] || 'nav').toLowerCase()
  const start = open.index
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi')
  re.lastIndex = start + open[0].length
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) {
        const closeTok = html.slice(match.index).match(new RegExp(`^</${tag}\\s*>`, 'i'))
        const end = match.index + (closeTok?.[0].length ?? `</${tag}>`.length)
        return { start, end, html: html.slice(start, end) }
      }
      continue
    }
    if (!/\/>$/.test(match[0])) depth += 1
  }
  return null
}

function is188PdpBottomNav(html: string): boolean {
  return (
    /data-pw-like-count/i.test(html) &&
    /pw-pdp-like-copy/i.test(html) &&
    /pw-pdp-sticky-copy/i.test(html)
  )
}

/**
 * HTML PDP cũ thiếu số lượt / 2 dòng 188 — nâng thanh đáy lúc Sửa nhanh / live.
 * Đã có `pw-pdp-like-copy` + `pw-pdp-sticky-copy` thì giữ (merchant đã sửa).
 */
export function ensurePartnerSitePdpBottomNavInHtml(
  html: string,
  input: {
    locale?: WebLocale | null
    siteSlug?: string | null
    pageKey?: string | null
  }
): string {
  if (!html.trim()) return html
  if (/\bdata-pw-chrome-kit=["']dock["']/i.test(html)) return html
  const bodyAttrs = html.match(/<body\b([^>]*)>/i)?.[1] || ''
  const isProduct =
    input.pageKey === 'product_detail' || /\bdata-pw-page=["']product["']/i.test(bodyAttrs)
  if (!isProduct) return html
  const locale = input.locale ?? 'vi'
  const siteSlug = input.siteSlug?.trim() ?? ''
  const homeHref = siteSlug ? partnerSiteHomePath(siteSlug) : '#'
  const found = extractPdpBottomNavRange(html)
  if (found && is188PdpBottomNav(found.html)) return html
  const stickyOnly = Boolean(found && /<div\b/i.test(found.html) && !/data-pw-pdp-bottom/i.test(found.html))
  const next = buildPartnerSitePdpBottomNavHtml({ locale, homeHref, stickyOnly })
  if (!found) {
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${next}\n</body>`)
    return `${html}\n${next}`
  }
  return `${html.slice(0, found.start)}${next}${html.slice(found.end)}`
}
