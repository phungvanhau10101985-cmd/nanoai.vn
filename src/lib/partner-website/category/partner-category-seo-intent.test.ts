import assert from 'node:assert/strict'
import test from 'node:test'
import {
  partnerCategoryGenderToken,
  partnerCategoryIntentStem,
  partnerCategoryNameKey,
} from '@/lib/partner-website/category/partner-category-name-key'
import { buildPartnerCategorySeoTitle } from '@/lib/partner-website/category/partner-category-seo-ai'
import {
  findExactCategorySibling,
  findLocalSeoIntentSibling,
} from '@/lib/partner-website/category/partner-category-seo-intent'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'

function cat(partial: Partial<PartnerCategoryRow> & Pick<PartnerCategoryRow, 'id' | 'name' | 'slug'>): PartnerCategoryRow {
  return {
    partnerId: 'p',
    parentId: null,
    nameI18n: {},
    path: partial.slug,
    depth: 1,
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

test('nameKey bỏ dấu và gộp khoảng trắng', () => {
  assert.equal(partnerCategoryNameKey('Áo  Thun Nam'), 'ao thun nam')
  assert.equal(partnerCategoryIntentStem('Áo thun nam'), 'ao thun')
  assert.equal(partnerCategoryGenderToken('Áo thun nam'), 'nam')
  assert.equal(partnerCategoryGenderToken('Áo thun'), null)
})

test('khớp đúng tên / slug dưới cùng cha', () => {
  const rows = [cat({ id: '1', name: 'Áo thun nam', slug: 'ao-thun-nam' })]
  assert.equal(findExactCategorySibling(rows, null, 'Ao Thun Nam')?.id, '1')
  assert.equal(findExactCategorySibling(rows, 'other', 'Áo thun nam'), undefined)
})

test('đồng nghĩa cùng giới tính = cùng ý định SEO', () => {
  const rows = [cat({ id: '1', name: 'Áo thun nam', slug: 'ao-thun-nam' })]
  assert.equal(findLocalSeoIntentSibling(rows, null, 'T-shirt nam')?.id, '1')
  assert.equal(findLocalSeoIntentSibling(rows, null, 'Áo phông nam')?.id, '1')
})

test('khác giới tính hoặc generic vs có giới tính = khác ý định', () => {
  const rows = [
    cat({ id: '1', name: 'Áo thun nam', slug: 'ao-thun-nam' }),
    cat({ id: '2', name: 'Áo thun', slug: 'ao-thun' }),
  ]
  assert.equal(findLocalSeoIntentSibling(rows, null, 'Áo thun nữ'), undefined)
  assert.equal(findLocalSeoIntentSibling(rows, null, 'Áo thun nam')?.id, '1')
  assert.equal(findLocalSeoIntentSibling([rows[1]], null, 'Áo thun nam'), undefined)
})

test('seo title rút gọn có tên shop', () => {
  assert.equal(buildPartnerCategorySeoTitle('Áo thun nam', 'Nano Shop'), 'Áo thun nam | Nano Shop')
  assert.ok(buildPartnerCategorySeoTitle('A'.repeat(80), 'Shop').length <= 60)
})
