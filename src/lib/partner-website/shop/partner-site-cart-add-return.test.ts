import assert from 'node:assert/strict'
import test from 'node:test'
import {
  consumePartnerShopReopenChat,
  markPartnerShopReopenChat,
  PARTNER_SHOP_REOPEN_CHAT_KEY,
} from '@/lib/partner-website/shop/partner-site-cart-add-return'

test('reopen-chat flag is one-shot in sessionStorage', () => {
  const store: Record<string, string> = {}
  const g = globalThis as unknown as { window?: { sessionStorage: Storage } }
  const prev = g.window
  const sessionStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: () => null,
    get length() {
      return Object.keys(store).length
    },
  } as Storage
  g.window = { sessionStorage }
  try {
    assert.equal(consumePartnerShopReopenChat(), false)
    markPartnerShopReopenChat()
    assert.equal(store[PARTNER_SHOP_REOPEN_CHAT_KEY], '1')
    assert.equal(consumePartnerShopReopenChat(), true)
    assert.equal(consumePartnerShopReopenChat(), false)
  } finally {
    if (prev) g.window = prev
    else g.window = undefined
  }
})
