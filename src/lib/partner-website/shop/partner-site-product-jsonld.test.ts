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

test('product JSON-LD points at /returns and does not invent transit days or return fees', () => {
  const data = buildPartnerSiteProductJsonLd({
    name: 'Áo',
    description: 'Cotton',
    images: ['https://cdn.example/a.jpg', 'not-a-url'],
    url: 'https://gudo.vn/products/ao',
    sku: 'Qa0001',
    brandName: '',
    sellerName: 'Gudo',
    price: 1230000,
    priceCurrency: 'VND',
    inStock: true,
    shippingFeeAmount: 30000,
    returnPolicyUrl: 'https://gudo.vn/returns',
    rating: { average: 4.5, total: 2 },
  })
  const raw = JSON.stringify(data)
  assert.match(raw, /https:\/\/gudo\.vn\/returns/)
  assert.match(raw, /InStock/)
  assert.match(raw, /"value":30000/)
  assert.doesNotMatch(raw, /deliveryTime|handlingTime|transitTime|merchantReturnDays|ReturnFees|return-policy/)
  const offers = (data.offers || {}) as { hasMerchantReturnPolicy?: { url?: string } }
  assert.equal(offers.hasMerchantReturnPolicy?.url, 'https://gudo.vn/returns')
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
  assert.doesNotMatch(raw, /shippingDetails|shippingRate/)
})
