import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import {
  darkenHex,
  hexesClose,
  parseThemeColorPatch,
  resolveShopThemeColors,
  rewriteThemeCssVarsInHtml,
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
})
