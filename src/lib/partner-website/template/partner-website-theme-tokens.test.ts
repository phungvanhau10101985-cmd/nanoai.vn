import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import {
  darkenHex,
  extractShopBrowserThemeColorFromHtml,
  hexesClose,
  parseThemeColorPatch,
  resolveShopThemeColors,
  rewriteThemeCssVarsInHtml,
  SHOP_AUX_BG_SWATCHES,
  SHOP_AUX_CART_SWATCHES,
  SHOP_MAIN_COLOR_SWATCHES,
  shopBrowserChromeColor,
  shopBrowserThemeColorViewportItems,
  shopThemeQuickPicks,
  themeFromAuxCartSwatch,
  themeFromMainSwatch,
  themeFromPresetPartial,
  upsertShopBrowserThemeColorInHtml,
} from '@/lib/partner-website/template/partner-website-theme-tokens'

test('resolves missing buy from primary and cart from supporting gray', () => {
  const resolved = resolveShopThemeColors({
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    buyButtonColor: undefined,
    cartButtonColor: undefined,
    primaryColor: '#2563eb',
    mutedColor: '#64748b',
  })
  assert.equal(resolved.buyButtonColor, '#2563eb')
  assert.equal(resolved.cartButtonColor, '#6b7280')
})

test('main swatch updates primary, accent, and buy button', () => {
  const next = themeFromMainSwatch(
    { ...DEFAULT_PARTNER_WEBSITE_THEME, cartButtonColor: '#6b7280' },
    '#2563eb'
  )
  assert.equal(next.primaryColor, '#2563eb')
  assert.equal(next.buyButtonColor, '#2563eb')
  assert.equal(next.cartButtonColor, '#6b7280')
  assert.equal(next.accentColor, darkenHex('#2563eb', 0.12))
  assert.equal(hexesClose(next.accentColor || '', '#2563eb'), false)
})

test('marketplace main swatch also syncs cart and keeps a lighter accent', () => {
  const next = themeFromMainSwatch(
    { ...DEFAULT_PARTNER_WEBSITE_THEME, look: 'marketplace', cartButtonColor: '#ff6b00' },
    '#2563eb'
  )
  assert.equal(next.primaryColor, '#2563eb')
  assert.equal(next.buyButtonColor, '#2563eb')
  assert.equal(next.cartButtonColor, '#2563eb')
  assert.equal(next.look, 'marketplace')
  assert.equal(hexesClose(next.accentColor || '', '#2563eb'), false)
})

test('preset look maps primary to buy and supporting gray to cart', () => {
  const next = themeFromPresetPartial(DEFAULT_PARTNER_WEBSITE_THEME, {
    primaryColor: '#0f766e',
    accentColor: '#14b8a6',
    backgroundColor: '#f0fdfa',
    textColor: '#134e4a',
    mutedColor: '#5eead4',
  })
  assert.equal(next.primaryColor, '#0f766e')
  assert.equal(next.buyButtonColor, '#0f766e')
  assert.equal(next.cartButtonColor, '#6b7280')
  assert.equal(next.mutedColor, '#5eead4')
  assert.equal(next.backgroundColor, '#f0fdfa')
  assert.equal(next.look, undefined)
})

test('aux cart swatch does not recolor muted text', () => {
  const next = themeFromAuxCartSwatch(
    { ...DEFAULT_PARTNER_WEBSITE_THEME, mutedColor: '#5eead4', cartButtonColor: '#6b7280' },
    '#1e3a5f'
  )
  assert.equal(next.cartButtonColor, '#1e3a5f')
  assert.equal(next.mutedColor, '#5eead4')
})

test('preset with explicit buy, cart, footer, and look keeps those values', () => {
  const next = themeFromPresetPartial(DEFAULT_PARTNER_WEBSITE_THEME, {
    look: 'marketplace',
    primaryColor: '#ff6b00',
    accentColor: '#ff8c00',
    buyButtonColor: '#ff3333',
    cartButtonColor: '#ff6b00',
    backgroundColor: '#f5f5f5',
    textColor: '#1a1a1a',
    mutedColor: '#6b7280',
    surfaceColor: '#ffffff',
    footerColor: '#111827',
    fontFamily: '"Nunito", sans-serif',
  })
  assert.equal(next.look, 'marketplace')
  assert.equal(next.buyButtonColor, '#ff3333')
  assert.equal(next.cartButtonColor, '#ff6b00')
  assert.equal(next.footerColor, '#111827')
  assert.equal(next.fontFamily, '"Nunito", sans-serif')
})

test('rejects invalid theme patch', () => {
  assert.equal(parseThemeColorPatch({ primaryColor: 'orange' }), null)
  assert.equal(parseThemeColorPatch({ primaryColor: '#2563eb' })?.primaryColor, '#2563eb')
})

test('rewrites :root CSS variables in saved HTML', () => {
  const html =
    '<html><head><style>:root{--pw-primary:#f97316;--pw-accent:#ea580c}</style></head><body></body></html>'
  const next = rewriteThemeCssVarsInHtml(html, {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#2563eb',
    buyButtonColor: '#2563eb',
  })
  assert.match(next, /--pw-primary:#2563eb/)
  assert.match(next, /--pw-buy:#2563eb/)
  assert.match(next, /id="pw-theme-root"/)
  assert.match(next, /:root,html,body\{/)
  assert.match(next, /--pw-primary:#2563eb !important/)
})

test('later :root block does not keep the old primary color', () => {
  const html =
    '<html><head><style>:root{--pw-primary:#f97316}</style><style>:root{--pw-primary:#c2410c;--pw-accent:#ea580c}</style></head><body></body></html>'
  const next = rewriteThemeCssVarsInHtml(html, {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#0f766e',
    buyButtonColor: '#0f766e',
  })
  assert.equal((next.match(/--pw-primary:#0f766e/g) || []).length >= 2, true)
  assert.equal(next.includes('--pw-primary:#c2410c'), false)
  assert.equal(next.includes('--pw-primary:#f97316'), false)
})

test('theme root rewrite is byte-idempotent and stays in place', () => {
  const theme = {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#0f766e',
    buyButtonColor: '#0f766e',
  }
  const html =
    '<html><head><style id="before">.x{color:red}</style><style id="pw-theme-root">:root{--pw-primary:#f97316}</style><style id="after">.y{color:blue}</style></head><body></body></html>'
  const once = rewriteThemeCssVarsInHtml(html, theme)
  const twice = rewriteThemeCssVarsInHtml(once, theme)
  assert.equal(twice, once)
  assert.equal(once.indexOf('id="before"') < once.indexOf('id="pw-theme-root"'), true)
  assert.equal(once.indexOf('id="pw-theme-root"') < once.indexOf('id="after"'), true)
  assert.equal((once.match(/id="pw-theme-root"/g) || []).length, 1)
})

test('rebinds chrome class hex to tokens and leaves inline paint alone', () => {
  const html =
    '<html><head><style>.pw-topbar{background:#c2410c}.pw-hero{background:#c2410c}</style></head><body><button style="background:#c2410c">TÌM</button><div data-pw-added-bg style="background:#c2410c"></div></body></html>'
  const next = rewriteThemeCssVarsInHtml(html, {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#0f766e',
    buyButtonColor: '#0f766e',
  })
  assert.match(next, /\.pw-topbar\{background:var\(--pw-primary\)/)
  assert.match(next, /\.pw-hero\{background:#c2410c/)
  assert.match(next, /<button style="background:#c2410c">TÌM<\/button>/)
  assert.match(next, /data-pw-added-bg style="background:#c2410c"/)
  assert.match(next, /id="pw-theme-root"/)
  assert.match(next, /--pw-primary:#0f766e !important/)
})

test('nav links including sale stay ink and do not follow theme', () => {
  const html =
    '<html><head><style>.pw-nav-main a{color:var(--pw-primary)}.pw-nav-main a.pw-nav-sale{color:var(--pw-primary)}</style></head><body></body></html>'
  const next = rewriteThemeCssVarsInHtml(html, {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#0f766e',
    buyButtonColor: '#0f766e',
  })
  assert.match(next, /\.pw-nav-main a\{color:#374151/)
  assert.match(next, /\.pw-nav-main a\.pw-nav-sale\{color:#374151/)
})

test('header nav link hover stays ink; active still uses the primary token', () => {
  const html =
    '<html><head><style>.pw-nav-main a:hover{color:#f97316}.pw-nav-main a.pw-nav-sale:hover{color:var(--pw-accent)}.pw-nav-main a.is-active{color:#ea580c}</style></head><body></body></html>'
  const next = rewriteThemeCssVarsInHtml(html, {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#0f766e',
    buyButtonColor: '#0f766e',
  })
  assert.match(next, /\.pw-nav-main a:hover\{color:#374151/)
  assert.match(next, /\.pw-nav-main a\.pw-nav-sale:hover\{color:#374151/)
  assert.match(next, /\.pw-nav-main a\.is-active\{color:var\(--pw-primary\)/)
})

test('marketplace header nav hover keeps white instead of the primary token', () => {
  const html =
    '<html><head><style>html[data-pw-look="marketplace"] .pw-nav-main .pw-nav-pill>a:hover{color:#fff!important}</style></head><body></body></html>'
  const next = rewriteThemeCssVarsInHtml(html, {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#f97316',
  })
  assert.match(next, /\.pw-nav-main \.pw-nav-pill>a:hover\{color:#fff/)
  assert.doesNotMatch(next, /\.pw-nav-pill>a:hover\{color:var\(--pw-primary\)/)
})

test('shopThemeQuickPicks exposes live main and supporting theme colors', () => {
  const labels = {
    mainTitle: 'Main',
    auxTitle: 'Aux',
    hint: 'Tap to apply',
    primary: 'Primary',
    accent: 'Accent',
    buy: 'Buy',
    cart: 'Cart',
    background: 'Bg',
    text: 'Text',
    muted: 'Muted',
    surface: 'Surface',
    footer: 'Footer',
  }
  const picks = shopThemeQuickPicks(
    {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      primaryColor: '#c2410c',
      accentColor: '#9a3412',
      buyButtonColor: '#ea580c',
      cartButtonColor: '#78716c',
      backgroundColor: '#fff7ed',
      textColor: '#1c1917',
      mutedColor: '#78716c',
      surfaceColor: '#ffedd5',
    },
    labels
  )
  assert.equal(picks.mainTitle, 'Main')
  assert.equal(picks.auxTitle, 'Aux')
  assert.equal(picks.hint, 'Tap to apply')
  assert.deepEqual(
    picks.main.slice(0, 4).map((s) => s.hex),
    ['#c2410c', '#9a3412', '#ea580c', '#78716c']
  )
  assert.equal(
    picks.main.some((s) => s.hex === SHOP_MAIN_COLOR_SWATCHES[1].hex),
    true
  )
  assert.deepEqual(
    picks.aux.slice(0, 4).map((s) => s.hex),
    ['#fff7ed', '#1c1917', '#78716c', '#ffedd5']
  )
  assert.equal(
    picks.aux.some((s) => s.hex === SHOP_AUX_BG_SWATCHES[0].hex),
    true
  )
  assert.equal(
    picks.aux.some((s) => s.hex === SHOP_AUX_CART_SWATCHES[0].hex),
    true
  )
  const presetsOnly = shopThemeQuickPicks(null, labels)
  assert.equal(presetsOnly.main[0].hex, SHOP_MAIN_COLOR_SWATCHES[0].hex)
  assert.equal(presetsOnly.main.length, SHOP_MAIN_COLOR_SWATCHES.length)
})

test('browser chrome color is the primary hex, never a CSS variable', () => {
  assert.equal(shopBrowserChromeColor('#0F766E'), '#0f766e')
  assert.equal(shopBrowserChromeColor({ primaryColor: '#0f766e' }), '#0f766e')
  assert.equal(shopBrowserChromeColor('var(--pw-primary)'), DEFAULT_PARTNER_WEBSITE_THEME.primaryColor)
})

test('rewrites leftover theme-color meta to the live primary hex', () => {
  const html =
    '<html><head><meta name="theme-color" content="var(--pw-primary,#111827)"/><style>:root{--pw-primary:#f97316}</style></head><body></body></html>'
  const next = rewriteThemeCssVarsInHtml(html, {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    primaryColor: '#0f766e',
    buyButtonColor: '#0f766e',
  })
  assert.match(next, /<meta name="theme-color" content="#0f766e"\/>/)
  assert.doesNotMatch(next, /theme-color" content="var\(/)
  assert.doesNotMatch(next, /theme-color" content="#f97316"/)
  assert.equal(extractShopBrowserThemeColorFromHtml(next), '#0f766e')
})

test('upserts a single theme-color tag when the document had none', () => {
  const once = upsertShopBrowserThemeColorInHtml('<html><head></head><body></body></html>', '#0f766e')
  const twice = upsertShopBrowserThemeColorInHtml(once, '#0f766e')
  assert.equal(twice, once)
  assert.equal((once.match(/name="theme-color"/g) || []).length, 1)
  assert.equal(extractShopBrowserThemeColorFromHtml(once), '#0f766e')
})

test('browser chrome extraction prefers the live theme block over stale preset metadata', () => {
  const html =
    '<html><head><meta name="theme-color" content="#f97316"/>' +
    '<style>:root{--pw-primary:#f97316}</style>' +
    '<style id="pw-theme-root">:root,html,body{--pw-primary:#2563eb !important}</style>' +
    '</head><body></body></html>'
  assert.equal(extractShopBrowserThemeColorFromHtml(html), '#2563eb')
})

test('shop viewport theme-color uses the same light/dark media keys as the NanoAI root layout', () => {
  const items = shopBrowserThemeColorViewportItems({ primaryColor: '#0f766e' })
  assert.deepEqual(items, [
    { media: '(prefers-color-scheme: light)', color: '#0f766e' },
    { media: '(prefers-color-scheme: dark)', color: '#0f766e' },
  ])
  assert.notEqual(items[0].color, DEFAULT_PARTNER_WEBSITE_THEME.primaryColor)
})
