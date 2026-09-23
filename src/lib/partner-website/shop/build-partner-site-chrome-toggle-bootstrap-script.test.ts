import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerSiteChromeToggleBootstrapScript } from './build-partner-site-chrome-toggle-bootstrap-script'
import { stripSeedCategoryPanelLinksInHtml } from './build-partner-site-header-html'

test('live category wrapper owns canonical placement instead of offsetting its child', () => {
  const html = buildPartnerSiteChromeToggleBootstrapScript({
    siteSlug: 'coordinate-parity',
    locale: 'vi',
  })

  assert.match(html, /var props=\['position','inset','left','top','right','bottom','z-index'\]/)
  assert.match(
    html,
    /var attrs=\['data-pw-placement','data-pw-coordinate-root','data-pw-box-x','data-pw-box-y','data-pw-box-w','data-pw-box-h'\]/
  )
  assert.match(html, /to\.setAttribute\(a,value\)/)
  assert.match(html, /from\.removeAttribute\(a\)/)
})

test('mobile category tap toggles even when the pointer can hover', () => {
  const html = buildPartnerSiteChromeToggleBootstrapScript({
    siteSlug: 'mobile-cat-tap',
    locale: 'vi',
  })
  assert.match(html, /!hoverCapable\(\)\|\|isMobileCatFace\(\)/)
  assert.match(html, /hoverCapable\(\)&&!isMobileCatFace\(\)&&panel\.classList\.contains\('is-open'\)/)
  assert.match(html, /if\(isMegaPanel\(panel\)\|\|isMobileCatFace\(\)\)placeMegaPanel\(btn,panel\)/)
  assert.match(html, /function adoptCatPanel\(wrap\)/)
  assert.match(html, /var wrapHit=t\.closest\('\.pw-chrome-cat-wrap'\)/)
  assert.match(html, /function requestCatOpen\(btn,panel,otherBtn,otherPanel\)/)
  assert.match(html, /function stripSeedCatLinks\(panel\)/)
  assert.match(html, /pendingCatOpenBtn=btn/)
  assert.match(html, /hydrateCats\(true\)/)
})

test('category hydration reuses featured navigation and cools mutation retries', () => {
  const html = buildPartnerSiteChromeToggleBootstrapScript({
    siteSlug: 'category-fetch-budget',
    locale: 'vi',
  })
  assert.match(html, /featuredNavCache&&Date\.now\(\)-featuredNavCacheAt<30000/)
  assert.match(html, /hydrateCatsCoolUntil=Date\.now\(\)\+30000/)
  assert.match(html, /hydrateCatsInFlight/)
})

test('saved category panel drops sample links and keeps the real tree and nav pills', () => {
  const html = `<header>
    <nav id="pw-cat-panel" class="pw-cat-panel" data-pw-cat-panel>
      <a href="/products">Hàng mới</a>
      <a href="/products">Thời trang</a>
      <a href="/products">Túi xách</a>
      <a href="/products">Giày dép</a>
      <a href="/products">Phụ kiện</a>
      <a href="/kho-sale">Khuyến mãi</a>
    </nav>
    <nav class="pw-nav-main"><a href="/products">Hàng mới</a><a href="/c/giay">Giày dép nữ</a></nav>
  </header>`
  const next = stripSeedCategoryPanelLinksInHtml(html)
  assert.doesNotMatch(next, /Túi xách/)
  assert.doesNotMatch(next, /Thời trang/)
  assert.match(next, /pw-nav-main/)
  assert.match(next, /Giày dép nữ/)
  const filled = stripSeedCategoryPanelLinksInHtml(
    `<nav data-pw-cat-panel data-pw-cat-filled="1"><div data-pw-cat-acc="1"><a href="/c/giay-dep-nu">Giày dép nữ</a></div></nav>`,
  )
  assert.match(filled, /Giày dép nữ/)
})
