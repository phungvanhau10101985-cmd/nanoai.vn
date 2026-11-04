import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopChatWidgetsHtml,
  normalizeZaloPersonalUrl,
  resolvePartnerShopZaloClickUrl,
} from '@/lib/partner-website/shop/partner-shop-chat-widgets'

test('normalizeZaloPersonalUrl accepts a phone or zalo.me link', () => {
  assert.equal(normalizeZaloPersonalUrl('0968 659 836'), 'https://zalo.me/0968659836')
  assert.equal(normalizeZaloPersonalUrl('https://zalo.me/0968659836'), 'https://zalo.me/0968659836')
  assert.equal(normalizeZaloPersonalUrl('<script>'), null)
  assert.equal(normalizeZaloPersonalUrl(''), null)
})

test('buildPartnerShopChatWidgetsHtml emits Facebook chat and Zalo OA when that mode is selected', () => {
  const html = buildPartnerShopChatWidgetsHtml({
    facebookChatPageId: '1234567890',
    zaloOpen: 'oa',
    zaloOaId: '99887766',
    zaloPersonalUrl: 'https://zalo.me/0968659836',
    zaloCustomHtml: '<script src="https://evil.example/x.js"></script><div>zns</div>',
  })
  assert.match(html, /page_id="1234567890"/)
  assert.match(html, /connect\.facebook\.net/)
  assert.match(html, /data-oaid="99887766"/)
  assert.match(html, /sp\.zalo\.me\/plugins\/sdk\.js/)
  assert.match(html, /<div>zns<\/div>/)
  assert.doesNotMatch(html, /0968659836/)
  assert.doesNotMatch(html, /evil\.example/)
})

test('a saved personal number opens that chat and hides the OA widget', () => {
  const html = buildPartnerShopChatWidgetsHtml({
    zaloOaId: '99887766',
    zaloPersonalUrl: '0968659836',
  })
  assert.match(html, /data-zalo-open="personal"/)
  assert.match(html, /https:\/\/zalo\.me\/0968659836/)
  assert.doesNotMatch(html, /zalo-chat-widget/)
  assert.equal(
    resolvePartnerShopZaloClickUrl({
      zaloPersonalUrl: '0968659836',
      zaloOaId: '99887766',
      contactZaloUrl: 'https://zalo.me/0900000000',
    }),
    'https://zalo.me/0968659836'
  )
  assert.equal(
    resolvePartnerShopZaloClickUrl({
      zaloOpen: 'oa',
      zaloPersonalUrl: '0968659836',
      zaloOaId: '99887766',
    }),
    'https://zalo.me/99887766'
  )
})

test('turning the float off hides the corner button and keeps the personal chat link', () => {
  const html = buildPartnerShopChatWidgetsHtml({
    zaloOpen: 'personal',
    zaloOaId: '99887766',
    zaloPersonalUrl: '0968659836',
    zaloFloatEnabled: false,
  })
  assert.equal(html, '')
  assert.equal(
    resolvePartnerShopZaloClickUrl({
      zaloOpen: 'personal',
      zaloPersonalUrl: '0968659836',
      zaloOaId: '99887766',
    }),
    'https://zalo.me/0968659836'
  )
  const oa = buildPartnerShopChatWidgetsHtml({
    zaloOpen: 'oa',
    zaloOaId: '99887766',
    zaloFloatEnabled: false,
  })
  assert.doesNotMatch(oa, /zalo-chat-widget/)
})
