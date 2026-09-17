import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatPushEnabledCopy } from './partner-customer-inapp-copy'
import { hostnameFromHostHeader, isShopCustomDomainHost } from './partner-custom-domain-platform-host'
import { isPartnerShopServiceWorkerScriptUrl } from '@/lib/partner-website/shop/partner-site-pwa'
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
  assert.match(src, /sendTest:\s*Boolean\(input\.sendTest \|\| created\)/)
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
  assert.match(src, /pushTestButton/)
  assert.match(src, /sendTest:\s*true/)
  assert.doesNotMatch(src, /permission !== 'granted' \|\| subscribed/)
  assert.doesNotMatch(src, /setSubscribed\(Boolean\(json\.subscribed\)\)/)
})

test('sending shop push does not load the full website project blob', () => {
  const src = readFileSync(join(here, 'partner-customer-notification-push.ts'), 'utf8')
  assert.match(src, /select site_slug from public\.messaging_partner_websites/)
  assert.match(src, /urgency:\s*'high'/)
  assert.doesNotMatch(src, /fetchPublishedPartnerWebsiteBySlugPg/)
})
