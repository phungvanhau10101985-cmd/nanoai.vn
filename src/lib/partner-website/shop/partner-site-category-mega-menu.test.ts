import assert from 'node:assert/strict'
import test from 'node:test'
import type { PartnerCategoryTreeNode } from '@/lib/partner-website/category/partner-category-types'
import {
  buildPartnerSiteCategoryMegaMenuHtml,
  buildPartnerSiteCategoryMobileAccordionHtml,
  compactPartnerCategorySizeSeoLabel,
  isPartnerCategoryCleanSizeSeoNode,
  isPartnerCategorySizeSeoNode,
  isPartnerCategoryWarehouseGroupNode,
  isPartnerShopMobileCategoryFace,
  PARTNER_KHO_SALE_NAV_ID,
  shouldSkipPartnerCategoryImportName,
  splitPartnerCategoryNavTree,
  takePartnerHorizontalNavTree,
  PARTNER_CATEGORY_MEGA_LAYOUT_CSS,
  PARTNER_HORIZONTAL_NAV_L1_LIMIT,
} from '@/lib/partner-website/shop/partner-site-category-mega-menu'

function node(
  id: string,
  name: string,
  slug: string,
  children: PartnerCategoryTreeNode[] = []
): PartnerCategoryTreeNode {
  return {
    id,
    partnerId: 'p',
    parentId: null,
    name,
    nameI18n: {},
    slug,
    path: slug,
    depth: 0,
    sortOrder: 0,
    isActive: true,
    imageUrl: '',
    description: '',
    descriptionI18n: {},
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
    children,
  }
}

test('isPartnerCategorySizeSeoNode matches Chi size / CHỈ SIZE / slug', () => {
  assert.equal(isPartnerCategorySizeSeoNode({ name: 'CHỈ SIZE 43', slug: 'chi-size-43' }), true)
  assert.equal(isPartnerCategorySizeSeoNode({ name: 'Chi size 34', slug: 'giay' }), true)
  assert.equal(isPartnerCategorySizeSeoNode({ name: 'chỉ size S', slug: 'chi-size-s' }), true)
  assert.equal(isPartnerCategorySizeSeoNode({ name: 'Giày dép Nam', slug: 'giay-dep-nam' }), false)
  assert.equal(isPartnerCategorySizeSeoNode({ name: 'Bảng size', slug: 'bang-size' }), false)
})

test('compactPartnerCategorySizeSeoLabel shortens CHI SIZE prefix', () => {
  assert.equal(compactPartnerCategorySizeSeoLabel('CHỈ SIZE 43'), 'Size 43')
  assert.equal(compactPartnerCategorySizeSeoLabel('Chi size 4XL'), 'Size 4XL')
})

test('warehouse group and dirty size SKU are junk, clean CHI SIZE is SEO', () => {
  assert.equal(isPartnerCategoryWarehouseGroupNode({ name: 'nam G04', slug: 'nam-g04' }), true)
  assert.equal(isPartnerCategoryWarehouseGroupNode({ name: 'nữ G05', slug: 'nu-g05' }), true)
  assert.equal(isPartnerCategoryWarehouseGroupNode({ name: 'Giày dép Nam', slug: 'giay-dep-nam' }), false)
  assert.equal(isPartnerCategoryCleanSizeSeoNode({ name: 'CHỈ SIZE 43', slug: 'chi-size-43' }), true)
  assert.equal(isPartnerCategoryCleanSizeSeoNode({ name: 'CHỈ SIZE M G06NAM', slug: 'chi-size-m-g06nam' }), false)
  assert.equal(shouldSkipPartnerCategoryImportName('nam G04'), true)
  assert.equal(shouldSkipPartnerCategoryImportName('CHỈ SIZE M G06NAM'), true)
  assert.equal(shouldSkipPartnerCategoryImportName('CHỈ SIZE 43'), true)
  assert.equal(shouldSkipPartnerCategoryImportName('Giày dép Nam'), false)
})

test('split keeps industry L1/L2/L3, hides Chỉ size L1, SEO only nested CHI SIZE', () => {
  const oxford = node('oxford', 'oxford nam buộc dây', 'oxford-nam-buoc-day')
  const sizeL3 = node('size-l3', 'CHỈ SIZE 41', 'chi-size-41')
  const dress = node('dress', 'Giày tây & công sở Nam', 'giay-tay-cong-so-nam', [oxford, sizeL3])
  const shoes = node('shoes', 'Giày dép Nam', 'giay-dep-nam', [dress])
  const sizeL1 = node('size-l1', 'Chi size 190', 'chi-size-190')
  const bags = node('bags', 'Túi xách nam', 'tui-xach-nam')
  const { menuTree, seoSizeNodes } = splitPartnerCategoryNavTree([sizeL1, shoes, bags], 'vi')
  assert.equal(menuTree[0]?.id, PARTNER_KHO_SALE_NAV_ID)
  assert.deepEqual(
    menuTree.slice(1).map((n) => n.name),
    ['Giày dép Nam', 'Túi xách nam']
  )
  assert.equal(menuTree[1]?.children[0]?.name, 'Giày tây & công sở Nam')
  assert.deepEqual(
    menuTree[1]?.children[0]?.children.map((n) => n.name),
    ['oxford nam buộc dây']
  )
  assert.deepEqual(
    seoSizeNodes.map((n) => n.id),
    ['size-l3']
  )
})

test('split hides warehouse SKUs, does not promote CHI SIZE children, injects Sale kho', () => {
  const tree = [
    node('dirty', 'CHỈ SIZE M G06NAM', 'chi-size-m-g06nam', [
      node('g04', 'nam G04', 'nam-g04'),
      node('g05', 'nữ G05', 'nu-g05'),
    ]),
    node('shoes', 'Giày dép Nam', 'giay-dep-nam'),
    node('clean', 'CHỈ SIZE 43', 'chi-size-43'),
  ]
  const { menuTree, seoSizeNodes } = splitPartnerCategoryNavTree(tree, 'vi')
  assert.equal(menuTree[0]?.id, PARTNER_KHO_SALE_NAV_ID)
  assert.deepEqual(
    menuTree.slice(1).map((n) => n.id),
    ['shoes']
  )
  assert.deepEqual(
    seoSizeNodes.map((n) => n.id),
    []
  )
})

test('mega menu HTML excludes CHI SIZE from the L1 column', () => {
  const html = buildPartnerSiteCategoryMegaMenuHtml({
    tree: [node('size-l1', 'CHỈ SIZE S', 'chi-size-s'), node('men', 'Thời trang Nam', 'thoi-trang-nam')],
    siteSlug: 'demo-shop',
    locale: 'vi',
    productsHref: '/site/demo-shop/products',
    saleHref: '/site/demo-shop/sale',
    copy: { newArrivals: 'Hàng mới', sale: 'Sale', hoverHint: 'hint', empty: '' },
  })
  assert.match(html, /Thời trang Nam/)
  assert.doesNotMatch(html, /CHỈ SIZE/)
  assert.doesNotMatch(html, /chi-size-s/)
})

test('mega menu HTML shows Sale kho pane like 188, not size SKUs', () => {
  const html = buildPartnerSiteCategoryMegaMenuHtml({
    tree: [
      node('dirty', 'CHỈ SIZE M G06NAM', 'chi-size-m-g06nam', [node('g04', 'nam G04', 'nam-g04')]),
      node('men', 'Giày dép Nam', 'giay-dep-nam'),
    ],
    siteSlug: 'demo-shop',
    locale: 'vi',
    productsHref: '/site/demo-shop/products',
    saleHref: '/site/demo-shop/sale',
    copy: {
      newArrivals: 'Hàng mới',
      sale: 'Sale',
      hoverHint: 'hint',
      empty: '',
      khoSale: 'Sale kho',
      khoSaleBlurb: 'Hàng hoàn và tồn thanh lý — giá ưu đãi, số lượng có hạn.',
      khoSaleViewAll: 'Xem tất cả →',
    },
  })
  assert.match(html, /Sale kho/)
  assert.match(html, /kho-sale/)
  assert.match(html, /Xem tất cả/)
  assert.match(html, /data-pw-kho-sale/)
  assert.doesNotMatch(html, /nam G04/)
  assert.doesNotMatch(html, /G06NAM/)
})

test('horizontal nav keeps Sale kho plus a short industry row', () => {
  const tree = [
    node('kho', 'Sale kho', 'kho-sale'),
    node('a', 'Giày dép Nữ', 'giay-dep-nu'),
    node('b', 'Thời trang Nam', 'thoi-trang-nam'),
    node('c', 'Thời trang Nữ', 'thoi-trang-nu'),
    node('d', 'Trang sức', 'trang-suc'),
    node('e', 'Túi xách Nam', 'tui-nam'),
    node('f', 'Túi xách Nữ', 'tui-nu'),
    node('g', 'Phụ kiện Nam', 'pk-nam'),
    node('h', 'Giày dép Nam', 'giay-dep-nam'),
    node('i', 'Đồng hồ', 'dong-ho'),
  ]
  const pills = takePartnerHorizontalNavTree(tree)
  assert.equal(pills.length, PARTNER_HORIZONTAL_NAV_L1_LIMIT)
  assert.equal(pills[0]?.id, 'kho')
  assert.equal(pills.some((n) => n.id === 'i'), false)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /text-transform:lowercase/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /overflow-x:hidden/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /data-pw-edit-device="mobile"/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /\.pw-shop-cat-panel\.is-open\.pw-cat-mega/)
  assert.doesNotMatch(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /html\[data-pw-edit-device="mobile"\] \.pw-shop-cat-panel\.pw-cat-mega,/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /720px/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /220px/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /data-pw-panel-fixed/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /pw-cat-mega-l1 a/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /pw-cat-mega-l2:hover/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /pw-cat-mega-l3:hover/)
  assert.match(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /color:var\(--pw-primary\)!important/)
  assert.doesNotMatch(PARTNER_CATEGORY_MEGA_LAYOUT_CSS, /@media \(max-width:899px\)/)
})

test('mobile category face is stamp-only — desktop tab stays desktop', () => {
  assert.equal(isPartnerShopMobileCategoryFace({ editDevice: 'mobile' }), true)
  assert.equal(isPartnerShopMobileCategoryFace({ sceneLock: 'mobile' }), true)
  assert.equal(isPartnerShopMobileCategoryFace({ queryDevice: 'mobile' }), true)
  assert.equal(isPartnerShopMobileCategoryFace({ editDevice: 'desktop', viewportMobile: true }), false)
  assert.equal(isPartnerShopMobileCategoryFace({ editDevice: 'tablet', viewportMobile: true }), false)
  assert.equal(isPartnerShopMobileCategoryFace({ editDevice: 'laptop', viewportMobile: true }), false)
  assert.equal(isPartnerShopMobileCategoryFace({ viewportMobile: true }), true)
  assert.equal(isPartnerShopMobileCategoryFace({ viewportMobile: false }), false)
})

test('mobile accordion HTML is 188 sheet, hides CHI SIZE / warehouse SKUs', () => {
  const oxford = node('oxford', 'oxford nam buộc dây', 'oxford-nam-buoc-day')
  const dress = node('dress', 'Giày tây & công sở Nam', 'giay-tay-cong-so-nam', [oxford])
  const shoes = node('shoes', 'Giày dép Nam', 'giay-dep-nam', [dress])
  const html = buildPartnerSiteCategoryMobileAccordionHtml({
    tree: [
      node('dirty', 'CHỈ SIZE M G06NAM', 'chi-size-m-g06nam', [node('g04', 'nam G04', 'nam-g04')]),
      shoes,
      node('size-l1', 'CHỈ SIZE S', 'chi-size-s'),
    ],
    siteSlug: 'demo-shop',
    locale: 'vi',
    productsHref: '/site/demo-shop/products',
    saleHref: '/site/demo-shop/sale',
    copy: {
      newArrivals: 'Hàng mới',
      sale: 'Sale',
      hoverHint: 'hint',
      empty: '',
      khoSale: 'Sale kho',
      hubTitle: 'Danh mục sản phẩm',
      close: 'Đóng',
    },
  })
  assert.match(html, /data-pw-cat-acc/)
  assert.match(html, /Danh mục sản phẩm/)
  assert.match(html, /pw-cat-acc-l2-grid/)
  assert.match(html, /Giày dép Nam/)
  assert.match(html, /oxford nam buộc dây/)
  assert.match(html, /Sale kho/)
  assert.doesNotMatch(html, /CHỈ SIZE/)
  assert.doesNotMatch(html, /nam G04/)
  assert.doesNotMatch(html, /G06NAM/)
})
