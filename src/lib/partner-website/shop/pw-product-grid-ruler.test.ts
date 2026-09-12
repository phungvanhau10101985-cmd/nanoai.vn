import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_OUTFIT_CSS } from '@/lib/partner-website/shop/outfit-products-css'
import {
  PW_PRODUCT_CARD_MEDIA_RULER_CSS,
  PW_PRODUCT_CATALOG_CARD_FACE_CSS,
  PW_PRODUCT_GRID_MORE_CSS,
  PW_PRODUCT_GRID_RULER_CSS,
  PW_PRODUCT_STRIP_GRID_CSS,
} from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { PW_FLASH_SALE_GRID_FACE_CSS } from '@/lib/partner-website/shop/pw-flash-sale-grid-face'
import { PW_RECOMMENDED_GRID_FACE_CSS } from '@/lib/partner-website/shop/pw-recommended-grid-face'
import { PW_RELATED_CSS } from '@/lib/partner-website/shop/related-products-css'

test('strip grid ruler locks 5 desktop / 2 mobile by data-pw attr, not auto-fit', () => {
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /\[data-pw-related\] \[data-pw-grid\]/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /\[data-pw-outfit\] \[data-pw-grid\]/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /html\[data-pw-scene-lock="mobile"\]/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/)
  assert.doesNotMatch(PW_PRODUCT_STRIP_GRID_CSS, /auto-fit|auto-fill/)
})

test('rec and flash-sale cards are the containing block for the favorite overlay', () => {
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\{position:relative;display:flex!important/)
  assert.match(PW_FLASH_SALE_GRID_FACE_CSS, /\[data-pw-personalize="flash-sale"\] \.pw-product-card,[\s\S]*?\{[\s\S]*?position:relative/)
  assert.match(PW_RECOMMENDED_GRID_FACE_CSS, /\[data-pw-personalize="recommended"\] \.pw-product-card,[\s\S]*?\{[\s\S]*?position:relative/)
  assert.match(PW_FLASH_SALE_GRID_FACE_CSS, /\.pw-rec-fav\{[\s\S]*?position:absolute;top:4px;right:4px/)
  assert.match(PW_RECOMMENDED_GRID_FACE_CSS, /\.pw-rec-fav\{[\s\S]*?position:absolute;top:4px;right:4px/)
})

test('catalog cards clamp names to two lines and hide listing add-to-cart', () => {
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\[data-pw-catalog\] \[data-pw-el="card-name"\]/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\.pw-product-card \[data-pw-el="card-name"\]/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /-webkit-line-clamp:2!important/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /max-height:2rem/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\.pw-product-card \.pw-shop-action-bar/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\[data-pw-el="card-cart"\]/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\[data-pw-el="card-buy"\]/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\[data-pw-add-cart\]:not\(\[data-pw-pdp-add-cart\]\)/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /display:none!important/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\.pw-rec-fav/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /\.pw-rec-stats/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /align-items:stretch/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /touch-action:manipulation/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /pw-product-card-hit/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /pointer-events:none/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /@media not all and \(hover:hover\) and \(pointer:fine\)/)
  assert.match(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /transform:none!important/)
  assert.doesNotMatch(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /data-pw-nav="1"/)
  assert.doesNotMatch(PW_PRODUCT_CATALOG_CARD_FACE_CSS, /opacity:\.72/)
  assert.equal(PW_PRODUCT_GRID_RULER_CSS.includes(PW_PRODUCT_CATALOG_CARD_FACE_CSS), true)
})

test('card media ruler keeps a square slot and does not indent the photo away', () => {
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /aspect-ratio:1\/1!important/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /position:absolute!important/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /object-fit:cover!important/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /text-indent:0!important/)
  assert.doesNotMatch(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /text-indent:100%/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /-webkit-line-clamp:2/)
})

test('empty-src hide only targets img, never the media box or loaded photos', () => {
  const hide = PW_PRODUCT_CARD_MEDIA_RULER_CSS.match(/\{visibility:hidden!important\}/g)
  assert.equal((hide || []).length, 1)
  const hideBlock = PW_PRODUCT_CARD_MEDIA_RULER_CSS.split('{visibility:hidden!important}')[0]
  const lastRule = hideBlock.slice(hideBlock.lastIndexOf('\n') + 1)
  for (const part of lastRule.split(',')) {
    assert.match(part, / img(\[src=""\]|:not\(\[src\]\))$/)
  }
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /html \.pw-related-card \.pw-product-card-media img,/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /html \.pw-outfit-card \.pw-product-card-media img,/)
})

test('added product grids hug content and do not keep section padding', () => {
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /\[data-pw-added-catalog\]/)
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /min-height:0!important/)
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /height:auto!important/)
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /padding:12px var\(--pw-page-gutter,16px\) 16px!important/)
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /padding:8px 0 12px!important/)
})

test('catalog titles are sized per device and show see-more plus see-all', () => {
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /font-size:1\.125rem!important/)
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /html\[data-pw-edit-device="mobile"\]/)
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /data-pw-grid-more/)
  assert.match(PW_PRODUCT_GRID_RULER_CSS, /\.pw-related-all/)
  assert.match(PW_PRODUCT_GRID_MORE_CSS, /background:var\(--pw-buy\)/)
  assert.match(PW_PRODUCT_GRID_MORE_CSS, /html \[data-pw-el="section-more"\]\[hidden\]/)
  assert.doesNotMatch(PW_PRODUCT_GRID_MORE_CSS, /html \[data-pw-catalog\] \[data-pw-el="section-more"\],html \[data-pw-personalize\] \[data-pw-el="section-more"\][\s\S]{0,80}\{display:none!important\}/)
})

test('related and outfit CSS both ship the shared ruler', () => {
  assert.match(PW_RELATED_CSS, /\[data-pw-related\] \[data-pw-grid\]/)
  assert.match(PW_OUTFIT_CSS, /\[data-pw-outfit\] \[data-pw-grid\]/)
  assert.equal(PW_RELATED_CSS.includes(PW_PRODUCT_GRID_RULER_CSS), true)
  assert.equal(PW_OUTFIT_CSS.includes(PW_PRODUCT_GRID_RULER_CSS), true)
})
