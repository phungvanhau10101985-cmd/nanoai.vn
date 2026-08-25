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
  | 'footerColor'

export type ResolvedShopThemeColors = {
  primaryColor: string
  accentColor: string
  buyButtonColor: string
  cartButtonColor: string
  backgroundColor: string
  textColor: string
  mutedColor: string
  surfaceColor: string
  footerColor: string
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

export type ShopThemeQuickPick = {
  id: string
  hex: string
  label: string
}

export type ShopThemeQuickPicks = {
  mainTitle: string
  auxTitle: string
  hint?: string
  main: ShopThemeQuickPick[]
  aux: ShopThemeQuickPick[]
}

export type ShopThemeQuickPickLabels = {
  mainTitle: string
  auxTitle: string
  hint?: string
  primary: string
  accent: string
  buy: string
  cart: string
  background: string
  text: string
  muted: string
  surface: string
  footer: string
}

function uniqueQuickPicks(items: ShopThemeQuickPick[]): ShopThemeQuickPick[] {
  const seen = new Set<string>()
  const out: ShopThemeQuickPick[] = []
  for (const item of items) {
    const hex = normalizeHexColor(item.hex, '')
    if (!hex || seen.has(hex)) continue
    seen.add(hex)
    out.push({ ...item, hex })
  }
  return out
}

/** Live shop tokens first, then the site main/supporting palettes — click to apply. */
export function shopThemeQuickPicks(
  theme: PartnerWebsiteTheme | null | undefined,
  labels: ShopThemeQuickPickLabels
): ShopThemeQuickPicks {
  const live = theme ? resolveShopThemeColors(theme) : null
  const liveMain = live
    ? [
        { id: 'primary', hex: live.primaryColor, label: labels.primary },
        { id: 'accent', hex: live.accentColor, label: labels.accent },
        { id: 'buy', hex: live.buyButtonColor, label: labels.buy },
        { id: 'cart', hex: live.cartButtonColor, label: labels.cart },
      ]
    : []
  const liveAux = live
    ? [
        { id: 'bg', hex: live.backgroundColor, label: labels.background },
        { id: 'text', hex: live.textColor, label: labels.text },
        { id: 'muted', hex: live.mutedColor, label: labels.muted },
        { id: 'surface', hex: live.surfaceColor, label: labels.surface },
        { id: 'footer', hex: live.footerColor, label: labels.footer },
      ]
    : []
  const mainPresets = SHOP_MAIN_COLOR_SWATCHES.map((s) => ({
    id: `main-${s.id}`,
    hex: s.hex,
    label: s.hex,
  }))
  const auxPresets = [...SHOP_AUX_BG_SWATCHES, ...SHOP_AUX_CART_SWATCHES].map((s) => ({
    id: `aux-${s.id}`,
    hex: s.hex,
    label: s.hex,
  }))
  return {
    mainTitle: labels.mainTitle,
    auxTitle: labels.auxTitle,
    hint: labels.hint,
    main: uniqueQuickPicks([...liveMain, ...mainPresets]),
    aux: uniqueQuickPicks([...liveAux, ...auxPresets]),
  }
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
    footerColor: normalizeHexColor(theme.footerColor, DEFAULT_PARTNER_WEBSITE_THEME.footerColor || '#ffffff'),
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
    '--pw-footer': c.footerColor,
  }
}

export function buildThemeCssVarBlock(theme: PartnerWebsiteTheme): string {
  const vars = themeCssVarMap(theme)
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

function buildThemeCssVarImportantBlock(theme: PartnerWebsiteTheme): string {
  const vars = themeCssVarMap(theme)
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v} !important`)
    .join(';')
}

export const PW_THEME_ROOT_STYLE_ID = 'pw-theme-root'

const EDITOR_STYLE_IDS = new Set(['nanoai-visual-editor-styles', 'pw-shop-chrome-layout', PW_THEME_ROOT_STYLE_ID])

/**
 * Theme contract (W2.3):
 * - Live pick only writes CSS variables on `#pw-theme-root`.
 * - Visual editor paint (`style=""` / added bg / logo) is never rewritten.
 * - Saved HTML chrome rules that still use brand hex are rebound to `var(--pw-*)`.
 */
function rewriteStyleTagCss(html: string, rewriteCss: (css: string) => string): string {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs: string, css: string) => {
    const id = /id=["']([^"']+)["']/i.exec(attrs)?.[1] || ''
    if (EDITOR_STYLE_IDS.has(id)) return full
    return `<style${attrs}>${rewriteCss(css)}</style>`
  })
}

const PW_NAV_INK = '#374151'
const NAV_HOST = String.raw`(?:\.pw-nav-main|\.pw-shop-nav-row|\.pw-cat-panel|\.pw-shop-cat-panel)`

function chromeSelectorKind(
  selector: string
): 'topbar' | 'search-submit' | 'search-form' | 'price' | 'buy' | 'cart' | 'nav-ink' | null {
  const parts = selector
    .split(',')
    .map((part) => part.replace(/::?[a-z-]+/gi, '').trim().toLowerCase())
    .filter(Boolean)
  if (!parts.length) return null
  const isNavInk = (part: string) =>
    /\.pw-nav-sale\b/.test(part) ||
    new RegExp(`${NAV_HOST}(?:\\s|>).*(?:\\ba\\b|\\bbutton\\b)|${NAV_HOST}$`).test(part)
  if (parts.every(isNavInk)) return 'nav-ink'
  const every = (re: RegExp) =>
    parts.every((part) => re.test(part) && !/\s+(a|button|span|svg|img)\b/.test(part.replace(re, ' ')))
  if (every(/\.pw-(?:shop-)?topbar$/)) return 'topbar'
  if (every(/\.pw-(?:shop-)?search-submit$/)) return 'search-submit'
  if (every(/\.pw-(?:shop-)?search-form$/)) return 'search-form'
  if (every(/\.pw-(?:shop-|fh-)?price$/)) return 'price'
  if (every(/\.pw-(?:shop-)?(?:cart-badge)$/)) return 'topbar'
  if (every(/\.pw-(?:shop-)?(?:wordmark|brand)$/)) return 'price'
  if (every(/\.pw-(?:shop-)?btn-cart$/)) return 'cart'
  if (every(/\.pw-(?:shop-)?btn-buy$|\.pw-shop-btn$|\.pw-btn$/)) return 'buy'
  return null
}

/** Convert leftover chrome hex in class rules to tokens. Leaves inline `style=""` alone. */
export function bindChromeThemeVarsInCss(css: string): string {
  return css.replace(/([^{}@]+)\{([^{}]+)\}/g, (full, rawSel: string, body: string) => {
    const kind = chromeSelectorKind(rawSel)
    if (!kind) return full
    let next = body
    if (kind === 'topbar' || kind === 'search-submit') {
      next = next.replace(/background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,8}/gi, 'background:var(--pw-primary)')
    } else if (kind === 'search-form') {
      next = next.replace(
        /(border(?:-color)?)\s*:\s*([^;]*?)#[0-9a-fA-F]{3,8}/gi,
        '$1:$2var(--pw-primary)'
      )
    } else if (kind === 'price') {
      next = next.replace(/color\s*:\s*#[0-9a-fA-F]{3,8}/gi, 'color:var(--pw-primary)')
    } else if (kind === 'cart') {
      next = next.replace(/background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,8}/gi, 'background:var(--pw-cart)')
    } else if (kind === 'buy') {
      next = next.replace(/background(?:-color)?\s*:\s*#[0-9a-fA-F]{3,8}/gi, 'background:var(--pw-buy)')
    } else if (kind === 'nav-ink') {
      next = next.replace(
        /color\s*:\s*(?:var\(--pw-[a-z-]+\)|#[0-9a-fA-F]{3,8})/gi,
        `color:${PW_NAV_INK}`
      )
    }
    return `${rawSel}{${next}}`
  })
}

export function applyThemeCssVarsToDocument(doc: Document, theme: PartnerWebsiteTheme): void {
  let style = doc.getElementById(PW_THEME_ROOT_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = PW_THEME_ROOT_STYLE_ID
  }
  style.textContent = `:root{${buildThemeCssVarImportantBlock(theme)}}`
  const host = doc.head || doc.documentElement
  if (style.parentNode !== host) host.appendChild(style)
}

/** Apply theme tokens to a preview frame and same-origin nested shop/landing iframes. */
export function applyThemeCssVarsToFrameWindow(
  win: Window | null | undefined,
  theme: PartnerWebsiteTheme
): void {
  if (!win) return
  try {
    const doc = win.document
    if (doc?.documentElement) applyThemeCssVarsToDocument(doc, theme)
    doc?.querySelectorAll('iframe').forEach((frame) => {
      const inner = frame as HTMLIFrameElement
      try {
        applyThemeCssVarsToFrameWindow(inner.contentWindow, theme)
      } catch {
        /* nested cross-origin */
      }
      inner.addEventListener(
        'load',
        () => {
          try {
            applyThemeCssVarsToFrameWindow(inner.contentWindow, theme)
          } catch {
            /* nested cross-origin */
          }
        },
        { once: true }
      )
    })
  } catch {
    /* cross-origin preview */
  }
}

function upsertPwVarsInRootBlock(block: string, vars: Record<string, string>): string {
  let next = block
  for (const [name, value] of Object.entries(vars)) {
    const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*[^;}]+`, 'gi')
    if (re.test(next)) {
      re.lastIndex = 0
      next = next.replace(re, `${name}:${value}`)
    } else {
      next = next.replace(/}\s*$/, `;${name}:${value}}`)
    }
  }
  return next
}

export function rewriteThemeCssVarsInHtml(html: string, theme: PartnerWebsiteTheme): string {
  if (!html.trim()) return html
  const vars = themeCssVarMap(theme)
  const liveTag = `<style id="${PW_THEME_ROOT_STYLE_ID}">:root{${buildThemeCssVarImportantBlock(theme)}}</style>`
  let out = html
  out = rewriteStyleTagCss(out, (css) => bindChromeThemeVarsInCss(css))
  out = out.replace(new RegExp(`<style id="${PW_THEME_ROOT_STYLE_ID}">[\\s\\S]*?<\\/style>`, 'gi'), '')
  out = out.replace(/:root\s*\{[^}]*--pw-primary:[^}]*\}/gi, (block) => upsertPwVarsInRootBlock(block, vars))
  out = out.replace(/\bhtml\s*\{[^}]*--pw-primary:[^}]*\}/gi, (block) => upsertPwVarsInRootBlock(block, vars))
  if (/<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, `${liveTag}</head>`)
  }
  return `${liveTag}${out}`
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
    'footerColor',
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
