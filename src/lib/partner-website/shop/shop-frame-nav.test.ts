import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { injectPartnerCustomDomainLinkRewriteScript } from '@/lib/partner-website/shop/inject-partner-custom-domain-link-script'
import { shopFrameTopIsAdminPath } from '@/lib/partner-website/shop/shop-frame-nav'

test('dashboard pathname is the admin tab', () => {
  assert.equal(shopFrameTopIsAdminPath('/dashboard'), true)
  assert.equal(shopFrameTopIsAdminPath('/dashboard/messaging/p/shop/website'), true)
  assert.equal(shopFrameTopIsAdminPath('/messaging/p/shop'), false)
  assert.equal(shopFrameTopIsAdminPath('/site/shop'), false)
})

test('shop runtime does not assign window.top while the preview sits in the admin', () => {
  const chrome = buildPartnerSiteChromeToggleBootstrapScript({ siteSlug: 'shop', locale: 'vi' })
  const search = buildPartnerSiteSearchBootstrapScript({ siteSlug: 'shop', locale: 'vi' })
  const actions = buildPartnerSiteShopActionsBootstrapScript({ siteSlug: 'shop', locale: 'vi' })
  const links = injectPartnerCustomDomainLinkRewriteScript('<a href="/products">x</a>', 'shop')
  for (const src of [chrome, search, actions, links]) {
    assert.match(src, /function pwTopIsAdmin/)
    assert.match(src, /\/dashboard\//)
  }
  assert.match(chrome, /pwShopNavWindow\(\)\.location\.href/)
  assert.match(search, /!pwTopIsAdmin\(\)/)
  assert.match(actions, /pwShopNavWindow\(\)\.location\.assign/)
  assert.match(links, /if\(pwTopIsAdmin\(\)\)return/)
  assert.match(links, /data-pw-chrome-btn="chat"/)
})
