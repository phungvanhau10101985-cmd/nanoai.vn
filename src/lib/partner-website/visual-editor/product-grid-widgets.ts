import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { buildOutfitProductsSectionHtml } from '@/lib/partner-website/shop/outfit-products'
import {
  clampProductGridRows,
  productGridColsForDevice,
  productGridPageSize,
  type PartnerProductGridDevice,
} from '@/lib/partner-website/shop/pw-product-grid-page'
import { buildRelatedProductsSectionHtml } from '@/lib/partner-website/shop/related-products'
import { PW_KIND_SCENE_MEDIA, pwKindSceneAttr } from '@/lib/partner-website/visual-editor/pw-kind-scene'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export const VISUAL_EDITOR_PRODUCT_GRID_KINDS = [
  'catalog',
  'recently-viewed',
  'recommended',
  'related',
  'outfit',
] as const

export type VisualEditorProductGridKind = (typeof VISUAL_EDITOR_PRODUCT_GRID_KINDS)[number]

export function isVisualEditorProductGridKind(value: string): value is VisualEditorProductGridKind {
  return (VISUAL_EDITOR_PRODUCT_GRID_KINDS as readonly string[]).includes(value)
}

/** Related + outfit bind the product being viewed — Thêm only on PDP. */
export const VISUAL_EDITOR_PDP_ONLY_PRODUCT_GRID_KINDS = ['related', 'outfit'] as const

export function isPdpOnlyProductGridKind(kind: string): boolean {
  return (VISUAL_EDITOR_PDP_ONLY_PRODUCT_GRID_KINDS as readonly string[]).includes(kind)
}

export function productGridKindAllowedOnVisualPage(
  kind: VisualEditorProductGridKind,
  pageKey?: string | null
): boolean {
  if (!isPdpOnlyProductGridKind(kind)) return true
  return String(pageKey || '').trim() === 'product_detail'
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
      ? 'Phối đồ'
      : locale === 'zh'
        ? '搭配'
        : locale === 'ja'
          ? 'コーディネート'
          : locale === 'ko'
            ? '코디'
            : 'Outfit pairing'
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

function gridMoreButtonHtml(label: string): string {
  return `<div class="pw-grid-actions" data-pw-grid-actions>
    <button type="button" class="pw-grid-more" data-pw-grid-more>
      <span class="pw-grid-more-icon" aria-hidden="true">↻</span>
      ${escapeHtml(label)}
    </button>
  </div>`
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
  const rows = clampProductGridRows(input.rows)
  const cols = productGridColsForDevice(input.device)
  const pageSize = productGridPageSize(rows, cols)
  const limit = Math.max(pageSize, Math.min(48, Math.floor(Number(input.limit) || pageSize)))
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
  const title =
    kind === 'recommended'
      ? copy.homeYouMayLike || TITLE.recommended[locale]
      : kind === 'recently-viewed'
        ? copy.recentlyViewedTitle || TITLE['recently-viewed'][locale]
        : copy.catalogTitle || TITLE.catalog[locale]
  const loadMore = copy.gridLoadMore || copy.loadMore
  const personalize =
    kind === 'catalog' ? '' : ` data-pw-personalize="${kind === 'recommended' ? 'recommended' : 'recently-viewed'}"`
  const catalogAttr = kind === 'catalog' ? ' data-pw-catalog data-sort="default"' : ''
  const sectionId =
    kind === 'catalog' ? 'pw-grid-catalog' : kind === 'recommended' ? 'pw-grid-recommended' : 'pw-grid-recently-viewed'
  const cards = placeholderCards(pageSize, title)

  return `<section class="pw-catalog pw-product-grid-section" id="${sectionId}" ${pwRegionAttr(PW_REGION.catalog)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-added-catalog="1" data-pw-grid-kind="${kind}" data-pw-grid-cols="5" data-pw-grid-cols-mobile="2" data-pw-grid-rows="${rows}" data-limit="${pageSize}"${catalogAttr}${personalize} style="margin:0;padding:0;min-height:0;height:auto">
  <div class="pw-container" style="padding:12px 16px 16px">
    <h2 ${pwElAttr(PW_EL.sectionTitle)} style="margin:0">${escapeHtml(title)}</h2>
    <div data-pw-grid class="pw-product-grid" ${pwElAttr(PW_EL.grid)}>${cards}</div>
    ${gridMoreButtonHtml(loadMore)}
    <p class="pw-catalog-empty pw-personalize-empty" hidden></p>
  </div>
</section>`
}
