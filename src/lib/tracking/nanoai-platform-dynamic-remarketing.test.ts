import assert from 'node:assert/strict'
import test from 'node:test'
import { WEDDING_ADD_TO_CART_VALUE_VND } from '@/lib/wedding/wedding-commerce-events'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import {
  buildNanoAiDynamicRemarketingPage,
  clipNanoAiAdsItemId,
} from '@/lib/tracking/nanoai-platform-dynamic-remarketing'

test('home and search pages get a stable remarketing id', () => {
  assert.deepEqual(buildNanoAiDynamicRemarketingPage('/', null), {
    pagetype: 'home',
    contentId: 'feature_home',
    valueVnd: 0,
  })
  assert.deepEqual(buildNanoAiDynamicRemarketingPage('/?q=thiep', null), {
    pagetype: 'home',
    contentId: 'feature_home',
    valueVnd: 0,
  })
  const search = buildNanoAiDynamicRemarketingPage('/tim-kiem?q=ao', null)
  assert.equal(search.pagetype, 'searchresults')
  assert.equal(search.contentId, 'feature_tim_kiem')
  assert.equal(search.valueVnd, 0)
})

test('feature pages use the catalog id and feed price', () => {
  const wedding = buildNanoAiDynamicRemarketingPage(
    '/tao-thiep-moi-cuoi-ai/khach-moi',
    '/tao-thiep-moi-cuoi-ai'
  )
  assert.equal(wedding.pagetype, 'product')
  assert.equal(wedding.contentId, 'feature_tao_thiep_moi_cuoi_ai')
  assert.equal(wedding.valueVnd, WEDDING_ADD_TO_CART_VALUE_VND)

  const logo = buildNanoAiDynamicRemarketingPage('/thiet-ke-logo', '/thiet-ke-logo')
  assert.equal(logo.pagetype, 'product')
  assert.equal(logo.contentId, 'feature_thiet_ke_logo')
  assert.equal(logo.valueVnd, CREDIT_UNIT_PRICE_VND)
})

test('other pages use the path and ignore the query', () => {
  const page = buildNanoAiDynamicRemarketingPage('/bang-gia?email=a@b.com', null)
  assert.equal(page.pagetype, 'other')
  assert.equal(page.contentId, 'feature_bang_gia')
  assert.equal(page.valueVnd, 0)
  assert.equal(page.contentId.includes('email'), false)
})

test('item ids stay within 50 characters', () => {
  const longPath = `/${'muc-'.repeat(40)}`
  const page = buildNanoAiDynamicRemarketingPage(longPath, null)
  assert.equal(page.contentId.length <= 50, true)
  assert.match(page.contentId, /^[A-Za-z0-9_-]+$/)
  assert.equal(clipNanoAiAdsItemId(''), 'feature_other')
})
