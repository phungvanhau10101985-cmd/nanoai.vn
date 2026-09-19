import assert from 'node:assert/strict'
import test from 'node:test'
import { getListingDraftPublishBlockers } from '@/lib/messaging/listing-import/listing-draft-publish-validation'
import { listingImportOverlayTitle } from '@/lib/messaging/listing-import/listing-import-taxonomy'
import {
  CATEGORY_AUTO_CREATE_DISABLED,
  CATEGORY_AUTO_CREATE_DISABLED_MESSAGE,
  findExistingCategoryTripleLeaf,
} from '@/lib/partner-website/category/partner-category-place-product'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'

function cat(partial: Partial<PartnerCategoryRow> & Pick<PartnerCategoryRow, 'id' | 'name' | 'depth'>): PartnerCategoryRow {
  return {
    partnerId: 'p1',
    parentId: null,
    nameI18n: {},
    slug: partial.name.toLowerCase().replace(/\s+/g, '-'),
    path: `/${partial.name.toLowerCase().replace(/\s+/g, '-')}`,
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
    ...partial,
  }
}

test('listing overlay title prefers chinese_name then name then title', () => {
  assert.equal(listingImportOverlayTitle(null), '')
  assert.equal(listingImportOverlayTitle({ chinese_name: '碎花裙', name: 'Váy' }), '碎花裙')
  assert.equal(listingImportOverlayTitle({ name: 'Váy hoa' }), 'Váy hoa')
  assert.equal(listingImportOverlayTitle({ title: 'Dress' }), 'Dress')
})

test('findExistingCategoryTripleLeaf requires full L1/L2/L3 exact siblings', () => {
  const l1 = cat({ id: '1', name: 'Thời trang Nữ', depth: 1, parentId: null, path: '/thoi-trang-nu' })
  const l2 = cat({
    id: '2',
    name: 'Đầm',
    depth: 2,
    parentId: '1',
    path: '/thoi-trang-nu/dam',
  })
  const l3 = cat({
    id: '3',
    name: 'Đầm voan',
    depth: 3,
    parentId: '2',
    path: '/thoi-trang-nu/dam/dam-voan',
  })
  const rows = [l1, l2, l3]
  assert.equal(findExistingCategoryTripleLeaf(rows, 'Thời trang Nữ', 'Đầm', 'Đầm voan')?.id, '3')
  assert.equal(findExistingCategoryTripleLeaf(rows, 'Thời trang Nữ', 'Đầm', 'Đầm suông'), null)
  assert.equal(findExistingCategoryTripleLeaf(rows, 'Thời trang Nữ', 'Đầm', ''), null)
  assert.equal(CATEGORY_AUTO_CREATE_DISABLED, 'CATEGORY_AUTO_CREATE_DISABLED')
})

test('listing draft publish is blocked when taxonomy auto-create failed', () => {
  const issues = getListingDraftPublishBlockers({
    _taxonomy_error: CATEGORY_AUTO_CREATE_DISABLED,
    chinese_name: '碎花裙',
    shop_name_chinese: '店铺',
    category: 'Thời trang Nữ',
    subcategory: 'Đầm',
    sub_subcategory: 'Đầm voan',
    images: ['https://cdn.example/a.jpg'],
    gallery: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    main_image: 'https://cdn.example/a.jpg',
  })
  assert.ok(issues.some((m) => m.includes('bật')))
  assert.ok(issues.some((m) => m.includes('Không cào')))
  assert.equal(issues[0], CATEGORY_AUTO_CREATE_DISABLED_MESSAGE)
})
