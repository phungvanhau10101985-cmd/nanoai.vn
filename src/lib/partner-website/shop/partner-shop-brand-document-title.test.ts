import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopBrandDocumentTitle,
  partnerShopBrandHostname,
} from '@/lib/partner-website/shop/partner-shop-brand-document-title'

test('partnerShopBrandHostname prefers apex and rejects NanoAI hosts', () => {
  assert.equal(partnerShopBrandHostname('www.gudo.vn'), 'gudo.vn')
  assert.equal(partnerShopBrandHostname('https://gudo.vn/login'), 'gudo.vn')
  assert.equal(partnerShopBrandHostname('nanoai.vn'), '')
  assert.equal(partnerShopBrandHostname('https://nanoai.vn/site/gudo-vn-3f93/login'), '')
})

test('buildPartnerShopBrandDocumentTitle is domain + slogan without NanoAI or Login', () => {
  assert.equal(
    buildPartnerShopBrandDocumentTitle({
      hostname: 'www.gudo.vn',
      slogan: 'Xem là thích click là mê',
      fallbackName: 'Gudo',
    }),
    'gudo.vn — Xem là thích click là mê'
  )
  assert.equal(
    buildPartnerShopBrandDocumentTitle({
      hostname: 'nanoai.vn',
      slogan: 'Xem là thích click là mê',
      fallbackName: 'gudo.vn',
    }),
    'gudo.vn — Xem là thích click là mê'
  )
  assert.equal(
    buildPartnerShopBrandDocumentTitle({
      hostname: '',
      slogan: '',
      fallbackName: 'Gudo',
    }),
    'Gudo'
  )
  assert.doesNotMatch(
    buildPartnerShopBrandDocumentTitle({
      hostname: 'gudo.vn',
      slogan: 'Xem là thích click là mê',
    }),
    /NanoAI|Login/i
  )
})
