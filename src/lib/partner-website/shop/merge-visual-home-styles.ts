const SKIP_HOME_STYLE_ID =
  /^(nanoai-visual-editor-styles|nanoai-visual-editor-script|pw-visual-device-split)$/i
const SKIP_INLINE_STYLE_ID =
  /^(nanoai-visual-editor-styles|nanoai-visual-editor-script|pw-visual-device-split)$/i

const HOME_STYLE_ATTR = 'data-pw-home-chrome-css'

function styleIdFromAttrs(attrs: string): string {
  return attrs.match(/\bid=["']([^"']+)["']/i)?.[1]?.trim() || ''
}

/** Saved homepage CSS used `display:block` on `.pw-visual-*` and killed sticky head. */
function rewriteVisualWrapperStickyCss(css: string): string {
  return css.replace(
    /(\.pw-visual-(?:desktop|laptop|tablet|mobile))\s*\{\s*display\s*:\s*block\s*!important\s*\}/gi,
    '$1{display:contents!important}'
  )
}

function stampTag(open: string): string {
  if (new RegExp(`\\b${HOME_STYLE_ATTR}=`, 'i').test(open)) return open
  return open.replace(/<(style|link)\b/i, `<$1 ${HOME_STYLE_ATTR}="1"`)
}

function isStyleOrFontLink(tag: string): boolean {
  const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase() || ''
  const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1] || ''
  const isStyle = /\bstylesheet\b/i.test(rel)
  const isFont =
    /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(href) ||
    /\bpreconnect\b/i.test(rel) ||
    (/\bpreload\b/i.test(rel) && /as=["'](?:style|font)["']/i.test(tag))
  return isStyle || isFont
}

function headInner(html: string): string {
  return html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
}

function headAlreadyHasHomeStyles(html: string): boolean {
  const head = headInner(html)
  if (head) return new RegExp(`\\b${HOME_STYLE_ATTR}=["']1["']`, 'i').test(head)
  return false
}

/** Pull authored CSS/font links from a visual homepage so other pages can reuse them. */
export function extractVisualDocumentStyles(html: string): string {
  if (!html.trim()) return ''
  const parts: string[] = []
  const seen = new Set<string>()
  const push = (chunk: string) => {
    const key = chunk.replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    parts.push(chunk)
  }

  html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs: string) => {
    const id = styleIdFromAttrs(attrs)
    if (id && SKIP_HOME_STYLE_ID.test(id)) return full
    const open = stampTag(`<style${attrs}>`)
    const inner = rewriteVisualWrapperStickyCss(full.slice(full.indexOf('>') + 1))
    push(`${open}${inner}`)
    return full
  })

  html.replace(/<link\b[^>]*>/gi, (full) => {
    if (!isStyleOrFontLink(full)) return full
    push(stampTag(full.endsWith('/>') || full.endsWith('>') ? full : `${full}>`))
    return full
  })

  return parts.join('\n')
}

/** Inner CSS only — safe to put in a React `<style>` tag (not a hidden innerHTML host). */
export function extractVisualDocumentCssText(html: string): string {
  if (!html.trim()) return ''
  if (!/<style\b/i.test(html) && !/<link\b/i.test(html)) return rewriteVisualWrapperStickyCss(html)
  const parts: string[] = []
  html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs: string, css: string) => {
    const id = styleIdFromAttrs(attrs)
    if (id && SKIP_INLINE_STYLE_ID.test(id)) return full
    if (css.trim()) parts.push(rewriteVisualWrapperStickyCss(css))
    return full
  })
  return parts.join('\n')
}

export type VisualHomeStyleLink = {
  rel: string
  href: string
  as?: string
  crossOrigin?: 'anonymous' | 'use-credentials'
}

export function extractVisualDocumentStyleLinks(html: string): VisualHomeStyleLink[] {
  if (!html.trim()) return []
  const out: VisualHomeStyleLink[] = []
  const seen = new Set<string>()
  html.replace(/<link\b[^>]*>/gi, (full) => {
    if (!isStyleOrFontLink(full)) return full
    const rel = full.match(/\brel=["']([^"']+)["']/i)?.[1] || 'stylesheet'
    const href = full.match(/\bhref=["']([^"']+)["']/i)?.[1] || ''
    if (!href || seen.has(`${rel}\n${href}`)) return full
    seen.add(`${rel}\n${href}`)
    const as = full.match(/\bas=["']([^"']+)["']/i)?.[1]
    const rawCross = full.match(/\bcrossorigin(?:=["']([^"']*)["'])?/i)?.[1]
    const crossOrigin =
      rawCross === 'use-credentials' ? 'use-credentials' : rawCross != null ? 'anonymous' : undefined
    out.push({ rel, href, ...(as ? { as } : {}), ...(crossOrigin ? { crossOrigin } : {}) })
    return full
  })
  return out
}

export function preferredVisualHomeStyleSource(...candidates: string[]): string {
  let best = ''
  let bestLen = 0
  for (const html of candidates) {
    const styles = extractVisualDocumentStyles(html || '')
    if (styles.length > bestLen) {
      best = html
      bestLen = styles.length
    }
  }
  return best
}

export function mergeVisualHomeStylesIntoHtml(targetHtml: string, homeHtml: string): string {
  const styles = extractVisualDocumentStyles(homeHtml)
  if (!styles.trim()) return targetHtml
  if (headAlreadyHasHomeStyles(targetHtml)) return targetHtml
  if (/<\/head>/i.test(targetHtml)) {
    return targetHtml.replace(/<\/head>/i, `${styles}\n</head>`)
  }
  if (/<html\b[^>]*>/i.test(targetHtml)) {
    return targetHtml.replace(/<html\b[^>]*>/i, (m) => `${m}\n<head>${styles}</head>`)
  }
  return `${styles}\n${targetHtml}`
}
