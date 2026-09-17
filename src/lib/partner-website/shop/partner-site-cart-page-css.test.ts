import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_SHOP_CART_PAGE_CSS } from '@/lib/partner-website/shop/partner-site-cart-page-css'

test('cart page CSS stacks promo/address/actions and does not clip money', () => {
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),[\s\S]*min-width:0!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-row\{[\s\S]*grid-template-columns:22px 64px minmax\(0,1fr\)!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-kv-v\{[\s\S]*white-space:normal!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-promo-row,[\s\S]*flex-direction:column!important/)
  assert.match(PW_SHOP_CART_PAGE_CSS, /\.pw-shop-cart-summary \.pw-shop-btn,[\s\S]*white-space:normal!important/)
  assert.doesNotMatch(PW_SHOP_CART_PAGE_CSS, /overflow-x:clip/)
})
