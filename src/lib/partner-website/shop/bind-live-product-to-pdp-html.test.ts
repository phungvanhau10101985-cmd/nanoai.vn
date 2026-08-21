import assert from 'node:assert/strict'
import test from 'node:test'
import { bindLiveProductToPdpHtml } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import { DEMO_PDP_BIND_PRODUCT } from '@/lib/partner-website/shop/demo-pdp-bind-product'

const SHELL = `<!DOCTYPE html><html><body data-pw-page="product">
<section data-pw-region="gallery">
  <img class="pw-pdp-hero-img" data-pw-el="main-image" src="https://old.example/a.jpg" alt="Old" />
  <button data-pw-el="thumb"><img src="https://old.example/a.jpg" alt="" /></button>
  <button data-pw-el="thumb"><img src="https://old.example/a2.jpg" alt="" /></button>
</section>
<div data-pw-region="pdp-info">
  <h1 class="pw-pdp-title" data-pw-el="title">Old bag</h1>
  <p class="pw-pdp-sku">SKU: <strong>OLD-1</strong></p>
  <p class="pw-shop-price" data-pw-el="price">10.000₫<span data-pw-el="compare-price">20.000₫</span></p>
  <div data-pw-el="desc">Old description</div>
  <button data-pw-pdp-add-cart="1" data-inventory-id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa">Add</button>
</div>
<section data-pw-region="reviews"><article data-pw-el="card"><p data-pw-el="body">Review for A</p></article></section>
<section data-pw-region="catalog"><article data-pw-el="card" data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"><h3 data-pw-el="card-name">Related</h3></article></section>
</body></html>`

const PRODUCT_B = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  name: 'New shirt',
  sku: 'SHIRT-9',
  description: 'Cotton shirt',
  priceHint: '150.000₫',
  priceAmount: 150000,
  imageUrl: 'https://new.example/shirt.jpg',
  galleryImages: ['https://new.example/shirt.jpg'],
}

test('bindLiveProductToPdpHtml rewrites locked PDP fields and keeps catalog cards', () => {
  const next = bindLiveProductToPdpHtml(SHELL, PRODUCT_B)
  assert.match(next, /New shirt/)
  assert.match(next, /SHIRT-9/)
  assert.match(next, /Cotton shirt/)
  assert.match(next, /https:\/\/new\.example\/shirt\.jpg/)
  assert.doesNotMatch(next, /Old bag/)
  assert.doesNotMatch(next, /https:\/\/old\.example\/a\.jpg/)
  assert.match(next, /data-inventory-id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"/)
  assert.match(next, /data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"/)
  assert.doesNotMatch(next, /Review for A/)
})

test('bindLiveProductToPdpHtml hides leftover thumbs when the next product has fewer images', () => {
  const next = bindLiveProductToPdpHtml(SHELL, PRODUCT_B)
  assert.match(next, /data-pw-el="thumb"[^>]*hidden/)
})

test('bindLiveProductToPdpHtml is a no-op without a product id', () => {
  assert.equal(bindLiveProductToPdpHtml(SHELL, { id: '', name: 'X' }), SHELL)
})

test('demo PDP product fills every locked field on the shared shell', () => {
  const next = bindLiveProductToPdpHtml(SHELL, DEMO_PDP_BIND_PRODUCT)
  assert.match(next, /Áo thun cotton demo/)
  assert.match(next, /DEMO-PDP-001/)
  assert.match(next, /placehold\.co/)
})
