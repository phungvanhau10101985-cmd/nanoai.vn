import assert from 'node:assert/strict'
import test from 'node:test'
import { guestChatProductDetailHref, inventoryAdminWebHref } from '@/lib/messaging/inventory-admin-web-href'

const PRODUCT = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Giày sneaker nữ',
  product_url: 'https://detail.1688.com/offer/123.html',
}

test('inventory admin product link prefers the configured custom domain', () => {
  const href = inventoryAdminWebHref('gudo-shop', 'https://gudo.vn/', PRODUCT)
  assert.equal(href, 'https://gudo.vn/products/giay-sneaker-nu-123e4567')
})

test('inventory admin product link keeps NanoAI public URL when no custom domain exists', () => {
  const href = inventoryAdminWebHref(
    'gudo-shop',
    'https://nanoai.vn/site/gudo-shop',
    PRODUCT
  )
  assert.equal(href, 'https://nanoai.vn/site/gudo-shop/products/giay-sneaker-nu-123e4567')
})

test('inventory admin product link falls back to the current NanoAI relative route', () => {
  const href = inventoryAdminWebHref('gudo-shop', null, PRODUCT)
  assert.equal(href, '/site/gudo-shop/products/giay-sneaker-nu-123e4567')
})

test('chat view-details opens the shop PDP instead of a China source URL', () => {
  const href = guestChatProductDetailHref('gudo-shop', 'https://gudo.vn/', PRODUCT)
  assert.equal(href, 'https://gudo.vn/products/giay-sneaker-nu-123e4567')
})

test('chat view-details keeps a non-China shop URL', () => {
  const href = guestChatProductDetailHref('gudo-shop', 'https://gudo.vn/', {
    ...PRODUCT,
    product_url: 'https://188.com.vn/products/giay-1',
  })
  assert.equal(href, 'https://188.com.vn/products/giay-1')
})

test('chat view-details does not open a China URL when the shop PDP cannot be built', () => {
  assert.equal(
    guestChatProductDetailHref('', null, {
      id: '',
      name: 'Túi',
      product_url: 'https://item.taobao.com/item.htm?id=9',
    }),
    ''
  )
})
