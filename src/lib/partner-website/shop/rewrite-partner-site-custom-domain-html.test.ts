import test from 'node:test'
import assert from 'node:assert/strict'
import { rewritePartnerSiteCustomDomainHtmlPaths } from './rewrite-partner-site-custom-domain-html'

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
