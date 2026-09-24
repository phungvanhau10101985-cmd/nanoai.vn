import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPartnerFlashSaleActive,
  normalizePartnerSalePriceAmount,
  resolvePartnerEffectiveUnitPrice,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'

test('normalizePartnerSalePriceAmount treats null and 0 as no sale', () => {
  assert.equal(normalizePartnerSalePriceAmount(null), null)
  assert.equal(normalizePartnerSalePriceAmount(undefined), null)
  assert.equal(normalizePartnerSalePriceAmount(''), null)
  assert.equal(normalizePartnerSalePriceAmount(0), null)
  assert.equal(normalizePartnerSalePriceAmount('0'), null)
  assert.equal(normalizePartnerSalePriceAmount(970_000), 970_000)
})

test('flash sale 0 / null must not become a 100% discount', () => {
  const leftoverZero = {
    priceAmount: 1_570_000,
    salePriceAmount: 0,
    saleStartsAt: null,
    saleEndsAt: null,
  }
  const leftoverNull = {
    priceAmount: 1_570_000,
    salePriceAmount: null,
    saleStartsAt: null,
    saleEndsAt: null,
  }
  assert.equal(isPartnerFlashSaleActive(leftoverZero), false)
  assert.equal(isPartnerFlashSaleActive(leftoverNull), false)
  assert.equal(resolvePartnerEffectiveUnitPrice(leftoverZero), 1_570_000)
  assert.equal(resolvePartnerEffectiveUnitPrice(leftoverNull), 1_570_000)
})

test('inventory mapper drops leftover sale_price_amount 0', () => {
  const product = inventoryRowToShopProduct('demo-shop', {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Áo cardigan',
    price_hint: '1.570.000 đ',
    price_amount: 1_570_000,
    sale_price_amount: 0,
    image_url: 'https://cdn.example/cardigan.jpg',
  })
  assert.equal(product?.salePriceAmount, null)
  assert.equal(product?.priceAmount, 1_570_000)
})

test('flash sale hides only after a real empty list, and retries when the API fails', () => {
  const js = buildPartnerSitePersonalizationBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(js, /function loadFlashSale\(el\)/)
  assert.match(js, /path==='\/flash-sale'/)
  assert.match(js, /res\.ok===false/)
  assert.match(js, /el\._pwFlashGen!==gen/)
  assert.match(js, /if\(!products\.length\)\{[\s\S]*el\.hidden=true/)
  assert.match(js, /el\._pwFlashFails/)
  assert.match(js, /el\._pwFlashEmpty/)
  assert.match(js, /flashGrid\.querySelector\('\[data-inventory-id\]'\)\)revealLiveProducts/)
})
