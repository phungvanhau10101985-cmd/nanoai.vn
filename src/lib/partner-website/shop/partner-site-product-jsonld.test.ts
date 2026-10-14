import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerSiteProductJsonLd,
  partnerSiteProductMetaDescription,
} from '@/lib/partner-website/shop/partner-site-product-jsonld'

test('product meta description uses the product text, not the shop name alone', () => {
  const text = partnerSiteProductMetaDescription({
    name: 'Giày sneaker nữ',
    description: '<p>Đế dày lưới thoáng. &amp; lót lông.</p>',
    siteName: 'gudo.vn',
  })
  assert.match(text, /Đế dày lưới thoáng/)
  assert.match(text, /gudo\.vn/)
  assert.doesNotMatch(text, /<p>/)
  assert.equal(
    partnerSiteProductMetaDescription({ name: 'Áo sơ mi', description: '', siteName: 'Shop A' }),
    'Áo sơ mi — Shop A'
  )
})

test('product JSON-LD fills merchant listing shipping, returns, and visible reviews', () => {
  const longName = `Áo sơ mi ${'cotton '.repeat(40)}`
  const data = buildPartnerSiteProductJsonLd({
    name: longName,
    description: 'Cotton',
    images: ['https://cdn.example/a.jpg', 'not-a-url'],
    url: 'https://gudo.vn/products/ao',
    sku: 'Qa0001',
    brandName: `Thương hiệu ${'X'.repeat(90)}`,
    sellerName: 'Gudo',
    price: 1230000,
    priceCurrency: 'VND',
    inStock: true,
    shippingFeeAmount: 30000,
    returnPolicyUrl: 'https://gudo.vn/returns',
    rating: { average: 4.5, total: 2 },
    reviews: [
      { authorName: 'A', rating: 5, body: 'bỏ tên một ký tự' },
      {
        authorName: 'Lan Phạm',
        rating: 5,
        body: '<b>Vải mát</b>',
        datePublished: '2026-04-02',
      },
    ],
  })
  const raw = JSON.stringify(data)
  assert.ok(String(data.name).length <= 150)
  assert.ok(String(data.name).length >= 1)
  assert.doesNotMatch(String(data.name), /…/)
  const brand = data.brand as { name?: string }
  assert.ok((brand.name || '').length <= 70)
  assert.match(raw, /https:\/\/gudo\.vn\/returns/)
  assert.match(raw, /InStock/)
  assert.match(raw, /"value":30000/)
  assert.match(raw, /ShippingDeliveryTime/)
  assert.match(raw, /MerchantReturnFiniteReturnWindow/)
  assert.match(raw, /"merchantReturnDays":7/)
  assert.match(raw, /"minValue":1/)
  assert.match(raw, /"maxValue":7/)
  assert.match(raw, /Lan Phạm/)
  assert.match(raw, /Vải mát/)
  assert.doesNotMatch(raw, /bỏ tên một ký tự/)
  assert.doesNotMatch(raw, /ReturnFees|returnShippingFeesAmount/)
  const offers = (data.offers || {}) as {
    hasMerchantReturnPolicy?: { url?: string; returnPolicyCategory?: string }
    shippingDetails?: { deliveryTime?: { transitTime?: { maxValue?: number } } }
  }
  assert.equal(offers.hasMerchantReturnPolicy?.url, 'https://gudo.vn/returns')
  assert.equal(
    offers.hasMerchantReturnPolicy?.returnPolicyCategory,
    'https://schema.org/MerchantReturnFiniteReturnWindow'
  )
  assert.equal(offers.shippingDetails?.deliveryTime?.transitTime?.maxValue, 7)
  const reviews = data.review as Array<{ author?: { name?: string } }>
  assert.equal(reviews.length, 1)
  assert.equal(reviews[0]?.author?.name, 'Lan Phạm')
})

test('product JSON-LD omits shipping rate when the shop fee is unknown and marks out of stock', () => {
  const data = buildPartnerSiteProductJsonLd({
    name: 'Túi',
    url: 'https://shop.example/products/tui',
    sellerName: 'Shop',
    price: 10000,
    inStock: false,
    shippingFeeAmount: null,
    returnPolicyUrl: 'https://shop.example/returns',
  })
  const raw = JSON.stringify(data)
  assert.match(raw, /OutOfStock/)
  assert.match(raw, /MerchantReturnFiniteReturnWindow/)
  assert.doesNotMatch(raw, /shippingDetails|shippingRate|aggregateRating|"@type":"Review"/)
})
