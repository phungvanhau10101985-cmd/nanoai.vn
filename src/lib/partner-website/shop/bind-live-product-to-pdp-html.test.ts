import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindLiveProductToPdpHtml,
  deferOffDevicePdpGalleryMedia,
} from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
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
  assert.match(next, /Đầm voan/)
  assert.match(next, /DEMO-PDP-001/)
  assert.match(next, /cdn\.188\.com\.vn|188comvn\.b-cdn\.net/)
  assert.match(next, /data-pw-el="variant"/)
  assert.match(next, /pw-pdp-pill/)
  assert.match(next, /pw-pdp-color/)
  assert.match(next, />S</)
  assert.match(next, /Kem|Trắng/)
})

test('bind injects missing size and color slots and extra gallery thumbs', () => {
  const next = bindLiveProductToPdpHtml(SHELL, DEMO_PDP_BIND_PRODUCT)
  const thumbs = next.match(/data-pw-el="thumb"/g) || []
  assert.ok(thumbs.length >= 4)
  assert.match(next, /data-pw-pdp-option="size"/)
  assert.match(next, /data-pw-pdp-option="color"/)
  assert.match(next, /data-pw-pdp-option-value="S"/)
})

test('bind fills demo reviews instead of clearing them', () => {
  const next = bindLiveProductToPdpHtml(SHELL, DEMO_PDP_BIND_PRODUCT)
  assert.match(next, /Form đẹp/)
  assert.match(next, /Lan/)
})

test('bind does not treat a product photo as a video slot', () => {
  const next = bindLiveProductToPdpHtml(SHELL, {
    ...DEMO_PDP_BIND_PRODUCT,
    productVideoUrl: 'https://cdn.example/look.jpg',
  })
  assert.doesNotMatch(next, /data-pw-pdp-slot="video"/)
})

test('bind injects missing editor layout slots onto a sparse shell', () => {
  const next = bindLiveProductToPdpHtml(SHELL, DEMO_PDP_BIND_PRODUCT)
  assert.match(next, /id="pw-pdp-qa"/)
  assert.match(next, /data-pw-pdp-slot="consult"/)
  assert.match(next, /data-pw-pdp-slot="size-guide"/)
  assert.match(next, /data-pw-region="breadcrumb"/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="video"/)
})

test('deferOffDevicePdpGalleryMedia parks hidden hero images on desktop', () => {
  const html = `<div class="pw-pdp-hero"><img src="https://cdn.example/hero.jpg" alt="x" /></div>
<div class="pw-shop-product-gallery pw-pdp-gallery-desktop"><img src="https://cdn.example/desk.jpg" alt="y" /></div>`
  const desktop = deferOffDevicePdpGalleryMedia(html, 'desktop')
  assert.match(desktop, /data-pw-deferred-src="https:\/\/cdn\.example\/hero\.jpg"/)
  assert.doesNotMatch(desktop, /(?:^|[\s"'/])src="https:\/\/cdn\.example\/hero\.jpg"/)
  assert.match(desktop, /(?:^|[\s"'/])src="https:\/\/cdn\.example\/desk\.jpg"/)
  const mobile = deferOffDevicePdpGalleryMedia(html, 'mobile')
  assert.match(mobile, /data-pw-deferred-src="https:\/\/cdn\.example\/desk\.jpg"/)
  assert.match(mobile, /src="https:\/\/cdn\.example\/hero\.jpg"/)
})

test('deferOffDevicePdpGalleryMedia keeps the only gallery on a device', () => {
  const heroOnly = `<div class="pw-pdp-hero"><img src="https://cdn.example/hero.jpg" alt="x" /></div>`
  assert.equal(deferOffDevicePdpGalleryMedia(heroOnly, 'desktop'), heroOnly)
})

test('bind stamps related catalog and rewrites cards when relatedProducts exist', () => {
  const next = bindLiveProductToPdpHtml(
    SHELL,
    {
      ...PRODUCT_B,
      categoryId: '11111111-1111-4111-8111-111111111111',
      categoryPath: 'ao/ao-thun',
      relatedProducts: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Similar tee',
          imageUrl: 'https://new.example/tee.jpg',
          priceHint: '99.000₫',
        },
      ],
    },
    { locale: 'vi', siteSlug: 'demo-shop' }
  )
  assert.match(next, /data-pw-related="1"/)
  assert.match(next, /data-exclude="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"/)
  assert.match(next, /data-category-id="11111111-1111-4111-8111-111111111111"/)
  assert.match(next, /Similar tee/)
  assert.doesNotMatch(next, /data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"/)
})

test('bind does not rewrite recommended catalog cards', () => {
  const html = SHELL.replace(
    'data-pw-region="catalog"',
    'data-pw-region="catalog" data-pw-personalize="recommended"'
  )
  const next = bindLiveProductToPdpHtml(
    html,
    {
      ...PRODUCT_B,
      relatedProducts: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Similar tee',
          imageUrl: 'https://new.example/tee.jpg',
        },
      ],
    },
    { locale: 'vi', siteSlug: 'demo-shop' }
  )
  assert.match(next, /data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"/)
  assert.match(next, /data-pw-related="1"/)
})

test('bind stamps outfit exclude without rewriting outfit cards as related', () => {
  const html = SHELL.replace(
    'data-pw-region="catalog"',
    'data-pw-region="catalog" data-pw-outfit="1" data-pw-grid-kind="outfit"'
  )
  const next = bindLiveProductToPdpHtml(html, PRODUCT_B, { locale: 'vi', siteSlug: 'demo-shop' })
  assert.match(next, /data-pw-outfit="1"/)
  assert.match(next, /data-exclude="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"/)
  assert.match(next, /data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"/)
  assert.match(next, /data-pw-related="1"/)
})

test('bind injects related strip when the shell has no catalog', () => {
  const html = SHELL.replace(
    /<section data-pw-region="catalog">[\s\S]*?<\/section>/,
    ''
  )
  const next = bindLiveProductToPdpHtml(html, PRODUCT_B, { locale: 'vi', siteSlug: 'demo-shop' })
  assert.match(next, /data-pw-related="1"/)
  assert.match(next, /Sản phẩm tương tự/)
})
