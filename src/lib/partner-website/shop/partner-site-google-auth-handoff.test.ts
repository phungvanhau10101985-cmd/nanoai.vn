import assert from 'node:assert/strict'
import test from 'node:test'

test('partner site google auth handoff round-trip', async () => {
  process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-auth-jwt-secret-at-least-32-chars!!'
  const {
    issuePartnerSiteGoogleAuthHandoff,
    verifyPartnerSiteGoogleAuthHandoff,
    buildShopGoogleAuthBridgeUrl,
    PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY,
  } = await import('@/lib/partner-website/shop/partner-site-google-auth-handoff')

  const token = issuePartnerSiteGoogleAuthHandoff({
    email: 'Buyer@Example.com',
    siteSlug: '188-shop',
    partnerId: '11111111-1111-1111-1111-111111111111',
    path: '/account',
    authUserId: '22222222-2222-2222-2222-222222222222',
  })
  assert.equal(typeof token, 'string')
  assert.match(token, /\./)

  const verified = verifyPartnerSiteGoogleAuthHandoff(token)
  assert.equal(verified.ok, true)
  if (!verified.ok) return
  assert.equal(verified.payload.email, 'buyer@example.com')
  assert.equal(verified.payload.siteSlug, '188-shop')
  assert.equal(verified.payload.path, '/account')
  assert.equal(verified.payload.authUserId, '22222222-2222-2222-2222-222222222222')

  assert.equal(verifyPartnerSiteGoogleAuthHandoff(token + 'x').ok, false)
  assert.equal(PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY, 'pw_auth')

  const bridge = buildShopGoogleAuthBridgeUrl({
    platformOrigin: 'https://nanoai.vn',
    siteSlug: '188-shop',
    shopReturnUrl: 'https://shop.example/account',
    nextPath: '/site/188-shop/account',
  })
  assert.match(bridge, /^https:\/\/nanoai\.vn\/auth\/shop-google\?/)
  assert.match(bridge, /site=188-shop/)
  assert.match(bridge, /return=/)
})
