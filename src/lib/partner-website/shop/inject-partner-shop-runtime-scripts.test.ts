import assert from 'node:assert/strict'
import test from 'node:test'
import { injectPartnerShopRuntimeScriptsIntoHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'

test('runtime scripts wire search, camera, cart badges, chat, and category APIs onto visual HTML', () => {
  const html = '<!DOCTYPE html><html><body><header></header></body></html>'
  const out = injectPartnerShopRuntimeScriptsIntoHtml(html, {
    siteSlug: '188-com-vn-rl56',
    locale: 'vi',
  })
  assert.match(out, /data-pw-search-bootstrap/)
  assert.match(out, /\/api\/site\/188-com-vn-rl56\/search\/text/)
  assert.match(out, /\/api\/site\/188-com-vn-rl56\/search\/image/)
  assert.match(out, /data-pw-shop-actions-bootstrap/)
  assert.match(out, /data-pw-catalog-bootstrap/)
  assert.match(out, /data-pw-chat-bridge/)
  assert.match(out, /data-pw-chrome-toggle-bootstrap/)
  assert.match(out, /\/api\/site\/188-com-vn-rl56\/categories/)
})

test('runtime scripts do not duplicate bootstraps on a second inject', () => {
  const html = '<!DOCTYPE html><html><body><p>shop</p></body></html>'
  const once = injectPartnerShopRuntimeScriptsIntoHtml(html, { siteSlug: '188-shop', locale: 'vi' })
  const twice = injectPartnerShopRuntimeScriptsIntoHtml(once, { siteSlug: '188-shop', locale: 'vi' })
  assert.equal(twice.split('data-pw-search-bootstrap').length, 2)
  assert.equal(twice.split('data-pw-chrome-toggle-bootstrap').length, 2)
})

test('search bootstrap binds every camera button', () => {
  const s = buildPartnerSiteSearchBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /querySelectorAll\('\[data-pw-image-search\]/)
  assert.match(s, /data-pw-image-bound/)
})

test('chrome toggle bootstrap hydrates the category panel from the public API', () => {
  const s = buildPartnerSiteChromeToggleBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /\/api\/site\/188-shop\/categories/)
  assert.match(s, /data-pw-el="cat-toggle"/)
  assert.match(s, /fillCatPanel/)
  assert.match(s, /normalizeCatBtns/)
  assert.match(s, /normalizeAccountBtns/)
  assert.match(s, /data-pw-chrome-btn="categories"/)
  assert.match(s, /data-pw-chrome-btn="account"/)
  assert.match(s, /fillAccountPanel/)
  assert.match(s, /ACCOUNT_MENU/)
  assert.match(s, /deviceRoot/)
  assert.match(s, /ensureAccountWrap/)
  assert.match(s, /pw-bottom-nav a\[href\$="\/account"\]/)
  assert.match(s, /closest\('\.pw-bottom-nav,\.\pw-shop-bottom-nav'\)/)
  assert.match(s, /data-pw-account-fallback-href/)
  assert.match(s, /aria-haspopup/)
  assert.match(s, /placePanelFixed/)
  assert.match(s, /getBoundingClientRect/)
  assert.match(s, /data-pw-panel-fixed/)
})

test('shop actions bootstrap hydrates Zalo\/Facebook from contact-channels API', async () => {
  const { buildPartnerSiteShopActionsBootstrapScript } = await import(
    '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
  )
  const s = buildPartnerSiteShopActionsBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /\/api\/site\/188-shop\/contact-channels/)
  assert.match(s, /hydrateChromeBadges\(true\)/)
  assert.match(s, /__pwChromeBadgeCache/)
  assert.match(s, /hydrateChromeBadges\(false\)/)
})
