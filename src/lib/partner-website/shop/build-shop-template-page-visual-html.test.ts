import assert from 'node:assert/strict'
import test from 'node:test'

import { adsPlatformPolicyParagraph } from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { VISUAL_DEVICE_VARIANTS } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { visualHtmlLooksUsable } from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import {
  buildShopTemplatePageVisualHtml,
  isShopTemplateInnerPageKey,
} from './build-shop-template-page-visual-html'

test('listing seed is SEO stamped and hydrates catalog on every device', () => {
  for (const variant of VISUAL_DEVICE_VARIANTS) {
    const html = buildShopTemplatePageVisualHtml({
      pageKey: 'products',
      variant,
      locale: 'vi',
      siteSlug: 'demo-shop',
      brand: 'Shop Cam',
    })
    assert.equal(visualHtmlLooksUsable(html), true)
    assert.match(html, /data-pw-page="listing"/)
    assert.match(html, new RegExp(`data-pw-edit-device="${variant}"`))
    assert.match(html, /data-pw-catalog/)
    assert.match(html, /data-pw-region="filters"/)
    assert.match(html, /data-pw-region="breadcrumb"/)
    assert.match(html, /<meta name="description"/)
    assert.match(html, /<h1\b/)
  }
})

test('desktop listing uses 5 columns and mobile uses 2', () => {
  const desktop = buildShopTemplatePageVisualHtml({
    pageKey: 'products',
    variant: 'desktop',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
  })
  const mobile = buildShopTemplatePageVisualHtml({
    pageKey: 'products',
    variant: 'mobile',
    locale: 'en',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
  })
  assert.match(desktop, /data-pw-grid-cols="5"/)
  assert.match(desktop, /grid-template-columns:repeat\(5,/)
  assert.match(mobile, /data-pw-grid-cols="2"/)
  assert.match(mobile, /grid-template-columns:repeat\(2,/)
  assert.match(mobile, /Products \| Shop Cam|Products/)
})

test('info and policy pages keep article SEO plus ads paragraph', () => {
  const about = buildShopTemplatePageVisualHtml({
    pageKey: 'about',
    variant: 'desktop',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
  })
  assert.match(about, /data-pw-page="info"/)
  assert.match(about, /data-pw-info-title/)
  assert.match(about, /data-pw-text-article="1"/)
  assert.match(about, /og:type" content="article"/)

  const privacy = buildShopTemplatePageVisualHtml({
    pageKey: 'privacy',
    variant: 'tablet',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
  })
  assert.ok(privacy.includes(adsPlatformPolicyParagraph('vi')))
})

test('cart and account shells use live regions and noindex', () => {
  const cart = buildShopTemplatePageVisualHtml({
    pageKey: 'cart',
    variant: 'laptop',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
  })
  assert.match(cart, /data-pw-page="cart"/)
  assert.match(cart, /data-pw-region="cart-list"/)
  assert.match(cart, /data-pw-region="cart-summary"/)
  assert.match(cart, /noindex/)

  const account = buildShopTemplatePageVisualHtml({
    pageKey: 'account',
    variant: 'mobile',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
  })
  assert.match(account, /data-pw-page="account"/)
  assert.match(account, /data-pw-region="account-nav"/)
  assert.match(account, /pw-page-split-stack/)
})

test('inner-page helper covers commerce and info keys', () => {
  assert.equal(isShopTemplateInnerPageKey('products'), true)
  assert.equal(isShopTemplateInnerPageKey('privacy'), true)
  assert.equal(isShopTemplateInnerPageKey('home'), false)
})
