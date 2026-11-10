import assert from 'node:assert/strict'
import test from 'node:test'
import {
  metaPixelInitArgsJs,
  partnerSiteMetaAmStorageKey,
  partnerSiteMetaMatchingParams,
} from '@/lib/partner-website/shop/partner-site-meta-advanced-matching'
import { META_AUTOMATIC_MATCHING_FIELDS, metaAutomaticMatchingUpdateBody } from '@/lib/tracking/meta-pixel-automatic-matching'

test('advanced matching normalizes the fields Meta lists and skips placeholders', () => {
  const params = partnerSiteMetaMatchingParams({
    email: ' Buyer@Example.com ',
    phone: '0912345678',
    fullName: 'Nguyễn Thị Mai',
    gender: 'female',
    dateOfBirth: '1991-05-26',
    shippingAddress: '12 Lê Lợi, Hà Nội',
    externalId: '11111111-1111-4111-8111-111111111111',
  })
  assert.equal(params.em, 'buyer@example.com')
  assert.equal(params.ph, '84912345678')
  assert.equal(params.ln, 'nguyen')
  assert.equal(params.fn, 'thi mai')
  assert.equal(params.ge, 'f')
  assert.equal(params.db, '19910526')
  assert.equal(params.st, 'hanoi')
  assert.equal(params.ct, 'hanoi')
  assert.equal(params.country, 'vn')
  assert.equal(params.external_id, '11111111-1111-4111-8111-111111111111')
  assert.equal(params.zp, undefined)
})

test('advanced matching keeps a 6-digit postal code written in the address', () => {
  const params = partnerSiteMetaMatchingParams({
    shippingAddress: '12 Lê Lợi, 700000, Hà Nội',
    phone: '0912345678',
  })
  assert.equal(params.zp, '700000')
  assert.equal(params.st, 'hanoi')
  assert.equal(params.country, 'vn')
})

test('advanced matching does not invent country from email alone', () => {
  const params = partnerSiteMetaMatchingParams({ email: 'buyer@example.com' })
  assert.deepEqual(params, { em: 'buyer@example.com' })
})

test('advanced matching drops a future birthday and an email used as external id', () => {
  const params = partnerSiteMetaMatchingParams({
    dateOfBirth: '2999-01-01',
    externalId: 'buyer@example.com',
    state: 'Bình Dương',
    city: 'Thủ Dầu Một',
  })
  assert.equal(params.db, undefined)
  assert.equal(params.external_id, undefined)
  assert.equal(params.st, 'binhduong')
  assert.equal(params.ct, 'thudaumot')
  assert.equal(params.country, 'vn')
})

test('pixel init reads stored customer data and does not embed a sample email', () => {
  const js = metaPixelInitArgsJs('1282319314072647', '188-com-vn')
  assert.equal(partnerSiteMetaAmStorageKey('188-Com-Vn'), 'pw_meta_am:188-com-vn')
  assert.match(js, /pw_meta_am:188-com-vn/)
  assert.match(js, /'em','ph','fn','ln','ge','db','ct','st','zp','country','external_id'/)
  assert.match(js, /ud=\{em:'',ph:'',fn:'',ln:'',ge:'',db:'',ct:'',st:'',zp:'',country:'',external_id:''\}/)
  assert.doesNotMatch(js, /email@email\.com/)
})

test('automatic matching update asks Meta for every customer field in the checklist', () => {
  const body = metaAutomaticMatchingUpdateBody('token-value-not-logged')
  assert.equal(body.enable_automatic_matching, true)
  assert.deepEqual(
    body.automatic_matching_fields,
    ['em', 'ph', 'fn', 'ln', 'ge', 'db', 'ct', 'st', 'zp', 'country', 'external_id']
  )
  assert.deepEqual([...META_AUTOMATIC_MATCHING_FIELDS], body.automatic_matching_fields)
})
