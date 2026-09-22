import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectPartnerShopLcpPreloadHref,
  injectPartnerShopCdnPreconnect,
  injectPartnerShopLcpPreloadLinks,
} from '@/lib/partner-website/shop/preload-partner-shop-lcp'

test('LCP preload prefers banner then first card and skips fetch-image', () => {
  const banner =
    '<html><head></head><body><a data-pw-promo-slide="1"><img src="https://img.alicdn.com/banner.jpg"/></a>' +
    '<article data-pw-el="card"><img src="https://img.alicdn.com/card.jpg"/></article></body></html>'
  assert.equal(collectPartnerShopLcpPreloadHref(banner), 'https://img.alicdn.com/banner.jpg')
  const proxied =
    '<html><head></head><body><article data-pw-el="card"><img src="/api/fetch-image?url=https%3A%2F%2Fx.jpg"/></article></body></html>'
  assert.equal(collectPartnerShopLcpPreloadHref(proxied), '')
  const withLink = injectPartnerShopLcpPreloadLinks(banner)
  assert.match(withLink, /rel="preload" as="image"/)
  assert.match(withLink, /data-pw-lcp-preload="1"/)
})

test('CDN preconnect stamps AliCDN and optional Bunny', () => {
  const out = injectPartnerShopCdnPreconnect('<html><head></head><body></body></html>', 'https://cdn.shop.example')
  assert.match(out, /img\.alicdn\.com/)
  assert.match(out, /gw\.alicdn\.com/)
  assert.match(out, /cdn\.shop\.example/)
  assert.match(out, /data-pw-cdn-preconnect="1"/)
})
