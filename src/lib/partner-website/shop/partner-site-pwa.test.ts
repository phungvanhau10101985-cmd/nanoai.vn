import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopWebManifest,
  partnerSitePwaIconPath,
  partnerSitePwaManifestPath,
} from '@/lib/partner-website/shop/partner-site-pwa'

test('PWA icon path keeps maskable and adds a sale cache bust', () => {
  assert.equal(partnerSitePwaIconPath('shop-a', 192, true), '/pwa-icon/192')
  assert.equal(
    partnerSitePwaIconPath('shop-a', 192, true, { maskable: true }),
    '/pwa-icon/192?purpose=maskable'
  )
  assert.equal(
    partnerSitePwaIconPath('shop-a', 192, true, { maskable: true, bust: 'on-sale99' }),
    '/pwa-icon/192?purpose=maskable&v=on-sale99'
  )
  assert.equal(
    partnerSitePwaIconPath('shop-a', 180, false, { bust: 'abc123' }),
    '/site/shop-a/pwa-icon/180?v=abc123'
  )
})

test('web manifest icon src changes when sale overlay token changes', () => {
  const off = buildPartnerShopWebManifest({
    siteSlug: 'shop-a',
    name: 'Shop',
    customDomain: true,
    backgroundColor: '#fff',
    themeColor: '#111',
    iconBust: 'offlogo',
  })
  const on = buildPartnerShopWebManifest({
    siteSlug: 'shop-a',
    name: 'Shop',
    customDomain: true,
    backgroundColor: '#fff',
    themeColor: '#111',
    iconBust: 'onsale99',
  })
  const offIcons = off.icons as Array<{ src: string }>
  const onIcons = on.icons as Array<{ src: string }>
  assert.match(offIcons[0].src, /[?&]v=offlogo/)
  assert.match(onIcons[0].src, /[?&]v=onsale99/)
  assert.notEqual(offIcons[0].src, onIcons[0].src)
  assert.equal(
    partnerSitePwaManifestPath('shop-a', true, '0a0a0a', 'onsale99'),
    '/manifest.webmanifest?c=0a0a0a&i=onsale99'
  )
})
