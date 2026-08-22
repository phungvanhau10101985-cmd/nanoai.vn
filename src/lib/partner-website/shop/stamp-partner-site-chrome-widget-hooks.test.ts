import assert from 'node:assert/strict'
import test from 'node:test'
import { stampPartnerSiteChromeWidgetHooksInHtml } from '@/lib/partner-website/shop/stamp-partner-site-chrome-widget-hooks'
import {
  VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS,
  chromeWidgetHref,
  chromeWidgetLiveHook,
} from '@/lib/partner-website/visual-editor/chrome-widgets'

test('stamp rewrites every route chrome widget to the current site slug', () => {
  const buttons = VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS.filter(
    (kind) => chromeWidgetLiveHook(kind) === 'route'
  )
    .map((kind) => `<a data-pw-chrome-btn="${kind}" href="/old">X</a>`)
    .join('')
  const next = stampPartnerSiteChromeWidgetHooksInHtml(`<body>${buttons}</body>`, {
    siteSlug: 'hotel-shop',
  })
  for (const kind of VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS) {
    if (chromeWidgetLiveHook(kind) !== 'route') continue
    const href = chromeWidgetHref(kind, 'hotel-shop')
    assert.match(next, new RegExp(`data-pw-chrome-btn="${kind}"[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  }
})

test('stamp wires leftover camera and category buttons without chrome-btn', () => {
  const html =
    '<button class="pw-search-image-btn">Cam</button><button class="pw-cat-btn">DM</button>' +
    '<form class="pw-search-form"><input name="q"/></form>'
  const next = stampPartnerSiteChromeWidgetHooksInHtml(html)
  assert.match(next, /pw-search-image-btn[^>]*data-pw-image-search="1"/)
  assert.match(next, /pw-cat-btn[^>]*data-pw-cat-toggle="1"/)
  assert.match(next, /pw-cat-btn[^>]*data-pw-el="cat-toggle"/)
  assert.match(next, /<form[^>]*data-pw-search-form/)
})

test('stamp stamps phone and Instagram contact channels', () => {
  const html =
    '<a data-pw-chrome-btn="phone">Gọi</a><a data-pw-chrome-btn="chat-instagram">IG</a>' +
    '<form data-pw-lead-form-el><input name="name"/></form>'
  const next = stampPartnerSiteChromeWidgetHooksInHtml(html, { siteSlug: 'hotel-shop' })
  assert.match(next, /data-pw-contact-channel="phone"/)
  assert.match(next, /data-pw-contact-channel="instagram"/)
  assert.match(next, /data-api="\/api\/site\/hotel-shop\/lead"/)
})

test('stamp does not overwrite Zalo\/Facebook contact hrefs', () => {
  const html = '<a data-pw-chrome-btn="chat-zalo" href="https://zalo.me/shop">Z</a>'
  const next = stampPartnerSiteChromeWidgetHooksInHtml(html, { siteSlug: '188-shop' })
  assert.match(next, /href="https:\/\/zalo\.me\/shop"/)
  assert.match(next, /data-pw-contact-channel="zalo"/)
})

test('stamp wires try-on and favorite-product action hooks', () => {
  const html =
    '<button data-pw-chrome-btn="try-on">Try</button><button data-pw-chrome-btn="favorite-product">Fav</button>' +
    '<button data-pw-chrome-btn="add-cart">Cart</button><button data-pw-chrome-btn="buy-now">Buy</button>'
  const next = stampPartnerSiteChromeWidgetHooksInHtml(html, { siteSlug: 'hotel-shop' })
  assert.match(next, /data-pw-chrome-btn="try-on"[^>]*data-nanoai-try-on/)
  assert.match(next, /data-pw-chrome-btn="favorite-product"[^>]*data-pw-favorite/)
  assert.match(next, /data-pw-chrome-btn="add-cart"[^>]*data-pw-add-cart/)
  assert.match(next, /data-pw-chrome-btn="buy-now"[^>]*data-pw-buy/)
})
