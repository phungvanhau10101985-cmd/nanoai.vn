import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PW_VIEWED_PDP_MAX_ENTRIES,
  PW_VIEWED_PDP_TTL_MS,
  readViewedProductPage,
  rememberViewedProductPage,
  viewedProductPathname,
  type ViewedProductStorage,
} from '@/lib/partner-website/shop/partner-site-viewed-product-cache'

function memoryStorage(): ViewedProductStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

const productHtml = `<html data-pw-page="product"><head><style>.pw-price{color:red}</style></head><body>
<section data-pw-region="pdp-info"><h1>Áo</h1><a href="/products/ao-aaaa1111">Áo</a>
<script>window.__shouldNotRun=1</script></section>
</body></html>`

test('viewedProductPathname accepts product urls only', () => {
  assert.equal(viewedProductPathname('/products/ao-aaaa1111'), '/products/ao-aaaa1111')
  assert.equal(
    viewedProductPathname('/site/shop/products/ao-aaaa1111?pw-device=mobile'),
    '/site/shop/products/ao-aaaa1111'
  )
  assert.equal(viewedProductPathname('/products'), null)
  assert.equal(viewedProductPathname('/products/outfit'), null)
  assert.equal(viewedProductPathname('/cart'), null)
})

test('rememberViewedProductPage stores a script-free preview and reads it back', () => {
  const storage = memoryStorage()
  assert.equal(
    rememberViewedProductPage('/products/ao-aaaa1111', productHtml, storage, 'shop.test'),
    true
  )
  const snap = readViewedProductPage('/products/ao-aaaa1111', storage, 'shop.test', Date.now())
  assert.ok(snap)
  assert.match(snap.css, /\.pw-price/)
  assert.match(snap.body, /Áo/)
  assert.doesNotMatch(snap.body, /<script/i)
  assert.doesNotMatch(snap.body, /\shref=/)
  assert.match(snap.body, /data-pw-snap-href=/)
  assert.equal(readViewedProductPage('/products/ao-aaaa1111', storage, 'other.test'), null)
})

test('rememberViewedProductPage keeps the newest 24 pages and drops the oldest', () => {
  const storage = memoryStorage()
  for (let i = 0; i < PW_VIEWED_PDP_MAX_ENTRIES + 1; i += 1) {
    assert.equal(
      rememberViewedProductPage(`/products/ao-${i}`, productHtml, storage, 'shop.test'),
      true
    )
  }
  assert.equal(readViewedProductPage('/products/ao-0', storage, 'shop.test'), null)
  assert.ok(readViewedProductPage(`/products/ao-${PW_VIEWED_PDP_MAX_ENTRIES}`, storage, 'shop.test'))
})

test('readViewedProductPage drops a preview older than the keep window', () => {
  const storage = memoryStorage()
  assert.equal(rememberViewedProductPage('/products/ao-aaaa1111', productHtml, storage, 'shop.test'), true)
  const snap = readViewedProductPage(
    '/products/ao-aaaa1111',
    storage,
    'shop.test',
    Date.now() + PW_VIEWED_PDP_TTL_MS + 5
  )
  assert.equal(snap, null)
})

test('rememberViewedProductPage ignores pages that are not a product shell', () => {
  const storage = memoryStorage()
  assert.equal(
    rememberViewedProductPage('/products/ao-aaaa1111', '<html><body><h1>Listing</h1></body></html>', storage, 'shop.test'),
    false
  )
})
