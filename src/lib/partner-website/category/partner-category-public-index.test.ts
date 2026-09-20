import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPartnerCategoryPublicIndexable,
  isPartnerCategoryStorefrontVisible,
  partnerCategoryHasGeneratedSeo,
  partnerCategoryRobotsContent,
  storedSeoIndexForTaxonomyCategory,
} from '@/lib/partner-website/category/partner-category-public-index'

test('empty categories stay off the storefront until they have products', () => {
  assert.equal(isPartnerCategoryStorefrontVisible({ productCount: 0 }), false)
  assert.equal(isPartnerCategoryStorefrontVisible({ productCount: 2 }), true)
  assert.equal(isPartnerCategoryStorefrontVisible({ productCount: 4, isNavJunk: true }), false)
})

test('L1/L2 index only when seo_index is on and the branch has products', () => {
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 1,
      seoIndex: true,
      productCount: 0,
      hasGeneratedSeo: false,
    }),
    false
  )
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 2,
      seoIndex: true,
      productCount: 0,
      hasGeneratedSeo: false,
    }),
    false
  )
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 1,
      seoIndex: true,
      productCount: 3,
      hasGeneratedSeo: false,
    }),
    true
  )
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 2,
      seoIndex: false,
      productCount: 10,
      hasGeneratedSeo: true,
    }),
    false
  )
})

test('L3 indexes only with products and generated SEO', () => {
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 3,
      seoIndex: true,
      productCount: 0,
      hasGeneratedSeo: true,
    }),
    false
  )
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 3,
      seoIndex: true,
      productCount: 4,
      hasGeneratedSeo: false,
    }),
    false
  )
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 3,
      seoIndex: true,
      productCount: 4,
      hasGeneratedSeo: true,
    }),
    true
  )
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 3,
      seoIndex: false,
      productCount: 4,
      hasGeneratedSeo: true,
    }),
    false
  )
})

test('nav junk is never indexable', () => {
  assert.equal(
    isPartnerCategoryPublicIndexable({
      depth: 1,
      seoIndex: true,
      productCount: 9,
      hasGeneratedSeo: true,
      isNavJunk: true,
    }),
    false
  )
})

test('generated SEO needs title + description + body', () => {
  assert.equal(partnerCategoryHasGeneratedSeo({ seoTitle: 'A', seoDescription: 'B', seoBody: 'C' }), true)
  assert.equal(partnerCategoryHasGeneratedSeo({ seoTitle: 'A', seoDescription: 'B', seoBody: '' }), false)
})

test('taxonomy import stores L3 index even when 188 file says noindex', () => {
  assert.equal(storedSeoIndexForTaxonomyCategory(3, false), true)
  assert.equal(storedSeoIndexForTaxonomyCategory(1, false), false)
  assert.equal(storedSeoIndexForTaxonomyCategory(2, true), true)
})

test('empty L3 robots are noindex,follow', () => {
  assert.equal(partnerCategoryRobotsContent(true), 'index, follow, max-image-preview:large, max-snippet:-1')
  assert.equal(partnerCategoryRobotsContent(false, true), 'noindex, follow')
  assert.equal(partnerCategoryRobotsContent(false, false), 'noindex, nofollow')
})
