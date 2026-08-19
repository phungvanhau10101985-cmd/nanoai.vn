/**
 * Shared shop chrome: header, footer, and mobile/tablet bottom nav.
 *
 * The page being saved is the source of truth for that device's shared chrome.
 * Saving any page copies header/footer/bottom nav + chrome widget positions onto every
 * other page of the same device. Other devices keep their own logo/layout; only home saves
 * may add missing feature buttons across devices without coordinates.
 */

import { mergeVisualHomeStylesIntoHtml } from '@/lib/partner-website/shop/merge-visual-home-styles'

export type SharedChromeDevice = 'desktop' | 'laptop' | 'tablet' | 'mobile'

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

function stripLayoutCoordsFromHtml(html: string): string {
  if (!html || !/\sstyle=/i.test(html)) return html
  return html.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_m, q: string, css: string) => {
    const cleaned = css
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !/^(left|top|right|bottom|transform|position)\s*:/i.test(part))
      .join('; ')
    return cleaned ? ` style=${q}${cleaned}${q}` : ''
  })
}

function restampChromeDevice(html: string, variant: SharedChromeDevice): string {
  if (!html) return html
  return html.replace(/<(a|button|div)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const isAdded = /\bdata-pw-chrome-added="1"/i.test(attrs)
    const isCount = /\bdata-pw-chrome-count=/i.test(attrs)
    const isBtn = /\bdata-pw-chrome-btn=/i.test(attrs)
    if (!isAdded && !isCount && !isBtn) return full
    let next = attrs
    if (/\bdata-pw-device=/.test(next)) {
      next = next.replace(/\sdata-pw-device=(["'])[^"']*\1/gi, ` data-pw-device="${variant}"`)
    } else {
      next += ` data-pw-device="${variant}"`
    }
    return `<${tag}${next}>`
  })
}

type ChromeFeatureHost = 'actions' | 'nav' | 'mid' | 'topbar' | 'footer'

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function chromeFeatureKey(snippet: string): string | null {
  const btn = snippet.match(/data-pw-chrome-btn=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase()
  if (btn) return `btn:${btn}`
  if (/data-pw-cat-toggle/i.test(snippet)) return 'categories'
  if (/data-pw-search-form|data-pw-el=["']search["']|pw-header-search|pw-shop-search-wrap/i.test(snippet)) {
    return 'search'
  }
  if (/data-pw-image-search/i.test(snippet)) return 'search-image'
  if (!/\bdata-pw-chrome-added="1"/i.test(snippet)) return null
  const href = snippet.match(/\bhref=["']([^"']*)["']/i)?.[1] || ''
  return href ? `href:${href}` : null
}

function htmlHasChromeFeature(html: string, key: string): boolean {
  if (key.startsWith('btn:')) {
    return new RegExp(`data-pw-chrome-btn=["']${escapeRe(key.slice(4))}["']`, 'i').test(html)
  }
  if (key === 'search') {
    return /data-pw-search-form|data-pw-el=["']search["']|pw-header-search|pw-shop-search-wrap/i.test(html)
  }
  if (key === 'search-image') return /data-pw-image-search/i.test(html)
  if (key === 'categories') return /data-pw-cat-toggle|data-pw-el=["']cat-toggle["']/i.test(html)
  if (key.startsWith('href:')) return html.includes(key.slice(5))
  return false
}

function deletedChromeFeatureKeys(...htmls: string[]): Set<string> {
  const keys = new Set<string>()
  for (const html of htmls) {
    if (!html) continue
    const re = /\bdata-pw-deleted-chrome-feature=(["'])([^"']+)\1/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(html))) {
      const key = (match[2] || '').trim()
      if (key) keys.add(key)
    }
  }
  return keys
}

function stripDeletedChromeFeaturesFromBlock(html: string, deleted: Set<string>): string {
  if (!html || deleted.size === 0) return html
  const masked = maskHtmlForTagScan(html)
  const openRe =
    /<(a|button|div)\b(?=[^>]*(?:\bdata-pw-chrome-added="1"|\bdata-pw-chrome-btn=|\bdata-pw-cat-toggle\b|\bdata-pw-image-search\b|\bdata-pw-search-form\b|\bdata-pw-el=["'](?:search|cat-toggle)["']|\bpw-header-search\b|\bpw-shop-search-wrap\b|\bpw-search-submit\b|\bpw-shop-search-submit\b))[^>]*>/gi
  const ranges: Array<{ start: number; end: number }> = []
  let match: RegExpExecArray | null
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const close = closingTagIndex(masked, start + match[0].length, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    const snippet = html.slice(start, end)
    const key =
      chromeFeatureKey(snippet) ||
      (/pw-search-submit|pw-shop-search-submit/i.test(snippet) ? 'search-submit' : null)
    if (key && deleted.has(key)) ranges.push({ start, end })
    openRe.lastIndex = end
  }
  if (!ranges.length) return html
  let out = ''
  let cursor = 0
  for (const range of ranges) {
    out += html.slice(cursor, range.start)
    cursor = range.end
  }
  return out + html.slice(cursor)
}

function stripDeletedChromeFeatures(chrome: SharedChrome, deleted: Set<string>): SharedChrome {
  if (deleted.size === 0) return chrome
  return {
    topbar: stripDeletedChromeFeaturesFromBlock(chrome.topbar, deleted),
    header: stripDeletedChromeFeaturesFromBlock(chrome.header, deleted),
    footer: stripDeletedChromeFeaturesFromBlock(chrome.footer, deleted),
    bottomNav: stripDeletedChromeFeaturesFromBlock(chrome.bottomNav, deleted),
  }
}

function extractAddedChromeWidgets(
  regionHtml: string,
  fallbackHost: ChromeFeatureHost
): Array<{ key: string; html: string; host: ChromeFeatureHost }> {
  if (!regionHtml || !/\bdata-pw-chrome-added="1"/i.test(regionHtml)) return []
  const out: Array<{ key: string; html: string; host: ChromeFeatureHost }> = []
  const seen = new Set<string>()
  const masked = maskHtmlForTagScan(regionHtml)
  const openRe = /<(a|button|div)\b(?=[^>]*\bdata-pw-chrome-added="1")[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const close = closingTagIndex(masked, start + match[0].length, tag)
    if (close < 0) continue
    const closeTok = regionHtml.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    const snippet = regionHtml.slice(start, end)
    const key = chromeFeatureKey(snippet)
    if (!key || seen.has(key)) {
      openRe.lastIndex = end
      continue
    }
    seen.add(key)
    const place = snippet.match(/data-pw-chrome-place=["']([^"']+)["']/i)?.[1]?.toLowerCase()
    let host = fallbackHost
    if (place === 'nav') host = 'nav'
    else if (place === 'mid') host = 'mid'
    else if (place === 'header') host = 'actions'
    out.push({ key, html: snippet, host })
    openRe.lastIndex = end
  }
  return out
}

const FEATURE_HOST_OPEN: Record<ChromeFeatureHost, RegExp> = {
  actions:
    /<(div)\b([^>]*class=["'][^"']*\b(?:pw-header-actions|pw-shop-header-actions)\b[^"']*["'][^>]*)>/i,
  nav: /<(nav)\b([^>]*class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)\b[^"']*["'][^>]*)>/i,
  mid: /<(nav)\b([^>]*class=["'][^"']*\b(?:pw-nav-main|pw-shop-nav-row)\b[^"']*["'][^>]*)>/i,
  topbar:
    /<(div)\b([^>]*class=["'][^"']*\b(?:pw-topbar-inner|pw-shop-topbar-inner|pw-topbar)\b[^"']*["'][^>]*)>/i,
  footer: FOOTER_RE,
}

function insertBeforeBlockClose(html: string, block: ExtractedBlock, snippet: string): string {
  const closeMatch = html.slice(block.start, block.end).match(/<\/[a-z0-9]+\s*>\s*$/i)
  if (!closeMatch) return html.slice(0, block.end) + snippet + html.slice(block.end)
  const closeAt = block.end - closeMatch[0].length
  return html.slice(0, closeAt) + snippet + html.slice(closeAt)
}

function insertFeatureWidget(html: string, host: ChromeFeatureHost, widget: string): string | null {
  const open = html.match(FEATURE_HOST_OPEN[host])
  if (open && open.index != null) {
    const tag = (open[1] || 'div').toLowerCase()
    const close = closingTagIndex(maskHtmlForTagScan(html), open.index + open[0].length, tag)
    if (close >= 0) return `${html.slice(0, close)}${widget}${html.slice(close)}`
  }
  if (host === 'actions' || host === 'mid' || host === 'topbar') {
    const header = extractFirst(html, HEADER_RE)
    if (header) return insertBeforeBlockClose(html, header, widget)
  }
  if (host === 'footer') {
    const footer = extractFirst(html, FOOTER_RE)
    if (footer) return insertBeforeBlockClose(html, footer, widget)
  }
  if (host === 'nav') {
    const nav = extractFirst(html, BOTTOM_RE)
    if (nav) return insertBeforeBlockClose(html, nav, widget)
  }
  return null
}

/** Add missing chrome feature buttons without copying logo/layout from another device. */
export function mergeMissingChromeFeatures(
  targetHtml: string,
  chrome: SharedChrome,
  variant: SharedChromeDevice
): string {
  if (!targetHtml.trim() || !hasSharedChrome(chrome)) return targetHtml
  const deleted = deletedChromeFeatureKeys(targetHtml)
  const widgets = [
    ...extractAddedChromeWidgets(chrome.topbar, 'topbar'),
    ...extractAddedChromeWidgets(chrome.header, 'actions'),
    ...extractAddedChromeWidgets(chrome.footer, 'footer'),
    ...extractAddedChromeWidgets(chrome.bottomNav, 'nav'),
  ]
  if (!widgets.length) return targetHtml
  let next = targetHtml
  for (const widget of widgets) {
    if (deleted.has(widget.key)) continue
    if (htmlHasChromeFeature(next, widget.key)) continue
    const prepared = restampChromeDevice(stripLayoutCoordsFromHtml(widget.html), variant)
    const hosts: ChromeFeatureHost[] = [widget.host, 'actions', 'nav', 'footer', 'topbar', 'mid']
    const tried = new Set<ChromeFeatureHost>()
    for (const host of hosts) {
      if (tried.has(host)) continue
      tried.add(host)
      const attempt = insertFeatureWidget(next, host, prepared)
      if (attempt) {
        next = attempt
        break
      }
    }
  }
  return next
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
    header = stripLayoutCoordsFromHtml(header)
    topbar = stripLayoutCoordsFromHtml(topbar)
    footer = stripLayoutCoordsFromHtml(footer)
    bottomNav = stripLayoutCoordsFromHtml(bottomNav)
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
  if (/\.laptop\.html$/i.test(path)) return 'laptop'
  return 'desktop'
}

function fileNameOf(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() || path
}

/** Homepage HTML of a device — the only chrome source when syncing. */
export function isHomeSharedChromePath(path: string): boolean {
  return /^index(\.(laptop|tablet|mobile))?\.html$/i.test(fileNameOf(path))
}

export function homeSharedChromePath(variant: SharedChromeDevice): string {
  if (variant === 'mobile') return 'index.mobile.html'
  if (variant === 'tablet') return 'index.tablet.html'
  if (variant === 'laptop') return 'index.laptop.html'
  return 'index.html'
}

function isSystemHtmlPath(path: string): boolean {
  return /(^|\/)404(\.mobile|\.tablet|\.laptop)?\.html$/i.test(path.replace(/\\/g, '/'))
}

function stampWithHomeChrome(html: string, homeHtml: string, variant: SharedChromeDevice): string {
  const deleted = deletedChromeFeatureKeys(html, homeHtml)
  const chrome = stripDeletedChromeFeatures(extractSharedChrome(homeHtml), deleted)
  if (!hasSharedChrome(chrome)) return html
  const next = applySharedChrome(html, chrome, { targetVariant: variant })
  return mergeVisualHomeStylesIntoHtml(next, homeHtml)
}

function readHomeHtmlForVariant<T extends { files: Array<{ path: string; kind: string; content: string }> }>(
  project: T,
  variant: SharedChromeDevice,
  sourcePath: string,
  sourceHtml: string
): string {
  if (isHomeSharedChromePath(sourcePath) && variantFromHtmlPath(sourcePath) === variant) {
    return sourceHtml
  }
  const homePath = homeSharedChromePath(variant)
  return project.files.find((f) => f.path === homePath && f.kind === 'html')?.content?.trim() || ''
}

export function syncSharedChromeAcrossProjectFiles<
  T extends { files: Array<{ path: string; kind: string; content: string }> },
>(project: T, sourcePath: string, sourceHtml: string): T {
  const path = sourcePath.trim() || 'index.html'
  const sourceVariant = variantFromHtmlPath(path)
  const sourceIsHome = isHomeSharedChromePath(path)
  const homeHtml = readHomeHtmlForVariant(project, sourceVariant, path, sourceHtml)
  const sourceChrome = extractSharedChrome(sourceHtml)
  const chromeSource = hasSharedChrome(sourceChrome)
    ? sourceHtml
    : homeHtml.length >= 40
      ? homeHtml
      : sourceIsHome
        ? sourceHtml
        : ''
  const chrome = extractSharedChrome(chromeSource || sourceHtml)
  if (!hasSharedChrome(chrome)) {
    const files = project.files.map((file) =>
      file.path === path && file.kind === 'html' ? { ...file, content: sourceHtml } : file
    )
    return { ...project, files }
  }

  const files = project.files.map((file) => {
    if (file.path === path && file.kind === 'html') {
      const content = sourceHtml
      return content === file.content ? file : { ...file, content }
    }
    if (file.kind !== 'html' || !/\.html$/i.test(file.path) || isSystemHtmlPath(file.path)) return file
    const current = file.content || ''
    if (!current.trim()) return file
    const targetVariant = variantFromHtmlPath(file.path)
    if (targetVariant !== sourceVariant) {
      if (!sourceIsHome) return file
      const next = mergeMissingChromeFeatures(current, chrome, targetVariant)
      return next === current ? file : { ...file, content: next }
    }
    const next = stampWithHomeChrome(current, chromeSource || sourceHtml, targetVariant)
    return next === current ? file : { ...file, content: next }
  })
  return { ...project, files }
}
