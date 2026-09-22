import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mapPartnerCustomDomainPathToInternal,
  partnerSiteHref,
} from '@/lib/messaging/partner-custom-domain-site-path'
import { PARTNER_CUSTOM_DOMAIN_HEADER } from '@/lib/auth/app-request-headers'
import {
  partnerShopNotFoundHomePath,
  redirectPartnerShopMissingPageToHome,
} from '@/lib/partner-website/shop/partner-site-not-found'

test('custom domain known shop routes still map into /site/{slug}', () => {
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/login'), '/site/188-shop/login')
  assert.equal(
    mapPartnerCustomDomainPathToInternal('188-shop', '/vi-dien-tu'),
    '/site/188-shop/vi-dien-tu'
  )
  assert.equal(
    mapPartnerCustomDomainPathToInternal('188-shop', '/tai-khoan-ngan-hang'),
    '/site/188-shop/tai-khoan-ngan-hang'
  )
})

test('custom domain unknown URLs enter the shop so 404 can send home', () => {
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/da-xem'), '/site/188-shop/da-xem')
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/foo/bar'), '/site/188-shop/foo/bar')
})

test('custom domain SSL and robots stay on the host', () => {
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/.well-known/acme-challenge/x'), null)
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/robots.txt'), null)
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/auth/shop-google'), null)
})

test('shop not-found screen uses storefront chrome and home redirect', async () => {
  const { readFile } = await import('node:fs/promises')
  const screen = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-not-found-screen.tsx', import.meta.url),
    'utf8'
  )
  assert.match(screen, /PartnerSiteShopShell/)
  assert.match(screen, /PartnerSiteHomeRedirect/)
  assert.match(screen, /pageKind=\{PW_PAGE\.home\}/)
  const nested = await readFile(new URL('../../../app/site/[slug]/not-found.tsx', import.meta.url), 'utf8')
  assert.match(nested, /PartnerSiteNotFoundScreen/)
})

test('missing shop page redirects to home on custom domain and platform', () => {
  assert.equal(partnerShopNotFoundHomePath('188-shop', true), '/')
  assert.equal(partnerShopNotFoundHomePath('188-shop', false), '/site/188-shop')
  assert.equal(partnerSiteHref('188-shop', '/', true), '/')

  const custom = redirectPartnerShopMissingPageToHome(
    new Request('https://gudo.vn/site/188-shop/missing', {
      headers: { [PARTNER_CUSTOM_DOMAIN_HEADER]: 'gudo.vn' },
    }),
    '188-shop'
  )
  assert.equal(custom.status, 307)
  assert.equal(new URL(custom.headers.get('location') || '', 'https://gudo.vn').pathname, '/')

  const platform = redirectPartnerShopMissingPageToHome(
    new Request('https://nanoai.vn/site/188-shop/missing'),
    '188-shop'
  )
  assert.equal(platform.status, 307)
  assert.equal(
    new URL(platform.headers.get('location') || '', 'https://nanoai.vn').pathname,
    '/site/188-shop'
  )
})
