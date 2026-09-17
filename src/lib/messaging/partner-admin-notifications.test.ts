import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notificationSkipsPlatformWebPush } from '@/lib/notifications/deliver-user-notification-pg'
import { partnerShopPushClickPath } from '@/lib/messaging/partner-shop-push-click-path'

test('shop owner alerts skip the NanoAI platform Web Push channel', () => {
  assert.equal(notificationSkipsPlatformWebPush({ skip_platform_push: true }), true)
  assert.equal(notificationSkipsPlatformWebPush({}), false)
  assert.equal(notificationSkipsPlatformWebPush(null), false)
})

test('shop PWA click keeps absolute dashboard and shop URLs', () => {
  assert.equal(
    partnerShopPushClickPath({
      href: 'https://nanoai.vn/dashboard/messaging/settings?section=hub-orders&partner=abc',
      siteSlug: 'gudo-vn-3f93',
      customDomain: true,
    }),
    'https://nanoai.vn/dashboard/messaging/settings?section=hub-orders&partner=abc'
  )
  assert.equal(
    partnerShopPushClickPath({
      href: '/account/notifications',
      siteSlug: 'gudo-vn-3f93',
      customDomain: true,
    }),
    '/account/notifications'
  )
})

test('owner shop events push to shop PWA, not NanoAI SW', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'partner-admin-notifications.ts'),
    'utf8'
  )
  assert.match(src, /skip_platform_push:\s*true/)
  assert.match(src, /sendPartnerCustomerWebPush/)
  assert.match(src, /findGuestAccountIdByEmailPg/)
  assert.doesNotMatch(src, /sendPushNotificationsToUser/)
})

test('checkout notifies the customer shop PWA as well as the owner', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'guest-chat-ordering.ts'),
    'utf8'
  )
  assert.match(src, /notifyPartnerCustomerOrderPlacedWebApp/)
  assert.match(src, /notifyPartnerOwnerNewOrder/)
})

test('shop SW opens cross-origin dashboard URLs in a new window', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../partner-website/shop/partner-site-pwa.ts'),
    'utf8'
  )
  assert.match(src, /var sameOrigin = urlToOpen\.indexOf\(self\.location\.origin\) === 0/)
})
