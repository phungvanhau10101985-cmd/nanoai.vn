import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import {
  preparePartnerVisualHtmlForEditor,
  renderPartnerVisualHtmlForPublic,
} from '@/lib/partner-website/shop/render-partner-visual-html'
import { visualHtmlLooksUsable, sanitizeVisualHtmlForStore } from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import { PW_SCENE_CANVAS_WIDTH, PW_SCENE_DESIGN_WIDTH } from '@/lib/partner-website/visual-editor/pw-scene'
import {
  addVisualPageKey,
  appendVisualDeviceQuery,
  VISUAL_DESKTOP_MIN_PX,
  VISUAL_WIDE_DESKTOP_MIN_PX,
  VISUAL_LAPTOP_PREVIEW_PX,
  VISUAL_MOBILE_PREVIEW_PX,
  VISUAL_TABLET_PREVIEW_PX,
  categoryPathFromSitePath,
  categoryVisualHtmlPath,
  cmsSlugFromSitePath,
  cmsVisualHtmlPath,
  composeResponsiveVisualHtml,
  ensureVisualHtmlLiveReady,
  isolateVisualHtmlForDevice,
  applyVisualEditThemeFlag,
  mergeVisualPageHtmlIntoProject,
  preserveAndRecolorVisualPageFiles,
  stripVisualAddedChrome,
  normalizeVisualPageKeys,
  pageKeyFromSitePath,
  productKeyFromSitePath,
  productVisualHtmlPath,
  parseVisualDeviceQuery,
  resolveExactVisualCategoryHtml,
  resolveExactVisualPageHtml,
  resolveExactVisualProductHtml,
  resolveVisualPdpShellHtml,
  resolvePublicVisualPageHtml,
  resolveVisualProductIdFromKey,
  shouldServeVisualPageHtml,
  visualDeviceCanvasWidth,
  visualDevicePreviewFrameStyle,
  isDesktopBrowserWindow,
  visualEditorDeviceVariant,
  visualEditorHtmlPath,
  visualEditorPreviewPath,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

test('scene layers use the same design width as the device preview', () => {
  assert.equal(PW_SCENE_DESIGN_WIDTH.mobile, VISUAL_MOBILE_PREVIEW_PX)
  assert.equal(PW_SCENE_DESIGN_WIDTH.tablet, VISUAL_TABLET_PREVIEW_PX)
  assert.equal(PW_SCENE_DESIGN_WIDTH.laptop, VISUAL_LAPTOP_PREVIEW_PX)
  assert.equal(PW_SCENE_DESIGN_WIDTH.desktop, VISUAL_DESKTOP_MIN_PX)
  assert.equal(PW_SCENE_CANVAS_WIDTH.mobile, VISUAL_MOBILE_PREVIEW_PX)
  assert.equal(PW_SCENE_CANVAS_WIDTH.tablet, VISUAL_TABLET_PREVIEW_PX)
  assert.equal(PW_SCENE_CANVAS_WIDTH.laptop, VISUAL_LAPTOP_PREVIEW_PX)
  assert.equal(PW_SCENE_CANVAS_WIDTH.desktop, VISUAL_WIDE_DESKTOP_MIN_PX)
  assert.equal(visualDeviceCanvasWidth('desktop'), VISUAL_WIDE_DESKTOP_MIN_PX)
})

test('visual editor paths map catalog pages', () => {
  assert.equal(visualEditorHtmlPath('home'), 'index.html')
  assert.equal(visualEditorHtmlPath('about'), 'about.html')
  assert.equal(visualEditorHtmlPath('recently_viewed'), 'recently-viewed.html')
  assert.equal(visualEditorHtmlPath('home', 'mobile'), 'index.mobile.html')
  assert.equal(visualEditorHtmlPath('home', 'tablet'), 'index.tablet.html')
  assert.equal(visualEditorHtmlPath('home', 'laptop'), 'index.laptop.html')
  assert.equal(visualEditorHtmlPath('about', 'mobile'), 'about.mobile.html')
  assert.equal(visualEditorHtmlPath('about', 'tablet'), 'about.tablet.html')
  assert.equal(visualEditorHtmlPath('about', 'laptop'), 'about.laptop.html')
  assert.equal(visualEditorDeviceVariant('mobile'), 'mobile')
  assert.equal(visualEditorDeviceVariant('tablet'), 'tablet')
  assert.equal(visualEditorDeviceVariant('laptop'), 'laptop')
  assert.equal(visualEditorDeviceVariant('desktop'), 'desktop')
  assert.equal(visualEditorPreviewPath('188-shop', 'home'), '/site/188-shop')
  assert.equal(appendVisualDeviceQuery('/site/188-shop/products', 'mobile'), '/site/188-shop/products?pw-device=mobile')
  assert.equal(appendVisualDeviceQuery('/site/188-shop/products', 'tablet'), '/site/188-shop/products?pw-device=tablet')
  assert.equal(appendVisualDeviceQuery('/site/188-shop?v=1', 'desktop'), '/site/188-shop?v=1&pw-device=desktop')
  assert.deepEqual(visualDevicePreviewFrameStyle('mobile'), {
    width: VISUAL_MOBILE_PREVIEW_PX,
    minWidth: VISUAL_MOBILE_PREVIEW_PX,
  })
  assert.deepEqual(visualDevicePreviewFrameStyle('tablet'), {
    width: VISUAL_TABLET_PREVIEW_PX,
    minWidth: VISUAL_TABLET_PREVIEW_PX,
  })
  assert.deepEqual(visualDevicePreviewFrameStyle('laptop'), {
    width: VISUAL_LAPTOP_PREVIEW_PX,
    minWidth: VISUAL_LAPTOP_PREVIEW_PX,
  })
  assert.deepEqual(visualDevicePreviewFrameStyle('desktop'), {
    width: VISUAL_WIDE_DESKTOP_MIN_PX,
    minWidth: VISUAL_WIDE_DESKTOP_MIN_PX,
  })
  assert.deepEqual(visualDevicePreviewFrameStyle(null), {})
  assert.equal(isDesktopBrowserWindow({ outerWidth: 1920 }), true)
  assert.equal(isDesktopBrowserWindow({ outerWidth: VISUAL_DESKTOP_MIN_PX }), true)
  assert.equal(isDesktopBrowserWindow({ outerWidth: VISUAL_DESKTOP_MIN_PX - 1 }), false)
  assert.equal(isDesktopBrowserWindow({ outerWidth: VISUAL_MOBILE_PREVIEW_PX }), false)
  assert.equal(isDesktopBrowserWindow({ outerWidth: 0 }), false)
  assert.equal(isDesktopBrowserWindow(null), false)
  assert.equal(VISUAL_MOBILE_PREVIEW_PX, 390)
  assert.equal(VISUAL_TABLET_PREVIEW_PX, 768)
  assert.equal(VISUAL_LAPTOP_PREVIEW_PX, 1280)
  assert.equal(VISUAL_WIDE_DESKTOP_MIN_PX, 1440)
  assert.equal(visualEditorPreviewPath('188-shop', 'products'), '/site/188-shop/products')
  assert.equal(visualEditorPreviewPath('188-shop', 'size_guide'), '/site/188-shop/size-guide')
  assert.equal(
    visualEditorPreviewPath('188-shop', 'collection', 'thoi-trang/ao'),
    '/site/188-shop/c/thoi-trang/ao'
  )
  assert.equal(
    visualEditorPreviewPath('188-shop', 'product_detail', null, 'tui-deo-00073cac'),
    '/site/188-shop/products/tui-deo-00073cac'
  )
  assert.equal(
    visualEditorPreviewPath('188-shop', 'home', null, null, 'huong-dan-mua'),
    '/site/188-shop/pages/huong-dan-mua'
  )
  assert.equal(categoryVisualHtmlPath('thoi-trang/ao'), 'c/thoi-trang__ao.html')
  assert.equal(categoryVisualHtmlPath('ao-nam', 'mobile'), 'c/ao-nam.mobile.html')
  assert.equal(categoryVisualHtmlPath('ao-nam', 'tablet'), 'c/ao-nam.tablet.html')
  assert.equal(
    productVisualHtmlPath('00073cac-1111-2222-3333-444444444444'),
    'p/00073cac-1111-2222-3333-444444444444.html'
  )
  assert.equal(cmsVisualHtmlPath('huong-dan-mua', 'mobile'), 'cms/huong-dan-mua.mobile.html')
})

test('saved visual page html is isolated from homepage', () => {
  const about = '<!DOCTYPE html><html><body><h1>About shop</h1></body></html>'
  const home = '<!DOCTYPE html><html><body><h1>Home</h1></body></html>'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      visualPageKeys: ['about'],
    },
    htmlSource: home,
    project: {
      entryPath: 'site.config.json',
      files: [
        { path: 'site.config.json', kind: 'json' as const, content: '{}' },
        { path: 'about.html', kind: 'html' as const, content: about },
      ],
    },
  }
  assert.equal(resolveExactVisualPageHtml(website, 'home'), home)
  assert.equal(resolveExactVisualPageHtml(website, 'about'), about)
  assert.equal(resolveExactVisualPageHtml(website, 'faq'), '')
})

test('desktop home chrome does not treat a product htmlSource as the homepage', () => {
  const home = `<!DOCTYPE html><html><body data-pw-page="home"><header class="pw-header">HomeHead</header></body></html>`
  const pdp = `<!DOCTYPE html><html><body data-pw-page="product"><header class="pw-header">PdpHead</header></body></html>`
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      visualPageKeys: ['product_detail'],
    },
    htmlSource: pdp,
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html' as const, content: home },
        { path: 'product-detail.html', kind: 'html' as const, content: pdp },
      ],
    },
  }
  assert.match(resolveExactVisualPageHtml(website, 'home'), /HomeHead/)
  assert.doesNotMatch(resolveExactVisualPageHtml(website, 'home'), /PdpHead/)
})

test('non-home visual html uses shared home header footer bottom nav and CSS', () => {
  const home = `<!DOCTYPE html><html><head>
<style>.pw-shop-topbar{background:#c2410c}</style>
</head><body>
<header class="pw-header">SharedHead</header>
<section>Home mid</section>
<footer class="pw-footer">SharedFoot</footer>
<nav class="pw-bottom-nav">SharedNav</nav>
</body></html>`
  const about = `<!DOCTYPE html><html><body>
<header class="pw-header">AboutHead</header>
<main>About mid</main>
<footer class="pw-footer">AboutFoot</footer>
</body></html>`
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      visualPageKeys: ['about'],
    },
    htmlSource: home,
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html' as const, content: home },
        { path: 'about.html', kind: 'html' as const, content: about },
      ],
    },
  }
  const out = resolveExactVisualPageHtml(website, 'about')
  assert.match(out, /SharedHead/)
  assert.match(out, /SharedFoot/)
  assert.match(out, /SharedNav/)
  assert.match(out, /About mid/)
  assert.match(out, /pw-shop-topbar/)
  assert.match(out, /data-pw-home-chrome-css/)
  assert.equal(out.includes('AboutHead'), false)
  assert.equal(out.includes('Home mid'), false)
})

test('product detail keeps its own mobile bottom nav instead of homepage nav', () => {
  const home = `<!DOCTYPE html><html><body>
<header class="pw-header">SharedHead</header>
<main>Home mid</main>
<nav class="pw-bottom-nav"><a href="/">HomeNav</a></nav>
</body></html>`
  const pdp = `<!DOCTYPE html><html><body data-pw-page="product">
<header class="pw-header">PdpHead</header>
<main>PDP mid</main>
<nav class="pw-bottom-nav" data-pw-pdp-bottom="1"><button data-pw-chrome-btn="buy-now">Mua hàng</button></nav>
</body></html>`
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      useVisualMobileHtml: true,
      visualPageKeys: ['product_detail'],
      visualMobilePageKeys: ['product_detail'],
    },
    htmlSource: home,
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html' as const, content: home },
        { path: 'index.mobile.html', kind: 'html' as const, content: home },
        { path: 'product-detail.mobile.html', kind: 'html' as const, content: pdp },
      ],
    },
  }
  const out = resolveExactVisualPageHtml(website, 'product_detail', 'mobile')
  assert.match(out, /SharedHead/)
  assert.match(out, /PDP mid/)
  assert.match(out, /data-pw-pdp-bottom="1"/)
  assert.match(out, /Mua hàng/)
  assert.equal(out.includes('HomeNav'), false)
})

test('mobile about uses that device home chrome, not desktop home chrome', () => {
  const deskHome = `<!DOCTYPE html><html><body>
<header class="pw-header">DeskHead</header>
<section>Desk mid</section>
<footer class="pw-footer">DeskFoot</footer>
</body></html>`
  const mobHome = `<!DOCTYPE html><html><body>
<header class="pw-header">MobHead</header>
<section>Mob mid</section>
<footer class="pw-footer">MobFoot</footer>
<nav class="pw-bottom-nav">MobNav</nav>
</body></html>`
  const aboutMob = `<!DOCTYPE html><html><body>
<header class="pw-header">AboutHead</header>
<main>About mobile mid</main>
<footer class="pw-footer">AboutFoot</footer>
</body></html>`
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      useVisualMobileHtml: true,
      visualPageKeys: ['about'],
      visualMobilePageKeys: ['about'],
    },
    htmlSource: deskHome,
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html' as const, content: deskHome },
        { path: 'index.mobile.html', kind: 'html' as const, content: mobHome },
        { path: 'about.mobile.html', kind: 'html' as const, content: aboutMob },
      ],
    },
  }
  const out = resolveExactVisualPageHtml(website, 'about', 'mobile')
  assert.match(out, /MobHead/)
  assert.match(out, /MobFoot/)
  assert.match(out, /About mobile mid/)
  assert.equal(out.includes('DeskHead'), false)
  assert.equal(out.includes('AboutHead'), false)
})

test('without visualPageKeys there is no non-home override', () => {
  const out = resolveExactVisualPageHtml(
    {
      theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: true },
      htmlSource: '<!DOCTYPE html><html><body>home</body></html>',
      project: {
        entryPath: 'index.html',
        files: [{ path: 'about.html', kind: 'html', content: '<!DOCTYPE html><html><body>about</body></html>' }],
      },
    },
    'about'
  )
  assert.equal(out, '')
})

test('merge visual page html does not overwrite site.config.json', () => {
  const project = {
    entryPath: 'site.config.json',
    files: [{ path: 'site.config.json', kind: 'json' as const, content: '{"ok":true}' }],
  }
  const next = mergeVisualPageHtmlIntoProject(
    project,
    '<!DOCTYPE html><html><body>FAQ</body></html>',
    'faq.html'
  )
  assert.equal(next.files.find((f) => f.path === 'site.config.json')?.content, '{"ok":true}')
  assert.equal(next.files.find((f) => f.path === 'faq.html')?.kind, 'html')
})

test('pageKeyFromSitePath maps shop routes', () => {
  assert.equal(pageKeyFromSitePath('/site/188-shop', '188-shop'), 'home')
  assert.equal(pageKeyFromSitePath('/site/188-shop/about', '188-shop'), 'about')
  assert.equal(pageKeyFromSitePath('/site/188-shop/account/orders', '188-shop'), 'account')
  assert.equal(pageKeyFromSitePath('/site/188-shop/login', '188-shop'), null)
  assert.equal(pageKeyFromSitePath('/site/188-shop/orders', '188-shop'), 'orders')
  assert.equal(pageKeyFromSitePath('/site/188-shop/addresses', '188-shop'), 'addresses')
  assert.equal(pageKeyFromSitePath('/site/188-shop/products/abc-1', '188-shop'), 'product_detail')
  assert.equal(pageKeyFromSitePath('/site/188-shop/lp/summer', '188-shop'), null)
  assert.equal(pageKeyFromSitePath('/site/188-shop/c/ao-nam', '188-shop'), 'collection')
  assert.equal(categoryPathFromSitePath('/site/188-shop/c/thoi-trang/ao', '188-shop'), 'thoi-trang/ao')
  assert.equal(productKeyFromSitePath('/site/188-shop/products/tui-deo-00073cac', '188-shop'), 'tui-deo-00073cac')
  assert.equal(cmsSlugFromSitePath('/site/188-shop/pages/huong-dan-mua', '188-shop'), 'huong-dan-mua')
  assert.equal(
    resolveVisualProductIdFromKey('tui-deo-00073cac', [
      { id: '00073cac-1111-2222-3333-444444444444' },
    ]),
    '00073cac-1111-2222-3333-444444444444'
  )
})

test('category visual html is isolated per path', () => {
  const html = '<!DOCTYPE html><html><body><h1>Ao nam</h1></body></html>'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      visualCategoryPaths: ['ao-nam'],
    },
    htmlSource: null,
    project: {
      entryPath: 'site.config.json',
      files: [{ path: 'c/ao-nam.html', kind: 'html' as const, content: html }],
    },
  }
  assert.equal(resolveExactVisualCategoryHtml(website, 'ao-nam'), html)
  assert.equal(resolveExactVisualCategoryHtml(website, 'tui'), '')
})

test('generic product detail html is not served for every PDP', () => {
  assert.equal(shouldServeVisualPageHtml('product_detail'), false)
  assert.equal(shouldServeVisualPageHtml('about'), true)
  assert.equal(shouldServeVisualPageHtml('cart'), true)
  assert.equal(shouldServeVisualPageHtml('orders'), true)
  assert.equal(shouldServeVisualPageHtml('addresses'), true)
})

test('a saved product page becomes the shared layout when no product-detail shell exists', () => {
  const html = '<!DOCTYPE html><html><body><h1>Tui deo</h1></body></html>'
  const id = '00073cac-1111-2222-3333-444444444444'
  const other = '11111111-1111-1111-1111-111111111111'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      visualProductIds: [id],
    },
    htmlSource: null,
    project: {
      entryPath: 'site.config.json',
      files: [{ path: `p/${id}.html`, kind: 'html' as const, content: html }],
    },
  }
  assert.equal(resolveExactVisualProductHtml(website, id), html)
  assert.equal(resolveExactVisualProductHtml(website, other), html)
})

test('resolveVisualPdpShellHtml reads product-detail.html without a product id', () => {
  const shell = '<!DOCTYPE html><html><body data-pw-page="product"><h1>PDP SHELL</h1></body></html>'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      visualPageKeys: ['product_detail'],
    },
    htmlSource: null,
    project: {
      entryPath: 'site.config.json',
      files: [{ path: 'product-detail.html', kind: 'html' as const, content: shell }],
    },
  }
  assert.match(resolveVisualPdpShellHtml(website, 'desktop'), /PDP SHELL/)
})

test('shared PDP shell is served for every product on that device', () => {
  const shell = '<!DOCTYPE html><html><body data-pw-page="product"><h1>PDP SHELL</h1></body></html>'
  const idA = '00073cac-1111-2222-3333-444444444444'
  const idB = '11111111-1111-1111-1111-111111111111'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      visualPageKeys: ['product_detail'],
    },
    htmlSource: null,
    project: {
      entryPath: 'site.config.json',
      files: [{ path: 'product-detail.html', kind: 'html' as const, content: shell }],
    },
  }
  assert.match(resolveExactVisualProductHtml(website, idA), /PDP SHELL/)
  assert.match(resolveExactVisualProductHtml(website, idB), /PDP SHELL/)
})

test('saving a product flags the shared product_detail shell for that device', () => {
  const id = '00073cac-1111-2222-3333-444444444444'
  const next = applyVisualEditThemeFlag(DEFAULT_PARTNER_WEBSITE_THEME, {
    pageKey: 'product_detail',
    variant: 'mobile',
    productId: id,
  })
  assert.deepEqual(next.visualMobileProductIds, [id])
  assert.deepEqual(next.visualMobilePageKeys, ['product_detail'])
  assert.deepEqual(next.visualPageKeys ?? [], [])
})

test('mobile visual html is isolated from desktop', () => {
  const desktop = '<!DOCTYPE html><html><body><h1>Desktop about</h1></body></html>'
  const mobile = '<!DOCTYPE html><html><body><h1>Mobile about</h1></body></html>'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      visualPageKeys: ['about'],
      visualMobilePageKeys: ['about'],
    },
    htmlSource: null,
    project: {
      entryPath: 'site.config.json',
      files: [
        { path: 'about.html', kind: 'html' as const, content: desktop },
        { path: 'about.mobile.html', kind: 'html' as const, content: mobile },
      ],
    },
  }
  assert.equal(resolveExactVisualPageHtml(website, 'about', 'desktop'), desktop)
  assert.equal(resolveExactVisualPageHtml(website, 'about', 'mobile'), mobile)
  const pub = resolvePublicVisualPageHtml(website, 'about')
  assert.ok(pub.includes('Desktop about'))
  assert.ok(pub.includes('Mobile about'))
  assert.ok(pub.includes('pw-visual-device-split'))
  assert.ok(pub.includes('pw-shop-chrome-layout'))
  assert.ok(pub.includes('[data-pw-chrome-added][data-pw-device="mobile"]'))
  assert.ok(pub.includes('pw-theme-root'))
  assert.ok(pub.includes('--pw-primary'))
})

test('compose responsive visual html keeps a single desktop variant as-is', () => {
  const only = '<!DOCTYPE html><html><body>Just one</body></html>'
  const out = composeResponsiveVisualHtml(only, '')
  assert.match(out, /Just one/)
  assert.doesNotMatch(out, /pw-visual-mobile/)
  assert.match(out, /<html[^>]*data-pw-edit-device="desktop"/)
  assert.match(out, /<html[^>]*data-pw-scene-lock="desktop"/)
})

test('mobile-only visual html does not leak added chrome onto desktop', () => {
  const mobile =
    '<!DOCTYPE html><html><body><header class="pw-header"><div class="pw-header-actions"><a data-pw-chrome-added="1" data-pw-chrome-btn="wallet">$</a></div></header></body></html>'
  const pub = composeResponsiveVisualHtml('', mobile)
  assert.ok(pub.includes('pw-visual-desktop'))
  assert.ok(pub.includes('pw-visual-mobile'))
  assert.ok(pub.includes('data-pw-device="mobile"'))
  const desktopBody = pub.match(/data-pw-visual-device="desktop"[^>]*>([\s\S]*?)<div class="pw-visual-mobile"/i)?.[1] || ''
  assert.equal(desktopBody.includes('data-pw-chrome-added'), false)
})

test('isolate does not treat nested chrome device wrappers as a composed page', () => {
  const html = `<!DOCTYPE html><html><head>
<style>.pw-header{background:#c2410c}</style>
</head><body>
<div class="pw-shop">
<style>.pw-topbar{color:#fff}</style>
<div class="pw-visual-desktop" data-pw-visual-device="desktop"><header class="pw-header">Head</header></div>
<main>Products mid</main>
<div class="pw-visual-desktop" data-pw-visual-device="desktop"><footer class="pw-footer">Foot</footer></div>
</div>
</body></html>`
  const out = isolateVisualHtmlForDevice(html, 'desktop')
  assert.match(out, /Products mid/)
  assert.match(out, /pw-header\{background:#c2410c\}/)
  assert.match(out, /pw-topbar\{color:#fff\}/)
  assert.match(out, /<footer class="pw-footer">Foot<\/footer>/)
})

test('isolate desktop html keeps nested sections from composed page', () => {
  const desktop =
    '<!DOCTYPE html><html><body><div class="pw-header"><span>Logo</span></div><h1>Hero saved</h1></body></html>'
  const tablet = '<!DOCTYPE html><html><body><h1>Tablet stale</h1></body></html>'
  const mobile = '<!DOCTYPE html><html><body><h1>Mobile stale</h1></body></html>'
  const composed = composeResponsiveVisualHtml(desktop, mobile, tablet)
  const isolated = isolateVisualHtmlForDevice(composed, 'desktop')
  assert.ok(isolated.includes('Hero saved'))
  assert.ok(isolated.includes('Logo'))
  assert.equal(isolated.includes('Tablet stale'), false)
  assert.equal(isolated.includes('Mobile stale'), false)
  assert.match(isolated, /<html[^>]*data-pw-edit-device="desktop"/)
  assert.match(isolated, /<html[^>]*data-pw-scene-lock="desktop"/)
  assert.doesNotMatch(composed, /<html[^>]*data-pw-edit-device=/)
  assert.doesNotMatch(composed, /<html[^>]*data-pw-scene-lock=/)
})

test('compose four-device html shows laptop between 1280 and 1439', () => {
  const composed = composeResponsiveVisualHtml(
    '<!DOCTYPE html><html><body><h1>Desk</h1></body></html>',
    '<!DOCTYPE html><html><body><h1>Mob</h1></body></html>',
    '<!DOCTYPE html><html><body><h1>Tab</h1></body></html>',
    '<!DOCTYPE html><html><body><h1>Lap</h1></body></html>'
  )
  assert.match(composed, /data-pw-visual-device="laptop"/)
  assert.match(composed, /Lap/)
  assert.match(composed, /max-width:1439px/)
  assert.match(composed, /min-width:1440px/)
  assert.match(composed, /html:not\(:has\(\.pw-visual-laptop\)\) \.pw-visual-desktop/)
  const laptop = isolateVisualHtmlForDevice(composed, 'laptop')
  assert.match(laptop, /Lap/)
  assert.doesNotMatch(laptop, /Desk/)
  assert.doesNotMatch(laptop, /Tab/)
  assert.match(laptop, /<html[^>]*data-pw-edit-device="laptop"/)
  assert.match(laptop, /<html[^>]*data-pw-scene-lock="laptop"/)
  assert.doesNotMatch(composed, /<html[^>]*data-pw-edit-device=/)
})

test('isolate visual html unwraps composed page and stamps chrome', () => {
  const composed = composeResponsiveVisualHtml(
    '<!DOCTYPE html><html><body><h1>Desk</h1></body></html>',
    '<!DOCTYPE html><html><body><h1>Mob</h1><a data-pw-chrome-added="1" data-pw-chrome-btn="orders">Box</a></body></html>'
  )
  const mobile = isolateVisualHtmlForDevice(composed, 'mobile')
  assert.ok(mobile.includes('Mob'))
  assert.equal(mobile.includes('Desk'), false)
  assert.ok(mobile.includes('data-pw-device="mobile"'))
  const stripped = stripVisualAddedChrome(mobile)
  assert.equal(stripped.includes('data-pw-chrome-added'), false)
})

test('isolate tablet html restamps search instead of hiding a mobile-stamped cluster', () => {
  const html =
    '<!DOCTYPE html><html><body><header class="pw-header"><div class="pw-header-search" data-pw-el="search" data-pw-chrome-added="1" data-pw-device="mobile"><form data-pw-search-form><input name="q"/></form></div></header></body></html>'
  const tablet = isolateVisualHtmlForDevice(html, 'tablet')
  assert.match(tablet, /pw-header-search/)
  assert.match(tablet, /data-pw-device="tablet"/)
  assert.doesNotMatch(tablet, /data-pw-device="mobile"/)
})

test('one-device html drops composed split css that would hide its own tablet widgets', () => {
  const html = `<!DOCTYPE html><html><head><style id="pw-visual-device-split">@media (min-width:768px){.pw-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]){display:none!important}}</style></head><body>
<header class="pw-header"><div class="pw-header-actions"><button data-pw-chrome-added="1" data-pw-chrome-btn="chat" data-pw-device="tablet">Chat</button></div></header>
</body></html>`
  const tablet = isolateVisualHtmlForDevice(html, 'tablet')
  assert.equal(tablet.includes('pw-visual-device-split'), false)
  assert.match(tablet, /data-pw-chrome-btn="chat"/)
  assert.match(tablet, /data-pw-device="tablet"/)
})

test('count badge chrome stays when isolating another device', () => {
  const desktop = `<!DOCTYPE html><html><body>
    <div class="pw-header-actions">
      <a data-pw-chrome-added="1" data-pw-chrome-btn="notifications" data-pw-device="desktop" href="/account/notifications">N</a>
      <a data-pw-chrome-added="1" data-pw-chrome-btn="wallet" data-pw-device="desktop">$</a>
    </div>
  </body></html>`
  const mobile = isolateVisualHtmlForDevice(desktop, 'mobile', { stripAddedChrome: true })
  assert.match(mobile, /data-pw-chrome-btn="notifications"/)
  assert.match(mobile, /data-pw-device="mobile"/)
  assert.match(mobile, /data-pw-chrome-count="1"/)
  assert.doesNotMatch(mobile, /data-pw-chrome-btn="wallet"/)
})

test('saving one device html does not rewrite sibling device files', () => {
  const project = {
    entryPath: 'index.html',
    files: [
      {
        path: 'index.html',
        kind: 'html' as const,
        content: `<!DOCTYPE html><html><body><div class="pw-header-actions"><a data-pw-chrome-added="1" data-pw-chrome-btn="notifications" href="/n">N</a></div></body></html>`,
      },
      {
        path: 'index.mobile.html',
        kind: 'html' as const,
        content: `<!DOCTYPE html><html><body><div class="pw-header-actions"><a href="/account">Acc</a></div></body></html>`,
      },
    ],
  }
  const next = mergeVisualPageHtmlIntoProject(project, project.files[0].content, 'index.html')
  const mobile = next.files.find((f) => f.path === 'index.mobile.html')?.content || ''
  assert.equal(mobile.includes('data-pw-chrome-btn="notifications"'), false)
  assert.equal(mobile.includes('href="/account"'), true)
})

test('tablet visual html is isolated from desktop and mobile', () => {
  const desktop = '<!DOCTYPE html><html><body><h1>Desktop about</h1></body></html>'
  const tablet = '<!DOCTYPE html><html><body><h1>Tablet about</h1></body></html>'
  const mobile = '<!DOCTYPE html><html><body><h1>Mobile about</h1></body></html>'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      visualPageKeys: ['about'],
      visualTabletPageKeys: ['about'],
      visualMobilePageKeys: ['about'],
    },
    htmlSource: null,
    project: {
      entryPath: 'site.config.json',
      files: [
        { path: 'about.html', kind: 'html' as const, content: desktop },
        { path: 'about.tablet.html', kind: 'html' as const, content: tablet },
        { path: 'about.mobile.html', kind: 'html' as const, content: mobile },
      ],
    },
  }
  assert.equal(resolveExactVisualPageHtml(website, 'about', 'desktop'), desktop)
  assert.equal(resolveExactVisualPageHtml(website, 'about', 'tablet'), tablet)
  assert.equal(resolveExactVisualPageHtml(website, 'about', 'mobile'), mobile)
  const pub = resolvePublicVisualPageHtml(website, 'about')
  assert.ok(pub.includes('Desktop about'))
  assert.ok(pub.includes('Tablet about'))
  assert.ok(pub.includes('Mobile about'))
  assert.ok(pub.includes('pw-visual-tablet'))
  assert.ok(pub.includes('min-width:1280px'))
})

test('public html without tablet still uses desktop from 768px', () => {
  const desktop = '<!DOCTYPE html><html><body><h1>Desktop about</h1></body></html>'
  const mobile = '<!DOCTYPE html><html><body><h1>Mobile about</h1></body></html>'
  const pub = composeResponsiveVisualHtml(desktop, mobile)
  assert.equal(pub.includes('pw-visual-tablet'), false)
  assert.ok(pub.includes('pw-visual-desktop'))
  assert.ok(pub.includes('pw-visual-mobile'))
})

test('empty visual html is not usable for Sửa nhanh', () => {
  assert.equal(visualHtmlLooksUsable(''), false)
  assert.equal(visualHtmlLooksUsable('<!DOCTYPE html><html><body></body></html>'), false)
  assert.equal(visualHtmlLooksUsable('<!DOCTYPE html><html><body><h1>Home</h1></body></html>'), true)
  assert.equal(
    visualHtmlLooksUsable('<!DOCTYPE html><html><body><div class="pw-shop">188</div></body></html>'),
    true
  )
  assert.equal(
    visualHtmlLooksUsable(
      '<!DOCTYPE html><html><body data-pw-page="home"><section data-pw-region="banner"><h1>Hero</h1></section></body></html>'
    ),
    true
  )
  assert.equal(
    visualHtmlLooksUsable(
      '<!DOCTYPE html><html><body><style>.pw-shop-bottom-nav{display:flex}</style><div class="pw-visual-desktop"></div></body></html>'
    ),
    false
  )
  assert.equal(
    visualHtmlLooksUsable(
      '<!DOCTYPE html><html><body><iframe srcdoc="<div class=pw-shop>188</div>"></iframe></body></html>'
    ),
    false
  )
})

test('sanitizeVisualHtmlForStore strips NUL before persist', () => {
  assert.equal(sanitizeVisualHtmlForStore('ok\u0000html'), 'okhtml')
})

test('ensureVisualHtmlLiveReady stamps chrome-added and device on moved widgets', () => {
  const html =
    '<button class="pw-cat-btn" data-pw-el="cat-toggle" data-pw-user-move="1">DM</button>' +
    '<a class="pw-icon-btn" data-pw-chrome-btn="cart">Cart</a>'
  const out = ensureVisualHtmlLiveReady(html, 'mobile')
  assert.match(out, /data-pw-user-move="1"[^>]*data-pw-chrome-added="1"/)
  assert.match(out, /data-pw-device="mobile"/)
  assert.doesNotMatch(out, /data-pw-chrome-btn="cart"[^>]*data-pw-chrome-added/)
})

test('ensureVisualHtmlLiveReady strips leftover drag geometry from the bottom dock', () => {
  const html =
    '<nav class="pw-bottom-nav" data-pw-pdp-bottom="1" data-pw-user-move="1" style="position:relative;left:12px;top:80px;color:#111">Dock</nav>'
  const out = ensureVisualHtmlLiveReady(html, 'mobile')
  assert.doesNotMatch(out, /data-pw-user-move/)
  assert.doesNotMatch(out, /position:relative/)
  assert.doesNotMatch(out, /left:12px/)
  assert.doesNotMatch(out, /top:80px/)
  assert.match(out, /color:#111/)
  assert.match(out, /data-pw-pdp-bottom="1"/)
})

test('saving one device html does not replace the other device file', () => {
  const project = {
    entryPath: 'index.html',
    files: [
      { path: 'index.html', kind: 'html' as const, content: '<!DOCTYPE html><html><body>DESK SAVED</body></html>' },
      { path: 'index.mobile.html', kind: 'html' as const, content: '<!DOCTYPE html><html><body>OLD MOB</body></html>' },
      { path: 'index.tablet.html', kind: 'html' as const, content: '<!DOCTYPE html><html><body>OLD TAB</body></html>' },
    ],
  }
  const next = mergeVisualPageHtmlIntoProject(
    project,
    '<!DOCTYPE html><html><body>NEW TAB</body></html>',
    'index.tablet.html'
  )
  assert.equal(next.files.find((f) => f.path === 'index.html')?.content.includes('DESK SAVED'), true)
  assert.equal(next.files.find((f) => f.path === 'index.mobile.html')?.content.includes('OLD MOB'), true)
  assert.equal(next.files.find((f) => f.path === 'index.tablet.html')?.content.includes('NEW TAB'), true)
})

test('theme recolor keeps saved desktop homepage html', () => {
  const previous = {
    entryPath: 'index.html',
    files: [
      { path: 'index.html', kind: 'html' as const, content: '<!DOCTYPE html><html><body>DESK SAVED</body></html>' },
    ],
  }
  const generated = {
    entryPath: 'index.html',
    files: [
      { path: 'index.html', kind: 'html' as const, content: '<!DOCTYPE html><html><body>TEMPLATE HOME</body></html>' },
    ],
  }
  const next = preserveAndRecolorVisualPageFiles({
    previous,
    next: generated,
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: true },
  })
  assert.equal(next.files.find((f) => f.path === 'index.html')?.content.includes('DESK SAVED'), true)
  assert.equal(next.files.find((f) => f.path === 'index.html')?.content.includes('TEMPLATE HOME'), false)
})

test('visualPageKeys stay unique and skip home', () => {
  assert.deepEqual(normalizeVisualPageKeys(['about', 'about', 'home', 'faq']), ['about', 'faq'])
  assert.deepEqual(addVisualPageKey(['about'], 'faq'), ['about', 'faq'])
  assert.deepEqual(addVisualPageKey(['about'], 'home'), ['about'])
})

test('visual edit theme flags only the page and device being saved', () => {
  const theme = {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    useVisualHtml: true,
    visualPageKeys: ['about'],
  }
  const homeMobile = applyVisualEditThemeFlag(theme, { pageKey: 'home', variant: 'mobile' })
  assert.equal(homeMobile.useVisualMobileHtml, true)
  assert.equal(homeMobile.useVisualHtml, true)
  assert.deepEqual(homeMobile.visualPageKeys, ['about'])

  const aboutTablet = applyVisualEditThemeFlag(theme, { pageKey: 'about', variant: 'tablet' })
  assert.deepEqual(aboutTablet.visualTabletPageKeys, ['about'])
  assert.deepEqual(aboutTablet.visualPageKeys, ['about'])
  assert.equal(aboutTablet.useVisualHtml, true)

  const homeLaptop = applyVisualEditThemeFlag(theme, { pageKey: 'home', variant: 'laptop' })
  assert.equal(homeLaptop.useVisualLaptopHtml, true)
  assert.equal(homeLaptop.useVisualHtml, true)

  const faqMobile = applyVisualEditThemeFlag(theme, { pageKey: 'faq', variant: 'mobile' })
  assert.deepEqual(faqMobile.visualMobilePageKeys, ['faq'])
  assert.deepEqual(faqMobile.visualPageKeys, ['about'])
})

test('isolating a device for persist does not keep the sibling wrapper', () => {
  const composed = composeResponsiveVisualHtml(
    '<!DOCTYPE html><html><body><h1>Desktop about</h1></body></html>',
    '<!DOCTYPE html><html><body><h1>Mobile about</h1></body></html>'
  )
  const mobile = isolateVisualHtmlForDevice(composed, 'mobile')
  assert.match(mobile, /Mobile about/)
  assert.doesNotMatch(mobile, /Desktop about/)
  assert.doesNotMatch(mobile, /data-pw-visual-device="desktop"/)
})

test('pw-device preview serves only the edited device file', () => {
  assert.equal(parseVisualDeviceQuery('desktop'), 'desktop')
  assert.equal(parseVisualDeviceQuery('mobile'), 'mobile')
  assert.equal(parseVisualDeviceQuery('tablet'), 'tablet')
  assert.equal(parseVisualDeviceQuery('laptop'), 'laptop')
  assert.equal(parseVisualDeviceQuery(undefined), null)

  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      useVisualMobileHtml: true,
    },
    htmlSource: '<!DOCTYPE html><html><body><h1>Desk home</h1></body></html>',
    project: {
      entryPath: 'index.html',
      files: [
        {
          path: 'index.mobile.html',
          kind: 'html' as const,
          content: '<!DOCTYPE html><html><body><h1>Mob home</h1></body></html>',
        },
      ],
    },
  }
  const desk = resolvePublicVisualPageHtml(website, 'home', 'desktop')
  assert.match(desk, /Desk home/)
  assert.doesNotMatch(desk, /Mob home/)
  assert.doesNotMatch(desk, /data-pw-visual-device="mobile"/)

  const composed = resolvePublicVisualPageHtml(website, 'home')
  assert.match(composed, /Desk home/)
  assert.match(composed, /Mob home/)
})

test('device slice survives runtime scripts appended after the wrapper', () => {
  const composed = composeResponsiveVisualHtml(
    '<!DOCTYPE html><html><body><h1>Desk</h1></body></html>',
    '<!DOCTYPE html><html><body><div class="pw-header-actions"><h1>Mob</h1><a data-pw-chrome-added="1" data-pw-chrome-btn="orders" href="/orders">Box</a></div></body></html>'
  )
  // The live page injects badge-pin / stick-header / bootstrap scripts before </body>.
  const served = composed.replace(
    /<\/body>/i,
    '<script id="pw-shop-chrome-badge-pin"></script>\n<script data-pw-shop-actions-bootstrap></script>\n</body>'
  )
  const mobile = isolateVisualHtmlForDevice(served, 'mobile')
  assert.match(mobile, /Mob/)
  assert.doesNotMatch(mobile, /Desk/)
  assert.match(mobile, /data-pw-chrome-btn="orders"/)
})

test('device stamping does not depend on attribute order', () => {
  const html =
    '<!DOCTYPE html><html><body><div class="pw-header-actions"><a data-pw-device="desktop" data-pw-chrome-added="1" data-pw-chrome-btn="wallet">$</a></div></body></html>'
  const mobile = isolateVisualHtmlForDevice(html, 'mobile')
  assert.doesNotMatch(mobile, /data-pw-chrome-btn="wallet"/)
})

test('pw-device view serves the saved file for that device untouched', () => {
  const mobile =
    '<!DOCTYPE html><html><body><div class="pw-header-actions"><a data-pw-chrome-added="1" data-pw-chrome-btn="products" href="/products">Box</a></div></body></html>'
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      useVisualMobileHtml: true,
    },
    htmlSource: '<!DOCTYPE html><html><body><h1>Desk home</h1></body></html>',
    project: {
      entryPath: 'index.html',
      files: [{ path: 'index.mobile.html', kind: 'html' as const, content: mobile }],
    },
  }
  const view = resolvePublicVisualPageHtml(website, 'home', 'mobile')
  // Widgets added only on Mobile must survive; no synthesized desktop twin may replace them.
  assert.match(view, /data-pw-chrome-btn="products"/)
  assert.doesNotMatch(view, /Desk home/)
  assert.doesNotMatch(view, /<div class="pw-visual-/)
  assert.doesNotMatch(view, /<(?:div|section)[^>]*data-pw-visual-device=/)
  assert.doesNotMatch(view, /pw-visual-device-split/)
})

test('public visual render gateway serves one device with chrome theme and runtime', () => {
  const website = {
    siteSlug: '188-shop',
    locale: 'vi' as const,
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      useVisualMobileHtml: true,
      primaryColor: '#123456',
    },
    htmlSource: '<!DOCTYPE html><html><body><h1>Desk home</h1></body></html>',
    project: {
      entryPath: 'index.html',
      files: [
        {
          path: 'index.mobile.html',
          kind: 'html' as const,
          content:
            '<!DOCTYPE html><html><body><header class="pw-header"><img class="pw-logo" src="/logo.png"/></header><h1>Mob home</h1></body></html>',
        },
      ],
    },
  }
  const view = renderPartnerVisualHtmlForPublic(
    website,
    { kind: 'page', pageKey: 'home' },
    { device: 'mobile' }
  )
  assert.match(view, /Mob home/)
  assert.doesNotMatch(view, /Desk home/)
  assert.doesNotMatch(view, /<div class="pw-visual-/)
  assert.doesNotMatch(view, /<(?:div|section)[^>]*data-pw-visual-device=/)
  assert.match(view, /id="pw-shop-chrome-layout"/)
  assert.match(view, /data-pw-search-bootstrap/)
  assert.match(view, /data-pw-catalog-bootstrap/)
  assert.match(view, /data-pw-personalization-bootstrap/)
  assert.match(view, /id="pw-logo-home-link"/)
  assert.match(view, /--pw-primary:\s*#123456/)
})

test('editor visual render stamps chrome hooks but does not inject live shop APIs', () => {
  const html =
    '<!DOCTYPE html><html><body><header class="pw-header"><div class="pw-header-actions"><a data-pw-chrome-added="1" data-pw-chrome-btn="chat">Chat</a><button class="pw-cat-btn">Danh mục</button></div></header><h1>Tablet edit</h1></body></html>'
  const edit = preparePartnerVisualHtmlForEditor(html, {
    variant: 'tablet',
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, primaryColor: '#654321' },
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(edit, /Tablet edit/)
  assert.match(edit, /data-pw-device="tablet"/)
  assert.match(edit, /id="pw-shop-chrome-layout"/)
  assert.match(edit, /--pw-primary:\s*#654321/)
  assert.match(edit, /data-pw-cat-toggle/)
  assert.doesNotMatch(edit, /data-pw-search-bootstrap/)
  assert.doesNotMatch(edit, /data-pw-shop-actions-bootstrap/)
  assert.doesNotMatch(edit, /data-pw-chrome-toggle-bootstrap/)
  assert.doesNotMatch(edit, /data-pw-catalog-bootstrap/)
  assert.doesNotMatch(edit, /data-pw-personalization-bootstrap/)
  assert.doesNotMatch(edit, /data-pw-chat-bridge/)
  assert.doesNotMatch(edit, /data-pw-header-toggle/)
  assert.doesNotMatch(edit, /id="pw-logo-home-link"/)
})

test('isolate keeps body-level topup seated outside the device wrapper', () => {
  const html = `<!DOCTYPE html><html><body>
<div class="pw-visual-desktop" data-pw-visual-device="desktop">
<header class="pw-header" data-pw-region="header">Head</header>
<main>Home mid</main>
<footer class="pw-footer" data-pw-region="footer">Foot</footer>
</div>
<button type="button" class="pw-icon-btn" data-pw-chrome-btn="topup" data-pw-chrome-float="1" data-pw-chrome-added="1" data-pw-device="desktop">Top</button>
<button type="button" class="pw-icon-btn" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-added="1" data-pw-device="desktop">Tư vấn</button>
</body></html>`
  const isolated = isolateVisualHtmlForDevice(html, 'desktop')
  assert.match(isolated, /Home mid/)
  assert.match(isolated, /data-pw-chrome-btn="topup"/)
  assert.match(isolated, /data-pw-chrome-btn="chat"/)
  assert.match(isolated, /data-pw-device="desktop"/)
})

test('save and pw-device view keep dragged notification position', () => {
  const home = `<!DOCTYPE html><html><body>
    <header class="pw-header"><div class="pw-header-actions">
      <a class="pw-shop-icon-btn" data-pw-chrome-btn="notifications" href="/site/188/account/notifications" style="transform: translate(346px, 0px);">Bell</a>
    </div></header>
  </body></html>`
  const isolated = isolateVisualHtmlForDevice(home, 'desktop')
  assert.match(isolated, /transform:\s*translate\(346px, 0px\)/)

  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
    },
    htmlSource: isolated,
    project: {
      entryPath: 'index.html',
      files: [{ path: 'index.html', kind: 'html' as const, content: isolated }],
    },
  }
  const preview = resolvePublicVisualPageHtml(website, 'home', 'desktop')
  assert.match(preview, /transform:\s*translate\(346px, 0px\)/)
})
