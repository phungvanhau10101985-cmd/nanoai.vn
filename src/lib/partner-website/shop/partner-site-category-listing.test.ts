import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerCategoryCanonicalQuery,
  buildPartnerCategoryListingSearch,
  parsePartnerCategoryListingFromRecord,
  parsePartnerCategoryListingSort,
  partnerCategoryListingOffset,
  PARTNER_CATEGORY_PAGE_SIZE,
} from '@/lib/partner-website/shop/partner-site-category-listing'
import {
  prunePartnerCategoriesMissingAncestors,
  rollupPartnerCategoryProductCounts,
  buildPartnerCategoryTree,
  type PartnerCategoryRow,
} from '@/lib/partner-website/category/partner-category-types'
import { buildPartnerSiteCategoryMegaMenuHtml } from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { WEB_LOCALES } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

function row(partial: Partial<PartnerCategoryRow> & Pick<PartnerCategoryRow, 'id' | 'name' | 'slug' | 'path'>): PartnerCategoryRow {
  return {
    partnerId: 'p1',
    parentId: null,
    depth: 1,
    sortOrder: 0,
    isActive: true,
    imageUrl: '',
    description: '',
    descriptionI18n: {},
    nameI18n: {},
    seoTitle: '',
    seoDescription: '',
    seoIndex: true,
    seoBody: '',
    seoBodyGeneratedAt: null,
    seoBodyGeneratedLocale: null,
    sizeGuideImageUrl: '',
    aiGenerated: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

test('sort parser matches 188 labels', () => {
  assert.equal(parsePartnerCategoryListingSort(''), 'random')
  assert.equal(parsePartnerCategoryListingSort('newest'), 'newest')
  assert.equal(parsePartnerCategoryListingSort('oldest'), 'oldest')
  assert.equal(parsePartnerCategoryListingSort('views_desc'), 'views_desc')
})

test('canonical query uses 188 whitelist order and drops page=1', () => {
  const q = parsePartnerCategoryListingFromRecord({
    sort: 'oldest',
    page: '1',
    min_price: '100000',
    size: 'M',
    color: 'den',
    r: 'seed',
  })
  assert.equal(buildPartnerCategoryCanonicalQuery(q), 'color=den&min_price=100000&size=M&sort=oldest')
  assert.doesNotMatch(buildPartnerCategoryCanonicalQuery(q), /[?&]r=/)
})

test('listing search keeps snake_case like 188', () => {
  const s = buildPartnerCategoryListingSearch({ sort: 'views_desc', page: 2, minPrice: 10, size: 'L' })
  assert.match(s, /min_price=10/)
  assert.match(s, /sort=views_desc/)
  assert.match(s, /page=2/)
  assert.equal(partnerCategoryListingOffset({ ...parsePartnerCategoryListingFromRecord({ page: '2' }), sort: 'newest' }), PARTNER_CATEGORY_PAGE_SIZE)
})

test('prune drops orphans when parent is inactive/missing', () => {
  const kept = prunePartnerCategoriesMissingAncestors([
    row({ id: '1', name: 'Ao', slug: 'ao', path: 'ao' }),
    row({ id: '2', name: 'Thun', slug: 'thun', path: 'ao/thun', parentId: '1', depth: 2 }),
    row({ id: '3', name: 'Mo coi', slug: 'mo', path: 'mat/mo', parentId: 'missing', depth: 2 }),
  ])
  assert.equal(kept.length, 2)
  assert.ok(!kept.some((c) => c.id === '3'))
})

test('rollup counts include descendants', () => {
  const tree = buildPartnerCategoryTree([
    row({ id: '1', name: 'Ao', slug: 'ao', path: 'ao' }),
    row({ id: '2', name: 'Thun', slug: 'thun', path: 'ao/thun', parentId: '1', depth: 2 }),
  ])
  const rolled = rollupPartnerCategoryProductCounts(tree, new Map([['2', 5]]))
  assert.equal(rolled.get('1'), 5)
  assert.equal(rolled.get('2'), 5)
})

test('mega menu html is 2-column L1 | L2/L3', () => {
  const tree = buildPartnerCategoryTree([
    row({ id: '1', name: 'Áo', slug: 'ao', path: 'ao' }),
    row({ id: '2', name: 'Áo thun', slug: 'ao-thun', path: 'ao/ao-thun', parentId: '1', depth: 2 }),
    row({ id: '3', name: 'Áo thun nam', slug: 'nam', path: 'ao/ao-thun/nam', parentId: '2', depth: 3 }),
  ])
  const html = buildPartnerSiteCategoryMegaMenuHtml({
    tree,
    siteSlug: 'shop',
    locale: 'vi',
    productsHref: '/site/shop/products',
    saleHref: '/site/shop/sale',
    copy: { newArrivals: 'Hàng mới', sale: 'Sale', hoverHint: 'Hint', empty: 'Empty' },
  })
  assert.match(html, /pw-cat-mega-cols/)
  assert.match(html, /pw-cat-mega-l1/)
  assert.match(html, /pw-cat-mega-l23/)
  assert.match(html, /pw-cat-mega-l2/)
  assert.match(html, /pw-cat-mega-l3/)
  assert.match(html, /ao-thun/)
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  const megaCss = css.slice(css.indexOf('.pw-cat-mega-cols'))
  assert.match(css, /pw-cat-mega-cols/)
  assert.match(megaCss.slice(0, 1800), /--pw-primary|--pw-surface|--pw-buy/)
  assert.match(css, /pw-cat-mega-l2:hover/)
  assert.match(css, /pw-cat-mega-l3:hover/)
  assert.match(css, /color:var\(--pw-primary\)!important/)
  assert.match(css, /text-transform:lowercase/)
  assert.match(css, /overflow-x:hidden/)
  assert.match(css, /\.pw-shop-category-tiles\{display:none!important\}/)
  assert.match(css, /\.pw-shop-category-hub\{display:grid/)
})

test('category listing copy exists for all locales', () => {
  for (const locale of WEB_LOCALES) {
    const t = getPartnerSiteShopCopy(locale)
    assert.ok(t.categorySortRandom)
    assert.ok(t.categorySortOldest)
    assert.ok(t.categorySortViews)
    assert.ok(t.categoryMegaHint)
    assert.ok(t.khoSaleNavLabel)
    assert.ok(t.khoSaleNavBlurb)
    assert.ok(t.khoSaleViewAll)
    assert.ok(t.categorySeoRowAria)
    assert.ok(t.categoryExpand)
    assert.ok(t.categoryCollapse)
    assert.ok(t.categoryHubTitle)
  }
})
