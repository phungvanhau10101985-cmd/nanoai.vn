import assert from 'node:assert/strict'
import test from 'node:test'
import {
  partnerShopEmailBrandName,
  shopBrandFromNotificationMeta,
  shopEmailSubject,
} from './partner-shop-email-brand'
import { formatOfflineShopReplyEmailContent } from './partner-reply-offline-email-i18n'
import { formatMarketingCampaignEmailContent } from './partner-marketing-email-i18n'

test('partnerShopEmailBrandName prefers brand then display then title', () => {
  assert.equal(partnerShopEmailBrandName({ brand_name: 'Gudo', display_name: 'gudo.vn' }), 'Gudo')
  assert.equal(partnerShopEmailBrandName({ display_name: 'gudo.vn' }), 'gudo.vn')
  assert.equal(partnerShopEmailBrandName({ title: 'Shop Gudo' }), 'Shop Gudo')
  assert.equal(partnerShopEmailBrandName(null), 'Shop')
})

test('shopEmailSubject leads with shop name and stays idempotent', () => {
  assert.equal(shopEmailSubject('gudo.vn', 'Đơn hàng mới'), 'gudo.vn — Đơn hàng mới')
  assert.equal(shopEmailSubject('gudo.vn', 'gudo.vn — Đơn GUDOVN05'), 'gudo.vn — Đơn GUDOVN05')
  assert.equal(shopEmailSubject('gudo.vn', ''), 'gudo.vn')
})

test('shopBrandFromNotificationMeta reads shop_display_name', () => {
  assert.equal(shopBrandFromNotificationMeta({ shop_display_name: ' gudo.vn ' }), 'gudo.vn')
  assert.equal(shopBrandFromNotificationMeta({}), '')
})

test('offline shop reply email has no NanoAI copy', () => {
  const mail = formatOfflineShopReplyEmailContent({
    shopDisplayName: 'gudo.vn',
    chatUrl: 'https://example.com/chat',
    replyPreview: 'Xin chào',
  })
  assert.match(mail.subject, /^gudo\.vn —/)
  assert.doesNotMatch(mail.subject, /NanoAI/i)
  assert.doesNotMatch(mail.text, /NanoAI/i)
  assert.doesNotMatch(mail.html, /NanoAI/i)
  assert.match(mail.text, /gudo\.vn/)
})

test('marketing shop email footer has no NanoAI copy', () => {
  const mail = formatMarketingCampaignEmailContent({
    shopDisplayName: 'gudo.vn',
    customerName: 'Lan',
    chatUrl: 'https://example.com/chat',
    optOutUrl: 'https://example.com/opt-out',
    products: [],
  })
  assert.match(mail.subject, /^gudo\.vn —/)
  assert.doesNotMatch(mail.subject, /NanoAI/i)
  assert.doesNotMatch(mail.text, /NanoAI/i)
  assert.doesNotMatch(mail.html, /NanoAI/i)
  assert.match(mail.text, /gudo\.vn/)
})
