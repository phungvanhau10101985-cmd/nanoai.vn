/**
 * Shared shop chrome: header, footer, mobile/tablet bottom nav, and viewport-fixed
 * float icons (Chat mua / Zalo / Facebook / Top up).
 *
 * The page being saved is the source of truth for that device's shared chrome.
 * Saving any page copies header/footer/bottom nav/floats onto every other page of the
 * same device. Head / dock / float are independent per machine — no Desktop↔Laptop
 * or Mobile↔Tablet pairing.
 */

import { mergeVisualHomeStylesIntoHtml } from '@/lib/partner-website/shop/merge-visual-home-styles'
import { PW_CHROME_FLOAT_KINDS } from '@/lib/partner-website/shop/chrome-float-widgets'

export type SharedChromeDevice = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export type SharedChrome = {
  topbar: string
  header: string
  footer: string
  bottomNav: string
  /** Body-level float icons — not inside header/footer/nav (JS seats them on `body`). */
  floats: string
}

const HEADER_RE =
  /<(header|div)\b(?=[^>]*?(?:data-pw-region=["']header["']|class=["'][^"']*\b(?:pw-header|pw-shop-header)(?![\w-])))[^>]*>/i
const FOOTER_RE =
  /<(footer|div)\b(?=[^>]*?(?:data-pw-region=["']footer["']|class=["'][^"']*\b(?:pw-footer|pw-shop-footer)(?![\w-])))[^>]*>/i
const BOTTOM_RE =
  /<(nav|div)\b(?=[^>]*?class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)(?![\w-]))[^>]*>/i
const TOPBAR_RE =
  /<(div)\b(?=[^>]*?(?:data-pw-region=["']topbar["']|class=["'][^"']*\b(?:pw-topbar|pw-shop-topbar)(?![\w-])))[^>]*>/i
const FLOAT_KIT_RE =
  /<(aside|div|nav)\b(?=[^>]*\bdata-pw-chrome-kit=["']float["'])[^>]*>/i

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
  return Boolean(chrome.header || chrome.footer || chrome.bottomNav || chrome.topbar || chrome.floats)
}

export function htmlHasShopHeader(html: string): boolean {
  return Boolean(html.trim() && extractFirst(html, HEADER_RE))
}

const FLOAT_KIND_RE = PW_CHROME_FLOAT_KINDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
const FLOAT_WIDGET_OPEN_RE = new RegExp(
  `<(a|button|div)\\b(?=[^>]*(?:\\bdata-pw-chrome-float=["']1["']|\\bdata-pw-chrome-btn=["'](?:${FLOAT_KIND_RE})["']))[^>]*>`,
  'gi'
)

function floatWidgetKind(snippet: string): string | null {
  const kind = snippet.match(/data-pw-chrome-btn=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase() || ''
  return (PW_CHROME_FLOAT_KINDS as readonly string[]).includes(kind) ? kind : null
}

function extractStandaloneFloatWidgets(
  html: string,
  occupied: ExtractedBlock[],
  uniqueKinds = true
): Array<{ kind: string; start: number; end: number; html: string }> {
  if (!html) return []
  const masked = maskHtmlForTagScan(html)
  const out: Array<{ kind: string; start: number; end: number; html: string }> = []
  const seen = new Set<string>()
  FLOAT_WIDGET_OPEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FLOAT_WIDGET_OPEN_RE.exec(masked))) {
    const tag = (match[1] || 'button').toLowerCase()
    const start = match.index
    const close = closingTagIndex(masked, start + match[0].length, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    FLOAT_WIDGET_OPEN_RE.lastIndex = end
    if (occupied.some((block) => start >= block.start && end <= block.end)) continue
    const snippet = html.slice(start, end)
    if (/\bdata-pw-float-dup=["']1["']/i.test(snippet)) continue
    const kind = floatWidgetKind(snippet)
    if (!kind) continue
    if (uniqueKinds && seen.has(kind)) continue
    if (uniqueKinds) seen.add(kind)
    out.push({ kind, start, end, html: snippet })
  }
  return out
}

function stripElementRanges(
  html: string,
  ranges: Array<{ start: number; end: number }>
): string {
  if (!ranges.length) return html
  let out = ''
  let cursor = 0
  for (const range of ranges) {
    out += html.slice(cursor, range.start)
    cursor = range.end
  }
  return out + html.slice(cursor)
}

function stripStandaloneFloatWidgets(html: string, occupied: ExtractedBlock[] = []): string {
  const floats = extractStandaloneFloatWidgets(html, occupied, false)
  return stripElementRanges(html, floats)
}

const LEFTOVER_FAB_OPEN_RE =
  /<(a|button|div)\b(?=[^>]*(?:class=["'][^"']*\bpw-fab-chat\b|data-nanoai-chat-bubble=["']1["']|data-pw-chat-launcher=["']1["']))[^>]*>/gi

/** Drop old NanoAI embed bubbles — Chat mua is the only shop chat chrome. */
function stripLeftoverEmbedChatFabs(html: string): string {
  if (!html) return html
  const masked = maskHtmlForTagScan(html)
  const ranges: Array<{ start: number; end: number }> = []
  LEFTOVER_FAB_OPEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LEFTOVER_FAB_OPEN_RE.exec(masked))) {
    const tag = (match[1] || 'button').toLowerCase()
    const start = match.index
    const close = closingTagIndex(masked, start + match[0].length, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    LEFTOVER_FAB_OPEN_RE.lastIndex = end
    ranges.push({ start, end })
  }
  return stripElementRanges(html, ranges)
}

function chromeOccupiedBlocks(html: string): ExtractedBlock[] {
  const header = extractFirst(html, HEADER_RE)
  const footer = extractFirst(html, FOOTER_RE)
  const bottomNav = extractFirst(html, BOTTOM_RE)
  const topbar = extractFirst(html, TOPBAR_RE)
  const floatKit = extractFirst(html, FLOAT_KIT_RE)
  return [header, footer, bottomNav, topbar, floatKit].filter((b): b is ExtractedBlock => Boolean(b))
}

function extractAllBlocks(html: string, openRe: RegExp): ExtractedBlock[] {
  if (!html) return []
  const masked = maskHtmlForTagScan(html)
  const out: ExtractedBlock[] = []
  const re = new RegExp(openRe.source, openRe.flags.includes('g') ? openRe.flags : `${openRe.flags}g`)
  re.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const close = closingTagIndex(masked, start + match[0].length, tag)
    if (close < 0) {
      re.lastIndex = start + match[0].length
      continue
    }
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    out.push({ start, end, html: html.slice(start, end) })
    re.lastIndex = end
  }
  return out
}

const DEVICE_WRAP_OPEN_RE =
  /<(div)\b(?=[^>]*\bdata-pw-visual-device=["'](?:desktop|laptop|tablet|mobile)["'])[^>]*>/gi

function floatMatchesDevice(snippet: string, variant: SharedChromeDevice): boolean {
  const device = snippet.match(/\bdata-pw-device=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase()
  if (!device) return true
  return device === variant
}

function chromePresentHtml(chrome: SharedChrome): string {
  return `${chrome.topbar}${chrome.header}${chrome.footer}${chrome.bottomNav}${chrome.floats}`
}

export function fillMissingSharedChromeFloats(chrome: SharedChrome, fallbackHtml: string): SharedChrome {
  if (!fallbackHtml.trim()) return chrome
  const extra = extractSharedChrome(fallbackHtml)
  if (!extra.floats.trim()) return chrome
  const present = chromePresentHtml(chrome)
  const snippets = extractStandaloneFloatWidgets(extra.floats, []).filter(
    (w) => !htmlHasChromeFeature(present, `btn:${w.kind}`)
  )
  if (!snippets.length) return chrome
  return {
    ...chrome,
    floats: [chrome.floats, ...snippets.map((s) => s.html)].filter((part) => part.trim()).join('\n'),
  }
}

/**
 * Editor seats Chat mua / Zalo / Facebook / Top up on `document.body`, outside
 * `[data-pw-visual-device]`. Isolating a device wrapper would otherwise drop them
 * on save, so other pages never receive the icons.
 */
export function hoistBodyLevelChromeFloats(
  targetHtml: string,
  sourceHtml: string,
  variant?: SharedChromeDevice
): string {
  if (!targetHtml.trim() || !sourceHtml.trim()) return targetHtml
  DEVICE_WRAP_OPEN_RE.lastIndex = 0
  const occupied = [...chromeOccupiedBlocks(sourceHtml), ...extractAllBlocks(sourceHtml, DEVICE_WRAP_OPEN_RE)]
  const picked = new Map<string, string>()
  for (const widget of extractStandaloneFloatWidgets(sourceHtml, occupied, false)) {
    if (variant && !floatMatchesDevice(widget.html, variant)) continue
    if (htmlHasChromeFeature(targetHtml, `btn:${widget.kind}`)) continue
    if (picked.has(widget.kind)) continue
    picked.set(widget.kind, widget.html)
  }
  if (!picked.size) return targetHtml
  return insertBeforeBodyClose(targetHtml, [...picked.values()].join('\n'))
}

const SCENE_OVERLAY_OPEN_RE =
  /<(div|p|h[1-6]|span|a|button|section|article|figure|img)\b(?=[^>]*(?:data-pw-added-text=["']1["']|data-pw-added-btn=["']1["']|data-pw-added-bg=["']1["']|data-pw-added-image=["']1["']|data-pw-added-video=["']1["']|data-pw-chrome-added=["']1["']|data-pw-placement=["']scene-absolute["']))[^>]*>/gi

function overlayIdentity(snippet: string): string {
  return (
    snippet.match(/\bid=["']([^"']+)["']/i)?.[1] ||
    snippet.match(/\bdata-pw-clone-id=["']([^"']+)["']/i)?.[1] ||
    snippet.match(/<[^>]+>/)?.[0]?.replace(/\s+/g, ' ').slice(0, 180) ||
    snippet.slice(0, 180)
  )
}

function extractStandaloneSceneOverlays(
  html: string,
  occupied: ExtractedBlock[]
): Array<{ start: number; end: number; html: string; id: string }> {
  if (!html) return []
  const masked = maskHtmlForTagScan(html)
  const out: Array<{ start: number; end: number; html: string; id: string }> = []
  const seen = new Set<string>()
  SCENE_OVERLAY_OPEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SCENE_OVERLAY_OPEN_RE.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const close = closingTagIndex(masked, start + match[0].length, tag)
    if (close < 0) {
      SCENE_OVERLAY_OPEN_RE.lastIndex = start + match[0].length
      continue
    }
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    SCENE_OVERLAY_OPEN_RE.lastIndex = end
    if (occupied.some((block) => start >= block.start && end <= block.end)) continue
    const snippet = html.slice(start, end)
    if (/\bdata-pw-chrome-float=["']1["']/i.test(snippet)) continue
    if (/\bdata-pw-chrome-kit=["'](?:1|actions|dock|float)["']/i.test(snippet)) continue
    if (/\bdata-pw-added-(?:bg|text|btn|image|video)-slot=["']1["']/i.test(snippet)) continue
    const id = overlayIdentity(snippet)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({ start, end, html: snippet, id })
  }
  return out
}

function insertBeforeMainClose(html: string, snippet: string): string {
  if (/<\/main>/i.test(html)) {
    return html.replace(/<\/main>/i, `${snippet}\n</main>`)
  }
  return insertBeforeBodyClose(html, snippet)
}

/**
 * Old Save parked authored overlays on `document.body`. Isolating a device
 * wrapper would drop them. Recover them into `main` / scene root.
 */
export function hoistBodyLevelSceneOverlays(
  targetHtml: string,
  sourceHtml: string,
  variant?: SharedChromeDevice
): string {
  if (!targetHtml.trim() || !sourceHtml.trim()) return targetHtml
  DEVICE_WRAP_OPEN_RE.lastIndex = 0
  const occupied = [...chromeOccupiedBlocks(sourceHtml), ...extractAllBlocks(sourceHtml, DEVICE_WRAP_OPEN_RE)]
  const snippets: string[] = []
  for (const overlay of extractStandaloneSceneOverlays(sourceHtml, occupied)) {
    if (variant && !floatMatchesDevice(overlay.html, variant)) continue
    if (
      overlay.id &&
      (targetHtml.includes(`id="${overlay.id}"`) || targetHtml.includes(`id='${overlay.id}'`))
    ) {
      continue
    }
    if (targetHtml.includes(overlay.html)) continue
    snippets.push(overlay.html)
  }
  if (!snippets.length) return targetHtml
  return insertBeforeMainClose(targetHtml, snippets.join('\n'))
}

function kitHtmlHasChromeKind(kitHtml: string, kind: string): boolean {
  return new RegExp(`data-pw-chrome-btn=["']${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(
    kitHtml
  )
}

/** Empty kit host after runtime hoist must not win over the authored standalone icons. */
function mergeStandaloneFloatsIntoKit(
  kitHtml: string,
  standalone: Array<{ kind: string; html: string }>
): string {
  const extras = standalone.filter((widget) => widget.kind && !kitHtmlHasChromeKind(kitHtml, widget.kind))
  if (!extras.length) return kitHtml
  const inject = extras.map((widget) => widget.html).join('\n')
  if (/<\/(aside|div|nav)\s*>/i.test(kitHtml)) {
    return kitHtml.replace(/<\/(aside|div|nav)\s*>/i, (_close, tag: string) => `${inject}\n</${tag}>`)
  }
  return `${kitHtml}\n${inject}`
}

export function extractSharedChrome(html: string): SharedChrome {
  const header = extractFirst(html, HEADER_RE)
  const footer = extractFirst(html, FOOTER_RE)
  const bottomNav = extractFirst(html, BOTTOM_RE)
  const topbar = extractFirst(html, TOPBAR_RE)
  const topbarStandalone = topbar && header && blockInside(topbar, header) ? '' : topbar?.html || ''
  const occupied = chromeOccupiedBlocks(html)
  const floatKit = extractFirst(html, FLOAT_KIT_RE)
  const standalone = extractStandaloneFloatWidgets(html, occupied)
  return {
    topbar: topbarStandalone,
    header: header?.html || '',
    footer: footer?.html || '',
    bottomNav: bottomNav?.html || '',
    floats: floatKit
      ? mergeStandaloneFloatsIntoKit(floatKit.html, standalone)
      : standalone.map((w) => w.html).join('\n'),
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
      // Keep --pw-chrome-size / data-pw-chrome-size so float widgets stay the same size.
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
    floats: stripDeletedChromeFeaturesFromBlock(chrome.floats, deleted),
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
  const floatWidgets = extractStandaloneFloatWidgets(chrome.floats, []).map((w) => ({
    key: `btn:${w.kind}`,
    html: w.html,
  }))
  if (!widgets.length && !floatWidgets.length) return targetHtml
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
  for (const widget of floatWidgets) {
    if (deleted.has(widget.key)) continue
    if (htmlHasChromeFeature(next, widget.key)) continue
    const prepared = restampChromeDevice(stripLayoutCoordsFromHtml(widget.html), variant)
    next = insertBeforeBodyClose(next, prepared)
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

export function isPdpPageHtml(html: string): boolean {
  return /data-pw-page=["']product["']/i.test(html)
}

export function isPdpBottomNavHtml(html: string): boolean {
  return /data-pw-pdp-bottom=["']1["']/i.test(html)
}

const LIVE_CHROME_OPEN_RE = /<(div)\b(?=[^>]*\bdata-pw-live-chrome\b)[^>]*>/gi
const LIVE_DOCK_OPEN_RE = /<(div)\b(?=[^>]*\bdata-pw-live-dock\b)[^>]*>/gi

/** Runtime hoist wrapper must not persist — it blocks live hoist and stacks a second header. */
export function unwrapPersistedLiveChromeHtml(html: string): string {
  if (!html) return html
  let out = html
  if (/data-pw-live-dock/i.test(out)) {
    const docks = extractAllBlocks(out, LIVE_DOCK_OPEN_RE)
    for (let i = docks.length - 1; i >= 0; i -= 1) {
      const block = docks[i]
      const inner = block.html.replace(/^<div\b[^>]*>/i, '').replace(/<\/div>\s*$/i, '')
      out = out.slice(0, block.start) + inner + out.slice(block.end)
    }
  }
  if (!/data-pw-live-chrome/i.test(out)) return out
  const blocks = extractAllBlocks(out, LIVE_CHROME_OPEN_RE)
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i]
    let inner = block.html.replace(/^<div\b[^>]*>/i, '').replace(/<\/div>\s*$/i, '')
    inner = inner.replace(/^<div\b[^>]*\bdata-pw-live-chrome-scale\b[^>]*>([\s\S]*)<\/div>\s*$/i, '$1')
    out = out.slice(0, block.start) + inner + out.slice(block.end)
  }
  return out.replace(/<[^>]*\bdata-pw-live-chrome-ph\b[^>]*>\s*<\/[^>]+>/gi, '')
}

export function dedupeSharedShopHeaders(html: string): string {
  if (!html) return html
  const blocks = extractAllBlocks(html, HEADER_RE)
  if (blocks.length <= 1) return html
  let out = html
  for (let i = blocks.length - 1; i >= 1; i -= 1) {
    const extra = blocks[i]
    if (blocks.some((keep, idx) => idx < i && extra.start >= keep.start && extra.end <= keep.end)) continue
    out = out.slice(0, extra.start) + out.slice(extra.end)
  }
  return out
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
  let floats = chrome.floats
  if (opts?.stripLogoFloat) {
    header = stripLayoutCoordsFromHtml(header)
    topbar = stripLayoutCoordsFromHtml(topbar)
    footer = stripLayoutCoordsFromHtml(footer)
    bottomNav = stripLayoutCoordsFromHtml(bottomNav)
    floats = stripLayoutCoordsFromHtml(floats)
  }
  if (opts?.targetVariant) {
    header = restampChromeDevice(header, opts.targetVariant)
    topbar = restampChromeDevice(topbar, opts.targetVariant)
    footer = restampChromeDevice(footer, opts.targetVariant)
    bottomNav = restampChromeDevice(bottomNav, opts.targetVariant)
    floats = restampChromeDevice(floats, opts.targetVariant)
  }

  let out = dedupeSharedShopHeaders(unwrapPersistedLiveChromeHtml(html))
  const sourceHeaderHasTopbar = /(?:pw-topbar|pw-shop-topbar|data-pw-region=["']topbar["'])/i.test(header)

  if (header) {
    out = dedupeSharedShopHeaders(out)
    const targetHeader = extractFirst(out, HEADER_RE)
    out = targetHeader ? replaceRange(out, targetHeader, header) : insertAfterBodyOpen(out, header)
    out = dedupeSharedShopHeaders(out)
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
    const targetIsPdp = isPdpPageHtml(out)
    const sourceIsPdpNav = isPdpBottomNavHtml(bottomNav)
    const sourceIsKitDock = /\bdata-pw-chrome-kit=["']dock["']/i.test(bottomNav)
    if (sourceIsKitDock || targetIsPdp === sourceIsPdpNav) {
      const targetNav = extractFirst(out, BOTTOM_RE)
      out = targetNav ? replaceRange(out, targetNav, bottomNav) : insertBeforeBodyClose(out, bottomNav)
    }
  }

  out = stripLeftoverEmbedChatFabs(out)
  const occupied = [
    extractFirst(out, HEADER_RE),
    extractFirst(out, FOOTER_RE),
    extractFirst(out, BOTTOM_RE),
    extractFirst(out, TOPBAR_RE),
  ].filter((b): b is ExtractedBlock => Boolean(b))
  if (floats.trim()) {
    const existingKit = extractFirst(out, FLOAT_KIT_RE)
    if (existingKit) out = replaceRange(out, existingKit, '')
    out = stripStandaloneFloatWidgets(out)
    out = insertBeforeBodyClose(out, floats)
  } else {
    // Chat mua still lives in header: drop page-local Top up / Zalo leftovers in the middle.
    out = stripStandaloneFloatWidgets(out, occupied)
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
      return file
    }
    const next = stampWithHomeChrome(current, chromeSource || sourceHtml, targetVariant)
    return next === current ? file : { ...file, content: next }
  })
  return { ...project, files }
}
