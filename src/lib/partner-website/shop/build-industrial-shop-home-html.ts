import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { buildPartnerSiteFooterHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import { buildPartnerSiteHeaderHtml } from '@/lib/partner-website/shop/build-partner-site-header-html'
import {
  buildShopVisualSeoHead,
  buildShopVisualWebsiteJsonLd,
} from '@/lib/partner-website/shop/build-shop-visual-seo-head'
import { buildPartnerShopFaviconHeadLinks } from '@/lib/partner-website/shop/inject-partner-shop-favicon'
import { PARTNER_WEBSITE_LOOK_SHOP } from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { getPartnerSiteCategoryNavLabels } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import {
  partnerSiteInfoPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_PRODUCT_GRID_RULER_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { buildThemeCssVarBlock } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { resolveShopTemplatePresetId } from '@/lib/partner-website/template/shop-template-presets'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { buildVisualEditorBannerHtml } from '@/lib/partner-website/visual-editor/banner-widgets'
import { buildVisualEditorFeaturedCategoriesHtml } from '@/lib/partner-website/visual-editor/featured-category-widgets'
import { buildVisualEditorProductGridHtml } from '@/lib/partner-website/visual-editor/product-grid-widgets'
import { PW_KIND_SCENE_MEDIA, pwKindSceneAttr } from '@/lib/partner-website/visual-editor/pw-kind-scene'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { pwUnlockedBelowLaptopMediaQuery } from '@/lib/partner-website/visual-editor/pw-coordinate-space'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export const INDUSTRIAL_HOME_FACE = 'industrial'
export const INDUSTRIAL_GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap'

const NEWS_IMAGE =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=640&q=80'

type IndustrialCopy = {
  seoDescription: string
  skip: string
  heroTitle: string
  heroSubtitle: string
  heroCta: string
  featuredTitle: string
  navPills: [string, string, string, string]
  catalogTitle: string
  whyTitle: string
  why: Array<{ title: string; body: string }>
  newsTitle: string
  newsMore: string
  newsHeadline: string
  newsBody: string
  quoteTitle: string
  quoteCta: string
}

const COPY: Record<WebLocale, IndustrialCopy> = {
  vi: {
    seoDescription: 'Máy móc và vật tư công nghiệp: danh mục, máy bán chạy, tư vấn và giao hàng.',
    skip: 'Bỏ qua nội dung',
    heroTitle: 'GIẢI PHÁP MÁY MÓC CÔNG NGHIỆP TOÀN DIỆN',
    heroSubtitle: 'Chất lượng hàng đầu. Dịch vụ chuyên nghiệp. Giá cạnh tranh.',
    heroCta: 'KHÁM PHÁ NGAY',
    featuredTitle: 'Danh mục nổi bật',
    navPills: ['Máy xây dựng', 'Máy cơ khí', 'Máy chế biến gỗ', 'Máy nông nghiệp'],
    catalogTitle: 'Máy móc bán chạy',
    whyTitle: 'Vì sao chọn chúng tôi',
    why: [
      { title: 'Chất lượng', body: 'Máy và vật tư được chọn lọc, kiểm tra trước khi giao.' },
      { title: 'Tư vấn kỹ thuật', body: 'Đội ngũ hỗ trợ chọn máy, công suất và phụ tùng.' },
      { title: 'Giao hàng', body: 'Vận chuyển toàn quốc theo lịch shop xác nhận.' },
      { title: 'Giá cạnh tranh', body: 'Báo giá rõ theo cấu hình và số lượng.' },
    ],
    newsTitle: 'Tin tức & sự kiện',
    newsMore: 'Xem tất cả',
    newsHeadline: 'Hội chợ máy công nghiệp',
    newsBody: 'Xem máy mới, vật tư và lịch tư vấn tại sự kiện sắp tới.',
    quoteTitle: 'LIÊN HỆ TƯ VẤN MIỄN PHÍ',
    quoteCta: 'GỌI NGAY',
  },
  en: {
    seoDescription: 'Industrial machinery and supplies: categories, best sellers, advice, and delivery.',
    skip: 'Skip to content',
    heroTitle: 'RELIABLE MACHINERY FOR YOUR GROWTH',
    heroSubtitle: 'Discover our premium selection of industrial equipment and solutions.',
    heroCta: 'EXPLORE PRODUCTS',
    featuredTitle: 'Featured categories',
    navPills: ['Construction', 'Mechanical', 'Woodworking', 'Agriculture'],
    catalogTitle: 'Latest arrivals',
    whyTitle: 'Why choose us',
    why: [
      { title: 'Quality assurance', body: 'Equipment and supplies are checked before delivery.' },
      { title: 'Expert support', body: 'Help choosing machines, capacity, and spare parts.' },
      { title: 'Global delivery', body: 'Shipping scheduled after the shop confirms the order.' },
      { title: 'Competitive pricing', body: 'Clear quotes by configuration and quantity.' },
    ],
    newsTitle: 'News & events',
    newsMore: 'View all',
    newsHeadline: 'Industrial machinery trade show',
    newsBody: 'See new machines, supplies, and consult slots at the next event.',
    quoteTitle: 'FREE CONSULTATION',
    quoteCta: 'CALL NOW',
  },
  zh: {
    seoDescription: '工业机械与物资：分类、热销、咨询与配送。',
    skip: '跳到正文',
    heroTitle: '可靠机械，助力增长',
    heroSubtitle: '精选工业设备与解决方案，服务专业，价格清楚。',
    heroCta: '立即了解',
    featuredTitle: '精选分类',
    navPills: ['工程机械', '机械加工', '木材加工', '农机'],
    catalogTitle: '热销机械',
    whyTitle: '为什么选择我们',
    why: [
      { title: '品质保证', body: '设备与物资在交付前经过检查。' },
      { title: '技术咨询', body: '协助选择机型、功率与配件。' },
      { title: '配送', body: '店铺确认订单后安排运送。' },
      { title: '价格清楚', body: '按配置与数量报价。' },
    ],
    newsTitle: '新闻与活动',
    newsMore: '查看全部',
    newsHeadline: '工业机械展',
    newsBody: '在即将举行的活动中查看新机、物资与咨询安排。',
    quoteTitle: '免费咨询',
    quoteCta: '立即致电',
  },
  ja: {
    seoDescription: '産業機械と資材：カテゴリ、売れ筋、相談、配送。',
    skip: '本文へスキップ',
    heroTitle: '成長を支える産業機械',
    heroSubtitle: '厳選した設備とソリューション。専門サポートと明確な価格。',
    heroCta: '製品を見る',
    featuredTitle: '注目カテゴリ',
    navPills: ['建設機械', '機械加工', '木工機械', '農業機械'],
    catalogTitle: '売れ筋機械',
    whyTitle: '選ばれる理由',
    why: [
      { title: '品質', body: '機械と資材は納品前に確認します。' },
      { title: '技術相談', body: '機種、能力、部品選びを支援します。' },
      { title: '配送', body: '注文確認後に配送を手配します。' },
      { title: '明確な価格', body: '仕様と数量に応じて見積します。' },
    ],
    newsTitle: 'ニュースとイベント',
    newsMore: 'すべて見る',
    newsHeadline: '産業機械の展示会',
    newsBody: '次回イベントで新型機、資材、相談枠を確認できます。',
    quoteTitle: '無料相談',
    quoteCta: '今すぐ電話',
  },
  ko: {
    seoDescription: '산업 기계와 자재: 카테고리, 인기 상품, 상담, 배송.',
    skip: '본문으로 건너뛰기',
    heroTitle: '성장을 위한 산업 기계',
    heroSubtitle: '엄선한 장비와 솔루션. 전문 상담과 명확한 가격.',
    heroCta: '제품 보기',
    featuredTitle: '주요 카테고리',
    navPills: ['건설 기계', '기계 가공', '목공 기계', '농기계'],
    catalogTitle: '인기 기계',
    whyTitle: '선택하는 이유',
    why: [
      { title: '품질', body: '기계와 자재는 출고 전에 확인합니다.' },
      { title: '기술 상담', body: '기종, 용량, 부품 선택을 돕습니다.' },
      { title: '배송', body: '주문 확인 후 배송을 잡습니다.' },
      { title: '명확한 가격', body: '사양과 수량에 따라 견적합니다.' },
    ],
    newsTitle: '뉴스와 이벤트',
    newsMore: '전체 보기',
    newsHeadline: '산업 기계 전시회',
    newsBody: '다음 행사에서 신규 장비, 자재, 상담 일정을 확인하세요.',
    quoteTitle: '무료 상담',
    quoteCta: '바로 전화',
  },
}

const ICON = {
  shield:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  support:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12a8 8 0 0 1 16 0"/><path d="M4 12v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2z"/><path d="M20 12v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z"/><path d="M12 19v2"/></svg>',
  globe:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>',
  price:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2v20"/><path d="M17 6.5c0-1.5-2-2.5-5-2.5s-5 1-5 2.5 2 2.5 5 2.5 5 1 5 2.5-2 2.5-5 2.5-5-1-5-2.5"/></svg>',
}

export function isIndustrialTemplateId(templateId: string | null | undefined): boolean {
  return resolveShopTemplatePresetId(templateId) === 'industrial-machinery'
}

function industrialCopy(locale: WebLocale): IndustrialCopy {
  return COPY[locale] || COPY.en
}

export function buildIndustrialHomeCss(): string {
  const belowLaptop = pwUnlockedBelowLaptopMediaQuery()
  return `
.pw-industrial-home{display:flex;flex-direction:column;gap:28px;padding:16px 0 32px}
.pw-industrial-home [data-pw-personalize-banner="promo"]{background:var(--pw-primary)!important;color:#fff}
.pw-industrial-home [data-pw-personalize-banner="promo"] [data-pw-el="badge"],
.pw-industrial-home [data-pw-personalize-banner="promo"] [data-pw-el="cta-secondary"]{display:none!important}
.pw-industrial-home [data-pw-personalize-banner="promo"] [data-pw-promo-slot] > div[aria-hidden="true"]{display:none!important}
.pw-industrial-home [data-pw-personalize-banner="promo"] img[data-pw-el="media"]{
  left:46%!important;width:54%!important;right:0!important;top:0!important;bottom:0!important;height:100%!important;
  object-fit:contain!important;object-position:right center!important;background:transparent!important
}
.pw-industrial-home [data-pw-personalize-banner="promo"] [data-pw-el="copy"]{max-width:min(46%,520px)!important}
.pw-industrial-home [data-pw-personalize-banner="promo"] [data-pw-el="title"]{font-weight:800;letter-spacing:.01em}
.pw-industrial-home [data-pw-personalize-banner="promo"] [data-pw-el="cta"]{
  background:#fff!important;color:var(--pw-primary)!important;border:0!important;border-radius:999px!important;
  font-weight:800;letter-spacing:.04em
}
.pw-industrial-block-title,.pw-industrial-home .pw-catalog [data-pw-el="section-title"]{
  display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:18px;font-weight:800;
  letter-spacing:.04em;text-transform:uppercase;color:var(--pw-text)
}
.pw-industrial-block-title::before,.pw-industrial-home .pw-catalog [data-pw-el="section-title"]::before{
  content:"";width:4px;height:1.05em;border-radius:2px;background:var(--pw-primary);flex:0 0 auto
}
.pw-industrial-home .pw-featured-cat .pw-industrial-block-title{color:#fff;padding:14px 16px 0;margin:0}
.pw-industrial-home .pw-featured-cat .pw-industrial-block-title::before{background:#fff}
.pw-industrial-why,.pw-industrial-news,.pw-industrial-quote{width:var(--pw-block-w);max-width:min(100%,var(--pw-block-w));margin:0 auto;box-sizing:border-box}
.pw-industrial-why{text-align:center;padding:8px 16px 0}
.pw-industrial-why [data-pw-el="heading"]{margin:0 0 22px;font-size:22px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.pw-industrial-why-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.pw-industrial-why-item{display:flex;flex-direction:column;align-items:center;gap:8px}
.pw-industrial-why-icon{
  width:64px;height:64px;border-radius:999px;display:grid;place-items:center;
  color:var(--pw-primary);border:1.5px solid color-mix(in srgb,var(--pw-primary) 55%,var(--pw-border))
}
.pw-industrial-why-item [data-pw-el="title"]{margin:0;font-size:15px;font-weight:800}
.pw-industrial-why-item [data-pw-el="body"]{margin:0;font-size:13px;line-height:1.45;color:var(--pw-muted)}
.pw-industrial-news{padding:0 16px}
.pw-industrial-news-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.pw-industrial-news [data-pw-el="heading"]{display:flex;align-items:center;gap:10px;margin:0;font-size:18px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.pw-industrial-news [data-pw-el="heading"]::before{content:"";width:4px;height:1.05em;border-radius:2px;background:var(--pw-primary)}
.pw-industrial-news [data-pw-el="link"]{color:var(--pw-primary);font-weight:700;font-size:14px}
.pw-industrial-news-card{display:grid;grid-template-columns:148px minmax(0,1fr);gap:12px;align-items:center;background:var(--pw-surface);border:1px solid var(--pw-border);border-radius:12px;overflow:hidden}
.pw-industrial-news-card img{width:100%;height:96px;object-fit:cover;display:block}
.pw-industrial-news-card [data-pw-el="title"]{margin:0 0 4px;font-size:15px;font-weight:800}
.pw-industrial-news-card [data-pw-el="body"]{margin:0;font-size:13px;color:var(--pw-muted)}
.pw-industrial-quote{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:16px 18px;border-radius:14px;background:var(--pw-primary);color:#fff
}
.pw-industrial-quote [data-pw-el="title"]{margin:0;font-size:18px;font-weight:800;letter-spacing:.03em}
.pw-industrial-quote [data-pw-el="cta"]{
  display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--pw-primary);
  border-radius:999px;padding:10px 16px;font-weight:800;white-space:nowrap
}
.pw-industrial-news{display:none}
@media ${belowLaptop}{
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-why{display:none!important}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-news{display:block!important}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-why-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-industrial-quote{flex-direction:column;align-items:stretch;text-align:center}
}
html[data-pw-edit-device="mobile"] .pw-industrial-why,
html[data-pw-edit-device="tablet"] .pw-industrial-why,
html[data-pw-scene-lock="mobile"] .pw-industrial-why,
html[data-pw-scene-lock="tablet"] .pw-industrial-why{display:none!important}
html[data-pw-edit-device="mobile"] .pw-industrial-news,
html[data-pw-edit-device="tablet"] .pw-industrial-news,
html[data-pw-scene-lock="mobile"] .pw-industrial-news,
html[data-pw-scene-lock="tablet"] .pw-industrial-news{display:block!important}
html[data-pw-edit-device="mobile"] .pw-industrial-quote,
html[data-pw-edit-device="tablet"] .pw-industrial-quote,
html[data-pw-scene-lock="mobile"] .pw-industrial-quote,
html[data-pw-scene-lock="tablet"] .pw-industrial-quote{flex-direction:column;align-items:stretch;text-align:center}
html[data-pw-edit-device="mobile"] .pw-industrial-news-card,
html[data-pw-scene-lock="mobile"] .pw-industrial-news-card{grid-template-columns:112px minmax(0,1fr)}
`.trim()
}

const FASHION_FEATURED_NAMES: Record<WebLocale, string[]> = {
  vi: ['Áo sơ mi', 'Giày tây', 'Áo khoác', 'Áo thun &amp; polo', 'Quần dài'],
  en: ['Shirts', 'Dress shoes', 'Jackets', 'Tees &amp; polos', 'Trousers'],
  zh: ['衬衫', '皮鞋', '外套', 'T恤 Polo', '长裤'],
  ja: ['シャツ', '革靴', 'ジャケット', 'ポロ', 'パンツ'],
  ko: ['셔츠', '구두', '재킷', '폴로', '바지'],
}

const INDUSTRIAL_EXTRA_TILE: Record<WebLocale, string> = {
  vi: 'Vật tư',
  en: 'Supplies',
  zh: '物资',
  ja: '資材',
  ko: '자재',
}

function withIndustrialFeaturedNames(html: string, locale: WebLocale, pills: IndustrialCopy['navPills']): string {
  const fashion = FASHION_FEATURED_NAMES[locale] || FASHION_FEATURED_NAMES.en
  const names = [...pills, INDUSTRIAL_EXTRA_TILE[locale] || INDUSTRIAL_EXTRA_TILE.en]
  let out = html
  fashion.forEach((from, index) => {
    const to = names[index] || names[0]
    out = out.split(`>${from}<`).join(`>${escapeHtml(to)}<`)
  })
  return out
}

function withIndustrialNavPills(header: string, locale: WebLocale, pills: IndustrialCopy['navPills']): string {
  const fashion = getPartnerSiteCategoryNavLabels(locale)
  const pairs: Array<[string, string]> = [
    [fashion.clothing, pills[0]],
    [fashion.bags, pills[1]],
    [fashion.shoes, pills[2]],
    [fashion.accessories, pills[3]],
  ]
  return header.replace(
    /(<nav\b[^>]*\bdata-pw-personalize-nav=["']recent-categories["'][^>]*>)([\s\S]*?)(<\/nav>)/i,
    (_full, open: string, inner: string, close: string) => {
      let body = inner
      for (const [from, to] of pairs) {
        body = body.replace(`>${from}<`, `>${escapeHtml(to)}<`)
      }
      return `${open}${body}${close}`
    }
  )
}

function withIndustrialBannerCopy(html: string, copy: IndustrialCopy, href: string): string {
  const safeHref = escapeAttr(href)
  return html
    .replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/gi, `$1${escapeHtml(copy.heroTitle)}$2`)
    .replace(/(<p\b[^>]*\bpw-hero-sub\b[^>]*>)[\s\S]*?(<\/p>)/gi, `$1${escapeHtml(copy.heroSubtitle)}$2`)
    .replace(/(<a\b[^>]*\bdata-pw-el=["']cta["'][^>]*)(>[\s\S]*?<\/a>)/gi, (_full, open: string) => {
      const next = /\bhref=/.test(open)
        ? open.replace(/\bhref=["'][^"']*["']/i, `href="${safeHref}"`)
        : `${open} href="${safeHref}"`
      return `${next}>${escapeHtml(copy.heroCta)}</a>`
    })
}

function retitleSection(html: string, title: string): string {
  return html.replace(
    /(<h2\b[^>]*\bdata-pw-el=["']section-title["'][^>]*>)[\s\S]*?(<\/h2>)/i,
    `$1${escapeHtml(title)}$2`
  )
}

function whySection(copy: IndustrialCopy): string {
  const icons = [ICON.shield, ICON.support, ICON.globe, ICON.price]
  const items = copy.why
    .map(
      (item, index) => `<article class="pw-industrial-why-item">
  <span class="pw-industrial-why-icon">${icons[index] || ICON.shield}</span>
  <h3 ${pwElAttr(PW_EL.title)}>${escapeHtml(item.title)}</h3>
  <p ${pwElAttr(PW_EL.body)}>${escapeHtml(item.body)}</p>
</article>`
    )
    .join('')
  return `<section class="pw-industrial-why" ${pwRegionAttr(PW_REGION.content)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="content">
  <h2 ${pwElAttr(PW_EL.heading)}>${escapeHtml(copy.whyTitle)}</h2>
  <div class="pw-industrial-why-grid">${items}</div>
</section>`
}

function newsSection(copy: IndustrialCopy, href: string): string {
  return `<section class="pw-industrial-news" ${pwRegionAttr(PW_REGION.content)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="content">
  <div class="pw-industrial-news-head">
    <h2 ${pwElAttr(PW_EL.heading)}>${escapeHtml(copy.newsTitle)}</h2>
    <a ${pwElAttr(PW_EL.link)} href="${escapeAttr(href)}">${escapeHtml(copy.newsMore)}</a>
  </div>
  <article class="pw-industrial-news-card">
    <img ${pwElAttr(PW_EL.image)} src="${escapeAttr(NEWS_IMAGE)}" alt="" width="320" height="180" loading="lazy" decoding="async"/>
    <div>
      <h3 ${pwElAttr(PW_EL.title)}>${escapeHtml(copy.newsHeadline)}</h3>
      <p ${pwElAttr(PW_EL.body)}>${escapeHtml(copy.newsBody)}</p>
    </div>
  </article>
</section>`
}

function quoteBar(copy: IndustrialCopy): string {
  return `<section class="pw-industrial-quote" ${pwRegionAttr(PW_REGION.content)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="content">
  <h2 ${pwElAttr(PW_EL.title)}>${escapeHtml(copy.quoteTitle)}</h2>
  <a ${pwElAttr(PW_EL.cta)} data-pw-chrome-btn="phone" href="#contact">${escapeHtml(copy.quoteCta)}</a>
</section>`
}

export function buildIndustrialShopHomeHtml(input: {
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
  const copy = industrialCopy(locale)
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
  const banner = withIndustrialBannerCopy(
    buildVisualEditorBannerHtml({ kind: 'promo', siteSlug, locale }),
    copy,
    productsHref
  )
  const featured = withIndustrialFeaturedNames(
    buildVisualEditorFeaturedCategoriesHtml({
      siteSlug,
      locale,
      rows: 2,
      device: input.variant,
    }),
    locale,
    copy.navPills
  ).replace(
    '<div class="pw-featured-cat-inner">',
    `<div class="pw-featured-cat-inner"><h2 class="pw-industrial-block-title" ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(copy.featuredTitle)}</h2>`
  )
  const catalog = retitleSection(
    buildVisualEditorProductGridHtml({
      kind: 'catalog',
      siteSlug,
      locale,
      rows: 1,
      device: input.variant,
    }),
    copy.catalogTitle
  )
  const flash = buildVisualEditorProductGridHtml({
    kind: 'flash-sale',
    siteSlug,
    locale,
    device: input.variant,
  })
  const footer = buildPartnerSiteFooterHtml({
    locale,
    siteSlug,
    brand: input.brand,
    logoUrl: logo,
  })
  const personalizationScript = siteSlug
    ? buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale })
    : ''
  const faviconLink = buildPartnerShopFaviconHeadLinks({
    siteSlug,
    faviconUrl: input.theme.faviconUrl,
    logoUrl: logo,
  })
  void input.chatPath

  return `<!DOCTYPE html>
<html lang="${escapeAttr(locale)}" data-pw-page="home" data-pw-look="${PARTNER_WEBSITE_LOOK_SHOP}" data-pw-home-face="${INDUSTRIAL_HOME_FACE}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${buildShopVisualSeoHead({
  title: input.brand,
  description: copy.seoDescription,
  locale,
  imageUrl: logo || null,
  themeColor: input.theme.primaryColor,
})}
${faviconLink}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${INDUSTRIAL_GOOGLE_FONTS_HREF}" rel="stylesheet"/>
<style id="pw-industrial-home-css">:root{${buildThemeCssVarBlock(input.theme)}}
${PW_PRODUCT_GRID_RULER_CSS}
${buildIndustrialHomeCss()}</style>
${buildShopVisualWebsiteJsonLd({
  brand: input.brand,
  locale,
  siteSlug: siteSlug || undefined,
  logoUrl: logo,
  description: copy.seoDescription,
})}
</head>
<body id="top" data-pw-page="home">
<a class="pw-skip" href="#pw-main">${escapeHtml(copy.skip)}</a>
${withIndustrialNavPills(chrome.header, locale, copy.navPills)}
<main id="pw-main" class="pw-shop-main pw-industrial-home" data-pw-scene-root="1" data-pw-scene-origin="content" data-pw-bg-role="content" data-pw-home-face="${INDUSTRIAL_HOME_FACE}">
${banner}
${featured}
${whySection(copy)}
${catalog}
${flash}
${newsSection(copy, partnerSiteInfoPath(siteSlug, 'blog'))}
${quoteBar(copy)}
</main>
${footer}
${chrome.bottomNav}
${chrome.scripts}
${personalizationScript}
</body>
</html>`
}
