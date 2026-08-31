import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SITE_CHAT_OPEN_SELECTOR,
  buildPartnerSiteConsultEmbedPath,
  buildPartnerSiteLandingChatBridgeScript,
  partnerSiteChatOpenModeFromEl,
  resolvePartnerTryOnImageUrl,
  stampPartnerSiteChatOpenAttrsInHtml,
} from '@/lib/partner-website/shop/partner-site-chat-embed'

function attrEl(attrs: Record<string, string>, className = '') {
  return {
    hasAttribute: (name: string) => Object.prototype.hasOwnProperty.call(attrs, name),
    getAttribute: (name: string) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null),
    classList: { contains: (token: string) => className.split(/\s+/).includes(token) },
  }
}

test('chat bridge listens for Chat mua chrome buttons and posts in the same window', () => {
  const s = buildPartnerSiteLandingChatBridgeScript()
  assert.match(s, /data-pw-chat-bridge/)
  assert.match(s, /pwShopLiveUiOff/)
  assert.equal(s.includes("getAttribute('data-pw-chrome-btn')==='chat'"), true)
  assert.match(s, /window\.postMessage\(msg,'\*'\)/)
  assert.equal(s.includes(JSON.stringify(PARTNER_SITE_CHAT_OPEN_SELECTOR)), true)
})

test('chrome Chat mua without extra attrs still opens default shop chat', () => {
  assert.equal(partnerSiteChatOpenModeFromEl(attrEl({ 'data-pw-chrome-btn': 'chat' })), 'default')
  assert.equal(partnerSiteChatOpenModeFromEl(attrEl({ 'data-nanoai-open-chat': '' })), 'default')
  assert.equal(partnerSiteChatOpenModeFromEl(attrEl({ 'data-nanoai-consult': '1' })), 'consult')
  assert.equal(partnerSiteChatOpenModeFromEl(attrEl({ 'data-nanoai-try-on': '1' })), 'try_on')
  assert.equal(partnerSiteChatOpenModeFromEl(attrEl({ 'data-pw-chrome-btn': 'try-on' })), 'try_on')
})

test('stampPartnerSiteChatOpenAttrsInHtml wires leftover Tư vấn buttons', () => {
  const html =
    '<button data-pw-chrome-btn="chat" data-pw-chrome-float="1">Tư vấn</button>' +
    '<a data-pw-chrome-btn="chat-zalo" href="#">Zalo</a>'
  const next = stampPartnerSiteChatOpenAttrsInHtml(html)
  assert.match(next, /data-pw-chrome-btn="chat"[^>]*data-nanoai-open-chat/)
  assert.match(next, /class="pw-chat-open"/)
  assert.equal(next.includes('data-pw-chrome-btn="chat-zalo"'), true)
  assert.doesNotMatch(next, /chat-zalo[^>]*data-nanoai-open-chat/)
})

test('try-on embed path puts the product image into ctx_image like 188', () => {
  assert.equal(resolvePartnerTryOnImageUrl('https://cdn.shop/bag.jpg'), 'https://cdn.shop/bag.jpg')
  assert.equal(resolvePartnerTryOnImageUrl('/uploads/bag.jpg', 'https://shop.example/site/demo/p/1'), 'https://shop.example/uploads/bag.jpg')
  assert.equal(resolvePartnerTryOnImageUrl('https://cdn.shop/clip.mp4'), '')
  const path = buildPartnerSiteConsultEmbedPath(
    '/messaging/p/demo-shop',
    { imageUrl: 'https://cdn.shop/bag.jpg', sku: 'BAG-1', inventoryId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    'try_on',
    'vi'
  )
  assert.match(path, /open_try_on=1/)
  assert.match(path, /ctx_image=/)
  assert.match(path, /cdn\.shop%2Fbag\.jpg|cdn\.shop\/bag\.jpg/)
  assert.match(path, /ctx_sku=BAG-1/)
})

test('chat bridge try-on reads PDP gallery, not the header logo', () => {
  const s = buildPartnerSiteLandingChatBridgeScript()
  assert.match(s, /function ctxFromPdp/)
  assert.match(s, /data-pw-el="main-image"/)
  assert.match(s, /pw-pdp-hero-img/)
  assert.match(s, /function isChromeImg/)
  assert.match(s, /data-nanoai-image/)
})

test('stampPartnerSiteChatOpenAttrsInHtml keeps existing open-chat attrs', () => {
  const html =
    '<button class="pw-icon-btn pw-chat-open" data-pw-chrome-btn="chat" data-nanoai-open-chat>Chat</button>'
  const next = stampPartnerSiteChatOpenAttrsInHtml(html)
  assert.equal(next.split('data-nanoai-open-chat').length, 2)
  assert.equal(next.split('pw-chat-open').length, 2)
})
