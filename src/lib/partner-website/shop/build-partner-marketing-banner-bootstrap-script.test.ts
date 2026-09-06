import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerMarketingBannerBootstrapScript } from '@/lib/partner-website/shop/build-partner-marketing-banner-bootstrap-script'

test('bootstrap paints N slides on the first host and turns leftover widgets off', () => {
  const html = buildPartnerMarketingBannerBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /\/api\/site\/demo-shop\/marketing-banners/)
  assert.match(html, /var WAIT=6500/)
  assert.match(html, /aspect-ratio:21\/9/)
  assert.match(html, /object-fit:contain/)
  assert.match(html, /var host=nodes\[0\]/)
  assert.match(html, /data-pw-banner-live','off'/)
  assert.match(html, /data-pw-personalize-banner','promo'/)
  assert.match(html, /data-pw-promo-carousel/)
  assert.match(html, /items\.forEach\(function\(item,i\)/)
  assert.match(html, /data-pw-promo-slide/)
  assert.match(html, /data-pw-promo-prev/)
  assert.match(html, /data-pw-promo-next/)
  assert.match(html, /data-pw-promo-dots/)
  assert.match(html, /pwShopLiveUiOff/)
  assert.doesNotMatch(html, /#f97316|#ea580c|#fff7ed/)
  assert.doesNotMatch(html, /kind==='sale-calendar'\?'sale':kind/)
})
