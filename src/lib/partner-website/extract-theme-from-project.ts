import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'

const HEX_RE = /#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/i
const RGB_RE = /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*[\d.]+\s*)?\)/i

function normalizeColor(raw: string | undefined | null): string | null {
  const v = String(raw ?? '').trim()
  if (!v) return null
  if (HEX_RE.test(v)) {
    const m = v.match(HEX_RE)
    return m?.[0]?.toLowerCase() ?? null
  }
  if (RGB_RE.test(v)) {
    const m = v.match(RGB_RE)
    return m?.[0] ?? null
  }
  return null
}

function pickCssVar(css: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`(?:--[\\w-]*${name}[\\w-]*)\\s*:\\s*([^;!}{]+)`, 'i')
    const m = css.match(re)
    const color = normalizeColor(m?.[1])
    if (color) return color
  }
  return null
}

function pickFirstColorAfter(css: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = css.match(re)
    if (!m?.[0]) continue
    const color = normalizeColor(m[1] ?? m[0])
    if (color) return color
    const nested = m[0].match(HEX_RE) || m[0].match(RGB_RE)
    if (nested?.[0]) return nested[0].toLowerCase()
  }
  return null
}

/**
 * Derive shop theme tokens from home `css/main.css` / `index.html` so React shop
 * pages (products/cart/…) match the AI-built homepage look.
 */
export function extractPartnerWebsiteThemeFromProject(
  project: PartnerWebsiteProject | null | undefined,
  fallback: PartnerWebsiteTheme = DEFAULT_PARTNER_WEBSITE_THEME
): PartnerWebsiteTheme {
  const css =
    project?.files.find((f) => f.path === 'css/main.css')?.content ||
    project?.files.find((f) => f.path === 'index.html')?.content ||
    ''
  if (!css.trim()) return { ...fallback }

  const primary =
    pickCssVar(css, ['primary', 'brand', 'main', 'pw-primary']) ||
    pickFirstColorAfter(css, [
      /(?:header|nav|brand)[^{]{0,80}\{[^}]{0,200}(?:background|color)\s*:\s*([^;]+)/i,
    ]) ||
    fallback.primaryColor

  const accent =
    pickCssVar(css, ['accent', 'cta', 'secondary', 'pw-accent']) ||
    pickFirstColorAfter(css, [
      /(?:button|\.btn|cta)[^{]{0,60}\{[^}]{0,160}background(?:-color)?\s*:\s*([^;]+)/i,
    ]) ||
    fallback.accentColor

  const background =
    pickCssVar(css, ['bg', 'background', 'surface', 'pw-bg']) ||
    pickFirstColorAfter(css, [/body\s*\{[^}]{0,200}background(?:-color)?\s*:\s*([^;]+)/i]) ||
    fallback.backgroundColor

  const text =
    pickCssVar(css, ['text', 'ink', 'foreground', 'pw-text']) ||
    pickFirstColorAfter(css, [/body\s*\{[^}]{0,200}(?:^|[^-])color\s*:\s*([^;]+)/im]) ||
    fallback.textColor

  const muted =
    pickCssVar(css, ['muted', 'subtle', 'secondary-text', 'pw-muted']) || fallback.mutedColor

  const fontMatch = css.match(/font-family\s*:\s*([^;!}{]+)/i)
  const fontFamily = fontMatch?.[1]?.trim().replace(/['"]/g, '') || fallback.fontFamily

  return {
    ...fallback,
    primaryColor: primary,
    accentColor: accent,
    backgroundColor: background,
    textColor: text,
    mutedColor: muted,
    fontFamily,
  }
}
