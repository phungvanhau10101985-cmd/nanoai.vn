import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindLiveProductToPdpHtml,
  deferOffDevicePdpGalleryMedia,
  restoreDeferredPdpGalleryMediaInHtml,
} from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import { buildDefaultDemoPdpShellHtml } from '@/lib/partner-website/shop/build-default-demo-pdp-shell-html'
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
  assert.doesNotMatch(next, /data-pw-pdp-video-thumb/)
})

test('bind puts product video as second gallery thumb like 188', () => {
  const next = bindLiveProductToPdpHtml(SHELL, {
    ...PRODUCT_B,
    productVideoUrl: 'https://cdn.example/look.mp4',
  })
  assert.match(next, /data-pw-pdp-video-thumb/)
  assert.match(next, /data-pw-pdp-hero-video/)
  assert.match(next, /look\.mp4/)
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

test('restoreDeferredPdpGalleryMediaInHtml puts src back on parked gallery images', () => {
  const html = `<img class="pw-shop-product-img" data-pw-el="main-image" data-pw-deferred-src="https://cdn.example/desk.jpg" alt="y" />`
  const next = restoreDeferredPdpGalleryMediaInHtml(html)
  assert.match(next, /src="https:\/\/cdn\.example\/desk\.jpg"/)
  assert.doesNotMatch(next, /data-pw-deferred-src/)
})

test('bind restores parked gallery src then rewrites it to the live product', () => {
  const html = `<!DOCTYPE html><html><body data-pw-page="product">
<section data-pw-region="gallery" class="pw-shop-product-gallery pw-pdp-gallery-desktop">
  <img class="pw-shop-product-img" data-pw-el="main-image" data-pw-deferred-src="https://old.example/parked.jpg" alt="Old" />
</section>
<div data-pw-region="pdp-info"><h1 class="pw-pdp-title" data-pw-el="title">Old</h1></div>
</body></html>`
  const next = bindLiveProductToPdpHtml(html, PRODUCT_B)
  assert.match(next, /src="https:\/\/new\.example\/shirt\.jpg"/)
  assert.doesNotMatch(next, /data-pw-deferred-src/)
  assert.doesNotMatch(next, /old\.example\/parked/)
})

test('bind injects a visible main image when the gallery region has none', () => {
  const html = `<!DOCTYPE html><html><body data-pw-page="product">
<section data-pw-region="gallery" class="pw-shop-product-gallery pw-pdp-gallery-desktop"></section>
<div data-pw-region="pdp-info"><h1 class="pw-pdp-title" data-pw-el="title">Old</h1></div>
</body></html>`
  const next = bindLiveProductToPdpHtml(html, PRODUCT_B)
  assert.match(next, /class="pw-shop-product-img"/)
  assert.match(next, /src="https:\/\/new\.example\/shirt\.jpg"/)
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
  assert.match(next, /pw-related-grid/)
  assert.doesNotMatch(next, /alt="Similar tee"/)
  assert.doesNotMatch(next, /data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"/)
})

test('bind related strip keeps at most 5 first-paint cards and stamps ruler grid class', () => {
  const html = SHELL.replace(
    '<section data-pw-region="catalog"><article data-pw-el="card" data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"><h3 data-pw-el="card-name">Related</h3></article></section>',
    '<section data-pw-region="catalog" data-pw-related="1"><div data-pw-grid class="pw-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"><article data-pw-el="card" data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"><h3 data-pw-el="card-name">Related</h3></article></div></section>'
  )
  const relatedProducts = Array.from({ length: 8 }, (_, i) => ({
    id: `33333333-3333-4333-8333-33333333333${i}`,
    name: `Similar ${i}`,
    imageUrl: `https://new.example/tee-${i}.jpg`,
  }))
  const next = bindLiveProductToPdpHtml(
    html,
    { ...PRODUCT_B, relatedProducts },
    { locale: 'vi', siteSlug: 'demo-shop' }
  )
  assert.match(next, /pw-related-grid/)
  assert.match(next, /pw-product-grid/)
  assert.doesNotMatch(next, /auto-fit/)
  assert.equal((next.match(/class="pw-product-card pw-related-card"/g) || []).length, 5)
  assert.doesNotMatch(next, /Similar 5/)
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

test('bind fills outfit slots and card images like 188 main_image', () => {
  const html = SHELL.replace(
    'data-pw-region="catalog"',
    'data-pw-region="catalog" data-pw-outfit="1" data-pw-grid-kind="outfit"'
  ).replace(
    '<article data-pw-el="card" data-inventory-id="cccccccc-cccc-cccc-cccc-cccccccccccc"><h3 data-pw-el="card-name">Related</h3></article>',
    '<div data-pw-outfit-slots></div><div data-pw-grid></div>'
  )
  const dress = 'https://img.alicdn.com/img/ibank/O1CN01aUuPLA2Dd3T8T15w4_!!991128631-0-cib.jpg'
  const next = bindLiveProductToPdpHtml(
    html,
    {
      ...PRODUCT_B,
      outfitTitle: 'Phối với váy này',
      outfitSlots: [
        {
          id: 'shoes',
          label: 'Giày',
          listingHref: '/site/demo-shop/c/giay',
          items: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Giày sandal', imageUrl: dress, priceHint: '320.000đ' }],
        },
      ],
    },
    { locale: 'vi', siteSlug: 'demo-shop' }
  )
  assert.match(next, /data-pw-outfit-slot="shoes"/)
  assert.match(next, /Giày sandal/)
  assert.match(next, /img\.alicdn\.com\/img\/ibank\/O1CN01aUuPLA2Dd3T8T15w4_!!991128631-0-cib\.jpg_600x600q90\.jpg/)
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

test('bind strips leftover demo material and real-use photos from the shared PDP shell', () => {
  const leftover = `<!DOCTYPE html><html><body data-pw-page="product">
<section class="pw-shop-product-detail">
  <div data-pw-pdp-slot="tabs">old</div>
  <div data-pw-pdp-slot="material"><h2>Ảnh chất liệu</h2><div class="pw-shop-detail-grid"><img src="https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/material-1-a3-1786251749-b5707ab23f.jpg" alt="Đầm voan trễ vai tiểu thư họa tiết hoa thêu" loading="lazy" decoding="async" /></div></div>
  <div data-pw-pdp-slot="real-use"><h2>Ảnh thực tế</h2><div class="pw-shop-detail-grid"><img src="https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-1-a2-1786247712-b45667f642.jpg" alt="Đầm voan trễ vai tiểu thư họa tiết hoa thêu" loading="lazy" decoding="async" /></div></div>
</section>
</body></html>`
  const next = bindLiveProductToPdpHtml(leftover, PRODUCT_B)
  assert.match(next, /Cotton shirt/)
  assert.doesNotMatch(next, /material-1-a3-1786251749/)
  assert.doesNotMatch(next, /gallery-1-a2-1786247712/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="material"/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="real-use"/)
  const fromFactory = bindLiveProductToPdpHtml(buildDefaultDemoPdpShellHtml({ locale: 'vi' }), PRODUCT_B)
  assert.doesNotMatch(fromFactory, /data-pw-pdp-slot="material"/)
  assert.doesNotMatch(fromFactory, /data-pw-pdp-slot="real-use"/)
  assert.doesNotMatch(fromFactory, /material-1-a3-1786251749/)
})

test('bind fills live 188 fields only — empty sizes/colors/consult do not keep demo leftovers', () => {
  const bag = {
    ...PRODUCT_B,
    name: 'Túi Xách Tay Nam Da Thật Công Sở',
    sku: 'A4827',
    sizes: [] as string[],
    colors: [
      { name: 'Màu đen', img: 'https://cdn.example/black.jpg' },
      { name: 'Màu đỏ cam', img: 'https://cdn.example/orange.jpg' },
    ],
    stockQty: 500,
    depositPolicy: false,
    relatedProducts: [],
    outfitSlots: [],
  }
  const next = bindLiveProductToPdpHtml(buildDefaultDemoPdpShellHtml({ locale: 'vi' }), bag)
  assert.match(next, /Túi Xách Tay Nam Da Thật Công Sở/)
  assert.match(next, /A4827/)
  assert.match(next, /data-pw-pdp-option-value="Màu đen"/)
  assert.match(next, /data-pw-pdp-option="color"/)
  assert.doesNotMatch(next, /data-pw-pdp-option="size"/)
  assert.doesNotMatch(next, /data-pw-pdp-option-value="S"/)
  assert.doesNotMatch(next, /data-pw-pdp-option-value="XL"/)
  assert.doesNotMatch(next, /Phù hợp Nữ 18/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="consult"/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="flash"/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="low-stock"/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="savings"/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="deposit"/)
  assert.doesNotMatch(next, /data-pw-pdp-slot="size-guide"/)
  assert.doesNotMatch(next, /Form đẹp/)
  assert.doesNotMatch(next, /Đầm voan/)
  assert.doesNotMatch(next, /Áo thun nữ cổ thuyền/)
})

test('bind writes this product material and real-use photos instead of shell leftovers', () => {
  const leftover = `<!DOCTYPE html><html><body data-pw-page="product">
<section class="pw-shop-product-detail">
  <div data-pw-pdp-slot="material"><img src="https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/material-1-a3-1786251749-b5707ab23f.jpg" alt="Đầm voan" /></div>
  <div data-pw-pdp-slot="real-use"><img src="https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-1-a2-1786247712-b45667f642.jpg" alt="Đầm voan" /></div>
</section>
</body></html>`
  const next = bindLiveProductToPdpHtml(leftover, {
    ...PRODUCT_B,
    materialImageUrl: 'https://new.example/mat.jpg',
    realUseImageUrls: ['https://new.example/real.jpg'],
  })
  assert.match(next, /https:\/\/new\.example\/mat\.jpg/)
  assert.match(next, /https:\/\/new\.example\/real\.jpg/)
  assert.match(next, /data-pw-pdp-slot="material"/)
  assert.match(next, /data-pw-pdp-slot="real-use"/)
  assert.doesNotMatch(next, /material-1-a3-1786251749/)
  assert.doesNotMatch(next, /gallery-1-a2-1786247712/)
})

test('bind fills catalog stats, brand, tabs, and every detail photo', () => {
  const next = bindLiveProductToPdpHtml(
    SHELL,
    {
      ...PRODUCT_B,
      brandName: '188 Fashion',
      origin: 'Trung Quốc',
      material: 'Cotton',
      ratingScore: 4.7,
      reviewsCount: 21,
      purchasesCount: 90,
      galleryImages: ['https://new.example/shirt.jpg'],
      detailImages: ['https://new.example/d1.jpg', 'https://new.example/d2.jpg', 'https://new.example/d3.jpg'],
      productInfo: { product_info: { sku: 'SHIRT-9', brand: '188 Fashion' } },
    },
    { locale: 'vi' }
  )
  assert.match(next, /Thương hiệu: 188 Fashion/)
  assert.match(next, /4\.7/)
  assert.match(next, /90/)
  assert.match(next, /Đã bán/)
  assert.match(next, /pw-pdp-stats-dot/)
  assert.match(next, /data-pw-pdp-slot="tabs"/)
  assert.match(next, /Thông tin sản phẩm/)
  assert.match(next, /https:\/\/new\.example\/d1\.jpg/)
  assert.match(next, /https:\/\/new\.example\/d3\.jpg/)
  assert.match(next, /pw-pdp-detail-photos/)
  assert.doesNotMatch(next, /https:\/\/new\.example\/d2\.jpg[^"]*"[^>]*data-pw-el="thumb"/)
})

test('bind updates like count without wiping the sticky heart icon', () => {
  const html = `<nav class="pw-pdp-sticky" data-pw-pdp-bottom="1">
    <button type="button" class="is-fav" data-pw-chrome-btn="favorite-product" data-pw-favorite data-pw-pdp-favorite="1" data-pw-like-base="0">
      <svg class="pw-pdp-like-icon" width="17" height="17" viewBox="0 0 24 24"></svg>
      <span class="pw-pdp-like-copy"><span>Thích</span><span class="pw-pdp-like-count" data-pw-like-count>0</span></span>
    </button>
  </nav>
  <div data-pw-region="pdp-info">
    <button type="button" data-pw-favorite data-pw-pdp-favorite="1">♡ <span data-pw-like-count>0</span></button>
  </div>`
  const next = bindLiveProductToPdpHtml(html, { ...PRODUCT_B, likesCount: 121 })
  assert.match(next, /data-pw-like-base="121"/)
  assert.match(next, /data-pw-like-count[^>]*>121</)
  assert.match(next, /pw-pdp-like-icon/)
  assert.match(next, /<span>Thích<\/span>/)
  assert.doesNotMatch(next, /class="is-fav"[^>]*>♡ 121/)
})

test('bind upgrades a legacy sticky favorite into 188 like-copy without wiping the heart', () => {
  const html = `<body data-pw-page="product">
    <nav class="pw-bottom-nav pw-pdp-sticky" data-pw-pdp-bottom="1">
      <div class="pw-pdp-sticky-nav">
        <a data-pw-chrome-btn="home"><svg width="22" height="22"></svg><span>Trang chủ</span></a>
        <button type="button" class="is-try" data-pw-chrome-btn="try-on"><span>Thử đồ AI</span></button>
        <button type="button" class="is-fav" data-pw-chrome-btn="favorite-product" data-pw-favorite data-pw-pdp-favorite="1">
          <svg class="pw-pdp-like-icon" width="22" height="22" viewBox="0 0 24 24"></svg><span>Thích sản phẩm</span>
        </button>
      </div>
      <div class="pw-pdp-sticky-ctas">
        <button type="button" data-pw-add-cart>Thêm giỏ</button>
        <button type="button" data-pw-buy>Mua hàng</button>
      </div>
    </nav>
  </body>`
  const next = bindLiveProductToPdpHtml(html, { ...PRODUCT_B, likesCount: 121 }, { locale: 'vi', siteSlug: 'demo-shop' })
  assert.match(next, /data-pw-chrome-btn="try-on"[^>]*data-nanoai-image="https:\/\/new\.example\/shirt\.jpg"/)
  assert.match(next, /data-nanoai-sku="SHIRT-9"/)
  assert.match(next, /data-nanoai-inventory="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"/)
  assert.match(next, /pw-pdp-like-icon/)
  assert.match(next, /pw-pdp-like-copy/)
  assert.match(next, /pw-pdp-sticky-copy/)
  assert.match(next, /data-pw-like-count[^>]*>121</)
  assert.doesNotMatch(next, /Thích sản phẩm/)
  assert.doesNotMatch(next, /class="is-fav"[^>]*>♡ 121/)
})
