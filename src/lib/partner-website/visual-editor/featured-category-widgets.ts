import type { WebLocale } from '@/lib/i18n/config'
import { FEATURED_CATEGORY_TILE_DEFAULT } from '@/lib/partner-website/shop/featured-categories-constants'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteCategoryHubPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  clampProductGridRows,
  productGridColsForDevice,
  productGridPageSize,
  type PartnerProductGridDevice,
} from '@/lib/partner-website/shop/pw-product-grid-page'
import { PW_KIND_SCENE_MEDIA, pwKindSceneAttr } from '@/lib/partner-website/visual-editor/pw-kind-scene'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const PLACEHOLDER_NAMES: Record<WebLocale, string[]> = {
  vi: ['Áo sơ mi', 'Giày tây', 'Áo khoác', 'Áo thun & polo', 'Quần dài'],
  en: ['Shirts', 'Dress shoes', 'Jackets', 'Tees & polos', 'Trousers'],
  zh: ['衬衫', '皮鞋', '外套', 'T恤 Polo', '长裤'],
  ja: ['シャツ', '革靴', 'ジャケット', 'ポロ', 'パンツ'],
  ko: ['셔츠', '구두', '재킷', '폴로', '바지'],
}

function placeholderTiles(count: number, locale: WebLocale, clone = false): string {
  const names = PLACEHOLDER_NAMES[locale] || PLACEHOLDER_NAMES.vi
  const n = Math.max(4, Math.min(20, count))
  let out = ''
  for (let i = 0; i < n; i += 1) {
    const name = names[i % names.length] || names[0]
    const contract = clone
      ? ''
      : ` ${pwElAttr(PW_EL.card)} data-pw-grid-placeholder="1"`
    const media = clone ? '' : ` ${pwElAttr(PW_EL.cardMedia)}`
    const label = clone ? '' : ` ${pwElAttr(PW_EL.cardName)}`
    out += `<a class="pw-featured-cat-card"${contract} href="#">
  <span class="pw-featured-cat-media"${media}></span>
  <span${label}>${escapeHtml(name)}</span>
</a>`
  }
  return out
}

/** Stamp seed `pw-categories` / fashion `categoryName:0` so live hydrates the same API. */
export function ensureFeaturedCategoriesHostInHtml(html: string): string {
  if (!html) return html
  let out = html.replace(/<(section|div)\b([^>]*\bpw-categories\b[^>]*)>/gi, (full, tag: string, attrs: string) => {
    if (/\bdata-pw-featured-categories=/.test(attrs)) return full
    return `<${tag}${attrs} data-pw-featured-categories="1" data-pw-grid-kind="featured-categories">`
  })
  if (/data-pw-edit=["']categoryName:/.test(out)) {
    out = out.replace(/<(section|div)\b([^>]*\bdata-pw-region=["']categories["'][^>]*)>/gi, (full, tag: string, attrs: string) => {
      if (/\bdata-pw-featured-categories=/.test(attrs)) return full
      return `<${tag}${attrs} data-pw-featured-categories="1" data-pw-grid-kind="featured-categories">`
    })
  }
  out = out.replace(/<div\b([^>]*\bpw-cat-grid\b[^>]*)>/gi, (full, attrs: string) => {
    if (/\bdata-pw-grid(?:[=:\s>]|$)/.test(attrs) || /\bdata-pw-grid=/.test(attrs)) return full
    return `<div${attrs} data-pw-grid data-pw-el="grid">`
  })
  return out
}

/** Lưu Sửa nhanh: bỏ bản nhân marquee — không đóng băng clone vào HTML. */
export function stripFeaturedCategoryMarqueeClonesInDocument(root: ParentNode): void {
  root.querySelectorAll('[data-pw-featured-clone]').forEach((el) => el.remove())
}

/** Live first paint: nhân lưới để animation 188 chạy ngay, không đợi JS. */
export function appendFeaturedMarqueeCloneHtml(inner: string): string {
  if (!inner) return inner
  const stripped = inner.replace(/<div\b[^>]*\bdata-pw-featured-clone\b[^>]*>[\s\S]*?<\/div>/gi, '')
  const gridRe = /<div\b([^>]*\bdata-pw-grid\b[^>]*)>([\s\S]*?)<\/div>/i
  const match = stripped.match(gridRe)
  if (!match) return stripped
  const cards = match[2] || ''
  const clone = `<div class="pw-featured-cat-grid" data-pw-featured-clone="1" aria-hidden="true">${cards}</div>`
  return stripped.replace(gridRe, `${match[0]}${clone}`)
}

/** Lưu Sửa nhanh: trả tên/ảnh/href mẫu, bỏ chữ vừa hydrate từ API. */
export function restoreFeaturedCategorySeedsInDocument(root: ParentNode): void {
  stripFeaturedCategoryMarqueeClonesInDocument(root)
  const cards = root.querySelectorAll('[data-pw-seed-name], [data-pw-seed-href], [data-pw-seed-src]')
  cards.forEach((card) => {
    const name = card.getAttribute('data-pw-seed-name')
    const href = card.getAttribute('data-pw-seed-href')
    const src = card.getAttribute('data-pw-seed-src')
    if (name != null) {
      const nameEl = card.querySelector('[data-pw-el="card-name"], [data-pw-edit^="categoryName"]')
      if (nameEl) nameEl.textContent = name
    }
    if (href != null && card.tagName === 'A') {
      if (href) card.setAttribute('href', href)
      else card.removeAttribute('href')
    }
    if (src != null) {
      const img = card.querySelector('img')
      if (img) {
        if (src) img.setAttribute('src', src)
        else img.removeAttribute('src')
      }
    }
    card.removeAttribute('data-pw-seed-name')
    card.removeAttribute('data-pw-seed-href')
    card.removeAttribute('data-pw-seed-src')
    if (card.getAttribute('hidden') === '') card.removeAttribute('hidden')
  })
}

/** In-flow featured category grid for Sửa nhanh «Thêm». Live hydrates via personalization bootstrap. */
export function buildVisualEditorFeaturedCategoriesHtml(input: {
  siteSlug: string
  locale?: WebLocale
  rows?: number
  device?: PartnerProductGridDevice | string | null
  limit?: number
}): string {
  const locale = input.locale && input.locale in PLACEHOLDER_NAMES ? input.locale : 'vi'
  const rows = clampProductGridRows(input.rows ?? 2)
  const cols = productGridColsForDevice(input.device)
  const pageSize = productGridPageSize(rows, cols)
  const limit = Math.max(
    FEATURED_CATEGORY_TILE_DEFAULT,
    pageSize,
    Math.min(20, Math.floor(Number(input.limit) || FEATURED_CATEGORY_TILE_DEFAULT))
  )
  const copy = getPartnerSiteShopCopy(locale)
  const seeAll = copy.featuredCategoriesSeeAll
  const href = partnerSiteCategoryHubPath(input.siteSlug)
  const chevron =
    '<svg class="pw-featured-cat-all-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>'
  const tiles = placeholderTiles(limit, locale)
  const cloneTiles = placeholderTiles(limit, locale, true)
  return `<section class="pw-featured-cat" ${pwRegionAttr(PW_REGION.categories)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-featured-categories="1" data-pw-grid-kind="featured-categories" data-pw-grid-cols="5" data-pw-grid-cols-mobile="2" data-pw-grid-rows="${rows}" data-limit="${limit}" style="margin:0;padding:0">
  <div class="pw-featured-cat-inner">
    <div class="pw-featured-cat-viewport" data-pw-featured-viewport="1">
      <div class="pw-featured-cat-marquee" data-pw-featured-marquee="1">
        <div data-pw-grid class="pw-featured-cat-grid" ${pwElAttr(PW_EL.grid)}>${tiles}</div>
        <div class="pw-featured-cat-grid" data-pw-featured-clone="1" aria-hidden="true">${cloneTiles}</div>
      </div>
    </div>
    <div class="pw-featured-cat-actions" data-pw-grid-actions>
      <a class="pw-featured-cat-all" ${pwElAttr(PW_EL.sectionMore)} href="${escapeHtml(href)}"><span>${escapeHtml(seeAll)}</span>${chevron}</a>
    </div>
    <p class="pw-featured-cat-empty pw-personalize-empty" hidden></p>
  </div>
</section>`
}
