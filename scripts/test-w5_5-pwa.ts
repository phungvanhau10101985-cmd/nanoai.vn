/**
 * W5.5 — per-shop PWA paths + manifest (không dùng file cài NanoAI chung).
 * Chạy: npx tsx scripts/test-w5_5-pwa.ts
 */
import assert from 'node:assert/strict'
import {
  mapPartnerCustomDomainPathToInternal,
  mapPartnerInternalPathToPublic,
} from '../src/lib/messaging/partner-custom-domain-site-path'
import {
  buildPartnerShopWebManifest,
  partnerSitePwaIconPath,
  partnerSitePwaManifestPath,
  partnerSitePwaSwPath,
} from '../src/lib/partner-website/shop/partner-site-pwa'

function main() {
  assert.equal(partnerSitePwaSwPath('my-shop', true), '/pw-shop-sw.js')
  assert.equal(partnerSitePwaSwPath('my-shop', false), '/site/my-shop/sw.js')
  assert.equal(partnerSitePwaManifestPath('my-shop', true), '/manifest.webmanifest')
  assert.equal(partnerSitePwaManifestPath('my-shop', false), '/site/my-shop/manifest.webmanifest')
  assert.equal(partnerSitePwaIconPath('my-shop', 192, false), '/site/my-shop/pwa-icon/192')

  assert.equal(
    mapPartnerCustomDomainPathToInternal('my-shop', '/pw-shop-sw.js'),
    '/site/my-shop/sw.js'
  )
  assert.equal(
    mapPartnerCustomDomainPathToInternal('my-shop', '/favicon.ico'),
    '/site/my-shop/favicon.ico'
  )
  assert.equal(mapPartnerInternalPathToPublic('my-shop', '/site/my-shop/sw.js'), '/pw-shop-sw.js')

  const manifest = buildPartnerShopWebManifest({
    siteSlug: 'my-shop',
    name: 'Áo Cưới Hồng',
    customDomain: true,
    backgroundColor: '#fff8f0',
    themeColor: '#b45309',
    locale: 'vi',
  })
  assert.equal(manifest.id, 'nanoai-shop:my-shop')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.name, 'Áo Cưới Hồng')
  const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose: string }>
  assert.equal(
    icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png' && icon.purpose === 'any'),
    true
  )
  assert.equal(
    icons.some((icon) => icon.sizes === '512x512' && icon.type === 'image/png' && icon.purpose === 'any'),
    true
  )
  assert.equal(icons.every((icon) => icon.src.startsWith('/pwa-icon/') && icon.type === 'image/png'), true)

  console.log('test-w5_5-pwa: ok')
}

main()
