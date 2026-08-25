import assert from 'node:assert/strict'
import test from 'node:test'
import { WEB_LOCALES } from '@/lib/i18n/config'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteAddressesApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  formatPartnerSiteAddressLine,
  parsePartnerSiteAddressInput,
} from '@/lib/partner-website/shop/partner-site-customer-address'
import { VIETNAM_PROVINCES } from '@/lib/partner-website/shop/vietnam-provinces'

test('address book copy exists for all shop locales', () => {
  for (const locale of WEB_LOCALES) {
    const shop = getPartnerSiteShopCopy(locale)
    assert.ok(shop.accountAddressBook)
    assert.ok(shop.addressAdd)
    assert.ok(shop.addressStreet)
    assert.ok(shop.addressCartTitle)
    assert.ok(shop.addressManageBook)
    assert.ok(shop.addressProvincePlaceholder)
  }
})

test('vietnam provinces match 188 dropdown (63 names)', () => {
  assert.equal(VIETNAM_PROVINCES.length, 63)
  assert.ok(VIETNAM_PROVINCES.includes('Hồ Chí Minh'))
  assert.ok(VIETNAM_PROVINCES.includes('Hà Nội'))
})

test('format and parse customer address like 188', () => {
  assert.equal(
    formatPartnerSiteAddressLine({
      street_address: '12 Lê Lợi',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      province: 'Hồ Chí Minh',
    }),
    '12 Lê Lợi, Bến Nghé, Quận 1, Hồ Chí Minh'
  )
  assert.equal(parsePartnerSiteAddressInput({ full_name: 'A', phone: '0912345678', street_address: '12 Lê Lợi' }), null)
  const parsed = parsePartnerSiteAddressInput({
    full_name: 'Nguyễn Văn A',
    phone: '0912 345 678',
    street_address: '12 Lê Lợi',
    province: 'Hồ Chí Minh',
    is_default: true,
  })
  assert.deepEqual(parsed, {
    full_name: 'Nguyễn Văn A',
    phone: '0912345678',
    province: 'Hồ Chí Minh',
    district: '',
    ward: '',
    street_address: '12 Lê Lợi',
    is_default: true,
  })
})

test('address book API path and theme tokens', () => {
  assert.equal(partnerSiteAddressesApiPath('demo-shop'), '/api/site/demo-shop/addresses')
  assert.equal(
    partnerSiteAddressesApiPath('demo-shop', '11111111-1111-1111-1111-111111111111', 'default'),
    '/api/site/demo-shop/addresses/11111111-1111-1111-1111-111111111111/default'
  )
  const theme = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  const addressCss = theme.match(/\.pw-shop-address-head[\s\S]*?\.pw-shop-address-delete-btn\{[^}]+\}/)?.[0] || ''
  assert.match(theme, /\.pw-shop-address-pick-item/)
  assert.match(addressCss, /--pw-primary/)
  assert.doesNotMatch(addressCss, /#ea580c|#f97316/)
})
