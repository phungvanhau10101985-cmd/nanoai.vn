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
    /function VisualHomeChromeRuntime[\s\S]*useLayoutEffect\(\(\) => \{\s*mountHtmlBootstraps/
  )
})
