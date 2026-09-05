import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPartnerSiteFooterHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import {
  buildShopVisualSeoHead,
  shopVisualSeoDescription,
} from '@/lib/partner-website/shop/build-shop-visual-seo-head'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  ensureAdsPlatformPolicyParagraphs,
  getPartnerSiteInfoPage,
  isPartnerSiteAdsPolicyPageKey,
  PARTNER_SITE_PLATFORM_INFO_KEYS,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import {
  partnerSiteAccountPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteLeadApiPath,
  partnerSiteOrdersPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  PW_ARTICLE_KIND_ATTR,
  PW_TEXT_ARTICLE_ATTR,
  resolvePartnerTextArticleKind,
} from '@/lib/partner-website/pages/partner-text-article-page'
import {
  PW_EL,
  PW_PAGE,
  PW_PAGE_BY_CATALOG_KEY,
  PW_REGION,
  pwElAttr,
  pwPageAttr,
  pwRegionAttr,
} from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

const INFO_PAGES: PartnerWebsitePageKey[] = [
  'about',
  'contact',
  'faq',
  'lookbook',
  'blog',
  'stores',
  'size_guide',
  'shipping',
  'returns',
  'payment',
  'privacy',
  'terms',
  'thank_you',
]

const LISTING_PAGES: PartnerWebsitePageKey[] = [
  'products',
  'sale',
  'collection',
  'wishlist',
  'recently_viewed',
]

const ACCOUNT_PAGES: PartnerWebsitePageKey[] = ['account', 'orders', 'addresses']

function infoKeyForPage(pageKey: PartnerWebsitePageKey): PartnerSiteInfoPageKey | null {
  const dashed = (
    pageKey === 'size_guide' ? 'size-guide' : pageKey === 'thank_you' ? 'thank-you' : pageKey.replace(/_/g, '-')
  ) as PartnerSiteInfoPageKey
  return PARTNER_SITE_PLATFORM_INFO_KEYS.includes(dashed) ? dashed : null
}

function homeHref(siteSlug: string): string {
  return siteSlug.trim() ? partnerSiteHomePath(siteSlug.trim()) : '/'
}

function compactDevice(variant: VisualDeviceVariant): boolean {
  return variant === 'mobile' || variant === 'tablet'
}

function pagePad(variant: VisualDeviceVariant): string {
  if (variant === 'mobile') return '12px 4px 96px'
  if (variant === 'tablet') return '28px 20px 96px'
  if (variant === 'laptop') return '36px 28px 48px'
  return '44px 32px 56px'
}

function articleMaxWidth(variant: VisualDeviceVariant): string {
  if (variant === 'mobile') return '100%'
  if (variant === 'tablet') return '640px'
  if (variant === 'laptop') return '720px'
  return '760px'
}

function uiCopy(locale: WebLocale) {
  const shop = getPartnerSiteShopCopy(locale)
  const extra: Record<
    WebLocale,
    {
      listingLead: string
      saleTitle: string
      saleLead: string
      collectionTitle: string
      addressesTitle: string
      accountLead: string
      skip: string
      leadName: string
      leadPhone: string
      leadEmail: string
      leadMessage: string
      leadSubmit: string
    }
  > = {
    vi: {
      listingLead: 'Lọc theo size, màu hoặc giá — mọi món đều đồng bộ kho thật.',
      saleTitle: 'Sale kho',
      saleLead: 'Hàng thanh lý theo size — số lượng có hạn.',
      collectionTitle: 'Bộ sưu tập',
      addressesTitle: 'Sổ địa chỉ',
      accountLead: 'Đơn hàng, địa chỉ và thông tin đăng nhập của bạn.',
      skip: 'Bỏ qua nội dung',
      leadName: 'Họ tên',
      leadPhone: 'Số điện thoại',
      leadEmail: 'Email',
      leadMessage: 'Nội dung',
      leadSubmit: 'Gửi',
    },
    en: {
      listingLead: 'Filter by size, color, or price — every item syncs with live stock.',
      saleTitle: 'Clearance',
      saleLead: 'Size-specific clearance — limited quantity.',
      collectionTitle: 'Collection',
      addressesTitle: 'Address book',
      accountLead: 'Orders, addresses, and your sign-in details.',
      skip: 'Skip to content',
      leadName: 'Name',
      leadPhone: 'Phone',
      leadEmail: 'Email',
      leadMessage: 'Message',
      leadSubmit: 'Send',
    },
    zh: {
      listingLead: '按尺码、颜色或价格筛选 — 商品与库存同步。',
      saleTitle: '特卖仓',
      saleLead: '按尺码清仓 — 数量有限。',
      collectionTitle: '系列',
      addressesTitle: '地址簿',
      accountLead: '订单、地址与登录信息。',
      skip: '跳到正文',
      leadName: '姓名',
      leadPhone: '电话',
      leadEmail: '邮箱',
      leadMessage: '留言',
      leadSubmit: '发送',
    },
    ja: {
      listingLead: 'サイズ・カラー・価格で絞り込み。在庫と同期しています。',
      saleTitle: 'セール倉庫',
      saleLead: 'サイズ別セール。数量限定。',
      collectionTitle: 'コレクション',
      addressesTitle: 'アドレス帳',
      accountLead: '注文・住所・ログイン情報。',
      skip: '本文へスキップ',
      leadName: 'お名前',
      leadPhone: '電話番号',
      leadEmail: 'メール',
      leadMessage: 'メッセージ',
      leadSubmit: '送信',
    },
    ko: {
      listingLead: '사이즈, 색상, 가격으로 필터 — 재고와 동기화됩니다.',
      saleTitle: '세일 창고',
      saleLead: '사이즈별 세일 — 수량 한정.',
      collectionTitle: '컬렉션',
      addressesTitle: '주소록',
      accountLead: '주문, 주소, 로그인 정보.',
      skip: '본문으로 건너뛰기',
      leadName: '이름',
      leadPhone: '전화',
      leadEmail: '이메일',
      leadMessage: '내용',
      leadSubmit: '보내기',
    },
  }
  return { shop, extra: extra[locale] || extra.en }
}

function breadcrumbHtml(input: {
  locale: WebLocale
  siteSlug: string
  current: string
}): string {
  const { shop } = uiCopy(input.locale)
  return `<nav class="pw-page-crumbs" ${pwRegionAttr(PW_REGION.breadcrumb)} aria-label="breadcrumb">
  <a href="${escapeAttr(homeHref(input.siteSlug))}" ${pwElAttr(PW_EL.crumb)}>${escapeHtml(shop.navHome)}</a>
  <span aria-hidden="true">/</span>
  <span ${pwElAttr(PW_EL.crumb)}>${escapeHtml(input.current)}</span>
</nav>`
}

function placeholderCards(count: number, label: string): string {
  let out = ''
  for (let i = 1; i <= count; i += 1) {
    out += `<article class="pw-product-card" ${pwElAttr(PW_EL.card)} data-pw-grid-placeholder="1">
  <div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} style="background:var(--pw-surface,#f3f4f6)"></div>
  <div class="pw-product-card-body">
    <h3 ${pwElAttr(PW_EL.cardName)}>${escapeHtml(label)}</h3>
    <p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>—</p>
  </div>
</article>`
  }
  return out
}

function listingTitle(pageKey: PartnerWebsitePageKey, locale: WebLocale): { title: string; lead: string } {
  const { shop, extra } = uiCopy(locale)
  if (pageKey === 'sale') return { title: extra.saleTitle, lead: extra.saleLead }
  if (pageKey === 'collection') return { title: extra.collectionTitle, lead: extra.listingLead }
  if (pageKey === 'wishlist') return { title: shop.wishlistTitle, lead: extra.listingLead }
  if (pageKey === 'recently_viewed') return { title: shop.recentlyViewedTitle, lead: extra.listingLead }
  return { title: shop.catalogTitle, lead: extra.listingLead }
}

function buildListingMain(
  pageKey: PartnerWebsitePageKey,
  locale: WebLocale,
  siteSlug: string,
  variant: VisualDeviceVariant
): string {
  const { shop } = uiCopy(locale)
  const { title, lead } = listingTitle(pageKey, locale)
  const personalize =
    pageKey === 'wishlist'
      ? ' data-pw-personalize="favorites"'
      : pageKey === 'recently_viewed'
        ? ' data-pw-personalize="recently-viewed"'
        : ''
  const catalogAttr =
    pageKey === 'wishlist' || pageKey === 'recently_viewed'
      ? personalize
      : ' data-pw-catalog data-sort="default"'
  const cols = compactDevice(variant) ? '2' : variant === 'laptop' ? '4' : '5'
  const limit = compactDevice(variant) ? 8 : 10
  return `<main id="main" class="pw-shop-main pw-page-shell" data-pw-bg-role="content">
  ${breadcrumbHtml({ locale, siteSlug, current: title })}
  <header class="pw-page-head">
    <h1 ${pwElAttr(PW_EL.heading)}>${escapeHtml(title)}</h1>
    <p class="pw-muted" ${pwElAttr(PW_EL.body)}>${escapeHtml(lead)}</p>
  </header>
  <div class="pw-shop-filters pw-page-filters" ${pwRegionAttr(PW_REGION.filters)} aria-label="${escapeAttr(shop.categoryFiltersAria)}">
    <label><span class="pw-shop-filter-label">${escapeHtml(shop.categoryFilterSize)}</span>
      <select ${pwElAttr(PW_EL.facet)} aria-label="${escapeAttr(shop.categoryFilterSize)}"><option>${escapeHtml(shop.categoryFilterAllSizes)}</option></select>
    </label>
    <label><span class="pw-shop-filter-label">${escapeHtml(shop.categoryFilterStyle)}</span>
      <select ${pwElAttr(PW_EL.facet)} aria-label="${escapeAttr(shop.categoryFilterStyle)}"><option>${escapeHtml(shop.categoryFilterAllStyles)}</option></select>
    </label>
    <label><span class="pw-shop-filter-label">${escapeHtml(shop.categoryFilterColor)}</span>
      <select ${pwElAttr(PW_EL.facet)} aria-label="${escapeAttr(shop.categoryFilterColor)}"><option>${escapeHtml(shop.categoryFilterAllColors)}</option></select>
    </label>
    <label><span class="pw-shop-filter-label">${escapeHtml(shop.categoryFilterMinPrice)}</span>
      <input type="number" min="0" step="1000" placeholder="${escapeAttr(shop.categoryFilterPriceMinPh)}" aria-label="${escapeAttr(shop.categoryFilterMinPrice)}"/>
    </label>
    <label><span class="pw-shop-filter-label">${escapeHtml(shop.categoryFilterMaxPrice)}</span>
      <input type="number" min="0" step="1000" placeholder="${escapeAttr(shop.categoryFilterPriceMaxPh)}" aria-label="${escapeAttr(shop.categoryFilterMaxPrice)}"/>
    </label>
    <label ${pwRegionAttr(PW_REGION.toolbar)}><span class="pw-shop-filter-label">${escapeHtml(shop.categorySortLabel)}</span>
      <select ${pwElAttr(PW_EL.sort)} aria-label="${escapeAttr(shop.categorySortLabel)}">
        <option value="random">${escapeHtml(shop.categorySortRandom)}</option>
        <option value="newest">${escapeHtml(shop.categorySortNewest)}</option>
        <option value="oldest">${escapeHtml(shop.categorySortOldest)}</option>
        <option value="views_desc">${escapeHtml(shop.categorySortViews)}</option>
      </select>
    </label>
  </div>
  <div class="pw-page-toolbar" ${pwRegionAttr(PW_REGION.toolbar)}>
    <p ${pwElAttr(PW_EL.count)}>${escapeHtml(shop.catalogTitle)}</p>
  </div>
  <section class="pw-catalog pw-section" ${pwRegionAttr(PW_REGION.catalog)} data-pw-grid-kind="catalog" data-pw-grid-cols="${cols}" data-pw-grid-cols-mobile="2" data-limit="${limit}"${catalogAttr}>
    <h2 class="pw-visually-hidden" ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(title)}</h2>
    <div data-pw-grid class="pw-product-grid" ${pwElAttr(PW_EL.grid)}>${placeholderCards(limit, title)}</div>
    <p class="pw-catalog-empty pw-personalize-empty" hidden>${escapeHtml(shop.catalogEmpty)}</p>
  </section>
</main>`
}

function buildCartMain(locale: WebLocale, siteSlug: string, variant: VisualDeviceVariant): string {
  const { shop } = uiCopy(locale)
  const split = compactDevice(variant) ? 'pw-page-split pw-page-split-stack' : 'pw-page-split'
  return `<main id="main" class="pw-shop-main pw-page-shell" data-pw-bg-role="content">
  ${breadcrumbHtml({ locale, siteSlug, current: shop.cartTitle })}
  <header class="pw-page-head">
    <h1 ${pwElAttr(PW_EL.heading)}>${escapeHtml(shop.cartTitle)}</h1>
  </header>
  <div class="${split}">
    <section ${pwRegionAttr(PW_REGION.cartList)} data-pw-bg-role="cart-list">
      <p ${pwElAttr(PW_EL.empty)}>${escapeHtml(shop.cartEmpty)}</p>
    </section>
    <aside ${pwRegionAttr(PW_REGION.cartSummary)} data-pw-bg-role="cart-summary">
      <h2 ${pwElAttr(PW_EL.title)}>${escapeHtml(shop.cartTotalLabel)}</h2>
      <p ${pwElAttr(PW_EL.price)}>—</p>
      <label ${pwElAttr(PW_EL.coupon)}>${escapeHtml(shop.cartPromoLabel)}
        <input type="text" ${pwElAttr(PW_EL.field)} placeholder="${escapeAttr(shop.cartPromoPlaceholder)}"/>
      </label>
      <a class="pw-btn" ${pwElAttr(PW_EL.checkout)} href="${escapeAttr(partnerSiteCartPath(siteSlug))}">${escapeHtml(shop.cartCheckout)}</a>
    </aside>
  </div>
</main>`
}

function buildAccountMain(
  pageKey: PartnerWebsitePageKey,
  locale: WebLocale,
  siteSlug: string,
  variant: VisualDeviceVariant
): string {
  const { shop, extra } = uiCopy(locale)
  const title =
    pageKey === 'orders' ? shop.ordersTitle : pageKey === 'addresses' ? extra.addressesTitle : shop.navAccount
  const empty =
    pageKey === 'orders' ? shop.ordersEmpty : pageKey === 'addresses' ? extra.accountLead : extra.accountLead
  const split = compactDevice(variant) ? 'pw-page-split pw-page-split-stack' : 'pw-page-split'
  const items = [
    { href: partnerSiteAccountPath(siteSlug), label: shop.navAccount },
    { href: partnerSiteOrdersPath(siteSlug), label: shop.ordersTitle },
    { href: partnerSiteAddressesPath(siteSlug), label: extra.addressesTitle },
    { href: partnerSiteCartPath(siteSlug), label: shop.navCart },
  ]
  const links = items
    .map(
      (item) =>
        `<a href="${escapeAttr(item.href)}" ${pwElAttr(PW_EL.menuItem)}>${escapeHtml(item.label)}</a>`
    )
    .join('')
  return `<main id="main" class="pw-shop-main pw-page-shell" data-pw-bg-role="content">
  ${breadcrumbHtml({ locale, siteSlug, current: title })}
  <div class="${split}">
    <nav ${pwRegionAttr(PW_REGION.accountNav)} data-pw-bg-role="account-nav" aria-label="${escapeAttr(shop.navAccount)}">
      <h2 ${pwElAttr(PW_EL.heading)}>${escapeHtml(shop.navAccount)}</h2>
      ${links}
    </nav>
    <section ${pwRegionAttr(PW_REGION.accountMain)} data-pw-bg-role="account-main">
      <h1 ${pwElAttr(PW_EL.heading)}>${escapeHtml(title)}</h1>
      <p ${pwElAttr(PW_EL.empty)}>${escapeHtml(empty)}</p>
    </section>
  </div>
</main>`
}

function buildInfoMain(pageKey: PartnerWebsitePageKey, locale: WebLocale, siteSlug: string): string {
  const { extra } = uiCopy(locale)
  const infoKey = infoKeyForPage(pageKey)
  const block = infoKey ? getPartnerSiteInfoPage(infoKey, locale) : { title: pageKey, paragraphs: [] as string[] }
  const paragraphs =
    infoKey && isPartnerSiteAdsPolicyPageKey(infoKey)
      ? ensureAdsPlatformPolicyParagraphs(block.paragraphs, locale)
      : block.paragraphs
  const kind = resolvePartnerTextArticleKind({ pageKey })
  const paras = paragraphs.map((p) => `<p ${pwElAttr(PW_EL.body)}>${escapeHtml(p)}</p>`).join('')
  const bullets = (block.bullets || [])
    .map((b) => `<li ${pwElAttr(PW_EL.body)}>${escapeHtml(b)}</li>`)
    .join('')
  const faq = (block.faq || [])
    .map(
      (item) =>
        `<details class="pw-faq" ${pwElAttr(PW_EL.faqItem)}><summary>${escapeHtml(item.q)}</summary><p ${pwElAttr(PW_EL.body)}>${escapeHtml(item.a)}</p></details>`
    )
    .join('')
  const form =
    pageKey === 'contact' && siteSlug.trim()
      ? `<section class="pw-lead-form" ${pwRegionAttr(PW_REGION.form)}>
    <h2 ${pwElAttr(PW_EL.title)}>${escapeHtml(block.title)}</h2>
    <form class="pw-form" data-api="${escapeAttr(partnerSiteLeadApiPath(siteSlug.trim()))}">
      <label ${pwElAttr(PW_EL.label)}>${escapeHtml(extra.leadName)}<input name="name" type="text" required maxlength="200" ${pwElAttr(PW_EL.field)}/></label>
      <label ${pwElAttr(PW_EL.label)}>${escapeHtml(extra.leadPhone)}<input name="phone" type="tel" maxlength="50" ${pwElAttr(PW_EL.field)}/></label>
      <label ${pwElAttr(PW_EL.label)}>${escapeHtml(extra.leadEmail)}<input name="email" type="email" maxlength="200" ${pwElAttr(PW_EL.field)}/></label>
      <label ${pwElAttr(PW_EL.label)}>${escapeHtml(extra.leadMessage)}<textarea name="message" rows="4" maxlength="4000" ${pwElAttr(PW_EL.field)}></textarea></label>
      <button type="submit" class="pw-btn" ${pwElAttr(PW_EL.submit)}>${escapeHtml(extra.leadSubmit)}</button>
    </form>
  </section>`
      : ''
  return `<main id="main" class="pw-shop-main pw-page-shell" ${pwRegionAttr(PW_REGION.content)} data-pw-bg-role="content">
  ${breadcrumbHtml({ locale, siteSlug, current: block.title })}
  <article class="pw-shop-info pw-page-article" data-pw-info-article="1" ${PW_TEXT_ARTICLE_ATTR}="1" ${PW_ARTICLE_KIND_ATTR}="${kind}">
    <h1 ${pwElAttr(PW_EL.heading)} data-pw-info-title="1">${escapeHtml(block.title)}</h1>
    <div data-pw-info-body="1">${paras}${bullets ? `<ul>${bullets}</ul>` : ''}${faq}</div>
    ${form}
  </article>
</main>`
}

function buildBottomNavHtml(input: { locale: WebLocale; siteSlug: string }): string {
  const shop = getPartnerSiteShopCopy(input.locale)
  return `<nav class="pw-bottom-nav" ${pwRegionAttr(PW_REGION.nav)}>
  <a href="${escapeAttr(homeHref(input.siteSlug))}" ${pwElAttr(PW_EL.navLink)} data-pw-chrome-btn="home">
    <span class="pw-chrome-icon-wrap"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg></span>
    <span class="pw-shop-icon-label">${escapeHtml(shop.navHome)}</span>
  </a>
</nav>`
}

function pageShellCss(variant: VisualDeviceVariant): string {
  const pad = pagePad(variant)
  const articleW = articleMaxWidth(variant)
  const gridCols = compactDevice(variant) ? 2 : variant === 'laptop' ? 4 : 5
  return `.pw-skip{position:absolute;left:-999px;top:8px;z-index:1000;padding:8px 12px;background:var(--pw-primary);color:#fff;border-radius:8px}
.pw-skip:focus{left:12px}
.pw-visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.pw-page-shell{min-height:70vh;padding:${pad};box-sizing:border-box;background:var(--pw-bg,#fff);color:var(--pw-text,#111)}
.pw-page-crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 18px;font-size:13px;color:var(--pw-muted,#6b7280)}
.pw-page-crumbs a{color:inherit;text-decoration:none}
.pw-page-crumbs a:hover{color:var(--pw-primary)}
.pw-page-head{margin:0 0 22px;max-width:40rem}
.pw-page-head h1{margin:0 0 8px;font-size:clamp(1.5rem,3vw,2.1rem);line-height:1.2;color:var(--pw-text,#111)}
.pw-page-filters{position:sticky;top:var(--pw-sticky-head,56px);z-index:40;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-items:end;margin:0 0 12px;padding:6px 0 8px;background:var(--pw-surface,#f9fafb);border-bottom:1px solid var(--pw-border,#e5e7eb)}
.pw-page-filters label{display:flex;flex-direction:column;gap:0;min-width:0;margin:0}
.pw-page-filters .pw-shop-filter-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.pw-page-filters select,.pw-page-filters input,.pw-form input,.pw-form textarea{height:32px;border:1px solid var(--pw-border,#d1d5db);border-radius:6px;padding:0 6px;font:inherit;font-size:11px;background:#fff;min-width:0;width:100%;box-sizing:border-box}
.pw-form textarea{height:auto;padding:10px}
.pw-page-toolbar{margin:0 0 16px;font-size:13px;color:var(--pw-muted,#6b7280)}
.pw-page-shell .pw-product-grid{display:grid;grid-template-columns:repeat(${gridCols},minmax(0,1fr));gap:${compactDevice(variant) ? '10px' : '16px'}}
.pw-page-split{display:grid;gap:24px;grid-template-columns:${compactDevice(variant) ? '1fr' : 'minmax(0,1.4fr) minmax(240px,0.8fr)'};align-items:start}
.pw-page-split-stack{grid-template-columns:1fr}
.pw-page-split [data-pw-region]{padding:20px;border:1px solid var(--pw-border,#e5e7eb);border-radius:14px;background:var(--pw-surface,#fff)}
.pw-page-article{max-width:${articleW};margin:0 auto}
.pw-page-article h1{margin:0 0 16px;font-size:clamp(1.6rem,3vw,2.2rem);line-height:1.2}
.pw-page-article p,.pw-page-article li{line-height:1.7;color:var(--pw-text,#111)}
.pw-page-article .pw-faq{border:1px solid var(--pw-border,#e5e7eb);border-radius:10px;padding:12px 14px;margin:0 0 10px;background:#fff}
.pw-btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:10px;background:var(--pw-buy);color:#fff;font-weight:700;text-decoration:none;border:none;cursor:pointer}
.pw-form{display:grid;gap:12px;margin-top:16px}
.pw-form label{display:grid;gap:4px;font-size:14px;font-weight:600}`
}

function pageSeo(
  pageKey: PartnerWebsitePageKey,
  locale: WebLocale,
  brand: string
): { title: string; description: string; article: boolean; noIndex: boolean } {
  const { shop, extra } = uiCopy(locale)
  if (LISTING_PAGES.includes(pageKey)) {
    const { title, lead } = listingTitle(pageKey, locale)
    return { title: `${title} | ${brand}`.slice(0, 70), description: lead, article: false, noIndex: false }
  }
  if (pageKey === 'cart') {
    return { title: `${shop.cartTitle} | ${brand}`.slice(0, 70), description: shop.cartEmpty, article: false, noIndex: true }
  }
  if (ACCOUNT_PAGES.includes(pageKey)) {
    const title = pageKey === 'orders' ? shop.ordersTitle : pageKey === 'addresses' ? extra.addressesTitle : shop.navAccount
    return { title: `${title} | ${brand}`.slice(0, 70), description: extra.accountLead, article: false, noIndex: true }
  }
  const infoKey = infoKeyForPage(pageKey)
  const block = infoKey ? getPartnerSiteInfoPage(infoKey, locale) : { title: pageKey, paragraphs: [] as string[] }
  return {
    title: `${block.title} | ${brand}`.slice(0, 70),
    description: shopVisualSeoDescription(block.paragraphs[0] || '', block.title),
    article: true,
    noIndex: false,
  }
}

function buildMain(
  pageKey: PartnerWebsitePageKey,
  locale: WebLocale,
  siteSlug: string,
  variant: VisualDeviceVariant
): string {
  if (LISTING_PAGES.includes(pageKey)) return buildListingMain(pageKey, locale, siteSlug, variant)
  if (pageKey === 'cart') return buildCartMain(locale, siteSlug, variant)
  if (ACCOUNT_PAGES.includes(pageKey)) return buildAccountMain(pageKey, locale, siteSlug, variant)
  if (pageKey === 'product_detail') {
    return `<main id="main" class="pw-shop-main pw-page-shell" data-pw-bg-role="content">
  <section ${pwRegionAttr(PW_REGION.gallery)} style="min-height:240px"></section>
  <section ${pwRegionAttr(PW_REGION.pdpInfo)}>
    <h1 ${pwElAttr(PW_EL.title)}></h1>
    <div ${pwElAttr(PW_EL.price)}></div>
    <div ${pwElAttr(PW_EL.desc)}></div>
  </section>
</main>`
  }
  if (INFO_PAGES.includes(pageKey)) return buildInfoMain(pageKey, locale, siteSlug)
  return buildInfoMain('about', locale, siteSlug)
}

/** Trang nội mẫu fashion — layout độc lập 4 máy, SEO + mã UI-contract. Canvas trắng không dùng hàm này. */
export function buildShopTemplatePageVisualHtml(input: {
  pageKey: PartnerWebsitePageKey
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
}): string {
  const { extra } = uiCopy(input.locale)
  const seo = pageSeo(input.pageKey, input.locale, input.brand)
  const main = buildMain(input.pageKey, input.locale, input.siteSlug, input.variant)
  const footer = buildPartnerSiteFooterHtml({
    locale: input.locale,
    brand: input.brand,
    siteSlug: input.siteSlug,
  })
  return `<!DOCTYPE html>
<html lang="${escapeAttr(input.locale)}" data-pw-edit-device="${input.variant}" data-pw-scene-lock="${input.variant}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${buildShopVisualSeoHead({
  title: seo.title,
  description: seo.description,
  locale: input.locale,
  pageKind: seo.article ? 'article' : 'website',
  noIndex: seo.noIndex,
})}
<style>${pageShellCss(input.variant)}</style>
</head>
<body ${pwPageAttr(PW_PAGE_BY_CATALOG_KEY[input.pageKey] || PW_PAGE.info)} data-pw-bg-role="canvas" style="margin:0;background:var(--pw-bg,#fff);color:var(--pw-text,#111);font-family:var(--pw-font,system-ui,sans-serif)">
<a class="pw-skip" href="#main">${escapeHtml(extra.skip)}</a>
${main}
${footer}
${buildBottomNavHtml({ locale: input.locale, siteSlug: input.siteSlug })}
</body>
</html>`
}

export function isShopTemplateInnerPageKey(pageKey: PartnerWebsitePageKey): boolean {
  return (
    LISTING_PAGES.includes(pageKey) ||
    ACCOUNT_PAGES.includes(pageKey) ||
    INFO_PAGES.includes(pageKey) ||
    pageKey === 'cart'
  )
}
