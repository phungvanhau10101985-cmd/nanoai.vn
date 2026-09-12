import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerSiteCatalogBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'
import { buildPartnerSiteOutfitBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-outfit-bootstrap-script'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listingCardFavHtml, listingCardStatsHtml } from '@/lib/partner-website/shop/listing-card-html'
import { PW_PRODUCT_CATALOG_CARD_FACE_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'

test('catalog live cards do not render listing add-to-cart', () => {
  const js = buildPartnerSiteCatalogBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(js, /function renderCard/)
  assert.doesNotMatch(js, /class="pw-btn pw-btn-cart"/)
  assert.doesNotMatch(js, /pw-shop-action-bar">/)
  assert.doesNotMatch(js, /COPY\.addToCart/)
  assert.match(js, /function listingFavHtml/)
  assert.match(js, /function listingStatsHtml/)
  assert.match(js, /pw-rec-fav/)
  assert.match(js, /pw-rec-stats/)
  assert.match(js, /Đã bán/)
  assert.match(js, /pw-product-card-hit/)
  assert.doesNotMatch(js, /Chi tiết sản phẩm/)
  assert.doesNotMatch(js, /pwElAttr\(PW_EL\.cardBuy\)/)
})

test('personalize live cards do not render listing add-to-cart', () => {
  const js = buildPartnerSitePersonalizationBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(js, /function renderCard/)
  assert.doesNotMatch(js, /class="pw-btn pw-btn-cart"/)
  assert.doesNotMatch(js, /pw-shop-action-bar">/)
  assert.doesNotMatch(js, /COPY\.addToCart/)
  assert.match(js, /function listingFavHtml/)
  assert.match(js, /function listingStatsHtml/)
  assert.match(js, /\+mark\+fav\+'<img/)
  assert.match(js, /pw-product-card-hit/)
})

test('shop-actions does not inject add-to-cart onto listing cards', () => {
  const js = buildPartnerSiteShopActionsBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(js, /function enhanceCards/)
  assert.doesNotMatch(js, /pw-shop-action-bar/)
  assert.match(js, /data-pw-add-cart/)
})

test('outfit live cards use listing heart and sold stats, not Chi tiết', () => {
  const js = buildPartnerSiteOutfitBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(js, /function listingFavHtml/)
  assert.match(js, /function listingStatsHtml/)
  assert.match(js, /pw-rec-fav/)
  assert.match(js, /pw-rec-stats/)
  assert.match(js, /Đã bán/)
  assert.match(js, /pw-product-card-hit/)
  assert.doesNotMatch(js, /Chi tiết sản phẩm/)
})

test('ruler CSS hides leftover listing cart and Chi tiết buttons and keeps PDP add-cart', () => {
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\[data-pw-add-cart\]:not\(\[data-pw-pdp-add-cart\]\)/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /display:none!important/)
  assert.doesNotMatch(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\[data-pw-pdp-add-cart\]\{display:none/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\[data-pw-el="card-buy"\]/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\.pw-rec-fav/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\.pw-rec-stats/)
})

test('listing HTML helper stamps heart overlay and sold stats', () => {
  const fav = listingCardFavHtml('abc-1', 'Thích')
  assert.match(fav, /class="pw-rec-fav"/)
  assert.match(fav, /data-pw-favorite/)
  assert.match(fav, /data-inventory-id="abc-1"/)
  const stats = listingCardStatsHtml({ rating: 4.8, sold: 12, soldLabel: 'Đã bán' })
  assert.match(stats, /★ 4\.8/)
  assert.match(stats, /Đã bán: 12/)
})

test('React listing card has heart + stats and no Chi tiết button', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(join(here, '../../../components/partner-website/shop/partner-site-listing-product-card.tsx'), 'utf8')
  assert.match(src, /PartnerSiteListingProductCard/)
  assert.match(src, /pw-rec-fav/)
  assert.match(src, /pw-rec-stats/)
  assert.match(src, /pw-product-card-hit/)
  assert.match(src, /pdpPurchasesLabel/)
  assert.doesNotMatch(src, /t\.productDetail/)
  assert.doesNotMatch(src, /PW_EL\.cardBuy/)
})
