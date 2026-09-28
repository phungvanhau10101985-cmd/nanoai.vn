import assert from 'node:assert/strict'
import test from 'node:test'
import {
  partnerShopDocumentVerification,
  partnerShopVerifyMetaTags,
  sanitizePartnerShopCustomEmbedHtml,
  stripPartnerShopVerifyMetasFromHtml,
} from '@/lib/partner-website/shop/sanitize-partner-shop-custom-embed'

test('sanitizePartnerShopCustomEmbedHtml allows GTM script and strips javascript handlers', () => {
  const ok = sanitizePartnerShopCustomEmbedHtml(
    '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC"></script>'
  )
  assert.match(ok, /googletagmanager\.com\/gtm\.js/)

  const blocked = sanitizePartnerShopCustomEmbedHtml(
    '<script src="https://evil.example/x.js"></script><img src=x onerror="alert(1)">'
  )
  assert.equal(blocked.includes('evil.example'), false)
  assert.equal(blocked.includes('onerror'), false)
  assert.equal(sanitizePartnerShopCustomEmbedHtml('javascript:alert(1)'), '')
})

test('partnerShopVerifyMetaTags emit search console / merchant / facebook metas', () => {
  const html = partnerShopVerifyMetaTags({
    googleSearchConsoleVerify: 'gsc-token',
    googleMerchantCenterVerify: 'gmc-token',
    facebookDomainVerification: 'fb-token',
  })
  assert.match(html, /name="google-site-verification" content="gsc-token"/)
  assert.match(html, /name="google-site-verification" content="gmc-token"/)
  assert.doesNotMatch(html, /data-pw-merchant-verify/)
  assert.match(html, /name="facebook-domain-verification" content="fb-token"/)
})

test('document verification is head metadata and body markup drops a misplaced meta', () => {
  const verification = partnerShopDocumentVerification({
    googleMerchantCenterVerify: 'D4YVtckkCwAjt7VaKinC-qLx24VNVvcjRH7BuaP2iTc',
    facebookDomainVerification: 'fb-token',
  })
  assert.equal(verification?.google, 'D4YVtckkCwAjt7VaKinC-qLx24VNVvcjRH7BuaP2iTc')
  assert.equal(verification?.other?.['facebook-domain-verification'], 'fb-token')
  const body =
    '<main>ok</main><meta name="google-site-verification" content="D4YVtckkCwAjt7VaKinC-qLx24VNVvcjRH7BuaP2iTc" />'
  const stripped = stripPartnerShopVerifyMetasFromHtml(body)
  assert.equal(stripped.includes('google-site-verification'), false)
  assert.match(stripped, /<main>ok<\/main>/)
})
