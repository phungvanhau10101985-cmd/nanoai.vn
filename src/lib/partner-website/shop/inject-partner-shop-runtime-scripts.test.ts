import assert from 'node:assert/strict'
import test from 'node:test'
import { injectPartnerShopRuntimeScriptsIntoHtml, stampPartnerShopEditorHooksInHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'

test('runtime scripts wire search, camera, cart badges, chat, and category APIs onto visual HTML', () => {
  const html = '<!DOCTYPE html><html><body><header></header></body></html>'
  const out = injectPartnerShopRuntimeScriptsIntoHtml(html, {
    siteSlug: '188-com-vn-rl56',
    locale: 'vi',
  })
  assert.match(out, /data-pw-search-bootstrap/)
  assert.match(out, /\/site\/188-com-vn-rl56\/search/)
  assert.match(out, /\/site\/188-com-vn-rl56\/tim-theo-anh/)
  assert.match(out, /\/api\/site\/188-com-vn-rl56\/search\/history/)
  assert.match(out, /data-pw-shop-actions-bootstrap/)
  assert.match(out, /data-pw-birth-gender-prompt-bootstrap/)
  assert.match(out, /Nhận ưu đãi sinh nhật/)
  assert.match(out, /data-pw-buy/)
  assert.match(out, /data-pw-catalog-bootstrap/)
  assert.match(out, /function saleView\(p\)/)
  assert.match(out, /pw-price-compare/)
  assert.match(out, /data-pw-outfit-bootstrap/)
  assert.match(out, /\/api\/site\/188-com-vn-rl56\/products\/outfit/)
  assert.match(out, /data-pw-personalization-bootstrap/)
  assert.match(out, /\/api\/site\/188-com-vn-rl56\/personalization/)
  assert.match(out, /data-pw-cohort-hint/)
  assert.match(out, /cohort_mode/)
  assert.match(out, /Cập nhật ngày sinh/)
  assert.match(out, /\/site\/188-com-vn-rl56\/account\/edit-profile/)
  assert.match(out, /\/featured-categories\?limit=/)
  assert.match(out, /hydrateFeatured/)
  assert.match(out, /paintFeaturedCard/)
  assert.match(out, /cards\.indexOf\(card\)/)
  assert.doesNotMatch(out, /seen\[card\]/)
  assert.match(out, /categoryName/)
  assert.match(out, /data-pw-seed-name/)
  assert.match(out, /section\.pw-categories/)
  assert.match(out, /pw-cat-card/)
  assert.match(out, /pwShopLiveUiOff/)
  assert.match(out, /data-pw-pdp-bootstrap/)
  assert.match(out, /data-pw-pdp-slot="flash"/)
  assert.match(out, /\/reviews/)
  assert.match(out, /\/questions/)
  assert.match(out, /\/options/)
  assert.match(out, /data-pw-chat-bridge/)
  assert.match(out, /data-pw-chrome-toggle-bootstrap/)
  assert.match(out, /isPlacedCatBtn/)
  assert.match(out, /transferCatBox/)
  assert.match(out, /var props=\['position','inset','left','top','right','bottom','z-index'\]/)
  assert.doesNotMatch(out, /var props=\[[^\]]*'transform'[^\]]*\]/)
  assert.match(out, /bindCatPanelHover/)
  assert.match(out, /Math\.min\(720/)
  assert.match(out, /\/api\/site\/188-com-vn-rl56\/categories/)
  assert.match(out, /data-pw-seo-row/)
  assert.match(out, /fillSeoRow/)
  assert.match(out, /splitNavTree/)
  assert.match(out, /hydratePersonalizedNav/)
  assert.match(out, /takeRecentViewNavPills/)
  assert.match(out, /nav_pills/)
  assert.match(out, /data-pw-personalize-nav/)
  assert.match(out, /\/featured-categories\?limit=8/)
  assert.doesNotMatch(out, /header\.pw-header,\[data-pw-region="header"\]\.pw-header/)
  assert.match(out, /data-pw-slider-bootstrap/)
  assert.match(out, /data-pw-slide-wait/)
  assert.match(out, /data-pw-paper-tile-bootstrap/)
  assert.match(out, /data-pw-paper-tile/)
})

test('injected storefront runtime scripts remain valid JavaScript', () => {
  const out = injectPartnerShopRuntimeScriptsIntoHtml(
    '<!DOCTYPE html><html><body><main></main></body></html>',
    { siteSlug: 'sale-parity-shop', locale: 'en' }
  )
  const scripts = [...out.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  assert.ok(scripts.length > 0)
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script[1] ?? ''))
  }
})

test('editor stamp keeps chrome hooks and strips live API bootstraps', () => {
  const html =
    '<!DOCTYPE html><html><body>' +
    '<button class="pw-cat-btn">Danh mục</button>' +
    '<script data-pw-chrome-toggle-bootstrap>window.__liveCat=1</script>' +
    '<script data-pw-slider-bootstrap>window.__liveSlider=1</script>' +
    '<script data-pw-paper-tile-bootstrap>window.__livePaperTile=1</script>' +
    '<script data-pw-search-bootstrap>window.__liveSearch=1</script>' +
    '<script data-pw-lp-buy>window.__liveBuy=1</script>' +
    '<script id="pw-logo-home-link">window.__liveLogo=1</script>' +
    '</body></html>'
  const out = stampPartnerShopEditorHooksInHtml(html, { siteSlug: '188-shop' })
  assert.match(out, /data-pw-cat-toggle/)
  assert.doesNotMatch(out, /data-pw-chrome-toggle-bootstrap/)
  assert.doesNotMatch(out, /data-pw-slider-bootstrap/)
  assert.doesNotMatch(out, /window\.__liveSlider=1/)
  assert.doesNotMatch(out, /data-pw-paper-tile-bootstrap/)
  assert.doesNotMatch(out, /data-pw-search-bootstrap/)
  assert.doesNotMatch(out, /data-pw-personalization-bootstrap/)
  assert.doesNotMatch(out, /data-pw-birth-gender-prompt-bootstrap/)
  assert.doesNotMatch(out, /data-pw-lp-buy/)
  assert.doesNotMatch(out, /id="pw-logo-home-link"/)
  assert.doesNotMatch(out, /window\.__liveCat=1/)
  assert.doesNotMatch(out, /window\.__liveBuy=1/)
})

test('runtime scripts stamp leftover chrome-btn hrefs to the current shop slug', () => {
  const html =
    '<!DOCTYPE html><html><body>' +
    '<a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>' +
    '<a data-pw-chrome-btn="account" href="/account">TK</a>' +
    '<a data-pw-chrome-btn="wishlist" href="/wishlist">YT</a>' +
    '<a data-pw-chrome-btn="login" href="/login">Login</a>' +
    '<button class="pw-search-image-btn">Cam</button>' +
    '<button class="pw-cat-btn">Danh mục</button>' +
    '</body></html>'
  const out = injectPartnerShopRuntimeScriptsIntoHtml(html, { siteSlug: '188-shop', locale: 'vi' })
  assert.match(out, /data-pw-chrome-btn="cart"[^>]*href="\/site\/188-shop\/cart"/)
  assert.match(out, /data-pw-chrome-btn="account"[^>]*href="\/site\/188-shop\/account"/)
  assert.match(out, /data-pw-chrome-btn="wishlist"[^>]*href="\/site\/188-shop\/wishlist"/)
  assert.match(out, /data-pw-chrome-btn="login"[^>]*href="\/site\/188-shop\/login"/)
  assert.match(out, /pw-search-image-btn[^>]*data-pw-image-search/)
  assert.match(out, /pw-cat-btn[^>]*data-pw-cat-toggle/)
  assert.match(out, /pw-cat-btn[^>]*data-pw-el="cat-toggle"/)
})

test('runtime scripts replace stale bootstraps so a new shop still gets current APIs', () => {
  const html =
    '<!DOCTYPE html><html><body><p>shop</p>' +
    '<script data-pw-search-bootstrap>window.__oldSearch=1</script></body></html>'
  const out = injectPartnerShopRuntimeScriptsIntoHtml(html, { siteSlug: 'hotel-shop', locale: 'vi' })
  assert.equal(out.includes('window.__oldSearch=1'), false)
  assert.match(out, /\/site\/hotel-shop\/search/)
  assert.equal(out.split('data-pw-search-bootstrap').length, 2)
})

test('runtime scripts do not duplicate bootstraps on a second inject', () => {
  const html = '<!DOCTYPE html><html><body><p>shop</p></body></html>'
  const once = injectPartnerShopRuntimeScriptsIntoHtml(html, { siteSlug: '188-shop', locale: 'vi' })
  const twice = injectPartnerShopRuntimeScriptsIntoHtml(once, { siteSlug: '188-shop', locale: 'vi' })
  assert.equal(twice.split('data-pw-search-bootstrap').length, 2)
  assert.equal(twice.split('data-pw-chrome-toggle-bootstrap').length, 2)
  assert.equal(twice.split('data-pw-chat-bridge').length, 2)
})

test('runtime scripts replace a stale chat bridge and stamp Chat mua open attrs', () => {
  const html =
    '<!DOCTYPE html><html><body><button data-pw-chrome-btn="chat">Tư vấn</button>' +
    '<script data-pw-chat-bridge>window.__oldChatBridge=1</script></body></html>'
  const out = injectPartnerShopRuntimeScriptsIntoHtml(html, { siteSlug: '188-shop', locale: 'vi' })
  assert.equal(out.includes('window.__oldChatBridge=1'), false)
  assert.equal(out.split('data-pw-chat-bridge').length, 2)
  assert.match(out, /data-pw-chrome-btn="chat"[^>]*data-nanoai-open-chat/)
  assert.match(out, /window\.postMessage\(msg,'\*'\)/)
})

test('search bootstrap opens an image-search popover like 188 (paste / drop / choose file)', () => {
  const s = buildPartnerSiteSearchBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /querySelectorAll\(imageBtnSel\(\)\)/)
  assert.match(s, /pw-image-search-popover/)
  assert.match(s, /data-pw-image-choose/)
  assert.match(s, /Tìm theo ảnh/)
  assert.match(s, /Chọn ảnh từ máy/)
  assert.match(s, /data-pw-image-drop/)
  assert.match(s, /IMAGE_PATH/)
  assert.match(s, /\/site\/188-shop\/tim-theo-anh/)
  assert.match(s, /storePendingAndGo/)
  assert.match(s, /pw_pending_image_v1/)
  assert.doesNotMatch(s, /pw-search-results/)
  assert.match(s, /pwShopLiveUiOff/)
})

test('search bootstrap navigates to /search?q= like 188 home /?q= (no overlay fetch)', () => {
  const s = buildPartnerSiteSearchBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /SEARCH_PATH/)
  assert.match(s, /\/site\/188-shop\/search/)
  assert.match(s, /toPublicPath/)
  assert.match(s, /location\.assign\(dest\)/)
  assert.doesNotMatch(s, /\/api\/site\/188-shop\/search\/text/)
  assert.doesNotMatch(s, /limit','24'/)
})

test('search bootstrap paints history panel under the search box and keeps guest queries in localStorage', () => {
  const s = buildPartnerSiteSearchBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /HISTORY_API/)
  assert.match(s, /\/api\/site\/188-shop\/search\/history/)
  assert.match(s, /pw-search-history:188-shop/)
  assert.match(s, /data-pw-search-history/)
  assert.match(s, /\.pw-header-search,\.pw-shop-search-wrap/)
  assert.match(s, /openHistory/)
  assert.match(s, /historyLoggedIn/)
  assert.match(s, /readLocalHistory/)
  assert.match(s, /persistHistory/)
  assert.match(s, /Xóa tất cả lịch sử/)
  assert.match(s, /Lịch sử tìm kiếm/)
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
  assert.match(s, /navigateAccountLogin/)
  assert.match(s, /expandAccountHref/)
  assert.match(s, /window\.top\.location\.href/)
  assert.match(s, /isAccountSubpathLink/)
  assert.match(s, /handleAccountClick/)
  assert.match(s, /applyLocalAuth/)
  assert.match(s, /function boot\(\)\{\s*applyLocalAuth\(\);\s*syncCatFace\(\);\s*bindToggles\(\)/)
  assert.match(s, /hydrateAuth\(function\(\)\{bindToggles\(\);\}\)/)
  assert.match(s, /bindCatPanelHover/)
  assert.match(s, /Math\.min\(720/)
  assert.match(s, /pwShopLiveUiOff/)
  assert.match(s, /hydratePersonalizedNav/)
  assert.match(s, /FEATURED_NAV_API/)
  assert.match(s, /applyFeaturedNav/)
  assert.match(s, /data-pw-nav-live/)
  assert.match(s, /Promise\.all\(\[catP,navP\]\)/)
  assert.match(s, /nav_pills/)
  assert.doesNotMatch(s, /header\.pw-header,\[data-pw-region="header"\]\.pw-header/)
  // Old bug: srcDoc iframe pathname is not /site/… → bare /account → NanoAI 404.
  assert.doesNotMatch(s, /test\(p\)\)return '\/account'/)
})

test('chrome toggle account login prefers /site/{slug}/account over bare /account', () => {
  const s = buildPartnerSiteChromeToggleBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /ACCOUNT_LOGIN_PATH="\/site\/188-shop\/account"/)
  assert.match(s, /SHOP_LOGIN_PATH="\/site\/188-shop\/login"/)
  assert.match(s, /function shopLoginHref/)
  assert.match(s, /return isLoggedIn\?\(ACCOUNT_LOGIN_PATH\|\|'\/account'\):shopLoginHref\(\)/)
  assert.match(s, /return ACCOUNT_LOGIN_PATH\|\|'\/account'/)
})

test('shop actions bootstrap hydrates Zalo\/Facebook from contact-channels API', async () => {
  const { buildPartnerSiteShopActionsBootstrapScript } = await import(
    '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
  )
  const s = buildPartnerSiteShopActionsBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /\/api\/site\/188-shop\/contact-channels/)
  assert.match(s, /\/api\/site\/188-shop\/lead/)
  assert.match(s, /\/api\/site\/188-shop\/promotions\/validate/)
  assert.match(s, /data-pw-chrome-btn="phone"/)
  assert.match(s, /wa.me/)
  assert.match(s, /bindShareLeadCoupon/)
  assert.match(s, /hydrateChromeBadges\(true\)/)
  assert.match(s, /__pwChromeBadgeCache/)
  assert.match(s, /__pwFavoriteIdsCache/)
  assert.match(s, /__pwFavoriteFetchInFlight/)
  assert.match(s, /__pwFavoriteToggleInFlight/)
  assert.match(s, /data-pw-shop-actions-bound/)
  assert.match(s, /data-pw-shop-actions-events/)
  assert.match(s, /data-pw-shop-actions-mo/)
  assert.match(s, /__pwContactChannelsCache/)
  assert.match(s, /__pwContactFetchInFlight/)
  assert.match(s, /__pwShopHydrating/)
  assert.match(s, /hydrateContactChatLinks\(!!forceNetwork\)/)
  assert.match(s, /hydrateFavoriteButtons\(!!forceNetwork\)/)
  assert.match(s, /pwShopLiveUiOff/)
  assert.match(s, /selectedPdpOption\('size'\)/)
  assert.match(s, /selectedPdpOption\('color'\)/)
  assert.match(s, /selectedPdpQty/)
  assert.match(s, /function paintLikeCount/)
  assert.match(s, /likes_count/)
  assert.match(s, /data-pw-like-count/)
  assert.match(s, /function productCardNavUrl/)
  assert.match(s, /function prefetchProduct/)
  assert.match(s, /rel='prefetch'/)
  assert.match(s, /data-pw-nav/)
  assert.match(s, /pointerdown/)
  assert.match(s, /location\.assign/)
})
