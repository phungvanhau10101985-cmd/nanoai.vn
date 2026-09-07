import type { WebLocale } from '@/lib/i18n/config'
import { FLASH_SALE_MAX_COUNT } from '@/lib/partner-website/promotions/partner-flash-sale'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { buildOutfitProductsSectionHtml } from '@/lib/partner-website/shop/outfit-products'
import {
  partnerSiteCategoryHubPath,
  partnerSiteProductsPath,
  partnerSiteRecentlyViewedPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  clampProductGridRows,
  productGridActionsHtml,
  productGridColsForDevice,
  productGridPageSize,
  type PartnerProductGridDevice,
} from '@/lib/partner-website/shop/pw-product-grid-page'
import { buildRelatedProductsSectionHtml } from '@/lib/partner-website/shop/related-products'
import { buildVisualEditorFeaturedCategoriesHtml } from '@/lib/partner-website/visual-editor/featured-category-widgets'
import { PW_KIND_SCENE_MEDIA, pwKindSceneAttr } from '@/lib/partner-website/visual-editor/pw-kind-scene'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export const VISUAL_EDITOR_PRODUCT_GRID_KINDS = [
  'catalog',
  'recently-viewed',
  'recommended',
  'flash-sale',
  'featured-categories',
  'related',
  'outfit',
] as const

export type VisualEditorProductGridKind = (typeof VISUAL_EDITOR_PRODUCT_GRID_KINDS)[number]

export function isVisualEditorProductGridKind(value: string): value is VisualEditorProductGridKind {
  return (VISUAL_EDITOR_PRODUCT_GRID_KINDS as readonly string[]).includes(value)
}

/** Related + outfit bind the product being viewed — Thêm only on PDP. */
export const VISUAL_EDITOR_PDP_ONLY_PRODUCT_GRID_KINDS = ['related', 'outfit'] as const

/** Lưới cá nhân hóa — Thêm trên mọi trang. Không gồm related / outfit. */
export const VISUAL_EDITOR_PERSONALIZE_PRODUCT_GRID_KINDS = [
  'recently-viewed',
  'recommended',
  'flash-sale',
  'featured-categories',
] as const

/** Panel Thêm (+ khe): cá nhân hóa mọi trang; tương tự + phối đồ chỉ PDP. Catalog seed, không nút. */
export const VISUAL_EDITOR_PICKER_PRODUCT_GRID_KINDS = [
  ...VISUAL_EDITOR_PERSONALIZE_PRODUCT_GRID_KINDS,
  'related',
  'outfit',
] as const

export function isPdpOnlyProductGridKind(kind: string): boolean {
  return (VISUAL_EDITOR_PDP_ONLY_PRODUCT_GRID_KINDS as readonly string[]).includes(kind)
}

export function isPersonalizeProductGridKind(kind: string): boolean {
  return (VISUAL_EDITOR_PERSONALIZE_PRODUCT_GRID_KINDS as readonly string[]).includes(kind)
}

export function productGridKindAllowedOnVisualPage(
  kind: VisualEditorProductGridKind,
  pageKey?: string | null
): boolean {
  if (!isPdpOnlyProductGridKind(kind)) return true
  return String(pageKey || '').trim() === 'product_detail'
}

export function productGridKindShownInAddPicker(
  kind: VisualEditorProductGridKind,
  pageKey?: string | null
): boolean {
  if (kind === 'catalog') return false
  if (isPersonalizeProductGridKind(kind)) return true
  if (isPdpOnlyProductGridKind(kind)) return productGridKindAllowedOnVisualPage(kind, pageKey)
  return false
}

const TITLE: Record<VisualEditorProductGridKind, Record<WebLocale, string>> = {
  catalog: {
    vi: 'Sản phẩm',
    en: 'Products',
    zh: '商品',
    ja: '商品',
    ko: '상품',
  },
  'recently-viewed': {
    vi: 'Sản phẩm đã xem',
    en: 'Recently viewed',
    zh: '最近浏览',
    ja: '最近見た商品',
    ko: '최근 본 상품',
  },
  recommended: {
    vi: 'CÓ THỂ BẠN THÍCH',
    en: 'YOU MAY ALSO LIKE',
    zh: '猜你喜欢',
    ja: 'あなたへのおすすめ',
    ko: '이런 상품은 어때요',
  },
  'flash-sale': {
    vi: 'FLASH SALE',
    en: 'FLASH SALE',
    zh: 'FLASH SALE',
    ja: 'FLASH SALE',
    ko: 'FLASH SALE',
  },
  related: {
    vi: 'Sản phẩm tương tự',
    en: 'Similar products',
    zh: '相似商品',
    ja: '類似商品',
    ko: '유사 상품',
  },
  outfit: {
    vi: 'Phối đồ',
    en: 'Outfit pairing',
    zh: '搭配',
    ja: 'コーディネート',
    ko: '코디',
  },
  'featured-categories': {
    vi: 'Danh mục nổi bật',
    en: 'Featured categories',
    zh: '精选分类',
    ja: '注目カテゴリ',
    ko: '추천 카테고리',
  },
}

export function productGridWidgetLabel(kind: VisualEditorProductGridKind, locale: WebLocale): string {
  if (kind === 'catalog') {
    return locale === 'vi'
      ? 'Lưới sản phẩm'
      : locale === 'zh'
        ? '商品网格'
        : locale === 'ja'
          ? '商品グリッド'
          : locale === 'ko'
            ? '상품 그리드'
            : 'Product grid'
  }
  if (kind === 'recently-viewed') {
    return locale === 'vi'
      ? 'Lưới đã xem'
      : locale === 'zh'
        ? '最近浏览网格'
        : locale === 'ja'
          ? '閲覧履歴グリッド'
          : locale === 'ko'
            ? '최근 본 그리드'
            : 'Recently viewed grid'
  }
  if (kind === 'related') {
    return locale === 'vi'
      ? 'Sản phẩm tương tự'
      : locale === 'zh'
        ? '相似商品'
        : locale === 'ja'
          ? '類似商品'
          : locale === 'ko'
            ? '유사 상품'
            : 'Similar products'
  }
  if (kind === 'outfit') {
    return locale === 'vi'
      ? 'Khối phối đồ'
      : locale === 'zh'
        ? '搭配'
        : locale === 'ja'
          ? 'コーディネート'
          : locale === 'ko'
            ? '코디'
            : 'Outfit pairing'
  }
  if (kind === 'featured-categories') {
    return locale === 'vi'
      ? 'Danh mục nổi bật'
      : locale === 'zh'
        ? '精选分类'
        : locale === 'ja'
          ? '注目カテゴリ'
          : locale === 'ko'
            ? '추천 카테고리'
            : 'Featured categories'
  }
  if (kind === 'flash-sale') {
    return locale === 'vi'
      ? 'Flash sale'
      : locale === 'zh'
        ? '限时抢购'
        : locale === 'ja'
          ? 'フラッシュセール'
          : locale === 'ko'
            ? '플래시 세일'
            : 'Flash sale'
  }
  return locale === 'vi'
    ? 'Lưới đề xuất'
    : locale === 'zh'
      ? '个性化推荐网格'
      : locale === 'ja'
        ? 'おすすめグリッド'
        : locale === 'ko'
          ? '추천 그리드'
          : 'Recommended grid'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function placeholderCards(count: number, label: string): string {
  const n = Math.max(2, Math.min(20, count))
  let out = ''
  for (let i = 1; i <= n; i += 1) {
    out += `<article class="pw-product-card" ${pwElAttr(PW_EL.card)} data-pw-grid-placeholder="1">
  <div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} style="background:var(--pw-surface,#f3f4f6)"></div>
  <div class="pw-product-card-body">
    <h3 ${pwElAttr(PW_EL.cardName)}>${escapeHtml(label)} ${i}</h3>
    <p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>—</p>
  </div>
</article>`
  }
  return out
}

const REC_BADGE: Record<WebLocale, string> = {
  vi: 'Đề xuất',
  en: 'For you',
  zh: '推荐',
  ja: 'おすすめ',
  ko: '추천',
}

function recommendedPlaceholderCards(count: number, label: string, soldLabel: string, badge: string): string {
  const n = Math.max(2, Math.min(20, count))
  let out = ''
  for (let i = 1; i <= n; i += 1) {
    out += `<article class="pw-product-card pw-rec-card" ${pwElAttr(PW_EL.card)} data-pw-grid-placeholder="1">
  <div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} style="background:var(--pw-surface,#f3f4f6)">
    ${badge ? `<span class="pw-rec-badge">${escapeHtml(badge)}</span>` : ''}
  </div>
  <div class="pw-product-card-body">
    <h3 ${pwElAttr(PW_EL.cardName)}>${escapeHtml(label)} ${i}</h3>
    <p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>—</p>
    <div class="pw-rec-stats"><span>★ 0.0</span><span>${escapeHtml(soldLabel)}: 0</span></div>
  </div>
</article>`
  }
  return out
}

function gridSeeAllHref(kind: VisualEditorProductGridKind, siteSlug: string): string {
  if (kind === 'recently-viewed') return partnerSiteRecentlyViewedPath(siteSlug)
  if (kind === 'featured-categories') return partnerSiteCategoryHubPath(siteSlug)
  return partnerSiteProductsPath(siteSlug)
}

/** In-flow catalog section for Sửa nhanh «Thêm». Live hydrates via catalog / personalization bootstrap. */
export function buildVisualEditorProductGridHtml(input: {
  kind: VisualEditorProductGridKind
  siteSlug: string
  locale?: WebLocale
  rows?: number
  device?: PartnerProductGridDevice | string | null
  limit?: number
}): string {
  const locale = input.locale && input.locale in TITLE.catalog ? input.locale : 'vi'
  const kind = input.kind
  const rows = clampProductGridRows(
    kind === 'featured-categories' ? input.rows ?? 2 : kind === 'flash-sale' ? input.rows ?? 3 : input.rows
  )
  const cols = productGridColsForDevice(input.device)
  const pageSize = productGridPageSize(rows, cols)
  const limit =
    kind === 'flash-sale'
      ? FLASH_SALE_MAX_COUNT
      : Math.max(pageSize, Math.min(48, Math.floor(Number(input.limit) || pageSize)))
  if (kind === 'featured-categories') {
    return buildVisualEditorFeaturedCategoriesHtml({
      siteSlug: input.siteSlug,
      locale,
      rows,
      device: input.device,
      limit,
    })
  }
  if (kind === 'related') {
    return buildRelatedProductsSectionHtml({
      locale,
      siteSlug: input.siteSlug,
      rows,
      limit,
      added: true,
    })
  }
  if (kind === 'outfit') {
    return buildOutfitProductsSectionHtml({
      locale,
      siteSlug: input.siteSlug,
      rows,
      limit,
      added: true,
    })
  }
  const copy = getPartnerSiteShopCopy(locale)
  const flash = kind === 'flash-sale'
  const title =
    kind === 'recommended'
      ? copy.homeYouMayLike || TITLE.recommended[locale]
      : kind === 'flash-sale'
        ? TITLE['flash-sale'][locale]
      : kind === 'recently-viewed'
        ? copy.recentlyViewedTitle || TITLE['recently-viewed'][locale]
        : copy.catalogTitle || TITLE.catalog[locale]
  const loadMore = copy.gridLoadMore || copy.loadMore
  const seeAll = copy.gridSeeAllGroups || copy.relatedSeeAll
  const personalize =
    kind === 'catalog'
      ? ''
      : ` data-pw-personalize="${kind === 'recommended' ? 'recommended' : kind === 'flash-sale' ? 'flash-sale' : 'recently-viewed'}"`
  const catalogAttr = kind === 'catalog' ? ' data-pw-catalog data-sort="default"' : ''
  const sectionId =
    kind === 'catalog'
      ? 'pw-grid-catalog'
      : kind === 'recommended'
        ? 'pw-grid-recommended'
        : kind === 'flash-sale'
          ? 'pw-grid-flash-sale'
          : 'pw-grid-recently-viewed'
  const rec = kind === 'recommended'
  const cards =
    rec || flash
      ? recommendedPlaceholderCards(
          flash ? FLASH_SALE_MAX_COUNT : pageSize,
          title,
          copy.pdpPurchasesLabel || 'Đã bán',
          rec ? REC_BADGE[locale] : ''
        )
      : placeholderCards(pageSize, title)
  const flashSub: Record<WebLocale, string> = {
    vi: '12 deal / 10 phút, cùng shop TQ và danh mục vừa xem. Hết lượt mất giảm — chốt giỏ ngay.',
    en: '12 deals / 10 minutes, same Chinese shop and recently viewed category. Discount ends with the round — checkout now.',
    zh: '每轮 10 分钟最多 12 个特惠，来自刚看过的中国店铺与三级类目。本轮结束即恢复原价。',
    ja: '10分で最大12件。最近見た中国ショップと同じカテゴリ。ラウンド終了で割引終了。',
    ko: '10분마다 최대 12개, 최근 본 중국 샵·카테고리. 라운드가 끝나면 할인이 사라집니다.',
  }
  const titleHtml = flash
    ? `<div class="pw-flash-head" data-pw-flash-head="1"><div class="pw-flash-copy"><h2 class="pw-flash-title" ${pwElAttr(PW_EL.sectionTitle)} style="margin:0">${escapeHtml(title)}</h2><p class="pw-flash-sub" data-pw-flash-sub="1">${escapeHtml(flashSub[locale])}</p></div><p class="pw-flash-timer" data-pw-flash-timer="1" hidden role="timer"></p></div>`
    : rec
    ? `<div class="pw-rec-head" data-pw-rec-head="1"><div class="pw-rec-head-row"><h2 class="pw-rec-title" ${pwElAttr(PW_EL.sectionTitle)} style="margin:0">${escapeHtml(title)}</h2></div></div>`
    : `<h2 ${pwElAttr(PW_EL.sectionTitle)} style="margin:0">${escapeHtml(title)}</h2>`

  return `<section class="pw-catalog pw-product-grid-section${rec ? ' pw-rec-grid' : ''}${flash ? ' pw-flash-sale-grid pw-rec-grid' : ''}" id="${sectionId}" ${pwRegionAttr(PW_REGION.catalog)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-added-catalog="1" data-pw-grid-kind="${kind}" data-pw-grid-cols="5" data-pw-grid-cols-mobile="2" data-pw-grid-rows="${rows}" data-limit="${limit}"${catalogAttr}${personalize}${rec ? ' data-pw-rec-face="188"' : ''}${flash ? ' data-pw-flash-face="188"' : ''} style="margin:0;padding:0;min-height:0;height:auto">
  <div class="pw-container" style="padding:12px 16px 16px">
    ${titleHtml}
    <div data-pw-grid class="pw-product-grid" ${pwElAttr(PW_EL.grid)}>${cards}</div>
    ${
      flash
        ? ''
        : productGridActionsHtml({
            loadMoreLabel: loadMore,
            seeAllLabel: seeAll,
            seeAllHref: gridSeeAllHref(kind, input.siteSlug),
            hideSeeAll: rec,
          })
    }
    <p class="pw-catalog-empty pw-personalize-empty" hidden></p>
  </div>
</section>`
}

/** Seed / reset home: FLASH SALE after banner, like 188 after hero. Keep merchant-saved block. */
function htmlHasFlashSaleBlock(html: string): boolean {
  return /<[a-z][^>]*\bdata-pw-personalize=["']flash-sale["']/i.test(html)
}

export function ensureHomeFlashSaleBlockInHtml(
  html: string,
  input: {
    siteSlug: string
    locale?: WebLocale
    device?: PartnerProductGridDevice | string | null
  }
): string {
  if (!html.trim()) return html
  if (htmlHasFlashSaleBlock(html)) return html
  const block = buildVisualEditorProductGridHtml({
    kind: 'flash-sale',
    siteSlug: input.siteSlug,
    locale: input.locale,
    device: input.device,
  })
  if (!block) return html
  const withBanner = html.replace(
    /(<section\b[^>]*data-pw-region=["']banner["'][\s\S]*?<\/section>)/i,
    `$1\n${block}`
  )
  if (withBanner !== html) return withBanner
  if (/<main\b/i.test(html)) return html.replace(/<main\b([^>]*)>/i, `<main$1>\n${block}`)
  return html
}
