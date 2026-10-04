import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPdpDetailTabsHtml } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import {
  buildPartnerSiteHeaderHtml,
  buildPartnerSitePdpBottomNavHtml,
} from '@/lib/partner-website/shop/build-partner-site-header-html'
import { buildIndustrialPdpCss } from '@/lib/partner-website/shop/industrial-pdp-css'
import { buildOutfitProductsSectionHtml } from '@/lib/partner-website/shop/outfit-products'
import {
  buildPdpReviewQaCardsHtml,
  buildPdpReviewQaModalsHtml,
} from '@/lib/partner-website/shop/partner-site-pdp-review-qa'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteHomePath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { buildRelatedProductsSectionHtml } from '@/lib/partner-website/shop/related-products'
import { getIndustrialShopTemplateSampleProducts } from '@/lib/partner-website/template/shop-template-sample-products'
import { PW_EL, PW_PAGE, PW_REGION, pwElAttr, pwPageAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

type IndustrialPdpCopy = {
  name: string
  lead: string
  price: string
  compare: string
  save: string
  specTitle: string
  specAlt: string
  specs: Array<[string, string]>
  buy: string
  addCart: string
  consult: string
  quote: string
  quickTitle: string
  quick: [string, string, string, string]
  related: string
  crumbs: [string, string]
}

const COPY: Record<WebLocale, IndustrialPdpCopy> = {
  vi: {
    name: 'Máy tiện CNC X-2000 - Công nghệ Đức, Độ chính xác cao',
    lead: 'Máy tiện CNC X-2000 là giải pháp hoàn hảo cho gia công chính xác cao. Hệ thống điều khiển Siemens, tốc độ trục chính lên đến 6000 vòng/phút. Bảo hành 24 tháng.',
    price: '550.000.000 VNĐ',
    compare: '600.000.000 VNĐ',
    save: 'Tiết kiệm 50.000.000 VNĐ',
    specTitle: 'Thông số kỹ thuật',
    specAlt: 'Size information',
    specs: [
      ['Hành trình X', '300mm'],
      ['Công suất', '15kW'],
      ['Trọng lượng', '300kg'],
    ],
    buy: 'Mua',
    addCart: 'Thêm vào giỏ hàng',
    consult: 'Liên hệ tư vấn',
    quote: 'Liên hệ báo giá',
    quickTitle: 'Liên kết nhanh',
    quick: ['Máy tiện', 'Phụ kiện', 'Trọng lượng', 'Tư vấn'],
    related: 'Sản phẩm liên quan',
    crumbs: ['Máy móc công nghiệp', 'Máy tiện CNC'],
  },
  en: {
    name: 'CNC lathe X-2000 — German engineering, high precision',
    lead: 'The X-2000 CNC lathe is built for high-precision work. Siemens control, spindle speed up to 6000 rpm, 24-month warranty.',
    price: '550,000,000 VND',
    compare: '600,000,000 VND',
    save: 'Save 50,000,000 VND',
    specTitle: 'Specifications',
    specAlt: 'Size information',
    specs: [
      ['X travel', '300mm'],
      ['Power', '15kW'],
      ['Weight', '300kg'],
    ],
    buy: 'Buy',
    addCart: 'Add to cart',
    consult: 'Request advice',
    quote: 'Request a quote',
    quickTitle: 'Quick links',
    quick: ['Lathe', 'Parts', 'Weight', 'Advice'],
    related: 'Related products',
    crumbs: ['Industrial machinery', 'CNC lathe'],
  },
  zh: {
    name: '数控车床 X-2000 — 德国工艺，高精度',
    lead: 'X-2000 数控车床适合高精度加工。西门子系统，主轴转速最高 6000 转/分钟，保修 24 个月。',
    price: '550,000,000 VND',
    compare: '600,000,000 VND',
    save: '节省 50,000,000 VND',
    specTitle: '技术参数',
    specAlt: '尺寸信息',
    specs: [
      ['X 行程', '300mm'],
      ['功率', '15kW'],
      ['重量', '300kg'],
    ],
    buy: '购买',
    addCart: '加入购物车',
    consult: '联系咨询',
    quote: '索取报价',
    quickTitle: '快速链接',
    quick: ['车床', '配件', '重量', '咨询'],
    related: '相关产品',
    crumbs: ['工业机械', '数控车床'],
  },
  ja: {
    name: 'CNC旋盤 X-2000 — ドイツ技術、高精度',
    lead: 'X-2000 は高精度加工向けの CNC 旋盤です。Siemens 制御、主軸最高 6000 rpm、保証 24 か月。',
    price: '550,000,000 VND',
    compare: '600,000,000 VND',
    save: '50,000,000 VND お得',
    specTitle: '仕様',
    specAlt: 'サイズ情報',
    specs: [
      ['X 移動量', '300mm'],
      ['出力', '15kW'],
      ['重量', '300kg'],
    ],
    buy: '購入',
    addCart: 'カートに追加',
    consult: '相談する',
    quote: '見積を依頼',
    quickTitle: 'クイックリンク',
    quick: ['旋盤', '部品', '重量', '相談'],
    related: '関連製品',
    crumbs: ['産業機械', 'CNC旋盤'],
  },
  ko: {
    name: 'CNC 선반 X-2000 — 독일 기술, 고정밀',
    lead: 'X-2000 CNC 선반은 고정밀 가공용입니다. Siemens 제어, 스핀들 최대 6000 rpm, 24개월 보증.',
    price: '550,000,000 VND',
    compare: '600,000,000 VND',
    save: '50,000,000 VND 절약',
    specTitle: '사양',
    specAlt: '크기 정보',
    specs: [
      ['X 이송', '300mm'],
      ['출력', '15kW'],
      ['중량', '300kg'],
    ],
    buy: '구매',
    addCart: '장바구니 담기',
    consult: '상담 문의',
    quote: '견적 요청',
    quickTitle: '바로가기',
    quick: ['선반', '부품', '중량', '상담'],
    related: '관련 제품',
    crumbs: ['산업 기계', 'CNC 선반'],
  },
}

const SPEC_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>'

function copyOf(locale: WebLocale): IndustrialPdpCopy {
  return COPY[locale] || COPY.en
}

function specList(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([label, value]) =>
        `<p class="pw-ind-spec">${SPEC_ICON}<span>${escapeHtml(label)}: ${escapeHtml(value)}</span></p>`
    )
    .join('')
}

/** GD09 product page. Live bind still fills gallery, price, tabs, and related products. */
export function buildIndustrialShopPdpHtml(input: {
  locale?: WebLocale
  siteSlug?: string | null
  variant?: VisualDeviceVariant
  title?: string | null
  logoUrl?: string | null
}): string {
  const locale = input.locale || 'vi'
  const variant = input.variant || 'desktop'
  const mobile = variant === 'mobile'
  const copy = copyOf(locale)
  const slug = String(input.siteSlug || '').trim()
  const products = getIndustrialShopTemplateSampleProducts(locale)
  const images = products.slice(0, 4).map((item) => item.imageUrl)
  const main = images[0] || ''
  const homeHref = slug ? escapeAttr(partnerSiteHomePath(slug)) : '#'
  const productsHref = slug ? escapeAttr(partnerSiteProductsPath(slug)) : '#'
  const thumbs = images
    .map(
      (url, index) =>
        `<button type="button" class="pw-shop-product-thumb${index === 0 ? ' is-active' : ''}" ${pwElAttr(PW_EL.thumb)}><img src="${escapeAttr(url)}" alt="${escapeAttr(copy.name)}" loading="lazy" decoding="async" /></button>`
    )
    .join('')
  const dots = images.map((_, index) => `<span${index === 0 ? ' class="is-active"' : ''}></span>`).join('')
  const galleryHero = `<div class="pw-pdp-hero" ${pwRegionAttr(PW_REGION.gallery)} data-pw-bg-role="gallery">
      <img class="pw-pdp-hero-img" ${pwElAttr(PW_EL.mainImage)} src="${escapeAttr(main)}" alt="${escapeAttr(copy.name)}" decoding="async" />
      <div class="pw-pdp-hero-dots">${dots}</div>
      <nav class="pw-pdp-hero-thumbs">${thumbs}</nav>
    </div>`
  const galleryDesktop = `<div class="pw-shop-product-gallery pw-pdp-gallery-desktop" ${pwRegionAttr(PW_REGION.gallery)} data-pw-bg-role="gallery">
        <img class="pw-shop-product-img" ${pwElAttr(PW_EL.mainImage)} src="${escapeAttr(main)}" alt="${escapeAttr(copy.name)}" decoding="async" />
        <div class="pw-shop-product-thumbs">${thumbs}</div>
      </div>`
  const shopCopy = getPartnerSiteShopCopy(locale)
  const crumb = [
    `<a href="${homeHref}" ${pwElAttr(PW_EL.link)}>${escapeHtml(shopCopy.navHome)}</a>`,
    ...copy.crumbs.map((name) => `<a href="${productsHref}" ${pwElAttr(PW_EL.crumb)}>${escapeHtml(name)}</a>`),
    `<span ${pwElAttr(PW_EL.crumb)}>${escapeHtml(copy.name)}</span>`,
  ].join(' / ')
  const specsInfo = {
    specifications: Object.fromEntries(copy.specs),
  }
  const tabs = buildPdpDetailTabsHtml(
    {
      id: 'industrial-demo-pdp',
      name: copy.name,
      description: copy.lead,
      detailDescription: `<p>${escapeHtml(copy.lead)}</p>`,
      productInfo: specsInfo,
      priceHint: copy.price,
    },
    locale
  )
  const related = buildRelatedProductsSectionHtml({
    locale,
    siteSlug: slug || undefined,
    rows: 1,
    cards: products.slice(1, 4).map((item, index) => ({
      id: `industrial-related-${index + 1}`,
      name: item.name,
      imageUrl: item.imageUrl,
      priceHint: item.price,
      ratingScore: 4.8,
      purchasesCount: 12,
    })),
    excludeId: 'industrial-demo-pdp',
  }).replace(
    /(<h3\b[^>]*\bdata-pw-el=["']section-title["'][^>]*>)[\s\S]*?(<\/h3>)/i,
    `$1${escapeHtml(copy.related)}$2`
  )
  const outfit = buildOutfitProductsSectionHtml({
    locale,
    siteSlug: slug || undefined,
    excludeId: 'industrial-demo-pdp',
  })
  const chrome = buildPartnerSiteHeaderHtml({
    locale,
    title: String(input.title || '').trim() || copy.name,
    logoUrl: input.logoUrl,
    siteSlug: slug || undefined,
    samplePreview: !slug,
    device: variant,
  })
  const header = chrome.header.replace(/<header\b([^>]*)>/i, (full, attrs: string) => {
    if (/\bpw-industrial-chrome\b/.test(attrs)) return full
    if (/\bclass=(["'])/.test(attrs)) {
      return `<header${attrs.replace(/\bclass=(["'])/, 'class=$1pw-industrial-chrome ')}>`
    }
    return `<header class="pw-header pw-industrial-chrome"${attrs}>`
  })
  const quick = copy.quick
    .map((label) => `<a href="${productsHref}" ${pwElAttr(PW_EL.link)}>${escapeHtml(label)}</a>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="${escapeAttr(locale)}" data-pw-page="product" data-pw-look="shop" data-pw-home-face="industrial" data-pw-edit-device="${escapeAttr(variant)}" data-pw-scene-lock="${escapeAttr(variant)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style id="pw-industrial-pdp-css">${buildIndustrialPdpCss()}</style>
</head>
<body ${pwPageAttr(PW_PAGE.product)} data-pw-home-face="industrial">
${header}
<main class="pw-shop pw-shop-main pw-industrial-pdp" data-pw-home-face="industrial">
  <nav class="pw-shop-breadcrumb" ${pwRegionAttr(PW_REGION.breadcrumb)} data-pw-pdp-slot="breadcrumb">${crumb}</nav>
  <div class="pw-pdp">
    ${mobile ? galleryHero : ''}
    <div class="pw-shop-product-layout">
      ${mobile ? '' : galleryDesktop}
      <div class="pw-shop-pdp-info pw-pdp-info-pad" ${pwRegionAttr(PW_REGION.pdpInfo)} data-pw-bg-role="pdp-info">
        <h1 class="pw-pdp-title" ${pwElAttr(PW_EL.title)}>${escapeHtml(copy.name)}</h1>
        <div class="pw-pdp-buy-row">
          <div class="pw-pdp-price-card">
            <p class="pw-shop-price" ${pwElAttr(PW_EL.price)}>${escapeHtml(copy.price)}<span class="pw-pdp-compare pw-ind-wide-only" ${pwElAttr(PW_EL.comparePrice)}>${escapeHtml(copy.compare)}</span></p>
            <p class="pw-pdp-save pw-ind-wide-only" data-pw-pdp-slot="savings">${escapeHtml(copy.save)}</p>
          </div>
          <div class="pw-pdp-stats" data-pw-pdp-slot="stats"><span class="pw-pdp-star">★</span> <strong>4.8</strong>/5 · 120</div>
        </div>
        <p class="pw-ind-lead pw-ind-wide-only" data-pw-pdp-slot="lead">${escapeHtml(copy.lead)}</p>
        <div class="pw-ind-specs" data-pw-pdp-slot="machine-specs">
          <p class="pw-ind-specs-head"><span>${escapeHtml(copy.specTitle)}</span><span>${escapeHtml(copy.specAlt)}</span></p>
          ${specList(copy.specs)}
        </div>
        <div class="pw-ind-wide-only" style="margin-top:16px">
          <div class="pw-pdp-qty" ${pwElAttr(PW_EL.qty)}><button type="button">−</button><span>1</span><button type="button">+</button></div>
        </div>
        <div class="pw-pdp-actions pw-pdp-actions-inline pw-ind-actions">
          <button type="button" class="pw-shop-btn pw-shop-btn-buy pw-ind-mobile-only" data-pw-chrome-btn="buy-now" ${pwElAttr(PW_EL.buy)} data-pw-buy data-pw-pdp-buy-now="1">${escapeHtml(copy.buy)}</button>
          <button type="button" class="pw-shop-btn pw-shop-btn-cart pw-ind-wide-only" data-pw-chrome-btn="add-cart" ${pwElAttr(PW_EL.cardCart)} data-pw-add-cart data-pw-pdp-add-cart="1">${escapeHtml(copy.addCart)}</button>
          <a class="pw-ind-consult pw-ind-mobile-only" data-pw-chrome-btn="phone" href="#contact">${escapeHtml(copy.consult)}</a>
          <a class="pw-ind-consult pw-ind-wide-only" data-pw-chrome-btn="phone" href="#contact">${escapeHtml(copy.quote)}</a>
        </div>
      </div>
    </div>
    <section class="pw-shop-product-detail" ${pwRegionAttr(PW_REGION.pdpInfo)} data-pw-bg-role="pdp-info">
      ${tabs}
    </section>
    ${buildPdpReviewQaCardsHtml(locale)}
    ${buildPdpReviewQaModalsHtml(locale)}
    ${related}
    ${outfit}
    <nav class="pw-ind-quick" aria-label="${escapeAttr(copy.quickTitle)}">
      <h2>${escapeHtml(copy.quickTitle)}</h2>
      <div class="pw-ind-quick-links">${quick}</div>
    </nav>
    ${
      mobile
        ? ''
        : buildPartnerSitePdpBottomNavHtml({
            locale,
            homeHref: slug ? partnerSiteHomePath(slug) : '#',
            stickyOnly: true,
          })
    }
  </div>
</main>
${chrome.bottomNav}
</body>
</html>`
}

export function markIndustrialPdpChrome(html: string): string {
  return html.replace(/<header\b([^>]*)>/i, (full, attrs: string) => {
    if (/\bpw-industrial-chrome\b/.test(String(attrs))) return full
    if (/\bclass=(["'])/.test(String(attrs))) {
      return `<header${String(attrs).replace(/\bclass=(["'])/, 'class=$1pw-industrial-chrome ')}>`
    }
    return `<header class="pw-header pw-industrial-chrome"${attrs}>`
  })
}
