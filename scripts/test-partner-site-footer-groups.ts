/**
 * Footer chrome: group platform links into shop / shopping / support / legal.
 * Chạy: npx tsx scripts/test-partner-site-footer-groups.ts
 */
import assert from 'node:assert/strict'
import {
  DEFAULT_PARTNER_SITE_FOOTER_LINKS,
  groupPartnerSiteFooterLinks,
  visibleSortedNavLinks,
} from '../src/lib/partner-website/shop/partner-site-nav-footer'
import { getPartnerSiteShopCopy } from '../src/lib/partner-website/shop/partner-site-shop-copy'
import { FASHION_SHOP_FONT_UI, FASHION_SHOP_GOOGLE_FONTS_HREF } from '../src/lib/partner-website/shop/fashion-shop-design'

function main() {
  const grouped = groupPartnerSiteFooterLinks(visibleSortedNavLinks(DEFAULT_PARTNER_SITE_FOOTER_LINKS))
  assert.ok(grouped.shop.some((x) => x.hrefKey === 'about'))
  assert.ok(grouped.shopping.some((x) => x.hrefKey === 'products'))
  assert.ok(grouped.support.some((x) => x.hrefKey === 'shipping'))
  assert.ok(grouped.legal.some((x) => x.hrefKey === 'privacy'))
  const total =
    grouped.shop.length + grouped.shopping.length + grouped.support.length + grouped.legal.length
  assert.equal(total, visibleSortedNavLinks(DEFAULT_PARTNER_SITE_FOOTER_LINKS).length)

  const leftover = groupPartnerSiteFooterLinks([
    { id: 'custom', hrefKey: 'home', visible: true, sortOrder: 0 },
  ])
  assert.equal(leftover.shopping[0]?.hrefKey, 'home')

  for (const locale of ['vi', 'en', 'zh', 'ja', 'ko'] as const) {
    const t = getPartnerSiteShopCopy(locale)
    assert.ok(t.footerColSupport.trim())
    assert.ok(t.footerCopyright.includes('{year}'))
    assert.ok(t.footerCopyright.includes('{shop}'))
  }

  assert.equal(FASHION_SHOP_FONT_UI.includes('Outfit'), false)
  assert.ok(FASHION_SHOP_FONT_UI.includes('Be Vietnam Pro'))
  assert.ok(FASHION_SHOP_GOOGLE_FONTS_HREF.includes('Be+Vietnam+Pro'))
  assert.equal(FASHION_SHOP_GOOGLE_FONTS_HREF.includes('Outfit'), false)

  console.log('test-partner-site-footer-groups: ok')
}

main()
