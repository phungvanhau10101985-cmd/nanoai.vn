import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { inertPartnerInlineVisualScripts } from '../../../app/site/[slug]/partner-site-public-client'
import { buildPartnerSiteGuestOrderBootScript } from './partner-site-guest-order-page-boot'

test('inline visual runtime scripts stay inert until React hydration completes', () => {
  const html =
    '<main>Shop</main><script>window.a=1</script><script type="module" src="/runtime.js"></script>'
  const inert = inertPartnerInlineVisualScripts(html)

  assert.match(inert, /type="application\/x-pw-runtime"/)
  assert.match(inert, /data-pw-script-inert="1"/)
  assert.match(inert, /data-pw-script-original-type="module"/)
  assert.match(inert, /src="\/runtime\.js"/)
  assert.doesNotMatch(inert, /<script>window\.a=1/)
})

test('inline visual JSON-LD remains non-executable metadata', () => {
  const html = '<script type="application/ld+json">{"@type":"WebSite"}</script>'
  assert.equal(inertPartnerInlineVisualScripts(html), html)
})

test('public storefront does not use a Suspense fallback that can consume the first click', async () => {
  const source = await readFile(
    new URL('../../../app/site/[slug]/partner-site-public-client.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(source, /useSearchParams/)
  assert.doesNotMatch(source, /<Suspense/)
  assert.match(source, /inertPartnerInlineVisualScripts\(extractVisualHtmlBodyMarkup\(previewHtml\)\)/)
  assert.match(source, /buildPartnerSiteVisualNativeNavigationScript/)
  assert.match(source, /id="pw-visual-native-navigation"/)
  assert.match(source, /PARTNER_SHOP_LISTING_HEAD_SCRIPT/)
  assert.match(source, /PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID}-early/)
  assert.match(source, /PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT/)
})

test('shop runtime arms from plain HTML instead of waiting for React to commit', async () => {
  const { PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT } = await import('./arm-inline-visual-runtime')
  assert.match(PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT, /data-pw-inline-visual-root/)
  assert.match(PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT, /data-pw-script-armed/)
  assert.match(PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT, /application\/x-pw-runtime/)
  assert.match(PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT, /DOMContentLoaded/)
  assert.doesNotMatch(PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT, /useLayoutEffect/)
})

test('account chrome has no loading.tsx Suspense that defers deposit/order hydration until click', async () => {
  const { access } = await import('node:fs/promises')
  await assert.rejects(
    () =>
      access(
        new URL('../../../app/site/[slug]/(account-chrome)/loading.tsx', import.meta.url)
      ),
    (err: NodeJS.ErrnoException) => err.code === 'ENOENT'
  )
})

test('account chrome resolves navigation on the server without a usePathname client boundary', async () => {
  const source = await readFile(
    new URL('../../../app/site/[slug]/(account-chrome)/layout.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(source, /PartnerSiteReactAccountShell/)
  assert.doesNotMatch(source, /usePathname/)
  assert.match(source, /reactAccountShellNavFromPathname/)
  assert.match(source, /<PartnerSiteShopShell/)
  assert.match(source, /buildPartnerSiteNativeNavigationScript/)
  const nativeNavigation = await readFile(
    new URL('./partner-site-account-native-navigation.ts', import.meta.url),
    'utf8'
  )
  assert.match(nativeNavigation, /window\.addEventListener\('click'/)
  assert.match(nativeNavigation, /window\.addEventListener\('pointerup'/)
  assert.match(nativeNavigation, /window\.addEventListener\('pointerdown',onPointerDown/)
  assert.match(nativeNavigation, /function liveLink\(/)
  assert.match(nativeNavigation, /elementFromPoint/)
  assert.doesNotMatch(nativeNavigation, /function onPointerDown\(event\)\{[\s\S]*location\.assign/)
  assert.doesNotMatch(nativeNavigation, /document\.addEventListener\('click'/)
  assert.match(nativeNavigation, /window\.location\.assign\(href\)/)
  assert.match(nativeNavigation, /__pwShopSoftNav/)
  assert.match(nativeNavigation, /__pwShopPrefetch/)
  assert.match(nativeNavigation, /function swallow\(event\)/)
  assert.doesNotMatch(nativeNavigation, /if\(event\.defaultPrevented/)
  assert.match(nativeNavigation, /stopImmediatePropagation/)
  assert.doesNotMatch(nativeNavigation, /__pwNativeNavGoing/)
})

test('root layout injects parser-blocking native navigation for custom-domain shops', async () => {
  const source = await readFile(new URL('../../../app/layout.tsx', import.meta.url), 'utf8')
  assert.match(source, /PARTNER_SITE_NATIVE_NAV_SCRIPT_ID/)
  assert.match(source, /buildPartnerSiteNativeNavigationScript/)
  assert.doesNotMatch(source, /strategy="beforeInteractive"/)
})

test('shop layout binds native navigation in head before React hydrates', async () => {
  const source = await readFile(new URL('../../../app/site/[slug]/layout.tsx', import.meta.url), 'utf8')
  assert.match(source, /PARTNER_SITE_NATIVE_NAV_SCRIPT_ID/)
  assert.match(source, /buildPartnerSiteNativeNavigationScript/)
  assert.match(source, /PartnerSiteSoftNavRelay/)
  assert.match(source, /<head>/)
  const relay = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-soft-nav-relay.tsx', import.meta.url),
    'utf8'
  )
  assert.match(relay, /startTransition/)
  assert.match(relay, /router\.push\(path\)/)
})

test('deposit and order pages fetch without waiting for session ready', async () => {
  const deposit = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-shop-deposit-client.tsx', import.meta.url),
    'utf8'
  )
  const detail = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-shop-order-detail-client.tsx', import.meta.url),
    'utf8'
  )
  const orders = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-shop-orders-client.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(deposit, /if \(ready\)/)
  assert.doesNotMatch(detail, /if \(ready\)/)
  assert.doesNotMatch(orders, /if \(!ready\)/)
  assert.match(deposit, /useState\(!initialOrder\)/)
  assert.match(detail, /useState\(!initialOrder\)/)
  assert.match(deposit, /useLayoutEffect\(\(\) => \{/)
  assert.match(deposit, /void load\(\)/)
  assert.match(detail, /useLayoutEffect\(\(\) => \{/)
  assert.match(detail, /void load\(\)/)
})

test('deposit and order pages SSR cookie order and boot-fetch without waiting for a click', async () => {
  const depositPage = await readFile(
    new URL('../../../app/site/[slug]/(account-chrome)/orders/[orderId]/deposit/page.tsx', import.meta.url),
    'utf8'
  )
  const detailPage = await readFile(
    new URL('../../../app/site/[slug]/(account-chrome)/orders/[orderId]/page.tsx', import.meta.url),
    'utf8'
  )
  const boot = await readFile(
    new URL('./partner-site-guest-order-page-boot.ts', import.meta.url),
    'utf8'
  )
  const loader = await readFile(
    new URL('../../messaging/load-guest-order-page.ts', import.meta.url),
    'utf8'
  )
  assert.match(depositPage, /loadGuestOrderPageForCookies/)
  assert.match(detailPage, /loadGuestOrderPageForCookies/)
  assert.match(depositPage, /buildPartnerSiteGuestOrderBootScript/)
  assert.match(detailPage, /buildPartnerSiteGuestOrderBootScript/)
  assert.match(boot, /localStorage\.getItem/)
  assert.doesNotMatch(loader, /completeGuestEmailAuth/)
  assert.doesNotMatch(loader, /upsertGuestAccountForGoogleIdentity/)
})

test('guest order boot script fetches with guest identity headers before React hydrates', () => {
  const src = buildPartnerSiteGuestOrderBootScript('shop-a', 'order-1')
  assert.match(src, /\/api\/messaging\/guest\/shop-a\/order\/order-1/)
  assert.match(src, /x-guest-session-id/)
  assert.match(src, /x-guest-account-id/)
  assert.match(src, /credentials:'same-origin'/)
})

test('PDP cart and favorite buttons are not disabled until session ready', async () => {
  const source = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-shop-product-client.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(source, /disabled=\{!ready/)
  assert.doesNotMatch(source, /if \(!ready\)/)
})

test('guest session becomes ready in layout effect without waiting on network', async () => {
  const source = await readFile(
    new URL('../../../hooks/use-partner-site-guest-session.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /useLayoutEffect\(\(\) => \{/)
  assert.match(source, /ensurePartnerSiteGuestBrowserSessionId\(\)/)
  assert.doesNotMatch(source, /useEffect\(\(\) => \{/)
})

test('React chrome runtime binds click handlers in layout effect', async () => {
  const source = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-shop-shell.tsx', import.meta.url),
    'utf8'
  )
  assert.match(
    source,
    /function VisualHomeChromeRuntime[\s\S]*useLayoutEffect\(\(\) => \{[\s\S]*stripPartnerLiveHoistHosts\(\)[\s\S]*mountHtmlBootstraps/
  )
  assert.match(source, /stripPartnerLiveHoistHosts/)
  assert.match(source, /__pwReactShopChrome/)
  assert.match(source, /dedupePartnerShopLiveHeaders/)
})

test('wishlist keeps SSR favorites until session identity is ready', async () => {
  const source = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-shop-saved-products-client.tsx', import.meta.url),
    'utf8'
  )
  assert.match(source, /if \(!ready\) return/)
  assert.match(source, /if \(!res\.ok\) return/)
  assert.match(source, /prevAuthRef/)
  assert.match(source, /next\.length === 0 && prev\.length > 0/)
  assert.match(source, /\(initialProducts\?\.length \?\? 0\) > 0\) return/)
  assert.doesNotMatch(source, /setProducts\(Array\.isArray\(json\.products\) \? json\.products : \[\]\)/)
})

test('visual HTML unmounts leftover hoisted heads so React account pages do not get two headers', async () => {
  const source = await readFile(
    new URL('../../../app/site/[slug]/partner-site-public-client.tsx', import.meta.url),
    'utf8'
  )
  assert.match(source, /stripPartnerLiveHoistHosts/)
  assert.match(source, /clearTimeout\(timer\)/)
})

test('custom-domain Google login has a native href before hydration', async () => {
  const authPanel = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-shop-auth-panel.tsx', import.meta.url),
    'utf8'
  )
  const siteLayout = await readFile(
    new URL('../../../app/site/[slug]/layout.tsx', import.meta.url),
    'utf8'
  )
  const handoffBoot = await readFile(
    new URL('../../../components/partner-website/shop/partner-site-google-auth-handoff-boot.tsx', import.meta.url),
    'utf8'
  )
  assert.match(authPanel, /<a[\s\S]*className="pw-shop-btn-google"[\s\S]*href=\{bridgeGoogleHref/)
  assert.doesNotMatch(authPanel, /onClick=\{handleBridgeGoogleLogin\}/)
  assert.match(siteLayout, /<PartnerSiteGoogleAuthHandoffBoot/)
  assert.match(handoffBoot, /useLayoutEffect/)
  assert.match(handoffBoot, /window\.location\.replace\(window\.location\.href\)/)
})
