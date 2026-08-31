import assert from 'node:assert/strict'
import test from 'node:test'
import type { PartnerCategoryTreeNode } from '@/lib/partner-website/category/partner-category-types'
import {
  featuredCategoryGenderLabel,
  flattenFeaturedCategoryCandidates,
  inferApparelGenderFromCandidates,
  pickFeaturedCategoryTiles,
  shortFeaturedCategoryName,
  tokenOverlapScore,
  type FeaturedCategoryCandidate,
} from '@/lib/partner-website/shop/featured-categories'

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

test('strips gender suffix and ellipsizes long names', () => {
  assert.equal(shortFeaturedCategoryName('Áo sơ mi Nam'), 'Áo sơ mi')
  assert.equal(shortFeaturedCategoryName('sơ mi nam dài tay formal office'), 'sơ mi nam dài tay for…')
})

test('scores overlapping tokens like 188', () => {
  assert.ok(tokenOverlapScore('Áo sơ mi nam', 'sơ mi nam dài tay') >= 2)
  assert.equal(tokenOverlapScore('Giày', 'Túi xách'), 0)
})

test('flattens L2/L3 with ancestor gender and skips Sale kho', () => {
  const tree: PartnerCategoryTreeNode[] = [
    node({
      id: 'kho',
      name: 'Sale kho',
      path: 'kho-sale',
      slug: 'kho-sale',
      depth: 1,
      children: [],
    }),
    node({
      id: 'nam',
      name: 'Thời trang nam',
      path: 'thoi-trang-nam',
      depth: 1,
      children: [
        node({
          id: 'somi',
          name: 'Áo sơ mi',
          path: 'thoi-trang-nam/ao-so-mi',
          depth: 2,
          parentId: 'nam',
          children: [
            node({
              id: 'dai',
              name: 'sơ mi nam dài tay',
              path: 'thoi-trang-nam/ao-so-mi/dai-tay',
              depth: 3,
              parentId: 'somi',
            }),
          ],
        }),
      ],
    }),
  ]
  const counts = new Map([
    ['somi', 4],
    ['dai', 2],
  ])
  const flat = flattenFeaturedCategoryCandidates(tree, counts, 'vi', new Set(['somi']))
  assert.equal(
    flat.some((c) => c.id === 'kho'),
    false
  )
  const l2 = flat.find((c) => c.id === 'somi')
  assert.ok(l2)
  assert.equal(l2?.gender, 'male')
  assert.equal(l2?.viewed, true)
  assert.equal(l2?.productCount, 6)
  assert.equal(flat.find((c) => c.id === 'dai')?.level, 3)
})

test('picks half L2 and half L3 for the matching gender', () => {
  const candidates: FeaturedCategoryCandidate[] = [
    { id: 'l2a', name: 'Áo sơ mi', path: 'a/so-mi', level: 2, productCount: 10, gender: 'male', imageUrl: '', viewed: true },
    { id: 'l2b', name: 'Quần dài', path: 'a/quan', level: 2, productCount: 8, gender: 'male', imageUrl: '', viewed: false },
    { id: 'l2c', name: 'Áo khoác', path: 'a/khoac', level: 2, productCount: 6, gender: 'male', imageUrl: '', viewed: false },
    { id: 'l3a', name: 'oxford nam', path: 'a/giay/oxford', level: 3, productCount: 5, gender: 'male', imageUrl: '', viewed: false },
    { id: 'l3b', name: 'polo nam', path: 'a/ao/polo', level: 3, productCount: 4, gender: 'male', imageUrl: '', viewed: false },
    { id: 'l3c', name: 'giày lười nam', path: 'a/giay/luoi', level: 3, productCount: 3, gender: 'male', imageUrl: '', viewed: false },
    { id: 'nu', name: 'Váy', path: 'nu/vay', level: 2, productCount: 99, gender: 'female', imageUrl: '', viewed: false },
  ]
  const picked = pickFeaturedCategoryTiles({ candidates, gender: 'male', limit: 4 })
  assert.equal(picked.length, 4)
  assert.equal(picked.filter((c) => c.level === 2).length, 2)
  assert.equal(picked.filter((c) => c.level === 3).length, 2)
  assert.equal(
    picked.some((c) => c.id === 'nu'),
    false
  )
  assert.equal(picked[0]?.id, 'l2a')
})

test('infers gender from viewed candidates and falls back without gender', () => {
  const viewed: FeaturedCategoryCandidate[] = [
    { id: '1', name: 'Áo nam', path: 'ao', level: 2, productCount: 1, gender: 'male', imageUrl: '', viewed: true },
    { id: '2', name: 'Giày nam', path: 'giay', level: 2, productCount: 1, gender: 'male', imageUrl: '', viewed: true },
    { id: '3', name: 'Váy', path: 'vay', level: 2, productCount: 1, gender: 'female', imageUrl: '', viewed: true },
  ]
  assert.equal(inferApparelGenderFromCandidates(viewed), 'male')
  assert.equal(featuredCategoryGenderLabel('female'), 'Nữ')
  const mixed: FeaturedCategoryCandidate[] = [
    { id: 'a', name: 'Túi', path: 'tui', level: 2, productCount: 3, gender: null, imageUrl: '', viewed: false },
    { id: 'b', name: 'Phụ kiện', path: 'pk', level: 2, productCount: 2, gender: null, imageUrl: '', viewed: false },
  ]
  const picked = pickFeaturedCategoryTiles({ candidates: mixed, gender: null, limit: 4 })
  assert.equal(picked.length, 2)
})
