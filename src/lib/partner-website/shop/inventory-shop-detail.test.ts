import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyShopAlicdnCardSize,
  collectShopProductDetailImages,
  collectShopProductGalleryImages,
  hasValidShopCardImageUrl,
  normalizeShopImageUrl,
  pickShopCardImageRaw,
  shopCardDisplaySrc,
  shopPdpDisplaySrc,
  nextShopImageRetrySrc,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'

test('normalizeShopImageUrl rewrites blocked 188 Bunny host and protocol-relative URLs', () => {
  assert.equal(
    normalizeShopImageUrl('https://188comvn.b-cdn.net/site/a.jpg'),
    'https://cdn.188.com.vn/site/a.jpg'
  )
  assert.equal(
    normalizeShopImageUrl('//188comvn.b-cdn.net/site/a.jpg'),
    'https://cdn.188.com.vn/site/a.jpg'
  )
  assert.equal(normalizeShopImageUrl('https://cdn.188.com.vn/ok.jpg'), 'https://cdn.188.com.vn/ok.jpg')
  assert.equal(
    normalizeShopImageUrl('https://cbu01.alicdn.com/img/ibank/O1CN01a.jpg'),
    'https://img.alicdn.com/img/ibank/O1CN01a.jpg'
  )
  assert.equal(normalizeShopImageUrl(''), '')
  assert.equal(normalizeShopImageUrl('not-a-url'), '')
})

test('PDP src keeps AliCDN original and retries then hides broken 600q90 URLs', () => {
  const broken =
    'https://img.alicdn.com/img/ibank/2020/688/457/21712754886_2079049757.jpg_600x600q90.jpg'
  const raw = 'https://img.alicdn.com/img/ibank/2020/688/457/21712754886_2079049757.jpg'
  assert.equal(shopPdpDisplaySrc(broken), raw)
  assert.equal(shopPdpDisplaySrc(raw), raw)
  assert.equal(nextShopImageRetrySrc(broken), raw)
  assert.equal(
    nextShopImageRetrySrc(raw),
    `/api/fetch-image?url=${encodeURIComponent(raw)}`
  )
  assert.equal(nextShopImageRetrySrc(`/api/fetch-image?url=${encodeURIComponent(raw)}`), null)
})

test('shopCardDisplaySrc reads AliCDN like 188 getProductMainImage (img.alicdn + 600q90)', () => {
  const dress = 'https://img.alicdn.com/img/ibank/O1CN01aUuPLA2Dd3T8T15w4_!!991128631-0-cib.jpg'
  assert.equal(shopCardDisplaySrc(dress), `${dress}_600x600q90.jpg`)
  assert.equal(
    shopCardDisplaySrc('https://cbu01.alicdn.com/img/ibank/O1CN01a.jpg'),
    'https://img.alicdn.com/img/ibank/O1CN01a.jpg_600x600q90.jpg'
  )
  assert.equal(shopCardDisplaySrc('https://cdn.188.com.vn/site/ok.jpg'), 'https://cdn.188.com.vn/site/ok.jpg')
  assert.equal(hasValidShopCardImageUrl('0'), false)
  assert.equal(hasValidShopCardImageUrl('https://188.com.vn'), false)
  assert.equal(
    pickShopCardImageRaw({ image_url: '0', main_image: dress, galleryImages: [] }),
    dress
  )
  assert.equal(applyShopAlicdnCardSize(dress), `${dress}_600x600q90.jpg`)
})

test('collectShopProductGalleryImages and shop mapper keep a reachable https card image', () => {
  const row = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Váy liền thân',
    image_url: 'https://188comvn.b-cdn.net/site/vay.jpg',
    price_hint: '1.520.000đ',
  }
  assert.deepEqual(collectShopProductGalleryImages(row), ['https://cdn.188.com.vn/site/vay.jpg'])
  const product = inventoryRowToShopProduct('demo-shop', row)
  assert.equal(product?.imageUrl, 'https://cdn.188.com.vn/site/vay.jpg')
})

test('collectShopProductGalleryImages is main + column P, not detail images', () => {
  const row = {
    image_url: 'https://cdn.example/main.jpg',
    gallery_urls: ['https://cdn.example/g1.jpg', 'https://cdn.example/main.jpg'],
    detail_image_urls: ['https://cdn.example/d1.jpg', 'https://cdn.example/d2.jpg'],
    colors_json: [{ name: 'Đỏ', img: 'https://cdn.example/red.jpg' }],
    real_use_image_url: 'https://cdn.example/real.jpg',
    material_detail_image_url: 'https://cdn.example/mat.jpg',
  }
  assert.deepEqual(collectShopProductGalleryImages(row), [
    'https://cdn.example/main.jpg',
    'https://cdn.example/g1.jpg',
  ])
  assert.deepEqual(collectShopProductDetailImages(row), [
    'https://cdn.example/d1.jpg',
    'https://cdn.example/d2.jpg',
  ])
})

test('inventoryRowToShopProduct maps catalog 188 fields on PDP', () => {
  const product = inventoryRowToShopProduct(
    'demo-shop',
    {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Áo thun',
      image_url: 'https://cdn.example/main.jpg',
      sku: '',
      remarketing_id: 'P-99',
      brand_name: '188',
      source_origin: 'Trung Quốc',
      material_note: 'Cotton',
      style: 'Basic',
      color_summary: 'Đen, Trắng',
      likes_count: 12,
      purchases_count: 40,
      reviews_count: 8,
      rating_score: 4.6,
      product_info_json: { product_info: { sku: 'P-99', brand: '188' } },
      gallery_urls: ['https://cdn.example/g1.jpg'],
      detail_image_urls: ['https://cdn.example/d1.jpg'],
    },
    { pdp: true }
  )
  assert.equal(product?.sku, 'P-99')
  assert.equal(product?.brandName, '188')
  assert.equal(product?.origin, 'Trung Quốc')
  assert.equal(product?.material, 'Cotton')
  assert.equal(product?.colorSummary, 'Đen, Trắng')
  assert.equal(product?.likesCount, 12)
  assert.equal(product?.purchasesCount, 40)
  assert.deepEqual(product?.galleryImages, ['https://cdn.example/main.jpg', 'https://cdn.example/g1.jpg'])
  assert.deepEqual(product?.detailImages, ['https://cdn.example/d1.jpg'])
  assert.equal((product?.productInfo as { product_info?: { sku?: string } } | null)?.product_info?.sku, 'P-99')
})

test('inventoryRowToShopProduct hydrates empty columns from catalog_json like 188 row', () => {
  const product = inventoryRowToShopProduct(
    'demo-shop',
    {
      id: '55555555-5555-4555-8555-555555555555',
      name: '',
      image_url: '',
      description: '["S","M"]',
      catalog_json: {
        product_id: 'P-188',
        code: 'SKU-188',
        name: 'Áo khoác 188',
        description: '<p>Mô tả HTML từ cột F</p>',
        brand_name: '188 Fashion',
        origin: 'Trung Quốc',
        material: 'Cotton',
        style: 'Basic',
        color: 'Đen',
        likes: 9,
        purchases: 33,
        rating_total: 12,
        rating_point: 4.5,
        images: ['https://cdn.example/g1.jpg', 'https://cdn.example/g2.jpg'],
        gallery: ['https://cdn.example/d1.jpg', 'https://cdn.example/d2.jpg', 'https://cdn.example/d3.jpg'],
        main_image: 'https://cdn.example/main.jpg',
        video_link: 'https://www.youtube.com/watch?v=abc123',
        sizes: ['M', 'L'],
        colors: [{ name: 'Đen', img: 'https://cdn.example/black.jpg' }],
        product_info: { product_info: { sku: 'SKU-188', brand: '188 Fashion' } },
        category: 'Áo',
        subcategory: 'Áo khoác',
        sub_subcategory: '',
      },
    },
    { pdp: true }
  )
  assert.equal(product?.name, 'Áo khoác 188')
  assert.equal(product?.sku, 'SKU-188')
  assert.equal(product?.detailDescription, '<p>Mô tả HTML từ cột F</p>')
  assert.equal(product?.brandName, '188 Fashion')
  assert.equal(product?.origin, 'Trung Quốc')
  assert.equal(product?.material, 'Cotton')
  assert.equal(product?.likesCount, 9)
  assert.equal(product?.purchasesCount, 33)
  assert.deepEqual(product?.galleryImages, [
    'https://cdn.example/main.jpg',
    'https://cdn.example/g1.jpg',
    'https://cdn.example/g2.jpg',
  ])
  assert.deepEqual(product?.detailImages, [
    'https://cdn.example/d1.jpg',
    'https://cdn.example/d2.jpg',
    'https://cdn.example/d3.jpg',
  ])
  assert.equal(product?.imageUrl, 'https://cdn.example/main.jpg')
  assert.equal(product?.productVideoUrl, 'https://www.youtube.com/watch?v=abc123')
  assert.deepEqual(product?.sizes, ['M', 'L'])
  assert.equal(product?.colors[0]?.name, 'Đen')
  assert.equal((product?.productInfo as { product_info?: { sku?: string } } | null)?.product_info?.sku, 'SKU-188')
})

test('PDP consult_note JSON becomes stylist sentence and specs, not a raw dump', () => {
  const consult = JSON.stringify({
    product_info: {
      sku: 'Q2477',
      target_audience_suggestion_vi: 'Phù hợp Nữ 18–35 tuổi, yêu thích phong cách ngọt ngào, thanh lịch',
    },
    specifications: { style: 'Ngọt ngào' },
  })
  const product = inventoryRowToShopProduct(
    'demo-shop',
    {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Áo sơ mi nữ',
      image_url: 'https://cdn.example/shirt.jpg',
      description: '',
      consult_note: consult,
    },
    { pdp: true }
  )
  assert.equal(product?.consultNote, 'Phù hợp Nữ 18–35 tuổi, yêu thích phong cách ngọt ngào, thanh lịch')
  assert.equal(product?.detailDescription, '')
  assert.doesNotMatch(product?.description || '', /\{"product_info"/)
  assert.equal((product?.productInfo as { product_info?: { sku?: string } } | null)?.product_info?.sku, 'Q2477')
})
