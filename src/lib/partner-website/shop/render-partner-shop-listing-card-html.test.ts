import assert from 'node:assert/strict'
import test from 'node:test'
import { renderPartnerShopListingCardsHtml } from '@/lib/partner-website/shop/render-partner-shop-listing-card-html'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'

const products = [
  {
    id: 'id-1',
    name: 'Túi đeo',
    imageUrl: 'https://img.alicdn.com/img/ibank/card.jpg',
    detailPath: '/products/tui-deo',
    priceHint: '199.000đ',
    ratingScore: 4.8,
    purchasesCount: 12,
  },
  {
    id: 'id-2',
    name: 'Giày',
    imageUrl: 'https://img.alicdn.com/img/ibank/shoe.jpg',
    detailPath: '/products/giay',
    priceHint: '299.000đ',
  },
] as PartnerSiteShopProduct[]

test('listing cards match 188 SimpleProductCard: hit link, heart, stats, no add-cart', () => {
  const html = renderPartnerShopListingCardsHtml(products, { locale: 'vi', priority: true })
  assert.match(html, /pw-product-card-media/)
  assert.match(html, /pw-product-card-hit/)
  assert.match(html, /pw-rec-fav/)
  assert.match(html, /Đã bán/)
  assert.doesNotMatch(html, /data-pw-add-cart/)
  assert.doesNotMatch(html, /data-pw-el="card-cart"/)
  assert.match(html, /loading="eager"/)
  assert.match(html, /fetchpriority="high"/)
  assert.match(html, /loading="lazy"/)
  assert.doesNotMatch(html, /\/api\/fetch-image/)
})
