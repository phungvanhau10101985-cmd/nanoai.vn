import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_OUTFIT_CSS } from '@/lib/partner-website/shop/outfit-products-css'
import {
  PW_PRODUCT_CARD_MEDIA_RULER_CSS,
  PW_PRODUCT_GRID_RULER_CSS,
  PW_PRODUCT_STRIP_GRID_CSS,
} from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { PW_RELATED_CSS } from '@/lib/partner-website/shop/related-products-css'

test('strip grid ruler locks 5 desktop / 2 mobile by data-pw attr, not auto-fit', () => {
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /\[data-pw-related\] \[data-pw-grid\]/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /\[data-pw-outfit\] \[data-pw-grid\]/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /html\[data-pw-scene-lock="mobile"\]/)
  assert.match(PW_PRODUCT_STRIP_GRID_CSS, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/)
  assert.doesNotMatch(PW_PRODUCT_STRIP_GRID_CSS, /auto-fit|auto-fill/)
})

test('card media ruler keeps a square slot and hides broken-image alt text', () => {
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /aspect-ratio:1\/1!important/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /position:absolute!important/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /color:transparent!important/)
  assert.match(PW_PRODUCT_CARD_MEDIA_RULER_CSS, /-webkit-line-clamp:2/)
})

test('related and outfit CSS both ship the shared ruler', () => {
  assert.match(PW_RELATED_CSS, /\[data-pw-related\] \[data-pw-grid\]/)
  assert.match(PW_OUTFIT_CSS, /\[data-pw-outfit\] \[data-pw-grid\]/)
  assert.equal(PW_RELATED_CSS.includes(PW_PRODUCT_GRID_RULER_CSS), true)
  assert.equal(PW_OUTFIT_CSS.includes(PW_PRODUCT_GRID_RULER_CSS), true)
})
