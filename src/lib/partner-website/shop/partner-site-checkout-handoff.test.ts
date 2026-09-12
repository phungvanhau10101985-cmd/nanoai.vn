import assert from 'node:assert/strict'
import test from 'node:test'
import {
  partnerSiteCheckoutHandoffKey,
  stashPartnerSiteCheckoutHandoff,
  readPartnerSiteCheckoutHandoff,
  takePartnerSiteCheckoutHandoff,
} from '@/lib/partner-website/shop/partner-site-checkout-handoff'

test('checkout handoff paints deposit then take clears storage', () => {
  const store = new Map<string, string>()
  const key = partnerSiteCheckoutHandoffKey('demo-shop')
  const g = globalThis as typeof globalThis & { window?: unknown }
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
    stashPartnerSiteCheckoutHandoff('demo-shop', {
      orderId: 'ord-1',
      order: {
        id: 'ord-1',
        status: 'awaiting_payment',
        required_amount: 150000,
        payment_qr_url: 'https://qr.sepay.vn/img?acc=1',
      },
      payment_display: {
        kind: 'bank',
        bank_name: 'Vietcombank',
        account_number: '123',
        account_holder: 'SHOP',
      },
    })
    const taken = readPartnerSiteCheckoutHandoff('demo-shop', 'ord-1')
    assert.equal(taken?.order.id, 'ord-1')
    assert.equal(taken?.payment_display?.kind, 'bank')
    assert.equal(readPartnerSiteCheckoutHandoff('demo-shop', 'ord-1')?.order.id, 'ord-1')
    const consumed = takePartnerSiteCheckoutHandoff('demo-shop', 'ord-1')
    assert.equal(consumed?.order.id, 'ord-1')
    assert.equal(readPartnerSiteCheckoutHandoff('demo-shop', 'ord-1'), null)
    assert.equal(store.has(key), false)
  } finally {
    g.window = prevWindow
  }
})

test('handoff ignores a different order id', () => {
  const store = new Map<string, string>()
  const g = globalThis as typeof globalThis & { window?: unknown }
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
    stashPartnerSiteCheckoutHandoff('demo-shop', {
      orderId: 'ord-a',
      order: { id: 'ord-a', status: 'awaiting_payment', required_amount: 1 },
    })
    assert.equal(takePartnerSiteCheckoutHandoff('demo-shop', 'ord-b'), null)
  } finally {
    g.window = prevWindow
  }
})
