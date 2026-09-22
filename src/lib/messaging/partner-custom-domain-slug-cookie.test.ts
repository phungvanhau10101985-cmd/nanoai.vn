import assert from 'node:assert/strict'
import test from 'node:test'
import {
  readSignedPartnerCustomDomainSlug,
  signPartnerCustomDomainSlugCookie,
  trustedPartnerSiteSlugFromEdgeHeaders,
} from '@/lib/messaging/partner-custom-domain-slug-cookie'

test('HMAC custom-domain slug cookie binds host and rejects another shop', async () => {
  const value = await signPartnerCustomDomainSlugCookie('gudo.vn', 'demo-shop')
  assert.match(value, /^demo-shop\.[a-f0-9]{24}$/)
  assert.equal(await readSignedPartnerCustomDomainSlug('gudo.vn', value), 'demo-shop')
  assert.equal(await readSignedPartnerCustomDomainSlug('other.vn', value), '')
  const spoof = value.replace(/^demo-shop/, 'other-shop')
  assert.equal(await readSignedPartnerCustomDomainSlug('gudo.vn', spoof), '')
})

test('edge slug only counts when X-NanoAI-Edge is set', () => {
  assert.equal(
    trustedPartnerSiteSlugFromEdgeHeaders({
      getHeader: (name) =>
        name.toLowerCase() === 'x-partner-site-slug' ? 'demo-shop' : null,
      host: 'gudo.vn',
    }),
    ''
  )
  assert.equal(
    trustedPartnerSiteSlugFromEdgeHeaders({
      getHeader: (name) => {
        const n = name.toLowerCase()
        if (n === 'x-nanoai-edge') return '1'
        if (n === 'x-partner-site-slug') return 'demo-shop'
        return null
      },
      host: 'gudo.vn',
    }),
    'demo-shop'
  )
})
