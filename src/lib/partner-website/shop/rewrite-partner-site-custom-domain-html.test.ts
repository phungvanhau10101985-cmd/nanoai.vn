import test from 'node:test'
import assert from 'node:assert/strict'
import { rewritePartnerSiteCustomDomainHtmlPaths } from './rewrite-partner-site-custom-domain-html'
import { buildPartnerSiteVisualNativeNavigationScript } from './partner-site-account-native-navigation'

test('rewrites saved visual chrome links before custom-domain hydration', () => {
  const html = [
    '<a href="/site/demo-shop/account">Account</a>',
    '<a data-pw-account-fallback-href="/site/demo-shop/login?redirect=%2Fsite%2Fdemo-shop%2Faccount">Login</a>',
    '<form action="/site/demo-shop/search"></form>',
    '<a href="/api/site/demo-shop/cart">API</a>',
  ].join('')
  const result = rewritePartnerSiteCustomDomainHtmlPaths(html, 'demo-shop', true)

  assert.match(result, /href="\/account"/)
  assert.match(result, /data-pw-account-fallback-href="\/login\?redirect=/)
  assert.match(result, /action="\/search"/)
  assert.match(result, /href="\/api\/site\/demo-shop\/cart"/)
})

test('keeps platform paths unchanged outside custom domains', () => {
  const html = '<a href="/site/demo-shop/account">Account</a>'
  assert.equal(rewritePartnerSiteCustomDomainHtmlPaths(html, 'demo-shop', false), html)
})

test('inline visual native navigation strips the internal site prefix before navigation', () => {
  const script = buildPartnerSiteVisualNativeNavigationScript('demo-shop')
  assert.match(script, /var PREFIX="\/site\/demo-shop"/)
  assert.match(script, /url\.pathname\.slice\(PREFIX\.length\)/)
  assert.match(script, /window\.location\.assign\(href\)/)
  assert.match(script, /stopImmediatePropagation/)
})
