import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isRegistrableApexHostname,
  partnerCustomDomainApexPair,
  partnerCustomDomainHostLookupNames,
  partnerCustomDomainHostsMatch,
  partnerCustomDomainPublicOrigin,
  partnerCustomDomainSeoHostname,
  partnerCustomDomainWwwApexSibling,
  rewritePartnerCustomDomainOriginForSeo,
} from './partner-custom-domain-hostname'

test('www and apex are siblings for shop domains', () => {
  assert.equal(partnerCustomDomainWwwApexSibling('www.tiemanhai.vn'), 'tiemanhai.vn')
  assert.equal(partnerCustomDomainWwwApexSibling('tiemanhai.vn'), 'www.tiemanhai.vn')
  assert.equal(partnerCustomDomainWwwApexSibling('shop.example.com'), 'www.shop.example.com')
})

test('lookup names include both www and apex', () => {
  assert.deepEqual(partnerCustomDomainHostLookupNames('www.tiemanhai.vn'), [
    'www.tiemanhai.vn',
    'tiemanhai.vn',
  ])
  assert.deepEqual(partnerCustomDomainHostLookupNames('tiemanhai.vn'), [
    'tiemanhai.vn',
    'www.tiemanhai.vn',
  ])
})

test('hosts match across www and apex', () => {
  assert.equal(partnerCustomDomainHostsMatch('www.tiemanhai.vn', 'tiemanhai.vn'), true)
  assert.equal(partnerCustomDomainHostsMatch('tiemanhai.vn', 'www.tiemanhai.vn'), true)
  assert.equal(partnerCustomDomainHostsMatch('www.tiemanhai.vn', 'www.tiemanhai.vn'), true)
  assert.equal(partnerCustomDomainHostsMatch('tiemanhai.vn', 'other.vn'), false)
})

test('apex pair is only for registrable root domains', () => {
  assert.deepEqual(partnerCustomDomainApexPair('www.tiemanhai.vn'), {
    apex: 'tiemanhai.vn',
    www: 'www.tiemanhai.vn',
  })
  assert.deepEqual(partnerCustomDomainApexPair('tiemanhai.vn'), {
    apex: 'tiemanhai.vn',
    www: 'www.tiemanhai.vn',
  })
  assert.equal(partnerCustomDomainApexPair('shop.example.com'), null)
  assert.equal(isRegistrableApexHostname('tiemanhai.vn'), true)
  assert.equal(isRegistrableApexHostname('www.tiemanhai.vn'), false)
  assert.equal(isRegistrableApexHostname('shop.example.com'), false)
})

test('SEO hostname prefers apex without www', () => {
  assert.equal(partnerCustomDomainSeoHostname('www.tiemanhai.vn'), 'tiemanhai.vn')
  assert.equal(partnerCustomDomainSeoHostname('tiemanhai.vn'), 'tiemanhai.vn')
  assert.equal(partnerCustomDomainSeoHostname('shop.example.com'), 'shop.example.com')
  assert.equal(partnerCustomDomainPublicOrigin('www.tiemanhai.vn'), 'https://tiemanhai.vn')
  assert.equal(
    rewritePartnerCustomDomainOriginForSeo('https://www.tiemanhai.vn'),
    'https://tiemanhai.vn'
  )
})
