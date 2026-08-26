import assert from 'node:assert/strict'
import test from 'node:test'
import type { PartnerCategoryTreeNode } from '@/lib/partner-website/category/partner-category-types'
import {
  buildPartnerSiteCategoryMegaMenuHtml,
  compactPartnerCategorySizeSeoLabel,
  isPartnerCategorySizeSeoNode,
  splitPartnerCategoryNavTree,
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

test('splitPartnerCategoryNavTree pulls CHI SIZE from any depth into one SEO list', () => {
  const tree = [
    node('shoes', 'Giày dép Nam', 'giay-dep-nam', [
      node('boot', 'Boot Nam', 'boot-nam', [node('size-l3', 'CHỈ SIZE 41', 'chi-size-41')]),
    ]),
    node('size-l1', 'Chi size 190', 'chi-size-190'),
    node('bags', 'Túi xách nam', 'tui-xach-nam'),
  ]
  const { menuTree, seoSizeNodes } = splitPartnerCategoryNavTree(tree)
  assert.deepEqual(
    menuTree.map((n) => n.id),
    ['shoes', 'bags']
  )
  assert.equal(menuTree[0]?.children[0]?.id, 'boot')
  assert.equal(menuTree[0]?.children[0]?.children.length, 0)
  assert.deepEqual(
    seoSizeNodes.map((n) => n.id),
    ['size-l3', 'size-l1']
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
