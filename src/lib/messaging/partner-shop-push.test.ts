import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatPushEnabledCopy } from './partner-customer-inapp-copy'
import { hostnameFromHostHeader, isShopCustomDomainHost } from './partner-custom-domain-platform-host'
import { isPartnerShopServiceWorkerScriptUrl, partnerShopServiceWorkerSourceIsShop, buildPartnerShopServiceWorkerSource } from '@/lib/partner-website/shop/partner-site-pwa'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { WEB_LOCALES } from '@/lib/i18n/config'

const here = dirname(fileURLToPath(import.meta.url))

test('gudo.vn Host is a shop custom domain even without middleware header', () => {
  assert.equal(hostnameFromHostHeader('gudo.vn:443'), 'gudo.vn')
  assert.equal(isShopCustomDomainHost('gudo.vn'), true)
  assert.equal(isShopCustomDomainHost('gudo.vn:443'), true)
  assert.equal(isShopCustomDomainHost('www.gudo.vn'), true)
  assert.equal(isShopCustomDomainHost('nanoai.vn'), false)
  assert.equal(isShopCustomDomainHost('www.nanoai.vn'), false)
  assert.equal(isShopCustomDomainHost('localhost:3000'), false)
  assert.equal(isShopCustomDomainHost(''), false)
})

test('only tenant shop SW scripts count as shop workers', () => {
  assert.equal(isPartnerShopServiceWorkerScriptUrl('https://gudo.vn/pw-shop-sw.js'), true)
  assert.equal(
    isPartnerShopServiceWorkerScriptUrl('https://nanoai.vn/site/gudo-vn-3f93/sw.js'),
    true
  )
  assert.equal(isPartnerShopServiceWorkerScriptUrl('https://gudo.vn/sw.js'), true)
  assert.equal(isPartnerShopServiceWorkerScriptUrl('https://nanoai.vn/sw.js'), false)
  assert.equal(partnerShopServiceWorkerSourceIsShop("/* Partner shop SW */\nconst CACHE = 'pw-shop-shell-v5-gudo';"), true)
  assert.equal(
    partnerShopServiceWorkerSourceIsShop("var title = data.title || 'NanoAI'\nicon: '/icons/icon-192x192.png'"),
    false
  )
})

test('push-enabled confirmation copy is locale-native, not an email subject dump', () => {
  const vi = formatPushEnabledCopy('vi')
  assert.equal(vi.title, 'Thông báo đẩy đã bật')
  assert.match(vi.body, /thiết bị/)
  const en = formatPushEnabledCopy('en')
  assert.equal(en.title, 'Push notifications are on')
  assert.doesNotMatch(en.body, /Payment status/)
})

test('notifications card has Gửi thử in every web locale', () => {
  for (const locale of WEB_LOCALES) {
    const t = getPartnerSiteShopCopy(locale)
    assert.ok(t.pushTestButton.trim())
  }
  assert.equal(getPartnerSiteShopCopy('vi').pushTestButton, 'Gửi thông báo thử')
})

test('shop push subscribe drops leftover NanoAI SW and can send a test ping', () => {
  const src = readFileSync(
    join(here, '../partner-website/shop/partner-site-push-subscribe-client.ts'),
    'utf8'
  )
  assert.match(src, /ensurePartnerShopServiceWorkerRegistration/)
  assert.match(src, /unregister\(\)/)
  assert.match(src, /shopReg/)
  assert.match(src, /sendTest:\s*Boolean\(input\.sendTest\)/)
  assert.match(src, /registrationScriptIsShopWorker/)
  assert.match(src, /ensurePartnerSitePushDefaultOn/)
  assert.match(src, /partnerShopPushUserOptedOut/)
  assert.doesNotMatch(src, /getRegistration\(scope\)[\s\S]{0,80}pushManager\.subscribe/)
})

test('push API stamps customDomain from Host and sends a test notification', () => {
  const src = readFileSync(join(here, '../../app/api/site/[slug]/push/route.ts'), 'utf8')
  assert.match(src, /isShopCustomDomainHost/)
  assert.match(src, /x-forwarded-host/)
  assert.match(src, /formatPushEnabledCopy/)
  assert.match(src, /sendPartnerCustomerWebPush/)
})

test('notifications card still syncs this device when another device already subscribed', () => {
  const src = readFileSync(
    join(here, '../../components/partner-website/shop/partner-site-push-enable-card.tsx'),
    'utf8'
  )
  assert.match(src, /pushDisableButton/)
  assert.match(src, /partnerShopPushUserOptedOut/)
  assert.match(src, /sendTest:\s*true/)
  assert.match(src, /partnerShopPushCannotAutoSubscribe/)
  assert.doesNotMatch(src, /permission !== 'granted' \|\| subscribed/)
  assert.doesNotMatch(src, /setSubscribed\(Boolean\(json\.subscribed\)\)/)
})

test('shop push defaults on and uses shop favicon, never NanoAI icons', () => {
  const boot = readFileSync(
    join(here, '../../components/partner-website/shop/partner-site-shop-push-boot.tsx'),
    'utf8'
  )
  const card = readFileSync(
    join(here, '../../components/partner-website/shop/partner-site-push-enable-card.tsx'),
    'utf8'
  )
  const client = readFileSync(
    join(here, '../partner-website/shop/partner-site-push-subscribe-client.ts'),
    'utf8'
  )
  const icon = readFileSync(join(here, '../partner-website/shop/partner-site-pwa-icon.ts'), 'utf8')
  const pwa = readFileSync(join(here, '../partner-website/shop/partner-site-pwa.ts'), 'utf8')
  const push = readFileSync(join(here, 'partner-customer-notification-push.ts'), 'utf8')
  const sw = buildPartnerShopServiceWorkerSource({
    siteSlug: 'gudo-vn',
    startUrl: '/',
    customDomain: true,
    iconPath: '/pwa-icon/192',
  })
  assert.match(client, /ensurePartnerSitePushDefaultOn/)
  assert.match(client, /partnerShopPushUserOptedOut/)
  assert.match(boot, /ensurePartnerSitePushDefaultOn/)
  assert.match(boot, /pageshow/)
  assert.match(boot, /visibilitychange/)
  assert.doesNotMatch(boot, /setTimeout/)
  assert.match(card, /pageshow/)
  assert.match(card, /disablePartnerSitePush/)
  assert.match(icon, /letterTilePng/)
  assert.doesNotMatch(icon, /icon-192x192/)
  assert.doesNotMatch(icon, /apple-touch-icon\.png/)
  assert.match(pwa, /data\.icon \|\| ICON/)
  assert.match(pwa, /pw-shop-shell-v5-/)
  assert.match(sw, /data\.icon \|\| ICON/)
  assert.doesNotMatch(sw, /icon-192x192\.png/)
  assert.doesNotMatch(sw, /NanoAI/)
  assert.match(push, /partnerShopPushIconPath/)
  assert.doesNotMatch(push, /icons\/icon-192x192/)
  for (const locale of WEB_LOCALES) {
    const t = getPartnerSiteShopCopy(locale)
    assert.ok(t.pushChromeIosHint.trim())
    assert.ok(t.pushDisableButton.trim())
  }
})

test('sending shop push does not load the full website project blob', () => {
  const src = readFileSync(join(here, 'partner-customer-notification-push.ts'), 'utf8')
  assert.match(src, /select site_slug from public\.messaging_partner_websites/)
  assert.match(src, /partnerShopPushIconPath/)
  assert.match(src, /urgency:\s*'high'/)
  assert.doesNotMatch(src, /icons\/icon-192x192/)
  assert.doesNotMatch(src, /fetchPublishedPartnerWebsiteBySlugPg/)
})
