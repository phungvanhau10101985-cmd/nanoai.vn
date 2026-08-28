import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { parseHTML } from 'linkedom'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { hashShopCachePayload } from '../../src/lib/cache/partner-shop-cache'
import {
  preparePartnerVisualHtmlForEditor,
  preparePartnerVisualHtmlForPublic,
  renderPartnerVisualHtmlForPublic,
} from '../../src/lib/partner-website/shop/render-partner-visual-html'
import type { PartnerWebsiteProject } from '../../src/lib/partner-website/partner-website-types'
import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsiteTheme,
} from '../../src/lib/partner-website/template/partner-website-template-types'
import { buildVisualEditorScript, NANOAI_VE_MESSAGE } from '../../src/lib/partner-website/visual-editor/build-visual-editor-script'
import { finalizeVisualEditorSave } from '../../src/lib/partner-website/visual-editor/finalize-visual-editor-save'
import {
  PW_COORDINATE_CONTRACT_VERSION,
  PW_SCENE_WIDTH,
  pwCoordinateRuntimeSource,
  type PwCoordinateDevice,
} from '../../src/lib/partner-website/visual-editor/pw-coordinate-space'
import { serializeVisualEditorHtml } from '../../src/lib/partner-website/visual-editor/serialize-visual-editor-html'
import {
  applyVisualEditThemeFlag,
  visualEditorHtmlPath,
} from '../../src/lib/partner-website/visual-editor/visual-editor-pages'

type VisualPage = 'home' | 'products' | 'product_detail' | 'cart' | 'account' | 'about'
type Rect = { left: number; top: number; width: number; height: number }
type Geometry = {
  activeDevice: string
  coordinateVersion: string
  centerDelta: number
  scrollHeight: number
  counts: { header: number; main: number; footer: number; dock: number }
  nodes: Record<string, { rect: Rect; host: string }>
  fixedRuntime: {
    sync: string
    script: boolean
    layers: number
    placement: string
    x: string
    y: string
  }
}

const DEVICES = Object.entries(PW_SCENE_WIDTH) as Array<[PwCoordinateDevice, number]>
const PAGES: VisualPage[] = ['home', 'products', 'product_detail', 'cart', 'account', 'about']
type TenantFixture = {
  slug: string
  industry: 'fashion' | 'hotel'
  theme: PartnerWebsiteTheme
}
const TENANTS: TenantFixture[] = [
  {
    slug: '188-com-vn-parity',
    industry: 'fashion',
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      primaryColor: '#9a3412',
      accentColor: '#fdba74',
      buyButtonColor: '#c2410c',
      cartButtonColor: '#334155',
      surfaceColor: '#fff7ed',
      footerColor: '#431407',
    },
  },
  {
    slug: 'hotel-parity-tenant',
    industry: 'hotel',
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      primaryColor: '#0f766e',
      accentColor: '#5eead4',
      buyButtonColor: '#0369a1',
      cartButtonColor: '#475569',
      surfaceColor: '#f0fdfa',
      footerColor: '#134e4a',
    },
  },
]
const IDS = [
  'pw-header',
  'pw-flow',
  'pw-absolute',
  'pw-fixed',
  'pw-float',
  'pw-footer',
  'pw-dock',
]

test.beforeEach(async ({ page }) => {
  await page.route('https://parity.invalid/api/site/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        products: [],
        items: [],
        categories: [],
        recommendations: [],
        recentlyViewed: [],
      }),
    })
  })
})

test('a dragged nested banner element keeps its position after save', async ({ page }) => {
  const device: PwCoordinateDevice = 'desktop'
  const source = fixtureHtml('home', device, TENANTS[0])
  await page.setViewportSize({ width: PW_SCENE_WIDTH[device], height: 900 })
  await settle(
    page,
    preparePartnerVisualHtmlForEditor(source, {
      variant: device,
      siteSlug: TENANTS[0].slug,
      locale: 'vi',
      pageKey: 'home',
      theme: TENANTS[0].theme,
    }),
    device
  )
  await activateActualEditor(page, device)

  const title = page.locator('[data-pw-el="title"]').first()
  await title.click()
  const before = await title.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  })
  const handle = await page.locator('.nanoai-ve-move-handle').boundingBox()
  expect(handle).not.toBeNull()
  if (!handle) return

  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 90, handle.y + handle.height / 2 + 55, {
    steps: 6,
  })
  await page.mouse.up()

  const moved = await title.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  })
  expect(moved.left).toBeGreaterThan(before.left + 70)
  await expect(title).toHaveAttribute('data-pw-user-move', '1')
  await expect(title).toHaveAttribute('data-pw-placement', 'scene-absolute')

  const saved = serializeBrowserMarkupForSave(await page.content(), device)
  await settle(
    page,
    preparePartnerVisualHtmlForEditor(saved, {
      variant: device,
      siteSlug: TENANTS[0].slug,
      locale: 'vi',
      pageKey: 'home',
      theme: TENANTS[0].theme,
    }),
    device
  )
  await activateActualEditor(page, device)
  const restored = await page.locator('[data-pw-el="title"]').first().evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  })
  expect(Math.abs(restored.left - moved.left)).toBeLessThanOrEqual(2)
  expect(
    Math.abs(restored.top - moved.top),
    JSON.stringify({ moved, restored, savedTitle: saved.match(/<h1\b[^>]*data-pw-el="title"[^>]*>/)?.[0] })
  ).toBeLessThanOrEqual(2)
})

test('a dragged header control is lifted to the scene and does not jump after save', async ({ page }) => {
  const device: PwCoordinateDevice = 'desktop'
  const source = fixtureHtml('home', device, TENANTS[0])
  await page.setViewportSize({ width: PW_SCENE_WIDTH[device], height: 900 })
  await settle(
    page,
    preparePartnerVisualHtmlForEditor(source, {
      variant: device,
      siteSlug: TENANTS[0].slug,
      locale: 'vi',
      pageKey: 'home',
      theme: TENANTS[0].theme,
    }),
    device
  )
  await activateActualEditor(page, device)
  await page.evaluate((slug) => {
    const account = document.createElement('a')
    account.id = 'header-account'
    account.className = 'pw-account-btn'
    account.setAttribute('data-pw-el', 'account')
    account.setAttribute('data-pw-chrome-btn', 'account')
    account.href = `/site/${slug}/account`
    account.textContent = 'Account'
    document.querySelector('header')?.appendChild(account)
  }, TENANTS[0].slug)

  const account = page.locator('#header-account')
  await account.evaluate((element) => {
    const html = element as HTMLElement
    html.style.setProperty('display', 'inline-flex', 'important')
    html.style.setProperty('visibility', 'visible', 'important')
    html.style.setProperty('opacity', '1', 'important')
    html.style.setProperty('position', 'relative', 'important')
    html.style.setProperty('width', '120px', 'important')
    html.style.setProperty('height', '32px', 'important')
  })
  await account.click({ timeout: 5_000 })
  const handle = await page.locator('.nanoai-ve-move-handle').boundingBox()
  expect(handle).not.toBeNull()
  if (!handle) return
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + handle.height / 2 + 12, {
    steps: 5,
  })
  await page.mouse.up()

  const moved = await account.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      parent: element.parentElement?.id || '',
      inHeader: Boolean(element.closest('header')),
    }
  })
  expect(moved.inHeader).toBe(false)
  await expect(account).toHaveAttribute('data-pw-placement', 'scene-absolute')

  const saved = serializeBrowserMarkupForSave(await page.content(), device)
  await settle(
    page,
    preparePartnerVisualHtmlForEditor(saved, {
      variant: device,
      siteSlug: TENANTS[0].slug,
      locale: 'vi',
      pageKey: 'home',
      theme: TENANTS[0].theme,
    }),
    device
  )
  await activateActualEditor(page, device)
  const restored = await page.locator('#header-account').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top }
  })
  expect(Math.abs(restored.left - moved.left)).toBeLessThanOrEqual(2)
  expect(
    Math.abs(restored.top - moved.top),
    JSON.stringify({
      moved,
      restored,
      savedAccount: saved.match(/<a\b[^>]*id="header-account"[^>]*>/)?.[0],
    })
  ).toBeLessThanOrEqual(2)
})

test('a newly added overlay keeps its mouse-dragged position', async ({ page }) => {
  const device: PwCoordinateDevice = 'desktop'
  const source = fixtureHtml('home', device, TENANTS[0])
  await page.setViewportSize({ width: PW_SCENE_WIDTH[device], height: 900 })
  await settle(
    page,
    preparePartnerVisualHtmlForEditor(source, {
      variant: device,
      siteSlug: TENANTS[0].slug,
      locale: 'vi',
      pageKey: 'home',
      theme: TENANTS[0].theme,
    }),
    device
  )
  await activateActualEditor(page, device)
  await page.evaluate((sourceName) => {
    window.postMessage({ source: sourceName, type: 'insertText' }, '*')
  }, NANOAI_VE_MESSAGE)

  const text = page.locator('[data-pw-added-text="1"]').first()
  await expect(text).toBeVisible({ timeout: 5_000 })
  const before = await text.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      boxX: element.getAttribute('data-pw-box-x') || '',
      boxY: element.getAttribute('data-pw-box-y') || '',
    }
  })

  await text.click()
  const handle = await page.locator('.nanoai-ve-move-handle').boundingBox()
  expect(handle).not.toBeNull()
  if (!handle) return
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 120, handle.y + handle.height / 2 + 80, {
    steps: 6,
  })
  await page.mouse.up()

  const after = await text.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      boxX: element.getAttribute('data-pw-box-x') || '',
      boxY: element.getAttribute('data-pw-box-y') || '',
      transform: (element as HTMLElement).style.transform || '',
    }
  })
  expect(after.left, JSON.stringify({ before, after })).toBeGreaterThan(before.left + 80)
  expect(after.top, JSON.stringify({ before, after })).toBeGreaterThan(before.top + 40)
  expect(after.boxX).not.toEqual(before.boxX)
  expect(after.boxY).not.toEqual(before.boxY)
})

function pageKind(page: VisualPage): string {
  if (page === 'products') return 'listing'
  if (page === 'product_detail') return 'product'
  if (page === 'about') return 'info'
  return page
}

function pageRegion(page: VisualPage): string {
  if (page === 'products') {
    return '<section data-pw-region="catalog"><h2 data-pw-el="section-title">Catalog</h2><div data-pw-el="grid"><article data-pw-el="card">Product</article></div></section>'
  }
  if (page === 'product_detail') {
    return '<section data-pw-region="gallery"><div data-pw-el="media">Gallery</div></section><section data-pw-region="pdp-info"><h1 data-pw-el="title">Product</h1><p data-pw-el="price">100</p></section>'
  }
  if (page === 'cart') {
    return '<section data-pw-region="cart-list"><div data-pw-el="line">Cart line</div></section><aside data-pw-region="cart-summary">Summary</aside>'
  }
  if (page === 'account') {
    return '<nav data-pw-region="account-nav"><a data-pw-el="menu-item">Profile</a></nav><section data-pw-region="account-main"><h1 data-pw-el="heading">Account</h1></section>'
  }
  if (page === 'about') {
    return '<article data-pw-region="content"><h1 data-pw-el="heading">About</h1><p data-pw-el="body">Content</p></article>'
  }
  return '<section data-pw-region="banner"><div data-pw-el="inner"><h1 data-pw-el="title">Home</h1><p data-pw-el="subtitle">Parity fixture</p></div></section>'
}

function fixtureHtml(
  page: VisualPage,
  device: PwCoordinateDevice,
  tenant: TenantFixture | string
): string {
  const width = PW_SCENE_WIDTH[device]
  const siteSlug = typeof tenant === 'string' ? tenant : tenant.slug
  const industry = typeof tenant === 'string' ? 'generic' : tenant.industry
  const primary = typeof tenant === 'string' ? '#315ca8' : tenant.theme.primaryColor
  const accent = typeof tenant === 'string' ? '#e9eefc' : tenant.theme.surfaceColor
  const dockHtml =
    page === 'product_detail'
      ? `<nav id="pw-dock" class="pw-bottom-nav pw-shop-bottom-nav pw-pdp-sticky" data-pw-pdp-bottom="1" data-pw-region="nav"><div class="pw-pdp-sticky-nav"><a href="/site/${siteSlug}"><span class="pw-pdp-sticky-copy">Home</span></a><button type="button"><span class="pw-pdp-like-copy">Like <span data-pw-like-count>0</span></span></button></div><div class="pw-pdp-sticky-ctas"><button type="button">Cart</button><button type="button">Buy</button></div></nav>`
      : `<nav id="pw-dock" class="pw-bottom-nav" data-pw-region="nav"><a data-pw-el="nav-link" href="/site/${siteSlug}">Home</a></nav>`
  const boxW = 180
  const boxH = 64
  const boxX = Math.round(width * 0.18 - width / 2 + boxW / 2)
  const boxY = 180 + boxH / 2
  const fixedW = 96
  const fixedH = 44
  const fixedX = Math.round((width * 0.7 - width / 2 + fixedW / 2) * 1000) / 1000
  const fixedY = 180 + fixedH / 2
  return `<!doctype html>
<html lang="vi" data-pw-edit-device="${device}" data-pw-scene-lock="${device}" data-pw-coordinate-version="${PW_COORDINATE_CONTRACT_VERSION}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <base href="https://parity.invalid/">
  <style>
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#172033;font-family:Arial,sans-serif}
    body{width:${width}px;min-width:${width}px}
    #pw-header{height:72px;padding:18px 24px;background:${accent};border-bottom:1px solid #9aa8cf}
    #pw-scene{position:relative;width:100%;min-height:1500px;padding-top:20px;background:#f7f9ff}
    #pw-flow{width:calc(100% - 48px);height:120px;margin:0 24px;padding:20px;background:#dce8ff;border:1px solid #88a0d8}
    #pw-absolute{display:flex;align-items:center;justify-content:center;background:${primary};color:#fff;border-radius:10px}
    #pw-fixed{display:flex;align-items:center;justify-content:center;border:0;border-radius:22px;background:#163f86;color:#fff}
    #pw-float{width:48px;height:48px;border:0;border-radius:24px;background:${primary};color:#fff}
    #pw-page-region{margin:220px 24px 0;padding:24px;min-height:260px;border:1px solid #b5bfd6;background:#fff}
    #pw-footer{height:120px;padding:32px 24px;background:#202b46;color:#fff}
    #pw-dock{height:56px;background:#edf1fa;border-top:1px solid #9aa8cf}
    [data-pw-live-fixed-layer],[data-pw-live-chrome],[data-pw-live-dock]{font-family:Arial,sans-serif}
  </style>
</head>
<body data-pw-page="${pageKind(page)}" data-parity-tenant="${siteSlug}" data-parity-industry="${industry}">
  <header id="pw-header" class="pw-header" data-pw-region="header"><strong>${siteSlug}</strong></header>
  <main id="pw-scene" data-pw-scene-root="1">
    <section id="pw-flow" data-pw-region="content"><span data-pw-el="body">Flow</span></section>
    <div id="pw-absolute" data-pw-added-text="1" data-pw-user-move="1" data-pw-scene="3"
      data-pw-placement="scene-absolute" data-pw-box-x="${boxX}"
      data-pw-box-y="${boxY}" data-pw-box-w="180" data-pw-box-h="64">Absolute</div>
    <button id="pw-fixed" type="button" data-pw-added-btn="1" data-pw-stay-scroll="1"
      data-pw-scene="4" data-pw-placement="viewport-fixed" data-pw-fixed-x="${fixedX}"
      data-pw-fixed-y="${fixedY}" data-pw-fixed-w="96" data-pw-fixed-h="44">Fixed</button>
    <button id="pw-float" type="button" data-pw-chrome-btn="chat" data-pw-chrome-added="1"
      data-pw-device="${device}" data-pw-scene="4">Chat</button>
    <div id="pw-page-region">${pageRegion(page)}</div>
  </main>
  <footer id="pw-footer" class="pw-footer" data-pw-region="footer" data-pw-footer="full"><span data-pw-el="copyright">Footer</span></footer>
  ${dockHtml}
</body>
</html>`
}

function removeExternalFontLinks(html: string): string {
  return html.replace(/<link\b[^>]*data-pw-shop-fonts=["']1["'][^>]*>/gi, '')
}

function documentBodyMarkup(html: string): string {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html
}

function serializeBrowserMarkupForSave(
  html: string,
  device: PwCoordinateDevice
): string {
  const parsed = parseHTML(html)
  parsed.document.querySelector('#pw-parity-freeze-style')?.remove()
  const globals = globalThis as unknown as Record<string, unknown>
  const replacements: Record<string, unknown> = {
    window: parsed.window,
    document: parsed.document,
    Node: parsed.window.Node,
    HTMLElement: parsed.window.HTMLElement,
    HTMLInputElement: parsed.window.HTMLInputElement,
  }
  const previous = new Map(
    Object.keys(replacements).map((key) => [
      key,
      {
        present: Object.prototype.hasOwnProperty.call(globals, key),
        value: globals[key],
      },
    ])
  )
  try {
    for (const [key, value] of Object.entries(replacements)) globals[key] = value
    return serializeVisualEditorHtml(
      parsed.document as unknown as Document,
      device
    )
  } finally {
    for (const [key, old] of previous) {
      if (old.present) globals[key] = old.value
      else delete globals[key]
    }
  }
}

async function activateActualEditor(
  page: Page,
  device: PwCoordinateDevice
): Promise<void> {
  await page.addScriptTag({ content: buildVisualEditorScript('vi') })
  await page.waitForFunction(
    () =>
      typeof (
        window as typeof window & {
          __nanoaiVeActivate?: unknown
        }
      ).__nanoaiVeActivate === 'function',
    undefined,
    { timeout: 10_000 }
  )
  await page.evaluate((activeDevice) => {
    const runtime = window as typeof window & {
      __nanoaiVeActivate?: (payload: Record<string, unknown>) => void
    }
    runtime.__nanoaiVeActivate?.({
      device: activeDevice,
      logoUrl: '',
      chatIconLogoUrl: '',
      hideChatLauncher: true,
      infoPage: false,
      pageKey: 'home',
      cmsSlug: '',
      hoverNameOn: false,
    })
  }, device)
  await page.waitForFunction(
    () =>
      document.body.classList.contains('nanoai-ve-active') &&
      Boolean(
        (window as typeof window & { __nanoaiVeBound?: unknown })
          .__nanoaiVeBound
      ),
    undefined,
    { timeout: 10_000 }
  )
}

function inlineRuntimeDocument(
  html: string,
  device: PwCoordinateDevice,
  revision: string
): string {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || ''
  return `<!doctype html><html data-pw-edit-device="${device}" data-pw-scene-lock="${device}" data-pw-coordinate-version="${PW_COORDINATE_CONTRACT_VERSION}"><head>${head}</head><body><div data-pw-inline-visual-root="1" data-pw-active-device="${device}" data-pw-runtime-revision="${revision}">${documentBodyMarkup(html)}</div></body></html>`
}

async function settle(page: Page, html: string, device: PwCoordinateDevice): Promise<void> {
  await page.setContent(removeExternalFontLinks(html), { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => window.scrollTo(0, 0))
  const freezeStyle = await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
  await freezeStyle.evaluate((element) => {
    ;(element as HTMLStyleElement).id = 'pw-parity-freeze-style'
  })
  await page.waitForFunction(
    ({ expected, version }) => {
      const root = document.querySelector('[data-pw-scene-root="1"]')
      const absolute = document.getElementById('pw-absolute')
      const fixed = document.getElementById('pw-fixed')
      const float = document.getElementById('pw-float')
      return (
        document.documentElement.getAttribute('data-pw-scene-lock') === expected &&
        document.documentElement.getAttribute('data-pw-coordinate-version') === version &&
        root &&
        absolute?.parentElement === root &&
        absolute.getBoundingClientRect().width > 8 &&
        fixed &&
        window.getComputedStyle(fixed).position === 'fixed' &&
        float &&
        window.getComputedStyle(float).position === 'fixed' &&
        typeof (window as typeof window & { __pwSceneCenterApply?: unknown })
          .__pwSceneCenterApply === 'function'
      )
    },
    { expected: device, version: PW_COORDINATE_CONTRACT_VERSION },
    { timeout: 10_000 }
  )
}

async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate((ids) => {
    const roundedRect = (element: Element): Rect => {
      const rect = element.getBoundingClientRect()
      const round = (value: number) => Math.round(value * 100) / 100
      return {
        left: round(rect.left),
        top: round(rect.top),
        width: round(rect.width),
        height: round(rect.height),
      }
    }
    const hostName = (element: Element): string => {
      if (element.closest('[data-pw-live-fixed-layer]')) return 'fixed'
      if (element.closest('[data-pw-live-chrome]')) return 'chrome'
      if (element.closest('[data-pw-live-dock]')) return 'dock'
      if (element.parentElement?.matches('[data-pw-scene-root="1"]')) return 'scene'
      return element.parentElement?.tagName.toLowerCase() || ''
    }
    const nodes: Geometry['nodes'] = {}
    for (const id of ids) {
      const element = document.getElementById(id)
      if (!element) throw new Error(`Missing #${id}`)
      nodes[id] = { rect: roundedRect(element), host: hostName(element) }
    }
    const scene = document.querySelector('[data-pw-scene-root="1"]')
    if (!scene) throw new Error('Missing scene root')
    const sceneRect = scene.getBoundingClientRect()
    return {
      activeDevice:
        document.documentElement.getAttribute('data-pw-scene-lock') ||
        document.documentElement.getAttribute('data-pw-edit-device') ||
        '',
      coordinateVersion:
        document.documentElement.getAttribute('data-pw-coordinate-version') || '',
      centerDelta: Math.abs(sceneRect.left + sceneRect.width / 2 - window.innerWidth / 2),
      scrollHeight: document.documentElement.scrollHeight,
      counts: {
        header: document.querySelectorAll('#pw-header').length,
        main: document.querySelectorAll('#pw-scene').length,
        footer: document.querySelectorAll('#pw-footer').length,
        dock: document.querySelectorAll('#pw-dock').length,
      },
      fixedRuntime: {
        sync: typeof (window as typeof window & { __pwStayScrollSync?: unknown })
          .__pwStayScrollSync,
        script: Boolean(document.getElementById('pw-shop-stay-scroll')),
        layers: document.querySelectorAll('[data-pw-live-fixed-layer]').length,
        placement: document.getElementById('pw-fixed')?.getAttribute('data-pw-placement') || '',
        x: document.getElementById('pw-fixed')?.getAttribute('data-pw-fixed-x') || '',
        y: document.getElementById('pw-fixed')?.getAttribute('data-pw-fixed-y') || '',
      },
      nodes,
    }
  }, IDS)
}

function expectRectNear(actual: Rect, expected: Rect, tolerance = 1): void {
  for (const key of ['left', 'top', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${key}: ${actual[key]} vs ${expected[key]}`).toBeLessThanOrEqual(
      tolerance
    )
  }
}

function screenshotDifferenceRatio(left: Buffer, right: Buffer): number {
  const a = PNG.sync.read(left)
  const b = PNG.sync.read(right)
  expect({ width: a.width, height: a.height }).toEqual({ width: b.width, height: b.height })
  const changed = pixelmatch(a.data, b.data, undefined, a.width, a.height, {
    threshold: 0.1,
    includeAA: false,
  })
  return changed / (a.width * a.height)
}

async function regionScreenshots(page: Page): Promise<Record<string, Buffer>> {
  const selectors = {
    fixed: '#pw-fixed',
    float: '#pw-float',
    content: '#pw-page-region',
    footer: '#pw-footer',
  }
  const shots: Record<string, Buffer> = {}
  for (const [name, selector] of Object.entries(selectors)) {
    shots[name] = await page.locator(selector).screenshot({ animations: 'disabled' })
  }
  return shots
}

async function expectScreenshotMatch(
  testInfo: TestInfo,
  label: string,
  editor: Buffer,
  live: Buffer,
  maxRatio: number
): Promise<void> {
  const ratio = screenshotDifferenceRatio(editor, live)
  if (ratio > maxRatio) {
    await testInfo.attach(`editor-${label}.png`, { body: editor, contentType: 'image/png' })
    await testInfo.attach(`live-${label}.png`, { body: live, contentType: 'image/png' })
  }
  expect(ratio, `${label} mismatch ratio`).toBeLessThanOrEqual(maxRatio)
}

for (const tenant of TENANTS) {
  for (const [device, width] of DEVICES) {
    for (const pageKey of PAGES) {
      test(`${tenant.slug} ${device} ${pageKey}: editor and live geometry are identical`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        const source = fixtureHtml(pageKey, device, tenant)
        const htmlPath = visualEditorHtmlPath(pageKey, device)
        const theme = applyVisualEditThemeFlag(tenant.theme, { pageKey, variant: device })
        const editor = preparePartnerVisualHtmlForEditor(source, {
          variant: device,
          siteSlug: tenant.slug,
          locale: 'vi',
          pageKey,
          theme,
        })
        const target =
          pageKey === 'product_detail'
            ? ({ kind: 'product', productId: 'parity-product' } as const)
            : ({ kind: 'page', pageKey } as const)
        const live = renderPartnerVisualHtmlForPublic(
          {
            siteSlug: tenant.slug,
            locale: 'vi',
            theme,
            project: {
              entryPath: htmlPath,
              files: [{ path: htmlPath, kind: 'html', content: source }],
            },
          },
          target,
          { device }
        )
        expect(editor).toContain(`--pw-primary:${tenant.theme.primaryColor}`)
        expect(live).toContain(`--pw-primary:${tenant.theme.primaryColor}`)

        await settle(page, editor, device)
        const editorGeometry = await geometry(page)
        expect(await page.locator('body').getAttribute('data-parity-industry')).toBe(
          tenant.industry
        )
        const fixedBefore = editorGeometry.nodes['pw-fixed'].rect
        const editorShot = await page.screenshot()
        const editorRegions = await regionScreenshots(page)
        await page.evaluate(() => window.scrollTo(0, 600))
        await page.waitForFunction(() => window.scrollY >= 500)
        const editorScrollShot = await page.screenshot()
        const fixedAfterScroll = await page.locator('#pw-fixed').evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        })
        expectRectNear(fixedAfterScroll, fixedBefore, 1)
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
          editorGeometry.scrollHeight
        )

        await settle(page, live, device)
        const liveGeometry = await geometry(page)
        expect(await page.locator('body').getAttribute('data-parity-industry')).toBe(
          tenant.industry
        )
        const liveShot = await page.screenshot()
        const liveRegions = await regionScreenshots(page)
        await page.evaluate(() => window.scrollTo(0, 600))
        await page.waitForFunction(() => window.scrollY >= 500)
        const liveScrollShot = await page.screenshot()
        const liveFixedAfterScroll = await page.locator('#pw-fixed').evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        })
        expectRectNear(liveFixedAfterScroll, liveGeometry.nodes['pw-fixed'].rect, 1)
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
          liveGeometry.scrollHeight
        )

        expect(editorGeometry.activeDevice).toBe(device)
        expect(liveGeometry.activeDevice).toBe(device)
        expect(editorGeometry.coordinateVersion).toBe(PW_COORDINATE_CONTRACT_VERSION)
        expect(liveGeometry.coordinateVersion).toBe(PW_COORDINATE_CONTRACT_VERSION)
        expect(editorGeometry.counts).toEqual({ header: 1, main: 1, footer: 1, dock: 1 })
        expect(liveGeometry.counts).toEqual(editorGeometry.counts)
        expect(editorGeometry.centerDelta).toBeLessThanOrEqual(1)
        expect(liveGeometry.centerDelta).toBeLessThanOrEqual(1)
        for (const id of IDS) {
          expect(
            liveGeometry.nodes[id].host,
            `${id} host; ${JSON.stringify(liveGeometry.fixedRuntime)}`
          ).toBe(editorGeometry.nodes[id].host)
          expectRectNear(liveGeometry.nodes[id].rect, editorGeometry.nodes[id].rect, 1)
        }

        await expectScreenshotMatch(testInfo, 'viewport-top', editorShot, liveShot, 0.005)
        await expectScreenshotMatch(
          testInfo,
          'viewport-scrolled',
          editorScrollShot,
          liveScrollShot,
          0.005
        )
        for (const name of Object.keys(editorRegions)) {
          await expectScreenshotMatch(
            testInfo,
            `region-${name}`,
            editorRegions[name],
            liveRegions[name],
            0.001
          )
        }
      })
    }
  }
}

for (const [device, width] of DEVICES) {
  test(`${device}: actual editor serialization survives two PATCH saves and public reload`, async ({
    page,
  }) => {
    const siteSlug = `save-parity-${device}`
    const endpoint = `https://parity.invalid/api/messaging/partner-website/${siteSlug}`
    const htmlPath = visualEditorHtmlPath('home', device)
    const source = fixtureHtml('home', device, siteSlug)
    let project: PartnerWebsiteProject = {
      entryPath: htmlPath,
      files: [{ path: htmlPath, kind: 'html' as const, content: source }],
    }
    let theme = applyVisualEditThemeFlag(
      {
        ...DEFAULT_PARTNER_WEBSITE_THEME,
        primaryColor: device === 'mobile' ? '#315ca8' : '#176b4d',
        accentColor: device === 'mobile' ? '#9bb8ee' : '#8fd3b8',
      },
      { pageKey: 'home', variant: device }
    )
    let revision = 0
    const requests: Array<Record<string, unknown>> = []

    await page.route(endpoint, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'PATCH,OPTIONS',
            'access-control-allow-headers': 'content-type',
          },
        })
        return
      }
      const body = route.request().postDataJSON() as Record<string, unknown>
      requests.push(body)
      const finalized = finalizeVisualEditorSave({
        project,
        theme,
        htmlPath,
        sourceHtml: String(body.htmlSource || ''),
        visualDevice: device,
      })
      project = finalized.project
      theme = finalized.theme
      const updatedAt = `parity-revision-${++revision}`
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify({
          success: true,
          website: { updatedAt, theme, project },
          canonicalVisual: {
            html: finalized.canonicalHtml,
            htmlPath,
            device,
            revision: updatedAt,
            sourceHash: hashShopCachePayload(finalized.canonicalHtml),
          },
        }),
      })
    })

    const save = async (htmlSource: string) =>
      page.evaluate(
        async ({ url, html, activeDevice }) => {
          const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              htmlSource: html,
              visualEdited: true,
              visualPageKey: 'home',
              visualDevice: activeDevice,
            }),
          })
          if (!response.ok) throw new Error(`PATCH failed: ${response.status}`)
          return (await response.json()).canonicalVisual as {
            html: string
            htmlPath: string
            device: string
            revision: string
            sourceHash: string
          }
        },
        { url: endpoint, html: htmlSource, activeDevice: device }
      )

    await page.setViewportSize({ width, height: 900 })
    await settle(
      page,
      preparePartnerVisualHtmlForEditor(source, {
        variant: device,
        siteSlug,
        locale: 'vi',
        pageKey: 'home',
        theme,
      }),
      device
    )
    await activateActualEditor(page, device)
    await page.locator('#pw-absolute').evaluate((element) => {
      element.textContent = 'Saved through editor'
    })
    const first = await save(
      serializeBrowserMarkupForSave(await page.content(), device)
    )
    expect(first.htmlPath).toBe(htmlPath)
    expect(first.device).toBe(device)
    expect(first.html).toContain('Saved through editor')
    expect(first.html).toContain(`data-pw-coordinate-version="${PW_COORDINATE_CONTRACT_VERSION}"`)
    expect(first.sourceHash).toBe(hashShopCachePayload(first.html))

    await settle(
      page,
      preparePartnerVisualHtmlForEditor(first.html, {
        variant: device,
        siteSlug,
        locale: 'vi',
        pageKey: 'home',
        theme,
      }),
      device
    )
    const canonicalEditorGeometry = await geometry(page)
    await activateActualEditor(page, device)
    const second = await save(
      serializeBrowserMarkupForSave(await page.content(), device)
    )
    expect(second.html).toBe(first.html)
    expect(second.sourceHash).toBe(first.sourceHash)
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(request.visualEdited).toBe(true)
      expect(request.visualPageKey).toBe('home')
      expect(request.visualDevice).toBe(device)
    }

    const live = renderPartnerVisualHtmlForPublic(
      {
        siteSlug,
        locale: 'vi',
        theme,
        project,
        htmlSource: device === 'desktop' ? second.html : null,
      },
      { kind: 'page', pageKey: 'home' },
      { device }
    )
    await settle(page, live, device)
    const liveGeometry = await geometry(page)
    expect(liveGeometry.activeDevice).toBe(device)
    expect(liveGeometry.counts).toEqual({ header: 1, main: 1, footer: 1, dock: 1 })
    for (const id of IDS) {
      expect(liveGeometry.nodes[id].host).toBe(canonicalEditorGeometry.nodes[id].host)
      expectRectNear(
        liveGeometry.nodes[id].rect,
        canonicalEditorGeometry.nodes[id].rect,
        1
      )
    }
  })
}

test('device ownership stays stable through the full viewport and zoom matrix', async ({
  page,
}) => {
  await page.setContent(`<script>${pwCoordinateRuntimeSource()}</script>`)
  const session = await page.context().newCDPSession(page)
  const widths = [390, 768, 1280, 1440, 1366, 1920]
  const zooms = [0.5, 0.75, 1, 1.25, 1.5]
  const observedVisualScales = new Set<number>()

  for (const width of widths) {
    const expectedDevice: PwCoordinateDevice =
      width < 768 ? 'mobile' : width < 1280 ? 'tablet' : width < 1440 ? 'laptop' : 'desktop'
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
    await page.setViewportSize({ width, height: 900 })
    for (const zoom of zooms) {
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom })
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
      const result = await page.evaluate(() => {
          const core = (
            window as typeof window & {
              __pwCoordinate: {
                resolveDevice(input: {
                  outerWidth: number
                  layoutWidth: number
                  screenWidth: number
                }): string
                createMap(input: {
                  device: string
                  viewportWidth: number
                }): { sceneWidth: number; scale: number; originX: number }
                sceneToClient(
                  point: { x: number; y: number },
                  map: { sceneWidth: number; scale: number; originX: number }
                ): { x: number; y: number }
              }
            }
          ).__pwCoordinate
          const visualWidth = window.visualViewport?.width || window.innerWidth
          const visualScale = window.visualViewport?.scale || 1
          const active = core.resolveDevice({
            outerWidth: window.outerWidth,
            layoutWidth: window.innerWidth,
            screenWidth: window.screen.width,
          })
          const map = core.createMap({ device: active, viewportWidth: visualWidth })
          const center = core.sceneToClient({ x: 0, y: 0 }, map)
          return {
            active,
            centerX: center.x,
            viewportCenterX: visualWidth / 2,
            layoutWidth: window.innerWidth,
            outerWidth: window.outerWidth,
            visualScale,
          }
        })
      observedVisualScales.add(Math.round(result.visualScale * 100) / 100)
      expect(result.active, `${width}px at ${zoom * 100}%`).toBe(expectedDevice)
      expect(result.layoutWidth).toBe(width)
      expect(result.outerWidth).toBeGreaterThan(0)
      expect(Math.abs(result.centerX - result.viewportCenterX)).toBeLessThanOrEqual(1)
    }
  }
  expect(observedVisualScales.size).toBeGreaterThan(1)
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
})

test('changing the active inline device removes stale derived runtime hosts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const desktop = preparePartnerVisualHtmlForPublic(
    fixtureHtml('product_detail', 'desktop', 'revision-desktop'),
    {
      siteSlug: 'revision-desktop',
      locale: 'vi',
      pageKey: 'product_detail',
    }
  )
  const mobile = preparePartnerVisualHtmlForPublic(
    fixtureHtml('product_detail', 'mobile', 'revision-mobile'),
    {
      siteSlug: 'revision-mobile',
      locale: 'vi',
      pageKey: 'product_detail',
    }
  )

  await settle(page, inlineRuntimeDocument(desktop, 'desktop', 'revision-a'), 'desktop')
  await page.evaluate(
    ({ body, revision }) => {
      const root = document.querySelector('[data-pw-inline-visual-root]')
      if (!root) throw new Error('Missing inline visual root')
      root.innerHTML = body
      root.setAttribute('data-pw-active-device', 'mobile')
      root.setAttribute('data-pw-runtime-revision', revision)
      document.documentElement.setAttribute('data-pw-edit-device', 'mobile')
      document.documentElement.setAttribute('data-pw-scene-lock', 'mobile')
      document
        .querySelectorAll(
          '[data-pw-live-chrome],[data-pw-live-dock],[data-pw-live-fixed-layer]'
        )
        .forEach((host) => {
          if (host.getAttribute('data-pw-runtime-revision') !== revision) host.remove()
        })
      const runtime = window as typeof window & {
        __pwSceneCenterApply?: () => void
        __pwStayScrollSync?: () => void
        __pwChromeFloatSync?: () => void
      }
      runtime.__pwSceneCenterApply?.()
      runtime.__pwStayScrollSync?.()
      runtime.__pwChromeFloatSync?.()
    },
    { body: documentBodyMarkup(mobile), revision: 'revision-b' }
  )
  await page.waitForFunction(() => {
    const revision = 'revision-b'
    return (
      document.querySelectorAll('#pw-header').length === 1 &&
      document.querySelectorAll('#pw-scene').length === 1 &&
      document.querySelectorAll('#pw-footer').length === 1 &&
      document.querySelectorAll('#pw-dock').length === 1 &&
      document.querySelectorAll('#pw-fixed').length === 1 &&
      document.querySelectorAll('#pw-float').length === 1 &&
      Array.from(
        document.querySelectorAll(
          '[data-pw-live-chrome],[data-pw-live-dock],[data-pw-live-fixed-layer]'
        )
      ).every((host) => host.getAttribute('data-pw-runtime-revision') === revision)
    )
  })
  expect(await page.locator('#pw-header').textContent()).toContain('revision-mobile')
  expect(await page.locator('#pw-fixed').evaluate((el) => getComputedStyle(el).position)).toBe(
    'fixed'
  )
})
