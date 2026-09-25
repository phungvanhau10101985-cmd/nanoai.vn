import assert from 'node:assert/strict'
import test from 'node:test'
import { WEB_LOCALES } from '@/lib/i18n/config'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteAddressesApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { formatPartnerChatCheckoutQuoteLine } from '@/lib/partner-website/shop/partner-site-chat-checkout-quote'
import {
  checkoutAddressBookInputFromOrder,
  formatPartnerSiteAddressLine,
  parsePartnerSiteAddressInput,
  resolveCheckoutShippingProvince,
  splitCheckoutAddressForBook,
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

test('checkout address keeps book province and writes a new province back', () => {
  assert.deepEqual(
    splitCheckoutAddressForBook({
      shippingAddress: '12 Lê Lợi, Hà Nội',
      shippingProvince: 'Hà Nội',
    }),
    { street_address: '12 Lê Lợi', province: 'Hà Nội' }
  )
  assert.deepEqual(
    splitCheckoutAddressForBook({ shippingAddress: 'Số nhà 9 Trần Phú, Đà Nẵng' }),
    { street_address: 'Số nhà 9 Trần Phú', province: 'Đà Nẵng' }
  )
  assert.equal(
    resolveCheckoutShippingProvince({
      bookProvince: 'Hà Nội',
      shippingAddress: '12 Lê Lợi, Hà Nội',
    }),
    'Hà Nội'
  )
  assert.equal(
    resolveCheckoutShippingProvince({
      bookProvince: 'Hà Nội',
      shippingAddress: 'Số nhà 9 Trần Phú, Đà Nẵng',
    }),
    'Đà Nẵng'
  )
  const saved = checkoutAddressBookInputFromOrder({
    customerName: 'Nguyễn Văn A',
    customerPhone: '0912 345 678',
    shippingAddress: 'Số nhà 9 Trần Phú, Đà Nẵng',
  })
  assert.equal(saved?.province, 'Đà Nẵng')
  assert.equal(saved?.street_address, 'Số nhà 9 Trần Phú')
  assert.equal(saved?.is_default, true)
  assert.equal(
    checkoutAddressBookInputFromOrder({
      customerName: 'A',
      customerPhone: '091',
      shippingAddress: 'Đà Nẵng',
    }),
    null
  )
})

test('chat checkout quote is one line without a voucher field', () => {
  const line = formatPartnerChatCheckoutQuoteLine({
    breakdown: {
      listSubtotal: 1_200_000,
      effectiveSubtotal: 1_140_000,
      flashSaleDiscountAmount: 60_000,
      calendarSaleDiscountAmount: 0,
      birthdayDiscountAmount: 50_000,
      loyaltyDiscountAmount: 0,
    },
    shippingFee: 30_000,
    orderTotal: 1_120_000,
  })
  assert.match(line, /Hàng 1\.200\.000đ/)
  assert.match(line, /Flash sale −60\.000đ/)
  assert.match(line, /CMSN −50\.000đ/)
  assert.match(line, /Ship 30\.000đ/)
  assert.match(line, /Tổng 1\.120\.000đ/)
  assert.doesNotMatch(line, /voucher|mã giảm|ví affiliate/i)
  assert.equal(
    formatPartnerChatCheckoutQuoteLine({
      breakdown: { listSubtotal: 200_000, effectiveSubtotal: 200_000 },
      shippingFee: 0,
      orderTotal: 200_000,
    }),
    'Hàng 200.000đ · Ship 0đ · Tổng 200.000đ'
  )
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
  assert.match(theme, /\.pw-shop-address-modal\{[^}]*z-index:100050/)
  assert.match(theme, /\.pw-shop-address-modal-card\{[^}]*width:min\(760px,92vw\)/)
  assert.match(theme, /\.pw-shop-address-form-grid\{[^}]*container-type:inline-size/)
  assert.match(theme, /\.pw-shop-address-form-grid input:not\(\[type="checkbox"\]\)[^}]*min-height:44px/)
  assert.doesNotMatch(addressCss, /#ea580c|#f97316/)
})
