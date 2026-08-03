import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  getPartnerSiteAccountMenuItems,
  getPartnerSiteCategoryNavLabels,
  getPartnerSitePromoNavLabel,
  getPartnerSiteShopNavPaths,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'

export type PartnerSiteHeaderHtmlInput = {
  locale: WebLocale
  title: string
  logoUrl?: string | null
  /** When set, header links target React shop routes under /site/{slug}/… */
  siteSlug?: string
  /** Gallery / static sample — show shop chrome without live slug */
  samplePreview?: boolean
}

export type PartnerSiteHeaderHtmlOutput = {
  header: string
  bottomNav: string
  scripts: string
}

type HtmlIconName =
  | 'menu'
  | 'user'
  | 'cart'
  | 'home'
  | 'box'
  | 'tag'
  | 'pencil'
  | 'clipboard'
  | 'clock'
  | 'mappin'

function svgIcon(name: HtmlIconName): string {
  const paths: Record<HtmlIconName, string> = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"/>',
    cart: '<path d="M3 4h2l2.2 11h9.6L19 7H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>',
    box: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>',
    tag: '<path d="M12 4h7v7l-9.5 9.5a2 2 0 0 1-2.8 0L4.5 18.3a2 2 0 0 1 0-2.8z"/><circle cx="16" cy="8" r="1.2"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    clipboard: '<rect x="8" y="4" width="8" height="4" rx="1"/><path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mappin: '<path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`
}

const ACCOUNT_MENU_ICONS: Record<string, HtmlIconName> = {
  account: 'user',
  'edit-profile': 'pencil',
  cart: 'cart',
  orders: 'clipboard',
  'recently-viewed': 'clock',
  addresses: 'mappin',
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
  return `<a href="${productsHref}">${escapeHtml(n.newArrivals)}</a>
    <a href="${productsHref}">${escapeHtml(n.clothing)}</a>
    <a href="${productsHref}">${escapeHtml(n.bags)}</a>
    <a href="${productsHref}">${escapeHtml(n.shoes)}</a>
    <a href="${productsHref}">${escapeHtml(n.accessories)}</a>
    <a class="pw-nav-sale" href="${saleHref}">${escapeHtml(n.sale)}</a>`
}

function buildAccountMenuHtml(items: ReturnType<typeof getPartnerSiteAccountMenuItems>): string {
  return items
    .map((item) => {
      const icon = ACCOUNT_MENU_ICONS[item.id] ?? 'user'
      const classes = [
        item.isHeader ? 'is-header' : '',
        item.isAccent ? 'is-accent' : '',
      ]
        .filter(Boolean)
        .join(' ')
      const classAttr = classes ? ` class="${classes}"` : ''
      return `<a href="${escapeAttr(item.href)}"${classAttr}>${svgIcon(icon)}<span>${escapeHtml(item.label)}</span></a>`
    })
    .join('\n        ')
}

function buildHeaderInteractionScripts(): string {
  return `<script data-pw-header-toggle>(function(){
  var catBtn=document.querySelector('[data-pw-cat-toggle]');
  var catPanel=document.querySelector('[data-pw-cat-panel]');
  var accBtn=document.querySelector('[data-pw-account-toggle]');
  var accPanel=document.querySelector('[data-pw-account-panel]');
  function closeCat(){
    if(!catPanel||!catBtn)return;
    catPanel.classList.remove('is-open');
    catBtn.setAttribute('aria-expanded','false');
  }
  function closeAcc(){
    if(!accPanel||!accBtn)return;
    accPanel.classList.remove('is-open');
    accBtn.setAttribute('aria-expanded','false');
  }
  if(catBtn&&catPanel){
    catBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=catPanel.classList.toggle('is-open');
      catBtn.setAttribute('aria-expanded',open?'true':'false');
      if(open)closeAcc();
    });
  }
  if(accBtn&&accPanel){
    accBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=accPanel.classList.toggle('is-open');
      accBtn.setAttribute('aria-expanded',open?'true':'false');
      if(open)closeCat();
    });
    accPanel.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click',function(){closeAcc();});
    });
  }
  document.addEventListener('click',function(e){
    if(catPanel&&(catPanel.contains(e.target)||(catBtn&&catBtn.contains(e.target))))return;
    if(accPanel&&(accPanel.contains(e.target)||(accBtn&&accBtn.contains(e.target))))return;
    closeCat();
    closeAcc();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){closeCat();closeAcc();}
  });
})();</script>`
}

/** CSS snippet for account dropdown — inject into template `buildStyles`. */
export function buildPartnerSiteAccountPanelCss(): string {
  return `.pw-account-wrap{position:relative}
.pw-account-panel{display:none;position:absolute;right:0;top:calc(100% + 8px);z-index:60;min-width:220px;padding:6px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)}
.pw-account-panel.is-open{display:grid;gap:2px}
.pw-account-panel a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#374151;text-decoration:none}
.pw-account-panel a:hover{background:#fff7ed;color:var(--pw-primary)}
.pw-account-panel a.is-header{background:#eff6ff;color:#2563eb;border-left:3px solid #2563eb;border-radius:8px 8px 8px 6px;font-weight:700}
.pw-account-panel a.is-header:hover{background:#dbeafe;color:#1d4ed8}
.pw-account-panel a.is-accent{background:#fff7ed;color:#ea580c;border-left:3px solid #f97316;border-radius:8px 8px 8px 6px;font-weight:700}
.pw-account-panel a.is-accent:hover{background:#ffedd5;color:#c2410c}
.pw-account-panel svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;flex-shrink:0}
.pw-account-panel a.is-header svg{color:#2563eb}
.pw-account-panel a.is-accent svg{color:#ea580c}
.pw-account-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border-radius:999px;border:none;background:transparent;color:#374151;font:inherit;font-size:13px;font-weight:700;cursor:pointer;position:relative}
.pw-account-btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2}
@media(min-width:900px){.pw-account-btn-label{display:inline}}
@media(max-width:899px){.pw-account-wrap{display:none}.pw-account-btn-label{display:none}}`
}

/**
 * Shared HTML header for template preview + gallery samples.
 * Links point to React shop when `siteSlug` is set.
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
        addresses: '#lead-form',
        recentlyViewed: '#products',
        contact: '#lead-form',
      }

  const homeHref = escapeAttr(paths.home)
  const productsHref = escapeAttr(paths.products)
  const wishlistHref = escapeAttr(paths.wishlist)
  const cartHref = escapeAttr(paths.cart)
  const saleHref = escapeAttr(paths.sale)
  const contactHref = escapeAttr(paths.contact)
  const accountHref = escapeAttr(paths.account)
  const accountMenuItems = getPartnerSiteAccountMenuItems({ siteSlug, locale: input.locale })
  const search = searchLabels(input.locale)
  const promoLabel = getPartnerSitePromoNavLabel(input.locale)
  const logo = input.logoUrl?.trim() ?? ''

  const topbar = `<div class="pw-topbar"><div class="pw-container pw-topbar-inner">
      <a href="${contactHref}">${escapeHtml(n.contact)}</a>
      <a href="${wishlistHref}">${escapeHtml(shop.navFavorites)}</a>
      <a href="${accountHref}">${escapeHtml(n.login)}</a>
    </div></div>`

  const brandBlock = logo
    ? `<a class="pw-brand" href="${homeHref}"><img class="pw-logo" src="${escapeAttr(logo)}" alt="${escapeAttr(input.title)}"/><span class="pw-wordmark">${escapeHtml(input.title)}</span></a>`
    : `<a class="pw-brand" href="${homeHref}"><span class="pw-wordmark">${escapeHtml(input.title)}</span></a>`

  const searchBar = `<div class="pw-header-search">
    <form class="pw-search-form" data-pw-search-form role="search">
      <input data-pw-search type="search" name="q" placeholder="${escapeAttr(search.placeholder)}" aria-label="${escapeAttr(search.placeholder)}" autocomplete="off"/>
      <button type="button" class="pw-search-image-btn" data-pw-image-search aria-label="${escapeAttr(search.image)}" title="${escapeAttr(search.image)}">📷</button>
      <button type="submit" class="pw-search-submit">${escapeHtml(search.button)}</button>
    </form>
  </div>`

  const categoryLinks = buildCategoryLinks(productsHref, saleHref, input.locale)
  const accountMenuHtml = buildAccountMenuHtml(accountMenuItems)

  const header = `<header class="pw-header">
  ${topbar}
  <div class="pw-container pw-header-main">
    <div class="pw-brand-cluster">
      <button type="button" class="pw-cat-btn" data-pw-cat-toggle aria-expanded="false" aria-controls="pw-cat-panel" aria-label="${escapeAttr(shop.navCategories)}">${svgIcon('menu')}<span>${escapeHtml(shop.navCategories)}</span></button>
      ${brandBlock}
      <nav id="pw-cat-panel" class="pw-cat-panel" data-pw-cat-panel aria-label="${escapeAttr(shop.navCategories)}">
        ${categoryLinks}
      </nav>
    </div>
    ${searchBar}
    <div class="pw-header-actions">
      <div class="pw-account-wrap">
        <button type="button" class="pw-account-btn" data-pw-account-toggle aria-expanded="false" aria-controls="pw-account-panel" aria-label="${escapeAttr(shop.navAccount)}">
          ${svgIcon('user')}
          <span class="pw-account-btn-label">${escapeHtml(shop.navAccount)}</span>
        </button>
        <nav id="pw-account-panel" class="pw-account-panel" data-pw-account-panel aria-label="${escapeAttr(shop.navAccount)}">
          ${accountMenuHtml}
        </nav>
      </div>
      <a class="pw-icon-btn" href="${cartHref}" aria-label="${escapeAttr(shop.navCart)}">${svgIcon('cart')}<span class="pw-cart-badge">0</span></a>
    </div>
  </div>
  <nav class="pw-container pw-nav-main" aria-label="Shop">
    ${categoryLinks}
  </nav>
</header>`

  const bottomNav = `<nav class="pw-bottom-nav" aria-label="Mobile">
    <a class="is-active" href="${homeHref}">${svgIcon('home')}<span>${escapeHtml(shop.navHome)}</span></a>
    <a href="${productsHref}">${svgIcon('box')}<span>${escapeHtml(shop.navProducts)}</span></a>
    <a href="${saleHref}">${svgIcon('tag')}<span>${escapeHtml(promoLabel)}</span></a>
    <a href="${accountHref}">${svgIcon('user')}<span>${escapeHtml(shop.navAccount)}</span></a>
  </nav>`

  return {
    header,
    bottomNav,
    scripts: buildHeaderInteractionScripts(),
  }
}
