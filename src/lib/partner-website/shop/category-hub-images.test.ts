import assert from 'node:assert/strict'
import test from 'node:test'
import type { PartnerCategoryTreeNode } from '@/lib/partner-website/category/partner-category-types'
import {
  assignCategoryHubImages,
  buildViewedImagesByCategory,
  categoryDescendantIdMap,
  categoryParentIdMap,
} from '@/lib/partner-website/shop/category-hub-images'

function node(
  partial: Partial<PartnerCategoryTreeNode> & { id: string; name: string; path: string; depth: number }
): PartnerCategoryTreeNode {
  return {
    partnerId: 'p',
    parentId: null,
    nameI18n: {},
    slug: partial.path.split('/').pop() || partial.id,
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
    children: [],
    ...partial,
  }
}

const tree: PartnerCategoryTreeNode[] = [
  node({
    id: 'giay',
    name: 'Giày dép Nữ',
    path: 'giay-dep-nu',
    depth: 1,
    children: [
      node({
        id: 'cao-got',
        name: 'Giày cao gót Nữ',
        path: 'giay-dep-nu/cao-got',
        depth: 2,
        parentId: 'giay',
        children: [
          node({
            id: 'mui-nhon',
            name: 'cao gót nữ mũi nhọn cổ điển',
            path: 'giay-dep-nu/cao-got/mui-nhon',
            depth: 3,
            parentId: 'cao-got',
          }),
        ],
      }),
    ],
  }),
  node({
    id: 'tui',
    name: 'Túi xách',
    path: 'tui-xach',
    depth: 1,
  }),
]

test('keeps merchant category image and fills missing from viewed then sample', () => {
  const descendants = categoryDescendantIdMap(tree)
  const assigned = assignCategoryHubImages({
    tiles: [
      { id: 'giay', imageUrl: 'https://cdn.example/cat-own.jpg' },
      { id: 'mui-nhon', imageUrl: '' },
      { id: 'tui', imageUrl: '' },
    ],
    descendantIds: descendants,
    viewedImagesByCategory: new Map([['mui-nhon', ['https://cdn.example/viewed.jpg']]]),
    sampleImagesByCategory: new Map([
      ['tui', ['https://cdn.example/tui-a.jpg', 'https://cdn.example/tui-b.jpg']],
    ]),
  })
  assert.equal(assigned[0]?.imageUrl, 'https://cdn.example/cat-own.jpg')
  assert.equal(assigned[1]?.imageUrl, 'https://cdn.example/viewed.jpg')
  assert.match(assigned[2]?.imageUrl || '', /cdn\.example\/tui-/)
})

test('parent tile uses viewed image from a descendant product', () => {
  const descendants = categoryDescendantIdMap(tree)
  const assigned = assignCategoryHubImages({
    tiles: [{ id: 'giay', imageUrl: '' }],
    descendantIds: descendants,
    viewedImagesByCategory: new Map([['mui-nhon', ['https://cdn.example/heel.jpg']]]),
    sampleImagesByCategory: new Map(),
  })
  assert.equal(assigned[0]?.imageUrl, 'https://cdn.example/heel.jpg')
})

test('viewed images walk up to ancestors when building the map', () => {
  const parents = categoryParentIdMap(tree)
  const viewed = buildViewedImagesByCategory({
    viewedIds: ['inv-1'],
    imagesByInventoryId: new Map([['inv-1', 'https://cdn.example/p.jpg']]),
    categoryIdsByInventoryId: new Map([['inv-1', ['mui-nhon']]]),
    parentIdByCategory: parents,
  })
  assert.equal(viewed.get('mui-nhon')?.[0], 'https://cdn.example/p.jpg')
  assert.equal(viewed.get('cao-got')?.[0], 'https://cdn.example/p.jpg')
  assert.equal(viewed.get('giay')?.[0], 'https://cdn.example/p.jpg')
  assert.equal(viewed.has('tui'), false)
})

test('avoids reusing the same sample image when another is available', () => {
  const assigned = assignCategoryHubImages({
    tiles: [
      { id: 'a', imageUrl: '' },
      { id: 'b', imageUrl: '' },
    ],
    descendantIds: new Map(),
    viewedImagesByCategory: new Map(),
    sampleImagesByCategory: new Map([
      ['a', ['https://cdn.example/shared.jpg', 'https://cdn.example/a-only.jpg']],
      ['b', ['https://cdn.example/shared.jpg', 'https://cdn.example/b-only.jpg']],
    ]),
  })
  assert.notEqual(assigned[0]?.imageUrl, assigned[1]?.imageUrl)
  assert.ok(assigned.every((t) => t.imageUrl.startsWith('https://cdn.example/')))
})
