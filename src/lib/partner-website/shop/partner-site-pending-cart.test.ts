import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearPartnerSitePendingCart,
  partnerSitePendingCartKey,
  queuePartnerSitePendingCart,
  readPartnerSitePendingCart,
  takePartnerSitePendingCart,
} from '@/lib/partner-website/shop/partner-site-pending-cart'

const ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

test('pending cart queues, merges quantity, and take clears storage', () => {
  const store = new Map<string, string>()
  const key = partnerSitePendingCartKey('demo-shop')
  const g = globalThis as typeof globalThis & { window?: unknown; sessionStorage?: Storage }
  const prevWindow = g.window
  g.window = {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    },
  }
  try {
    queuePartnerSitePendingCart('demo-shop', {
      inventory_id: ID,
      name: 'Áo',
      quantity: 1,
      color: 'Đỏ',
      size: 'M',
    })
    queuePartnerSitePendingCart('demo-shop', {
      inventory_id: ID,
      quantity: 2,
      color: 'Đỏ',
      size: 'M',
      buyNow: true,
    })
    const listed = readPartnerSitePendingCart('demo-shop')
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.quantity, 3)
    assert.equal(listed[0]?.buyNow, true)
    const taken = takePartnerSitePendingCart('demo-shop')
    assert.equal(taken.length, 1)
    assert.equal(readPartnerSitePendingCart('demo-shop').length, 0)
    assert.equal(store.has(key), false)
    clearPartnerSitePendingCart('demo-shop')
  } finally {
    g.window = prevWindow
  }
})
