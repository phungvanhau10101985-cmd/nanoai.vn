/**
 * Header / footer logo offset — per-slot, per-device X/Y from the default slot.
 * Stored on that slot's `<a>` in that device's HTML.
 * Chrome sync copies header → every header and footer → every footer on the same machine.
 * Header offset never writes onto footer, and the reverse.
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
  const css = String(styleMatch?.[2] || '')
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

function isHeaderMainOpenAttrs(attrs: string): boolean {
  return /\b(?:pw-header-main|pw-shop-header-inner)\b/.test(attrs)
}

function isHeaderClusterOpenAttrs(attrs: string): boolean {
  return /\b(?:pw-brand-cluster|pw-shop-brand-cluster)\b/.test(attrs)
}

function isHeaderLogoFrameOpenAttrs(attrs: string): boolean {
  return /\bpw-logo-frame\b/.test(attrs) || /\bdata-pw-logo-frame=/.test(attrs)
}

/** CSS vars only — descendants inherit. Do not stamp `data-pw-logo-*` on header-main. */
function withInheritedLogoOffsetVars(openAttrs: string, x: number, y: number): string {
  const { attrs, css, quote, hasStyle } = stripOffsetBits(openAttrs)
  if (!x && !y) {
    if (!hasStyle) return attrs
    return css
      ? attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${css}${quote}`)
      : attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, '')
  }
  const vars = [x ? `--pw-logo-x:${x}px` : '', y ? `--pw-logo-y:${y}px` : ''].filter(Boolean).join(';')
  const nextCss = css ? `${css};${vars}` : vars
  if (hasStyle) return attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${nextCss}${quote}`)
  return `${attrs} style=${quote}${nextCss}${quote}`
}

function readLogoOffsetFromHeaderBlock(block: string): { x: number; y: number } {
  let x = 0
  let y = 0
  block.replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
    if (!isHeaderBrandOpenAttrs(attrs)) return _full
    if (!x) x = readOffset(attrs, PW_LOGO_X_ATTR, '--pw-logo-x')
    if (!y) y = readOffset(attrs, PW_LOGO_Y_ATTR, '--pw-logo-y')
    return _full
  })
  if (x || y) return { x, y }
  block.replace(/<(div|span)\b([^>]*)>/gi, (_full, _tag: string, attrs: string) => {
    if (!isHeaderMainOpenAttrs(attrs) && !isHeaderClusterOpenAttrs(attrs) && !isHeaderLogoFrameOpenAttrs(attrs)) {
      return _full
    }
    if (!x) x = readOffset(attrs, PW_LOGO_X_ATTR, '--pw-logo-x')
    if (!y) y = readOffset(attrs, PW_LOGO_Y_ATTR, '--pw-logo-y')
    return _full
  })
  return { x, y }
}

/** Stamp `--pw-logo-*` on header brand + inherit onto header-main / cluster / frame. */
export function stampHeaderLogoOffsetInHtml(html: string): string {
  if (!html || !/<header\b/i.test(html)) return html
  return html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, (block) => {
    let next = block.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
      if (!isHeaderBrandOpenAttrs(attrs)) return full
      return `<a${withBrandLogoOffsetStyle(attrs)}>`
    })
    const { x, y } = readLogoOffsetFromHeaderBlock(next)
    return next.replace(/<(div|span)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
      if (!isHeaderMainOpenAttrs(attrs) && !isHeaderClusterOpenAttrs(attrs) && !isHeaderLogoFrameOpenAttrs(attrs)) {
        return full
      }
      return `<${tag}${withInheritedLogoOffsetVars(attrs, x, y)}>`
    })
  })
}

function isFooterLogoAnchorAttrs(attrs: string): boolean {
  return /\bdata-pw-el=["']logo["']/i.test(attrs) || /\bpw-shop-footer-logo\b/i.test(attrs)
}

/** Stamp `--pw-logo-*` on footer brand links only — never the header brand. */
export function stampFooterLogoOffsetInHtml(html: string): string {
  if (!html || !/<footer\b/i.test(html)) return html
  return html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, (block) => {
    let next = block.replace(
      /<a\b([^>]*)>(\s*<img\b[^>]*\bpw-shop-footer-logo\b)/gi,
      (_m, attrs: string, rest: string) => `<a${withBrandLogoOffsetStyle(attrs)}>${rest}`
    )
    next = next.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
      if (!isFooterLogoAnchorAttrs(attrs)) return full
      return `<a${withBrandLogoOffsetStyle(attrs)}>`
    })
    return next
  })
}

function readStylePx(css: string, prop: string): number {
  const m = css.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, 'i'))
  const n = Math.round(Number(m?.[1]))
  return Number.isFinite(n) && n > 8 ? n : 0
}

function withLogoFrameBoxStyle(openAttrs: string): string {
  const styleMatch = openAttrs.match(/\sstyle=(["'])([\s\S]*?)\1/i)
  const quote = styleMatch?.[1] || '"'
  const css = String(styleMatch?.[2] || '')
  const w = readStylePx(css, '--pw-logo-box-w') || readStylePx(css, 'width')
  const h = readStylePx(css, '--pw-logo-box-h') || readStylePx(css, 'height')
  if (!(w > 8 && h > 8)) return openAttrs
  const nextCss = css
    .replace(/(?:^|;)\s*--pw-logo-box-w\s*:[^;]*/gi, '')
    .replace(/(?:^|;)\s*--pw-logo-box-h\s*:[^;]*/gi, '')
    .replace(/^;+|;+$/g, '')
    .trim()
  const vars = `--pw-logo-box-w:${w}px;--pw-logo-box-h:${h}px`
  const merged = nextCss ? `${nextCss};${vars}` : vars
  if (styleMatch) return openAttrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${merged}${quote}`)
  return `${openAttrs} style=${quote}${merged}${quote}`
}

/** Copy authored header logo box onto `--pw-logo-box-*` so live CSS matches Sửa nhanh. */
export function stampHeaderLogoFrameBoxInHtml(html: string): string {
  if (!html || !/<header\b/i.test(html)) return html
  return html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, (block) =>
    block.replace(
      /<(span|div|a)\b([^>]*(?:pw-logo-frame|data-pw-logo-frame)[^>]*)>/gi,
      (_full, tag: string, attrs: string) => `<${tag}${withLogoFrameBoxStyle(attrs)}>`
    )
  )
}

export function stampChromeLogoOffsetInHtml(html: string): string {
  return stampHeaderLogoFrameBoxInHtml(stampFooterLogoOffsetInHtml(stampHeaderLogoOffsetInHtml(html)))
}
