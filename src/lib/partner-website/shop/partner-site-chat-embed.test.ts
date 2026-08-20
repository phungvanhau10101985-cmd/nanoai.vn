import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SITE_CHAT_OPEN_SELECTOR,
  buildPartnerSiteLandingChatBridgeScript,
  partnerSiteChatOpenModeFromEl,
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

test('stampPartnerSiteChatOpenAttrsInHtml keeps existing open-chat attrs', () => {
  const html =
    '<button class="pw-icon-btn pw-chat-open" data-pw-chrome-btn="chat" data-nanoai-open-chat>Chat</button>'
  const next = stampPartnerSiteChatOpenAttrsInHtml(html)
  assert.equal(next.split('data-nanoai-open-chat').length, 2)
  assert.equal(next.split('pw-chat-open').length, 2)
})
