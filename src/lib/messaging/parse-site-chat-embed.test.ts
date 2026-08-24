import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isChatWidgetScriptSrc,
  isHostedChatIframeSrc,
  parseSiteChatEmbed,
} from './parse-site-chat-embed'

const SHOP_WIDGET_SCRIPT = `<script
  src="https://nanoai.vn/embed/nanoai-chat-widget.js"
  data-chat-url="https://nanoai.vn/messaging/p/nanoai-ws-un9v?embed=1"
  data-shop-name="NanoAI"
  data-orders-label="Đơn hàng của tôi"
  data-cart-label="Giỏ hàng"
  data-logo-url="https://nanoai.b-cdn.net/logo.png"
  defer
></script>`

test('parseSiteChatEmbed reads data-chat-url from shop widget script', () => {
  const parsed = parseSiteChatEmbed(SHOP_WIDGET_SCRIPT)
  assert.ok(parsed)
  assert.equal(parsed?.src, 'https://nanoai.vn/messaging/p/nanoai-ws-un9v?embed=1')
  assert.equal(parsed?.title, 'NanoAI')
  assert.notEqual(parsed?.src.includes('nanoai-chat-widget.js'), true)
})

test('parseSiteChatEmbed still reads iframe messaging src', () => {
  const raw =
    '<iframe src="https://nanoai.vn/messaging/p/nanoai-ws-wdh5?embed=1" title="Chat NanoAI" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>'
  const parsed = parseSiteChatEmbed(raw)
  assert.ok(parsed)
  assert.equal(parsed?.src, 'https://nanoai.vn/messaging/p/nanoai-ws-wdh5?embed=1')
  assert.equal(parsed?.title, 'Chat NanoAI')
  assert.equal(parsed?.loading, 'lazy')
})

test('parseSiteChatEmbed rejects widget JS as iframe src', () => {
  assert.equal(parseSiteChatEmbed('<script src="https://nanoai.vn/embed/nanoai-chat-widget.js"></script>'), null)
  assert.equal(isChatWidgetScriptSrc('https://nanoai.vn/embed/nanoai-chat-widget.js'), true)
  assert.equal(isHostedChatIframeSrc('https://nanoai.vn/embed/nanoai-chat-widget.js'), false)
  assert.equal(isHostedChatIframeSrc('https://nanoai.vn/messaging/p/nanoai-ws-un9v?embed=1'), true)
})
