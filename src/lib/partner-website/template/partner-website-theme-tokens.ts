import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'

const HEX6 = /^#([0-9a-fA-F]{6})$/
const HEX3 = /^#([0-9a-fA-F]{3})$/

export type ShopThemeColorRole =
  | 'primaryColor'
  | 'accentColor'
  | 'buyButtonColor'
  | 'cartButtonColor'
  | 'backgroundColor'
  | 'textColor'
  | 'mutedColor'
  | 'surfaceColor'

export type ResolvedShopThemeColors = {
  primaryColor: string
  accentColor: string
  buyButtonColor: string
  cartButtonColor: string
  backgroundColor: string
  textColor: string
  mutedColor: string
  surfaceColor: string
  borderColor: string
}

export type ShopColorSwatch = {
  id: string
  hex: string
}

/** Brand / CTA hues — bảng màu chính. */
export const SHOP_MAIN_COLOR_SWATCHES: ShopColorSwatch[] = [
  { id: 'orange', hex: '#f97316' },
  { id: 'blue', hex: '#2563eb' },
  { id: 'teal', hex: '#0f766e' },
  { id: 'warm', hex: '#c2410c' },
  { id: 'ink', hex: '#111827' },
  { id: 'stone', hex: '#78716c' },
  { id: 'rose', hex: '#9d174d' },
  { id: 'navy', hex: '#1e3a5f' },
  { id: 'green', hex: '#065f46' },
  { id: 'red', hex: '#dc2626' },
  { id: 'violet', hex: '#7c3aed' },
  { id: 'gold', hex: '#d4a017' },
]

/** Background / supporting hues — bảng màu phụ trợ. */
export const SHOP_AUX_BG_SWATCHES: ShopColorSwatch[] = [
  { id: 'white', hex: '#ffffff' },
  { id: 'cream', hex: '#fff7ed' },
  { id: 'beige', hex: '#fafaf9' },
  { id: 'mint', hex: '#f0fdfa' },
  { id: 'fog', hex: '#f3f4f6' },
  { id: 'sky', hex: '#eff6ff' },
]

export const SHOP_AUX_CART_SWATCHES: ShopColorSwatch[] = [
  { id: 'gray', hex: '#6b7280' },
  { id: 'stone', hex: '#78716c' },
  { id: 'slate', hex: '#475569' },
  { id: 'charcoal', hex: '#374151' },
  { id: 'navy', hex: '#1e3a5f' },
  { id: 'brown', hex: '#9a3412' },
]

export function normalizeHexColor(raw: string | null | undefined, fallback: string): string {
  const v = String(raw ?? '').trim()
  if (HEX6.test(v)) return `#${v.slice(1).toLowerCase()}`
  if (HEX3.test(v)) {
    const h = v.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  return fallback
}

export function isHexColor(raw: string | null | undefined): boolean {
  const v = String(raw ?? '').trim()
  return HEX6.test(v) || HEX3.test(v)
}

function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHexColor(hex, '')
  if (!HEX6.test(n)) return null
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function darkenHex(hex: string, amount = 0.14): string {
  const rgb = parseRgb(hex)
  if (!rgb) return hex
  const k = 1 - amount
  return toHex(rgb.r * k, rgb.g * k, rgb.b * k)
}

export function mixHex(hex: string, withHex: string, amount: number): string {
  const a = parseRgb(hex)
  const b = parseRgb(withHex)
  if (!a || !b) return hex
  const t = Math.max(0, Math.min(1, amount))
  return toHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
}

export function hexesClose(a: string, b: string): boolean {
  return normalizeHexColor(a, '') === normalizeHexColor(b, '')
}

export function resolveShopThemeColors(theme: PartnerWebsiteTheme): ResolvedShopThemeColors {
  const primaryColor = normalizeHexColor(theme.primaryColor, DEFAULT_PARTNER_WEBSITE_THEME.primaryColor)
  const accentColor = normalizeHexColor(theme.accentColor, darkenHex(primaryColor))
  const backgroundColor = normalizeHexColor(
    theme.backgroundColor,
    DEFAULT_PARTNER_WEBSITE_THEME.backgroundColor
  )
  const textColor = normalizeHexColor(theme.textColor, DEFAULT_PARTNER_WEBSITE_THEME.textColor)
  const mutedColor = normalizeHexColor(theme.mutedColor, DEFAULT_PARTNER_WEBSITE_THEME.mutedColor)
  return {
    primaryColor,
    accentColor,
    buyButtonColor: normalizeHexColor(theme.buyButtonColor, primaryColor),
    cartButtonColor: normalizeHexColor(theme.cartButtonColor, mutedColor || '#6b7280'),
    backgroundColor,
    textColor,
    mutedColor,
    surfaceColor: normalizeHexColor(theme.surfaceColor, mixHex('#ffffff', primaryColor, 0.08)),
    borderColor: normalizeHexColor(theme.borderColor, '#e5e7eb'),
  }
}

export function mergeShopThemeColors(
  base: PartnerWebsiteTheme,
  patch: Partial<ResolvedShopThemeColors>
): PartnerWebsiteTheme {
  const next: PartnerWebsiteTheme = { ...base }
  for (const [key, value] of Object.entries(patch) as Array<[ShopThemeColorRole | 'borderColor', string]>) {
    if (typeof value === 'string' && isHexColor(value)) {
      next[key] = normalizeHexColor(value, value)
    }
  }
  return next
}

export function themeFromMainSwatch(
  base: PartnerWebsiteTheme,
  hex: string
): PartnerWebsiteTheme {
  const primaryColor = normalizeHexColor(hex, base.primaryColor)
  return mergeShopThemeColors(base, {
    primaryColor,
    accentColor: darkenHex(primaryColor, 0.12),
    buyButtonColor: primaryColor,
    surfaceColor: mixHex('#ffffff', primaryColor, 0.08),
  })
}

export function themeFromAuxBackgroundSwatch(
  base: PartnerWebsiteTheme,
  hex: string
): PartnerWebsiteTheme {
  const backgroundColor = normalizeHexColor(hex, base.backgroundColor)
  const primary = normalizeHexColor(base.primaryColor, DEFAULT_PARTNER_WEBSITE_THEME.primaryColor)
  return mergeShopThemeColors(base, {
    backgroundColor,
    surfaceColor: mixHex(backgroundColor, primary, 0.1),
  })
}

export function themeFromAuxCartSwatch(
  base: PartnerWebsiteTheme,
  hex: string
): PartnerWebsiteTheme {
  const cartButtonColor = normalizeHexColor(hex, base.cartButtonColor || '#6b7280')
  return mergeShopThemeColors(base, {
    cartButtonColor,
    mutedColor: cartButtonColor,
  })
}

export function themeFromPresetPartial(
  base: PartnerWebsiteTheme,
  presetTheme: Partial<PartnerWebsiteTheme>
): PartnerWebsiteTheme {
  const primaryColor = normalizeHexColor(
    presetTheme.primaryColor,
    base.primaryColor || DEFAULT_PARTNER_WEBSITE_THEME.primaryColor
  )
  const accentColor = normalizeHexColor(presetTheme.accentColor, darkenHex(primaryColor, 0.12))
  const backgroundColor = normalizeHexColor(
    presetTheme.backgroundColor,
    base.backgroundColor || DEFAULT_PARTNER_WEBSITE_THEME.backgroundColor
  )
  const mutedColor = normalizeHexColor(
    presetTheme.mutedColor,
    base.mutedColor || DEFAULT_PARTNER_WEBSITE_THEME.mutedColor
  )
  return mergeShopThemeColors(base, {
    primaryColor,
    accentColor,
    buyButtonColor: primaryColor,
    cartButtonColor: mutedColor,
    backgroundColor,
    textColor: normalizeHexColor(presetTheme.textColor, base.textColor),
    mutedColor,
    surfaceColor: mixHex(backgroundColor, primaryColor, 0.1),
  })
}

export function themeCssVarMap(theme: PartnerWebsiteTheme): Record<string, string> {
  const c = resolveShopThemeColors(theme)
  return {
    '--pw-primary': c.primaryColor,
    '--pw-accent': c.accentColor,
    '--pw-buy': c.buyButtonColor,
    '--pw-cart': c.cartButtonColor,
    '--pw-bg': c.backgroundColor,
    '--pw-text': c.textColor,
    '--pw-muted': c.mutedColor,
    '--pw-surface': c.surfaceColor,
    '--pw-border': c.borderColor,
    '--pw-footer': '#ffffff',
  }
}

export function buildThemeCssVarBlock(theme: PartnerWebsiteTheme): string {
  const vars = themeCssVarMap(theme)
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

const LIVE_STYLE_ID = 'pw-theme-root'

export function applyThemeCssVarsToDocument(doc: Document, theme: PartnerWebsiteTheme): void {
  const vars = themeCssVarMap(theme)
  const root = doc.documentElement
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
  let style = doc.getElementById(LIVE_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = LIVE_STYLE_ID
    doc.head?.appendChild(style)
  }
  style.textContent = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v} !important`)
    .join(';')}}`
}

export function rewriteThemeCssVarsInHtml(html: string, theme: PartnerWebsiteTheme): string {
  if (!html.trim()) return html
  const block = buildThemeCssVarBlock(theme)
  const liveTag = `<style id="${LIVE_STYLE_ID}">:root{${block}}</style>`
  const withId = html.replace(
    /<style id="pw-theme-root">[\s\S]*?<\/style>/i,
    liveTag
  )
  if (withId !== html) return withId

  const replacedRoot = html.replace(
    /:root\s*\{[^}]*--pw-primary:[^}]*\}/i,
    `:root{${block}}`
  )
  if (replacedRoot !== html) return replacedRoot

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${liveTag}</head>`)
  }
  return `${liveTag}${html}`
}

export function parseThemeColorPatch(raw: unknown): Partial<ResolvedShopThemeColors> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const keys: Array<keyof ResolvedShopThemeColors> = [
    'primaryColor',
    'accentColor',
    'buyButtonColor',
    'cartButtonColor',
    'backgroundColor',
    'textColor',
    'mutedColor',
    'surfaceColor',
    'borderColor',
  ]
  const patch: Partial<ResolvedShopThemeColors> = {}
  for (const key of keys) {
    if (typeof o[key] === 'string' && isHexColor(o[key])) {
      patch[key] = normalizeHexColor(o[key], o[key])
    }
  }
  return Object.keys(patch).length ? patch : null
}
