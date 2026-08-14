/**
 * Shop SaaS Web Push — click path + SW handlers.
 * Chạy: npx tsx scripts/test-partner-shop-web-push.ts
 */
import assert from 'node:assert/strict'
import { partnerShopPushClickPath } from '../src/lib/messaging/partner-shop-push-click-path'
import { buildPartnerShopServiceWorkerSource } from '../src/lib/partner-website/shop/partner-site-pwa'

function main() {
  const slug = '188-com-vn-rl56'

  assert.equal(
    partnerShopPushClickPath({ href: '', siteSlug: slug, customDomain: false }),
    `/site/${slug}/account/notifications`
  )
  assert.equal(
    partnerShopPushClickPath({ href: '', siteSlug: slug, customDomain: true }),
    '/account/notifications'
  )
  assert.equal(
    partnerShopPushClickPath({
      href: `/site/${slug}/account/orders`,
      siteSlug: slug,
      customDomain: true,
    }),
    '/account/orders'
  )
  assert.equal(
    partnerShopPushClickPath({
      href: '/account/orders',
      siteSlug: slug,
      customDomain: false,
    }),
    `/site/${slug}/account/orders`
  )
  assert.equal(
    partnerShopPushClickPath({
      href: `https://188.com.vn/account/notifications`,
      siteSlug: slug,
      customDomain: true,
    }),
    '/account/notifications'
  )

  const sw = buildPartnerShopServiceWorkerSource({
    siteSlug: slug,
    startUrl: `/site/${slug}/`,
    customDomain: false,
    inboxPath: `/site/${slug}/account/notifications`,
    iconPath: `/site/${slug}/pwa-icon/192`,
  })
  assert.match(sw, /addEventListener\('push'/)
  assert.match(sw, /addEventListener\('notificationclick'/)
  assert.match(sw, /PW_SHOP_NOTIFICATIONS_REFRESH/)
  assert.match(sw, /pw-shop-shell-v4/)
  assert.doesNotMatch(sw, /#f97316|#ea580c|orange-/)

  console.log('OK — partner shop web push')
}

main()
