import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_SHOP_CART_PAGE_CSS, PW_SHOP_CART_WIDE_MQ } from '@/lib/partner-website/shop/partner-site-cart-page-css'

test('cart page CSS stacks promo/address/actions on compact and does not clip money', () => {
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),[\s\S]*min-width:0!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-row\{[\s\S]*grid-template-columns:22px 64px minmax\(0,1fr\)!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-kv-v\{[\s\S]*white-space:normal!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-promo-row,[\s\S]*flex-direction:column!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-summary \.pw-shop-btn,[\s\S]*white-space:nowrap!important/)
  assert.doesNotMatch(PW_SHOP_CART_PAGE_CSS, /overflow-x:clip/)
})

test('laptop and desktop cart is two columns with unclipped apply/checkout buttons', () => {
  assert.equal(PW_SHOP_CART_WIDE_MQ, '(min-width:1280px)')
  assert.match(PW_SHOP_CART_PAGE_CSS, /@media \(min-width:1280px\)/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /grid-template-columns:minmax\(0,1fr\) minmax\(320px,400px\)!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-promo-row\{[\s\S]*grid-template-columns:minmax\(0,1fr\) max-content!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-actions,[\s\S]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-actions\.pw-shop-cart-stack a\.pw-shop-btn\{[\s\S]*white-space:nowrap!important/)
  assert.doesNotMatch(PW_SHOP_CART_PAGE_CSS, /min-width:1600px/)
})
