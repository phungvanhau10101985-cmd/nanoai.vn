/**
 * Shared shop chrome: header, footer, and mobile/tablet bottom nav.
 * Page HTML files keep their own middle content; chrome is copied across
 * every page and every device so Sửa nhanh / live stay consistent.
 */

export type SharedChromeDevice = 'desktop' | 'tablet' | 'mobile'

export type SharedChrome = {
  topbar: string
  header: string
  footer: string
  bottomNav: string
}

const HEADER_RE =
  /<(header|div)\b(?=[^>]*?(?:data-pw-region=["']header["']|class=["'][^"']*\b(?:pw-header|pw-shop-header)(?![\w-])))[^>]*>/i
const FOOTER_RE =
  /<(footer|div)\b(?=[^>]*?(?:data-pw-region=["']footer["']|class=["'][^"']*\b(?:pw-footer|pw-shop-footer)(?![\w-])))[^>]*>/i
const BOTTOM_RE =
  /<(nav|div)\b(?=[^>]*?class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)(?![\w-]))[^>]*>/i
const TOPBAR_RE =
  /<(div)\b(?=[^>]*?(?:data-pw-region=["']topbar["']|class=["'][^"']*\b(?:pw-topbar|pw-shop-topbar)(?![\w-])))[^>]*>/i

function maskHtmlForTagScan(html: string): string {
  return html.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (block) => ' '.repeat(block.length)
  )
}

function closingTagIndex(masked: string, from: number, tag: string): number {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi')
  re.lastIndex = from
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) return match.index
      continue
    }
    if (!/\/>$/.test(match[0])) depth += 1
  }
  return -1
}

type ExtractedBlock = { start: number; end: number; html: string }

function extractFirst(html: string, openRe: RegExp): ExtractedBlock | null {
  const masked = maskHtmlForTagScan(html)
  openRe.lastIndex = 0
  const open = openRe.exec(masked)
  if (!open) return null
  const tag = (open[1] || 'div').toLowerCase()
  const start = open.index
  const close = closingTagIndex(masked, start + open[0].length, tag)
  if (close < 0) return null
  const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
  const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
  return { start, end, html: html.slice(start, end) }
}

function blockInside(inner: ExtractedBlock, outer: ExtractedBlock): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

export function hasSharedChrome(chrome: SharedChrome): boolean {
  return Boolean(chrome.header || chrome.footer || chrome.bottomNav || chrome.topbar)
}

export function extractSharedChrome(html: string): SharedChrome {
  const header = extractFirst(html, HEADER_RE)
  const footer = extractFirst(html, FOOTER_RE)
  const bottomNav = extractFirst(html, BOTTOM_RE)
  const topbar = extractFirst(html, TOPBAR_RE)
  const topbarStandalone = topbar && header && blockInside(topbar, header) ? '' : topbar?.html || ''
  return {
    topbar: topbarStandalone,
    header: header?.html || '',
    footer: footer?.html || '',
    bottomNav: bottomNav?.html || '',
  }
}

function stripLogoFloatCoords(html: string): string {
  if (!html || !/data-pw-logo-float/i.test(html)) return html
  return html.replace(/<[^>]*\bdata-pw-logo-float="1"[^>]*>/gi, (full) =>
    full.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_m, q: string, css: string) => {
      const cleaned = css
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !/^(left|top|right|bottom|transform|position)\s*:/i.test(part))
        .join('; ')
      return cleaned ? ` style=${q}${cleaned}${q}` : ''
    })
  )
}

function restampChromeDevice(html: string, variant: SharedChromeDevice): string {
  if (!html) return html
  return html.replace(/<(a|button)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const isAdded = /\bdata-pw-chrome-added="1"/i.test(attrs)
    const isCount = /\bdata-pw-chrome-count=/i.test(attrs)
    if (!isAdded && !isCount) return full
    let next = attrs
    if (/\bdata-pw-device=/.test(next)) {
      next = next.replace(/\sdata-pw-device=(["'])[^"']*\1/gi, ` data-pw-device="${variant}"`)
    } else if (isAdded || isCount) {
      next += ` data-pw-device="${variant}"`
    }
    return `<${tag}${next}>`
  })
}

function insertAfterBodyOpen(html: string, snippet: string): string {
  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(/<body\b[^>]*>/i, (m) => `${m}\n${snippet}`)
  }
  return `${snippet}\n${html}`
}

function insertBeforeBodyClose(html: string, snippet: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${snippet}\n</body>`)
  }
  return `${html}\n${snippet}`
}

function insertBeforeBottomNavOrBodyClose(html: string, snippet: string): string {
  const nav = extractFirst(html, BOTTOM_RE)
  if (nav) return html.slice(0, nav.start) + snippet + '\n' + html.slice(nav.start)
  return insertBeforeBodyClose(html, snippet)
}

function replaceRange(html: string, block: ExtractedBlock, next: string): string {
  return html.slice(0, block.start) + next + html.slice(block.end)
}

export function applySharedChrome(
  html: string,
  chrome: SharedChrome,
  opts?: { targetVariant?: SharedChromeDevice; stripLogoFloat?: boolean }
): string {
  if (!html.trim() || !hasSharedChrome(chrome)) return html
  let header = chrome.header
  let topbar = chrome.topbar
  let footer = chrome.footer
  let bottomNav = chrome.bottomNav
  if (opts?.stripLogoFloat) {
    header = stripLogoFloatCoords(header)
    topbar = stripLogoFloatCoords(topbar)
    footer = stripLogoFloatCoords(footer)
    bottomNav = stripLogoFloatCoords(bottomNav)
  }
  if (opts?.targetVariant) {
    header = restampChromeDevice(header, opts.targetVariant)
    topbar = restampChromeDevice(topbar, opts.targetVariant)
    footer = restampChromeDevice(footer, opts.targetVariant)
    bottomNav = restampChromeDevice(bottomNav, opts.targetVariant)
  }

  let out = html
  const sourceHeaderHasTopbar = /(?:pw-topbar|pw-shop-topbar|data-pw-region=["']topbar["'])/i.test(header)

  if (header) {
    const targetHeader = extractFirst(out, HEADER_RE)
    out = targetHeader ? replaceRange(out, targetHeader, header) : insertAfterBodyOpen(out, header)
  }

  if (topbar && !sourceHeaderHasTopbar) {
    const host = extractFirst(out, HEADER_RE)
    const existing = extractFirst(out, TOPBAR_RE)
    const inside = Boolean(existing && host && blockInside(existing, host))
    if (existing && !inside) {
      out = replaceRange(out, existing, topbar)
    } else if (!existing) {
      const after = extractFirst(out, HEADER_RE)
      out = after
        ? out.slice(0, after.start) + topbar + '\n' + out.slice(after.start)
        : insertAfterBodyOpen(out, topbar)
    }
  } else if (sourceHeaderHasTopbar) {
    const host = extractFirst(out, HEADER_RE)
    const existing = extractFirst(out, TOPBAR_RE)
    if (existing && host && !blockInside(existing, host)) {
      out = out.slice(0, existing.start) + out.slice(existing.end)
    }
  }

  if (footer) {
    const targetFooter = extractFirst(out, FOOTER_RE)
    out = targetFooter
      ? replaceRange(out, targetFooter, footer)
      : insertBeforeBottomNavOrBodyClose(out, footer)
  }

  if (bottomNav) {
    const targetNav = extractFirst(out, BOTTOM_RE)
    out = targetNav ? replaceRange(out, targetNav, bottomNav) : insertBeforeBodyClose(out, bottomNav)
  }

  return out
}

function variantFromHtmlPath(path: string): SharedChromeDevice {
  if (/\.mobile\.html$/i.test(path)) return 'mobile'
  if (/\.tablet\.html$/i.test(path)) return 'tablet'
  return 'desktop'
}

function isSystemHtmlPath(path: string): boolean {
  return /(^|\/)404(\.mobile|\.tablet)?\.html$/i.test(path.replace(/\\/g, '/'))
}

export function syncSharedChromeAcrossProjectFiles<
  T extends { files: Array<{ path: string; kind: string; content: string }> },
>(project: T, sourcePath: string, sourceHtml: string): T {
  const chrome = extractSharedChrome(sourceHtml)
  if (!hasSharedChrome(chrome)) return project
  const path = sourcePath.trim() || 'index.html'
  const sourceVariant = variantFromHtmlPath(path)
  const files = project.files.map((file) => {
    if (file.path === path && file.kind === 'html') return { ...file, content: sourceHtml }
    if (file.kind !== 'html' || !/\.html$/i.test(file.path) || isSystemHtmlPath(file.path)) return file
    const current = file.content || ''
    if (!current.trim()) return file
    const targetVariant = variantFromHtmlPath(file.path)
    const next = applySharedChrome(current, chrome, {
      targetVariant,
      stripLogoFloat: targetVariant !== sourceVariant,
    })
    return next === current ? file : { ...file, content: next }
  })
  return { ...project, files }
}
