import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SHOP_LISTING_HEAD_SCRIPT,
  PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID,
  PW_HEAD_COMPACT_ATTR,
  PW_LISTING_FILTER_SLOT_ATTR,
  PW_LISTING_HEAD_COLLAPSE_Y,
  PW_LISTING_HEAD_CSS,
  PW_LISTING_HEAD_EXPAND_Y,
} from '@/lib/partner-website/shop/listing-head'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'

test('listing head attaches filters and collapses after scroll', () => {
  assert.equal(PW_HEAD_COMPACT_ATTR, 'data-pw-head-compact')
  assert.equal(PW_LISTING_FILTER_SLOT_ATTR, 'data-pw-listing-filter-slot')
  assert.equal(PW_LISTING_HEAD_COLLAPSE_Y, 72)
  assert.equal(PW_LISTING_HEAD_EXPAND_Y, 28)
  assert.equal(PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID, 'pw-shop-listing-head')
  assert.match(PW_LISTING_HEAD_CSS, /\[data-pw-listing-filter-slot\]/)
  assert.match(PW_LISTING_HEAD_CSS, /\[data-pw-listing-filter-slot\]:empty/)
  assert.match(PW_LISTING_HEAD_CSS, /html\[data-pw-page="listing"\]\[data-pw-head-compact="1"\] \.pw-nav-main/)
  assert.match(PW_LISTING_HEAD_CSS, /min-height:48px/)
  assert.match(PARTNER_SHOP_LISTING_HEAD_SCRIPT, /data-pw-listing-filter-slot/)
  assert.match(PARTNER_SHOP_LISTING_HEAD_SCRIPT, /data-pw-react-filters/)
  assert.match(PARTNER_SHOP_LISTING_HEAD_SCRIPT, /insertAdjacentElement\('afterend'/)
  assert.match(PARTNER_SHOP_LISTING_HEAD_SCRIPT, /nanoai-ve-active/)
  assert.equal(PARTNER_SHOP_LISTING_HEAD_SCRIPT.includes('</script>'), false)
})

test('chrome layout and shop theme ship listing head CSS and script', () => {
  const html = injectPartnerShopChromeLayoutCss('<!DOCTYPE html><html><head></head><body></body></html>')
  assert.match(html, /id="pw-shop-listing-head"/)
  assert.match(html, /data-pw-head-compact/)
  assert.match(html, /data-pw-listing-filter-slot/)
  assert.match(html, /html\[data-pw-page="listing"\]\[data-pw-head-compact="1"\]/)
})
