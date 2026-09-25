import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
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
  assert.match(html, /window\.__pwShopToggleCat=toggleCatFromTap/)
  assert.match(html, /function catGestureFresh\(btn\)/)
  assert.match(html, /data-pw-cat-gesture/)
  assert.match(html, /if\(catGestureFresh\(cur\)\)return/)
  assert.match(html, /if\(catGestureFresh\(hit\)\)return/)
  assert.match(html, /btn\.__pwCatTapLock&&Date\.now\(\)-btn\.__pwCatTapLock<400\)return/)
  assert.match(html, /cur\.__pwCatTapLock&&Date\.now\(\)-cur\.__pwCatTapLock<400\)return/)
  assert.match(html, /btn\.__pwCatPendingAt&&Date\.now\(\)-btn\.__pwCatPendingAt<500/)
  assert.match(html, /__pwCatIgnoreClickUntil/)
  assert.match(html, /__pwCatHydrateTries/)
  assert.match(html, /addEventListener\('pointerup'/)
})

test('mobile category touch opens on pointerup and the follow-up click leaves the sheet open', async () => {
  const { window, document } = parseHTML(`<!doctype html><html data-pw-edit-device="mobile"><body>
    <header class="pw-header"><button type="button" class="pw-cat-btn" data-pw-chrome-btn="categories" data-pw-el="cat-toggle">Danh mục</button></header>
  </body></html>`)
  const mem = new Map<string, string>()
  const storage = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, String(value))
    },
    removeItem: (key: string) => {
      mem.delete(key)
    },
  }
  const view = window as unknown as {
    localStorage: typeof storage
    sessionStorage: typeof storage
    matchMedia: (query: string) => { matches: boolean }
    innerWidth: number
    fetch: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
    __pwShopToggleCat?: (btn: Element | null, x?: number, y?: number) => void
    Event: typeof Event
  }
  view.localStorage = storage
  view.sessionStorage = storage
  view.matchMedia = () => ({ matches: false })
  view.innerWidth = 390
  view.fetch = async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      String(url).includes('/categories')
        ? { tree: [{ id: 'ao', name: 'Áo', slug: 'ao', path: 'ao', children: [] }] }
        : { nav_pills: [], tiles: [] },
  })
  const raw = buildPartnerSiteChromeToggleBootstrapScript({ siteSlug: 'tap-shop', locale: 'vi' })
  const js = raw.slice(raw.indexOf('>') + 1, raw.lastIndexOf('</script>'))
  const run = new Function('window', 'document', 'fetch', js)
  run(view, document, view.fetch)
  const btn = document.querySelector('[data-pw-chrome-btn="categories"]')
  assert.ok(btn)
  view.__pwShopToggleCat?.(btn, 24, 40)
  for (let i = 0; i < 20 && !document.querySelector('.is-open'); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.ok(document.querySelector('[data-pw-cat-panel].is-open'))
  const backdrop = document.querySelector('[data-pw-cat-acc-backdrop]')
  assert.ok(backdrop)
  backdrop.dispatchEvent(new view.Event('click', { bubbles: true }))
  document.dispatchEvent(new view.Event('click', { bubbles: true }))
  assert.equal(btn.getAttribute('aria-expanded'), 'true')
  assert.ok(document.querySelector('[data-pw-cat-panel].is-open'))
  view.__pwShopToggleCat?.(btn, 24, 40)
  assert.equal(btn.getAttribute('aria-expanded'), 'true')
  assert.ok(document.querySelector('[data-pw-cat-panel].is-open'))
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
