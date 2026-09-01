/**
 * Header logo offset — per-device X/Y from the default slot.
 * Stored on `.pw-brand` in that device's HTML. Chrome sync copies same-device only.
 */

export const PW_LOGO_X_ATTR = 'data-pw-logo-x'
export const PW_LOGO_Y_ATTR = 'data-pw-logo-y'
export const PW_LOGO_X_MIN = -480
export const PW_LOGO_X_MAX = 480
export const PW_LOGO_Y_MIN = -120
export const PW_LOGO_Y_MAX = 160

export function clampHeaderLogoOffsetX(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.max(PW_LOGO_X_MIN, Math.min(PW_LOGO_X_MAX, n))
}

export function clampHeaderLogoOffsetY(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.max(PW_LOGO_Y_MIN, Math.min(PW_LOGO_Y_MAX, n))
}

function isHeaderBrandOpenAttrs(attrs: string): boolean {
  return /\b(?:pw-brand|pw-shop-brand)\b/.test(attrs) || /\bdata-pw-logo-home=/.test(attrs)
}

function readOffset(openAttrs: string, attr: string, cssVar: string): number {
  const fromAttr = openAttrs.match(new RegExp(`\\b${attr}=(["'])([^"']*)\\1`, 'i'))?.[2]
  const fromCss = openAttrs.match(new RegExp(`${cssVar}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px`, 'i'))?.[1]
  return attr === PW_LOGO_Y_ATTR ? clampHeaderLogoOffsetY(fromAttr ?? fromCss) : clampHeaderLogoOffsetX(fromAttr ?? fromCss)
}

function stripOffsetBits(openAttrs: string): { attrs: string; css: string; quote: string; hasStyle: boolean } {
  const styleMatch = openAttrs.match(/\sstyle=(["'])([\s\S]*?)\1/i)
  const quote = styleMatch?.[1] || '"'
  let css = String(styleMatch?.[2] || '')
    .replace(/(?:^|;)\s*--pw-logo-x\s*:[^;]*/gi, '')
    .replace(/(?:^|;)\s*--pw-logo-y\s*:[^;]*/gi, '')
    .replace(/^;+|;+$/g, '')
    .trim()
  const attrs = openAttrs
    .replace(new RegExp(`\\s${PW_LOGO_X_ATTR}=(["'])[^"']*\\1`, 'gi'), '')
    .replace(new RegExp(`\\s${PW_LOGO_Y_ATTR}=(["'])[^"']*\\1`, 'gi'), '')
  return { attrs, css, quote, hasStyle: Boolean(styleMatch) }
}

export function withBrandLogoOffsetStyle(openAttrs: string): string {
  const x = readOffset(openAttrs, PW_LOGO_X_ATTR, '--pw-logo-x')
  const y = readOffset(openAttrs, PW_LOGO_Y_ATTR, '--pw-logo-y')
  const { attrs, css, quote, hasStyle } = stripOffsetBits(openAttrs)
  if (!x && !y) {
    if (!hasStyle) return attrs
    return css
      ? attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${css}${quote}`)
      : attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, '')
  }
  let next = attrs
  if (x) next += ` ${PW_LOGO_X_ATTR}="${x}"`
  if (y) next += ` ${PW_LOGO_Y_ATTR}="${y}"`
  const vars = [x ? `--pw-logo-x:${x}px` : '', y ? `--pw-logo-y:${y}px` : ''].filter(Boolean).join(';')
  const nextCss = css ? `${css};${vars}` : vars
  if (hasStyle) return next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${nextCss}${quote}`)
  return `${next} style=${quote}${nextCss}${quote}`
}

/** Stamp `--pw-logo-*` on header brand links so live CSS reads the same file as Sửa nhanh. */
export function stampHeaderLogoOffsetInHtml(html: string): string {
  if (!html || !/<header\b/i.test(html)) return html
  return html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, (block) =>
    block.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
      if (!isHeaderBrandOpenAttrs(attrs)) return full
      return `<a${withBrandLogoOffsetStyle(attrs)}>`
    })
  )
}
