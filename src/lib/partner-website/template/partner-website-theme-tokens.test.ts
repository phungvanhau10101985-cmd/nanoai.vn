import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import {
  darkenHex,
  hexesClose,
  parseThemeColorPatch,
  resolveShopThemeColors,
  rewriteThemeCssVarsInHtml,
  SHOP_AUX_BG_SWATCHES,
  SHOP_AUX_CART_SWATCHES,
  SHOP_MAIN_COLOR_SWATCHES,
  shopThemeQuickPicks,
  themeFromMainSwatch,
  themeFromPresetPartial,
} from '@/lib/partner-website/template/partner-website-theme-tokens'

test('resolves buy/cart from primary/muted when missing', () => {
  const resolved = resolveShopThemeColors({
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    buyButtonColor: undefined,
    cartButtonColor: undefined,
    primaryColor: '#2563eb',
    mutedColor: '#64748b',
  })
  assert.equal(resolved.buyButtonColor, '#2563eb')
  assert.equal(resolved.cartButtonColor, '#64748b')
})

test('main swatch updates primary, accent, and buy button', () => {
  const next = themeFromMainSwatch(DEFAULT_PARTNER_WEBSITE_THEME, '#2563eb')
  assert.equal(next.primaryColor, '#2563eb')
  assert.equal(next.buyButtonColor, '#2563eb')
  assert.equal(next.accentColor, darkenHex('#2563eb', 0.12))
  assert.equal(hexesClose(next.accentColor || '', '#2563eb'), false)
})

test('preset look maps primary to buy and muted to cart', () => {
  const next = themeFromPresetPartial(DEFAULT_PARTNER_WEBSITE_THEME, {
    primaryColor: '#0f766e',
    accentColor: '#14b8a6',
    backgroundColor: '#f0fdfa',
    textColor: '#134e4a',
    mutedColor: '#5eead4',
  })
  assert.equal(next.primaryColor, '#0f766e')
  assert.equal(next.buyButtonColor, '#0f766e')
  assert.equal(next.cartButtonColor, '#5eead4')
  assert.equal(next.backgroundColor, '#f0fdfa')
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
