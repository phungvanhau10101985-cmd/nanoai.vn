import assert from 'node:assert/strict'
import test from 'node:test'
import { bindLiveCatalogGridsToHtml } from '@/lib/partner-website/shop/bind-live-catalog-grids-to-html'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'

function card(id: string, name: string): PartnerSiteShopProduct {
  return {
    id,
    name,
    imageUrl: `https://img.alicdn.com/img/${id}.jpg`,
    detailPath: `/products/${id}`,
    priceHint: '100.000đ',
  } as PartnerSiteShopProduct
}

test('bindLiveCatalogGridsToHtml paints catalog cards and stamps ready', () => {
  const html =
    '<html><body><section data-pw-catalog data-pw-grid-rows="1">' +
    '<div data-pw-grid><article>demo</article></div></section></body></html>'
  const out = bindLiveCatalogGridsToHtml(
    html,
    { generic: [card('a1', 'Túi A'), card('a2', 'Túi B')], listing: [], personalize: [] },
    { locale: 'vi', device: 'desktop' }
  )
  assert.match(out, /data-pw-live-products="ready"/)
  assert.match(out, /data-inventory-id="a1"/)
  assert.match(out, /class="pw-product-card-hit"/)
  assert.match(out, /class="pw-rec-fav"/)
  assert.doesNotMatch(out, />demo</)
  assert.doesNotMatch(out, /data-pw-add-cart/)
})

test('listing host uses listing cards; outfit and related stay seed', () => {
  const html =
    '<section data-pw-catalog data-category-id="cat-1"><div data-pw-grid></div></section>' +
    '<section data-pw-outfit="1" data-pw-catalog><div data-pw-grid><article>outfit</article></div></section>' +
    '<section data-pw-related="1"><div data-pw-grid><article>related</article></div></section>'
  const out = bindLiveCatalogGridsToHtml(html, {
    generic: [card('g1', 'Generic')],
    listing: [card('l1', 'Listing')],
    personalize: [],
  })
  assert.match(out, /data-inventory-id="l1"/)
  assert.doesNotMatch(out, /data-inventory-id="g1"/)
  assert.match(out, />outfit</)
  assert.match(out, />related</)
})

test('listing host paints one batch of 20 even when the shell is one row', () => {
  const listing = Array.from({ length: 25 }, (_, i) => card(`l${i + 1}`, `SP ${i + 1}`))
  const html =
    '<section data-pw-catalog data-category-id="cat-1" data-pw-grid-rows="1" data-pw-grid-cols="5"><div data-pw-grid></div></section>'
  const out = bindLiveCatalogGridsToHtml(
    html,
    { generic: [], listing, personalize: [] },
    { locale: 'vi', device: 'desktop' }
  )
  assert.match(out, /data-inventory-id="l1"/)
  assert.match(out, /data-inventory-id="l20"/)
  assert.doesNotMatch(out, /data-inventory-id="l21"/)
})

test('home catalog stays one row', () => {
  const generic = Array.from({ length: 8 }, (_, i) => card(`g${i + 1}`, `Home ${i + 1}`))
  const html =
    '<section data-pw-catalog data-pw-grid-rows="1" data-pw-grid-cols="5"><div data-pw-grid></div></section>'
  const out = bindLiveCatalogGridsToHtml(
    html,
    { generic, listing: [], personalize: [] },
    { locale: 'vi', device: 'desktop' }
  )
  assert.match(out, /data-inventory-id="g5"/)
  assert.doesNotMatch(out, /data-inventory-id="g6"/)
})

test('personalize hosts use popular fallback cards', () => {
  const html =
    '<section data-pw-personalize="flash-sale" data-limit="12"><div data-pw-grid></div></section>'
  const out = bindLiveCatalogGridsToHtml(html, {
    generic: [],
    listing: [],
    personalize: [card('p1', 'Phổ biến')],
  })
  assert.match(out, /data-pw-live-products="ready"/)
  assert.match(out, /data-inventory-id="p1"/)
})
