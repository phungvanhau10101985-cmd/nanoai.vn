import assert from 'node:assert/strict'
import test from 'node:test'
import {
  rewriteShopHtmlImageDelivery,
  tightenShopCdnImageUrl,
} from '@/lib/partner-website/shop/shop-image-delivery'

test('bunny product photos gain a width and quality without touching AliCDN or logos', () => {
  assert.equal(
    tightenShopCdnImageUrl('https://gudo-vn-3f93.b-cdn.net/site/manual-products/a.jpg', 640),
    'https://gudo-vn-3f93.b-cdn.net/site/manual-products/a.jpg?width=640&quality=68'
  )
  assert.equal(
    tightenShopCdnImageUrl('https://img.alicdn.com/img/a.jpg_600x600q90.jpg', 640),
    'https://img.alicdn.com/img/a.jpg_600x600q90.jpg'
  )
  const html = rewriteShopHtmlImageDelivery(
    '<img class="pw-logo" src="https://gudo-vn-3f93.b-cdn.net/logo.png" width="120">' +
      '<img src="https://cdn.188.com.vn/site/vay.jpg" alt="Váy">'
  )
  assert.match(html, /pw-logo" src="https:\/\/gudo-vn-3f93\.b-cdn\.net\/logo\.png"/)
  assert.match(html, /vay\.jpg\?width=800&quality=68/)
})
