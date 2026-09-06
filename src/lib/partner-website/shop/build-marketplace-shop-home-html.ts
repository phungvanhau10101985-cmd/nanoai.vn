import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { buildPartnerSiteHeaderHtml } from '@/lib/partner-website/shop/build-partner-site-header-html'
import {
  buildShopVisualSeoHead,
  buildShopVisualWebsiteJsonLd,
} from '@/lib/partner-website/shop/build-shop-visual-seo-head'
import { buildPartnerShopFaviconHeadLinks } from '@/lib/partner-website/shop/inject-partner-shop-favicon'
import {
  buildMarketplaceLookCss,
  MARKETPLACE_GOOGLE_FONTS_HREF,
  PARTNER_WEBSITE_LOOK_MARKETPLACE,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { getPartnerSiteCategoryNavLabels } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import {
  partnerSiteKhoSalePath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_PRODUCT_GRID_RULER_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { buildThemeCssVarBlock } from '@/lib/partner-website/template/partner-website-theme-tokens'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { buildVisualEditorBannerHtml } from '@/lib/partner-website/visual-editor/banner-widgets'
import { buildVisualEditorFeaturedCategoriesHtml } from '@/lib/partner-website/visual-editor/featured-category-widgets'
import { buildVisualEditorProductGridHtml } from '@/lib/partner-website/visual-editor/product-grid-widgets'
import { PW_KIND_SCENE_MEDIA, pwKindSceneAttr } from '@/lib/partner-website/visual-editor/pw-kind-scene'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

type MarketplaceCopy = {
  seoDescription: string
  skip: string
  featuredTitle: string
  bestSellers: string
  leadTitle: string
  leadSubtitle: string
  trustSub1: string
  trustSub2: string
  trustSub3: string
}

const COPY: Record<WebLocale, MarketplaceCopy> = {
  vi: {
    seoDescription: 'Sàn mua sắm: hàng mới, sale, danh mục và gợi ý theo khách.',
    skip: 'Bỏ qua nội dung',
    featuredTitle: 'Danh mục sản phẩm',
    bestSellers: 'Sản phẩm bán chạy',
    leadTitle: 'Đăng ký nhận ưu đãi',
    leadSubtitle: 'Nhận mã giảm cho đơn đầu tiên',
    trustSub1: 'Hàng chọn lọc',
    trustSub2: 'Đặt hàng nhanh',
    trustSub3: 'Hỗ trợ khi cần',
  },
  en: {
    seoDescription: 'Marketplace: new arrivals, sale, categories, and personalized picks.',
    skip: 'Skip to content',
    featuredTitle: 'Product categories',
    bestSellers: 'Best sellers',
    leadTitle: 'Get offers',
    leadSubtitle: 'First-order discount codes',
    trustSub1: 'Curated goods',
    trustSub2: 'Easy checkout',
    trustSub3: 'Help when you need it',
  },
  zh: {
    seoDescription: '购物卖场：新品、特卖、分类与个性化推荐。',
    skip: '跳到正文',
    featuredTitle: '商品分类',
    bestSellers: '畅销商品',
    leadTitle: '订阅优惠',
    leadSubtitle: '领取首单优惠码',
    trustSub1: '精选好物',
    trustSub2: '下单便捷',
    trustSub3: '随时支持',
  },
  ja: {
    seoDescription: 'マーケット：新着、セール、カテゴリ、おすすめ。',
    skip: '本文へスキップ',
    featuredTitle: '商品カテゴリ',
    bestSellers: 'ベストセラー',
    leadTitle: 'お得情報を受け取る',
    leadSubtitle: '初回注文クーポン',
    trustSub1: '厳選商品',
    trustSub2: 'かんたん注文',
    trustSub3: '必要なときにサポート',
  },
  ko: {
    seoDescription: '마켓플레이스: 신상품, 세일, 카테고리, 맞춤 추천.',
    skip: '본문으로 건너뛰기',
    featuredTitle: '상품 카테고리',
    bestSellers: '베스트셀러',
    leadTitle: '혜택 받기',
    leadSubtitle: '첫 주문 할인 코드',
    trustSub1: '엄선 상품',
    trustSub2: '간편 주문',
    trustSub3: '필요할 때 지원',
  },
}

function marketplaceCopy(locale: WebLocale): MarketplaceCopy {
  return COPY[locale] || COPY.en
}

function retitleSection(html: string, title: string): string {
  return html.replace(/<h2\b([^>]*)>[\s\S]*?<\/h2>/i, `<h2$1>${escapeHtml(title)}</h2>`)
}

function patchSectionOpen(html: string, extra: string): string {
  return html.replace(/<section\b([^>]*)>/i, `<section$1${extra}>`)
}

function setSeeAllHref(html: string, href: string): string {
  return html.replace(
    /(<a\b[^>]*data-pw-el=["']section-more["'][^>]*href=["'])[^"']*(["'])/i,
    `$1${escapeAttr(href)}$2`
  )
}

function catalogBlock(input: {
  kind: 'catalog' | 'recommended' | 'recently-viewed'
  title: string
  siteSlug: string
  locale: WebLocale
  device: VisualDeviceVariant
  extraAttrs?: string
  sort?: string
  seeAllHref?: string
}): string {
  let html = buildVisualEditorProductGridHtml({
    kind: input.kind,
    siteSlug: input.siteSlug,
    locale: input.locale,
    rows: 1,
    device: input.device,
  })
  html = retitleSection(html, input.title)
  if (input.sort) {
    html = /\bdata-sort=/.test(html)
      ? html.replace(/\bdata-sort=["'][^"']*["']/, `data-sort="${input.sort}"`)
      : patchSectionOpen(html, ` data-sort="${input.sort}"`)
  }
  if (input.extraAttrs) html = patchSectionOpen(html, input.extraAttrs)
  if (input.seeAllHref) html = setSeeAllHref(html, input.seeAllHref)
  return html
}

function trustRow(locale: WebLocale): string {
  const copy = marketplaceCopy(locale)
  const shop = getPartnerSiteShopCopy(locale)
  const items: Array<{ title: string; sub: string; icon: string }> = [
    {
      title: shop.lpTrust1,
      sub: copy.trustSub1,
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    },
    {
      title: shop.lpTrust2,
      sub: copy.trustSub2,
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    },
    {
      title: shop.lpTrust3,
      sub: copy.trustSub3,
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    },
  ]
  const cards = items
    .map(
      (item) => `<div class="pw-marketplace-trust-item" data-pw-trust-item="1">
  <span class="pw-marketplace-trust-icon">${item.icon}</span>
  <span><strong ${pwElAttr(PW_EL.title)}>${escapeHtml(item.title)}</strong><span ${pwElAttr(PW_EL.subtitle)}>${escapeHtml(item.sub)}</span></span>
</div>`
    )
    .join('')
  return `<section class="pw-marketplace-trust" data-pw-trust-bar="1" ${pwRegionAttr(PW_REGION.promo)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="promo">${cards}</section>`
}

function featuredBlock(input: { siteSlug: string; locale: WebLocale; device: VisualDeviceVariant }): string {
  const title = marketplaceCopy(input.locale).featuredTitle
  const html = buildVisualEditorFeaturedCategoriesHtml({
    siteSlug: input.siteSlug,
    locale: input.locale,
    rows: 2,
    device: input.device,
  })
  return html.replace(
    '<div class="pw-featured-cat-inner">',
    `<div class="pw-featured-cat-inner"><h2 class="pw-marketplace-block-title" ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(title)}</h2>`
  )
}

function leadCta(input: { locale: WebLocale }): string {
  const copy = marketplaceCopy(input.locale)
  const shop = getPartnerSiteShopCopy(input.locale)
  return `<section class="pw-marketplace-cta" ${pwRegionAttr(PW_REGION.form)} data-pw-bg-role="form">
  <h2 ${pwElAttr(PW_EL.title)}>${escapeHtml(copy.leadTitle)}</h2>
  <p ${pwElAttr(PW_EL.subtitle)}>${escapeHtml(copy.leadSubtitle)}</p>
  <form class="pw-newsletter" data-pw-newsletter="1" novalidate>
    <input type="email" name="email" required maxlength="200" placeholder="${escapeAttr(shop.footerNewsletterPlaceholder)}" ${pwElAttr(PW_EL.field)}/>
    <button type="submit" ${pwElAttr(PW_EL.submit)}>${escapeHtml(shop.footerNewsletterSubmit)}</button>
    <p data-pw-newsletter-status hidden></p>
  </form>
</section>`
}

function marketplaceStyles(theme: PartnerWebsiteTheme): string {
  return `:root{
  ${buildThemeCssVarBlock(theme)};
  --pw-content:1200px;
  --pw-chrome-inset:calc(var(--pw-content) * 0.05);
  --pw-font-ui:${theme.fontFamily || '"Nunito","Be Vietnam Pro",sans-serif'};
  --pw-font-display:${theme.fontFamily || '"Nunito","Be Vietnam Pro",sans-serif'};
}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--pw-font-ui);color:var(--pw-text);background:var(--pw-bg);line-height:1.5}
a{color:inherit;text-decoration:none}
.pw-container{max-width:var(--pw-content,1200px);margin:0 auto;padding:0 var(--pw-page-gutter,20px)}
.pw-skip{position:absolute;left:-999px;top:8px;z-index:1000;padding:8px 12px;background:var(--pw-primary);color:#fff;border-radius:8px}
.pw-skip:focus{left:12px}
${buildMarketplaceLookCss()}
${PW_PRODUCT_GRID_RULER_CSS}`
}

export function buildMarketplaceShopHomeHtml(input: {
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  theme: PartnerWebsiteTheme
  chatPath?: string
  samplePreview?: boolean
}): string {
  const locale = input.locale
  const copy = marketplaceCopy(locale)
  const shop = getPartnerSiteShopCopy(locale)
  const nav = getPartnerSiteCategoryNavLabels(locale)
  const siteSlug = input.siteSlug.trim()
  const logo = input.theme.logoUrl ?? input.logoUrl
  const chrome = buildPartnerSiteHeaderHtml({
    locale,
    title: input.brand,
    logoUrl: logo,
    chatIconLogoUrl: input.theme.chatIconLogoUrl,
    siteSlug: siteSlug || undefined,
    samplePreview: input.samplePreview,
    device: input.variant,
  })
  const productsHref = partnerSiteProductsPath(siteSlug)
  const saleHref = partnerSiteKhoSalePath(siteSlug)
  const slider = buildVisualEditorBannerHtml({
    kind: 'promo',
    siteSlug,
    locale,
  })
  const featured = featuredBlock({ siteSlug, locale, device: input.variant })
  const newArrivals = catalogBlock({
    kind: 'catalog',
    title: nav.newArrivals,
    siteSlug,
    locale,
    device: input.variant,
    extraAttrs: ' data-new-badge="1"',
    sort: 'newest',
  })
  const sale = catalogBlock({
    kind: 'catalog',
    title: shop.khoSalePageTitle,
    siteSlug,
    locale,
    device: input.variant,
    extraAttrs: ' data-sale="1" id="pw-grid-sale"',
    seeAllHref: saleHref,
  })
  const recommended = catalogBlock({
    kind: 'recommended',
    title: shop.homeYouMayLike,
    siteSlug,
    locale,
    device: input.variant,
  })
  const best = catalogBlock({
    kind: 'catalog',
    title: copy.bestSellers,
    siteSlug,
    locale,
    device: input.variant,
    extraAttrs: ' id="pw-grid-best-sellers"',
    seeAllHref: productsHref,
  })
  const recent = catalogBlock({
    kind: 'recently-viewed',
    title: shop.recentlyViewedTitle || shop.navRecentlyViewed,
    siteSlug,
    locale,
    device: input.variant,
  })
  const personalizationScript = siteSlug
    ? buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale })
    : ''
  const faviconLink = buildPartnerShopFaviconHeadLinks({
    siteSlug,
    faviconUrl: input.theme.faviconUrl,
    logoUrl: logo,
  })

  return `<!DOCTYPE html>
<html lang="${escapeAttr(locale)}" data-pw-look="${PARTNER_WEBSITE_LOOK_MARKETPLACE}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${buildShopVisualSeoHead({
  title: input.brand,
  description: copy.seoDescription,
  locale,
  imageUrl: logo || null,
})}
${faviconLink}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${MARKETPLACE_GOOGLE_FONTS_HREF}" rel="stylesheet"/>
<style>${marketplaceStyles(input.theme)}</style>
${buildShopVisualWebsiteJsonLd({
  brand: input.brand,
  locale,
  siteSlug: siteSlug || undefined,
  logoUrl: logo,
  description: copy.seoDescription,
})}
</head>
<body id="top">
<a class="pw-skip" href="#pw-main">${escapeHtml(copy.skip)}</a>
${chrome.header}
<main id="pw-main" class="pw-shop-main pw-marketplace-home-main" data-pw-scene-root="1" data-pw-scene-origin="content" data-pw-bg-role="content">
${slider}
${trustRow(locale)}
${featured}
${newArrivals}
${sale}
${recommended}
${best}
${recent}
${leadCta({ locale })}
</main>
${chrome.bottomNav}
${chrome.scripts}
${personalizationScript}
</body>
</html>`
}
