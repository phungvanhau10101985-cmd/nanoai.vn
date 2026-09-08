import assert from 'node:assert/strict'
import test from 'node:test'
import { buildShopVisualSeoHead } from '@/lib/partner-website/shop/build-shop-visual-seo-head'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'

test('seed SEO head stamps theme-color as a hex, not a CSS variable', () => {
  const head = buildShopVisualSeoHead({
    title: 'Shop',
    description: 'Demo',
    locale: 'vi',
    themeColor: '#0F766E',
  })
  assert.match(head, /<meta name="theme-color" content="#0f766e"\/>/)
  assert.doesNotMatch(head, /theme-color" content="var\(/)
})

test('seed SEO head falls back to the default primary hex', () => {
  const head = buildShopVisualSeoHead({
    title: 'Shop',
    description: 'Demo',
    locale: 'vi',
  })
  assert.match(
    head,
    new RegExp(`<meta name="theme-color" content="${DEFAULT_PARTNER_WEBSITE_THEME.primaryColor}"/>`)
  )
})
