import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeFacebookDomainVerification,
  normalizeGoogleAdsConversionLabel,
  normalizeGoogleSearchConsoleVerify,
} from '@/lib/partner-website/shop/normalize-ads-conversion-label'

test('normalizeGoogleAdsConversionLabel accepts AW-/label and strips wrappers', () => {
  assert.equal(normalizeGoogleAdsConversionLabel('AW-123456789/AbCdEfGh'), 'AW-123456789/AbCdEfGh')
  assert.equal(
    normalizeGoogleAdsConversionLabel("gtag('event','conversion',{'send_to':'AW-111/xyz_1'})"),
    'AW-111/xyz_1'
  )
  assert.equal(normalizeGoogleAdsConversionLabel('  aw-99 / label-2 '), 'AW-99/label-2')
  assert.equal(normalizeGoogleAdsConversionLabel('G-ABCDEF'), null)
  assert.equal(normalizeGoogleAdsConversionLabel(''), null)
})

test('verification tokens reject html and javascript', () => {
  assert.equal(normalizeGoogleSearchConsoleVerify('abc_DEF-123'), 'abc_DEF-123')
  assert.equal(normalizeGoogleSearchConsoleVerify('<meta content="x">'), null)
  assert.equal(normalizeFacebookDomainVerification('fb-token_1'), 'fb-token_1')
  assert.equal(normalizeFacebookDomainVerification('not valid!'), null)
})
