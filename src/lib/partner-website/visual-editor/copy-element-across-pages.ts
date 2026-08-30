/**
 * Copy a Sửa nhanh element onto every other page of the same device,
 * keeping canvas coordinates. One engine — every shop.
 *
 * Source of truth: the page being saved. Elements stamped
 * `data-pw-clone-all="1"` are mirrored; copies on other pages keep
 * `data-pw-clone-id` only so saving a destination does not overwrite the source.
 */

import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import { buildBlankShopVisualHtml } from '@/lib/partner-website/shop/build-blank-shop-visual-html'
import { buildShopTemplatePageVisualHtml } from '@/lib/partner-website/shop/build-shop-template-page-visual-html'
import {
  applySharedChrome,
  extractSharedChrome,
  hasSharedChrome,
  htmlHasShopHeader,
} from '@/lib/partner-website/shop/sync-shared-chrome'
import {
  VISUAL_EDITOR_PAGE_KEYS,
  visualDeviceVariantFromHtmlPath,
  visualEditorHtmlPath,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  PW_COORDINATE_CONTRACT_VERSION,
  pwClientBoxToScene,
  pwCoordinateDevice,
  pwCreateViewportMap,
  pwLeftOriginToCenterX,
  pwLooksLikeNormalized01,
  pwParseCoordinateVersion,
  pwSceneBoxLeftCss,
  pwSceneBoxTopPx,
  pwSceneWidth,
  pwTopLeftToElementCenter,
  type PwPlacementMode,
} from '@/lib/partner-website/visual-editor/pw-coordinate-space'

export const PW_CLONE_ID_ATTR = 'data-pw-clone-id'
export const PW_CLONE_ALL_ATTR = 'data-pw-clone-all'
export const PW_CLONE_BOX_ATTR = 'data-pw-clone-box'

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const PRODUCT_INSTANCE_RE =
  /(^|\/)p\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.(mobile|tablet|laptop))?\.html$/i

export type CloneBoxMode = PwPlacementMode

export type CloneBox = {
  mode: CloneBoxMode
  left: number
  top: number
  width: number
  height: number
  /** Legacy abs/fixed values are top-left; v2 fixed is 0..1; v3 is top-left scene px; v4 is element-center scene px. */
  version?: 1 | 2 | 3 | 4
}

export type CopiedPageClone = {
  id: string
  html: string
  box: CloneBox | null
}

type HtmlFile = { path: string; kind: string; content: string }

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

function extractByOpenRe(html: string, openRe: RegExp): Array<{ start: number; end: number; html: string }> {
  if (!html) return []
  const masked = maskHtmlForTagScan(html)
  const out: Array<{ start: number; end: number; html: string }> = []
  openRe.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const openEnd = start + match[0].length
    const selfClose = /\/\s*>$/.test(match[0]) || VOID_TAGS.has(tag)
    let end = openEnd
    if (!selfClose) {
      const close = closingTagIndex(masked, openEnd, tag)
      if (close < 0) {
        openRe.lastIndex = openEnd
        continue
      }
      const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
      end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    }
    openRe.lastIndex = end
    if (out.some((block) => start >= block.start && end <= block.end)) continue
    out.push({ start, end, html: html.slice(start, end) })
  }
  return out
}

function isSystemHtmlPath(path: string): boolean {
  const norm = path.replace(/\\/g, '/')
  return /(^|\/)404(?:\.(mobile|tablet|laptop))?\.html$/i.test(norm)
}

export function isProductInstanceHtmlPath(path: string): boolean {
  return PRODUCT_INSTANCE_RE.test(path.replace(/\\/g, '/'))
}

export function isSameDeviceVisualHtmlPath(path: string, sourcePath: string): boolean {
  return visualDeviceVariantFromHtmlPath(path) === visualDeviceVariantFromHtmlPath(sourcePath)
}

export function shouldReceivePageClone(path: string, sourcePath: string): boolean {
  const norm = path.replace(/\\/g, '/')
  if (!/\.html$/i.test(norm)) return false
  if (norm === sourcePath.replace(/\\/g, '/')) return false
  if (isSystemHtmlPath(norm)) return false
  if (isProductInstanceHtmlPath(norm)) return false
  return isSameDeviceVisualHtmlPath(norm, sourcePath)
}

export function visualPageKeyFromHtmlPath(path: string): PartnerWebsitePageKey | null {
  const norm = path.replace(/\\/g, '/')
  const variant = visualDeviceVariantFromHtmlPath(norm)
  for (const key of VISUAL_EDITOR_PAGE_KEYS) {
    if (visualEditorHtmlPath(key, variant) === norm) return key
  }
  return null
}

export function sameDeviceCatalogPageTargets(sourcePath: string): Array<{
  path: string
  pageKey: PartnerWebsitePageKey
}> {
  const variant = visualDeviceVariantFromHtmlPath(sourcePath)
  const source = sourcePath.replace(/\\/g, '/')
  return VISUAL_EDITOR_PAGE_KEYS.filter((key) => visualEditorHtmlPath(key, variant) !== source).map(
    (key) => ({ path: visualEditorHtmlPath(key, variant), pageKey: key })
  )
}

export function seedVisualPageHtmlWithChrome(input: {
  pageKey: PartnerWebsitePageKey
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
  chromeSourceHtml: string
}): string {
  const inner = htmlHasShopHeader(input.chromeSourceHtml)
    ? buildShopTemplatePageVisualHtml({
        pageKey: input.pageKey,
        variant: input.variant,
        locale: input.locale,
        siteSlug: input.siteSlug,
        brand: input.brand,
      })
    : buildBlankShopVisualHtml({
        pageKey: input.pageKey,
        variant: input.variant,
        locale: input.locale,
        siteSlug: input.siteSlug,
        brand: input.brand,
      })
  const chrome = extractSharedChrome(input.chromeSourceHtml)
  if (!hasSharedChrome(chrome)) return inner
  return applySharedChrome(inner, chrome, { targetVariant: input.variant })
}

export function parseCloneBox(raw: string | null | undefined): CloneBox | null {
  const value = String(raw || '').trim()
  if (!value) return null
  if (value === 'flow') return { mode: 'flow', left: 0, top: 0, width: 0, height: 0, version: 1 }
  const rawParts = value.split(',')
  const parsedVersion = pwParseCoordinateVersion(rawParts[0])
  const version = parsedVersion || 1
  const parts = parsedVersion ? rawParts.slice(1) : rawParts
  const mode =
    parts[0] === 'scene-absolute' || parts[0] === 'abs'
      ? 'scene-absolute'
      : parts[0] === 'viewport-fixed' || parts[0] === 'fixed'
        ? 'viewport-fixed'
        : parts[0] === 'flow'
          ? 'flow'
          : null
  if (!mode) return null
  if (mode === 'flow') return { mode: 'flow', left: 0, top: 0, width: 0, height: 0, version }
  const left = Number(parts[1])
  const top = Number(parts[2])
  const width = Number(parts[3])
  const height = Number(parts[4])
  if (![left, top, width, height].every((n) => Number.isFinite(n))) return null
  return { mode, left, top, width, height, version }
}

function cloneIdOf(snippet: string): string {
  return snippet.match(/\bdata-pw-clone-id=["']([^"']+)["']/i)?.[1]?.trim() || ''
}

function cloneBoxOf(snippet: string): CloneBox | null {
  return parseCloneBox(snippet.match(/\bdata-pw-clone-box=["']([^"']+)["']/i)?.[1])
}

function stripEditorChromeFromSnippet(html: string): string {
  return html
    .replace(/\sclass=(["'])([^"']*)\1/gi, (_m, q: string, cls: string) => {
      const next = cls
        .split(/\s+/)
        .filter(
          (name) =>
            name &&
            !/^nanoai-ve-/.test(name) &&
            name !== 'nanoai-ve-selected' &&
            name !== 'nanoai-ve-highlight'
        )
        .join(' ')
      return next ? ` class=${q}${next}${q}` : ''
    })
    .replace(/\sdata-nanoai-ve-selected(=["'][^"']*["'])?/gi, '')
    .replace(/\scontenteditable(=["'][^"']*["'])?/gi, '')
}

function stripCloneAllAttr(html: string): string {
  return html.replace(/\sdata-pw-clone-all=(["'])[^"']*\1/gi, '')
}

function setStyleDecls(snippet: string, decls: Record<string, string>): string {
  const extra = Object.entries(decls)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
  if (/\sstyle=(["'])([\s\S]*?)\1/i.test(snippet)) {
    return snippet.replace(/\sstyle=(["'])([\s\S]*?)\1/i, (_m, q: string, css: string) => {
      const kept = css
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !/^(left|top|right|bottom|width|height|position)\s*:/i.test(part))
      const next = [...kept, extra].filter(Boolean).join(';')
      return ` style=${q}${next}${q}`
    })
  }
  return snippet.replace(/^(<[a-zA-Z][\w-]*)\b/, `$1 style="${extra}"`)
}

function setOpeningTagAttrs(snippet: string, attrs: Record<string, string>): string {
  return snippet.replace(/^<([a-zA-Z][\w-]*)([^>]*)>/, (_full, tag: string, raw: string) => {
    let next = raw
    for (const [name, value] of Object.entries(attrs)) {
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      next = next.replace(new RegExp(`\\s${safe}=(["'])[^"']*\\1`, 'gi'), '')
      next += ` ${name}="${String(value).replace(/"/g, '&quot;')}"`
    }
    return `<${tag}${next}>`
  })
}

function applyCloneBoxToSnippet(snippet: string, box: CloneBox | null, sceneWidth = 1440): string {
  if (!box || box.mode === 'flow') return snippet
  const fixed = box.mode === 'viewport-fixed'
  const legacyNorm = fixed && (box.version === 2 || (box.version < 3 && pwLooksLikeNormalized01(box.left, box.top)))
  let x = box.left
  let y = box.top
  if (!fixed) {
    if (box.version < 3) x = pwLeftOriginToCenterX(x, sceneWidth)
    if (box.version < 4) {
      const center = pwTopLeftToElementCenter(x, y, box.width, box.height)
      x = center.x
      y = center.y
    }
  } else if (!legacyNorm && box.version < 4) {
    const center = pwTopLeftToElementCenter(x, y, box.width, box.height)
    x = center.x
    y = center.y
  }
  const left = legacyNorm ? `${box.left * 100}%` : pwSceneBoxLeftCss(x, box.width)
  const top = legacyNorm ? `${box.top * 100}%` : `${pwSceneBoxTopPx(y, box.height)}px`
  const styled = setStyleDecls(snippet, {
    position: fixed ? 'fixed' : 'absolute',
    left,
    top,
    width: `${Math.max(1, Math.round(box.width))}px`,
    height: `${Math.max(1, Math.round(box.height))}px`,
    right: 'auto',
    bottom: 'auto',
  })
  if (fixed) {
    return setOpeningTagAttrs(
      styled,
      legacyNorm
        ? {
            'data-pw-placement': 'viewport-fixed',
            'data-pw-fixed-x': String(box.left),
            'data-pw-fixed-y': String(box.top),
            'data-pw-fixed-w': String(box.width),
            'data-pw-fixed-h': String(box.height),
          }
        : {
            'data-pw-placement': 'viewport-fixed',
            'data-pw-fixed-x': String(x),
            'data-pw-fixed-y': String(y),
            'data-pw-fixed-w': String(box.width),
            'data-pw-fixed-h': String(box.height),
          }
    )
  }
  return setOpeningTagAttrs(styled, {
        'data-pw-placement': 'scene-absolute',
        'data-pw-box-x': String(x),
        'data-pw-box-y': String(y),
        'data-pw-box-w': String(box.width),
        'data-pw-box-h': String(box.height),
      })
}

export function extractPageClones(html: string): CopiedPageClone[] {
  if (!html.trim()) return []
  const blocks = extractByOpenRe(
    html,
    /<([a-zA-Z][\w-]*)\b(?=[^>]*\bdata-pw-clone-all=["']1["'])[^>]*>/gi
  )
  const out: CopiedPageClone[] = []
  const seen = new Set<string>()
  for (const block of blocks) {
    const id = cloneIdOf(block.html)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      html: stripEditorChromeFromSnippet(block.html),
      box: cloneBoxOf(block.html),
    })
  }
  return out
}

function removeCloneById(html: string, id: string): string {
  const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blocks = extractByOpenRe(
    html,
    new RegExp(`<([a-zA-Z][\\w-]*)\\b(?=[^>]*\\bdata-pw-clone-id=["']${safe}["'])[^>]*>`, 'gi')
  )
  if (!blocks.length) return html
  let next = html
  for (const block of [...blocks].reverse()) {
    next = next.slice(0, block.start) + next.slice(block.end)
  }
  return next
}

function ensureMainIsPositioned(html: string): string {
  if (!/<main\b/i.test(html)) return html
  return html.replace(/<main\b([^>]*)>/i, (full, attrs: string) => {
    if (/\bstyle=/i.test(attrs)) {
      return full.replace(/\bstyle=(["'])([\s\S]*?)\1/i, (styleFull: string, q: string, css: string) => {
        if (/position\s*:/i.test(css)) return styleFull
        return ` style=${q}${String(css).replace(/;?\s*$/, '')};position:relative${q}`
      })
    }
    return `<main${attrs} style="position:relative">`
  })
}

function insertBeforeMainClose(html: string, snippet: string): string {
  const positioned = ensureMainIsPositioned(html)
  if (/<\/main>/i.test(positioned)) return positioned.replace(/<\/main>/i, `${snippet}\n</main>`)
  if (/<(footer|nav)\b(?=[^>]*(?:data-pw-region=["']footer["']|class=["'][^"']*\b(?:pw-footer|pw-shop-footer|pw-bottom-nav|pw-shop-bottom-nav)))/i.test(positioned)) {
    return positioned.replace(
      /<(footer|nav)\b(?=[^>]*(?:data-pw-region=["']footer["']|class=["'][^"']*\b(?:pw-footer|pw-shop-footer|pw-bottom-nav|pw-shop-bottom-nav)))/i,
      `${snippet}\n$&`
    )
  }
  if (/<\/body>/i.test(positioned)) return positioned.replace(/<\/body>/i, `${snippet}\n</body>`)
  return `${positioned}\n${snippet}`
}

function insertAfterMainOpen(html: string, snippet: string): string {
  if (/<main\b[^>]*>/i.test(html)) return html.replace(/<main\b[^>]*>/i, (open) => `${open}\n${snippet}\n`)
  return insertBeforeMainClose(html, snippet)
}

function sceneWidthOfHtml(html: string): number {
  return pwSceneWidth(
    pwCoordinateDevice(html.match(/\bdata-pw-(?:edit-device|scene-lock)=["']([^"']+)["']/i)?.[1])
  )
}

function placeCloneOnPage(html: string, clone: CopiedPageClone): string {
  const snippet = applyCloneBoxToSnippet(stripCloneAllAttr(clone.html), clone.box, sceneWidthOfHtml(html))
  const without = removeCloneById(html, clone.id)
  if (clone.box?.mode === 'flow') return insertAfterMainOpen(without, snippet)
  return insertBeforeMainClose(without, snippet)
}

export function mergeClonesFromSourceHtml(targetHtml: string, sourceHtml: string): string {
  const clones = extractPageClones(sourceHtml)
  if (!clones.length || targetHtml.trim().length < 40) return targetHtml
  let next = targetHtml
  for (const clone of clones) next = placeCloneOnPage(next, clone)
  return next
}

const FLOW_SLOT_ATTRS = [
  'data-pw-added-bg-slot',
  'data-pw-added-text-slot',
  'data-pw-added-btn-slot',
  'data-pw-added-image-slot',
  'data-pw-added-video-slot',
  'data-pw-added-chrome-slot',
] as const

/** Bake canvas coordinates onto clone-all elements before serialize/save. */
export function refreshCloneBoxesInDocument(doc: Document): void {
  const host = doc.querySelector('main, .pw-shop-main, .pw-main') || doc.body
  if (!host) return
  const view = doc.defaultView
  const hr = host.getBoundingClientRect()
  doc.querySelectorAll(`[${PW_CLONE_ALL_ATTR}="1"]`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (FLOW_SLOT_ATTRS.some((attr) => node.getAttribute(attr) === '1')) {
      node.setAttribute(PW_CLONE_BOX_ATTR, `${PW_COORDINATE_CONTRACT_VERSION},flow`)
      return
    }
    const er = node.getBoundingClientRect()
    const cs = view?.getComputedStyle(node)
    const stay =
      node.getAttribute('data-pw-stay-scroll') === '1' || node.getAttribute('data-pw-pin-screen') === '1'
    const mode: CloneBoxMode = stay || cs?.position === 'fixed' ? 'viewport-fixed' : 'scene-absolute'
    const device = pwCoordinateDevice(
      doc.documentElement.getAttribute('data-pw-edit-device') ||
        doc.documentElement.getAttribute('data-pw-scene-lock')
    )
    const sceneWidth = pwSceneWidth(device)
    const map = pwCreateViewportMap({
      device,
      viewportWidth: view?.innerWidth || sceneWidth,
      scale: hr.width > 8 ? hr.width / sceneWidth : 1,
      originX: (hr.left || 0) + (hr.width || 0) / 2,
      originY: hr.top,
    })
    const sceneBox = pwClientBoxToScene(
      { x: er.left + er.width / 2, y: er.top + er.height / 2, width: er.width, height: er.height },
      map
    )
    const frame = doc.documentElement.getBoundingClientRect()
    const viewportMap = pwCreateViewportMap({
      device,
      viewportWidth: view?.innerWidth || sceneWidth,
      originX: (frame.left || 0) + (frame.width || view?.innerWidth || sceneWidth) / 2,
      originY: frame.top || 0,
    })
    const fixedBox = pwClientBoxToScene(
      { x: er.left + er.width / 2, y: er.top + er.height / 2, width: er.width, height: er.height },
      viewportMap
    )
    const left = mode === 'viewport-fixed' ? fixedBox.x : sceneBox.x
    const top = mode === 'viewport-fixed' ? fixedBox.y : sceneBox.y
    const width = mode === 'viewport-fixed' ? fixedBox.width : sceneBox.width
    const height = mode === 'viewport-fixed' ? fixedBox.height : sceneBox.height
    node.setAttribute(
      PW_CLONE_BOX_ATTR,
      [
        PW_COORDINATE_CONTRACT_VERSION,
        mode,
        Math.round(left * 100000) / 100000,
        Math.round(top * 100000) / 100000,
        Math.round(width * 1000) / 1000,
        Math.round(height * 1000) / 1000,
      ].join(',')
    )
  })
}

export function countSameDeviceCloneTargets<T extends { files: HtmlFile[] }>(
  project: T,
  sourcePath: string
): number {
  return project.files.filter(
    (file) => file.kind === 'html' && shouldReceivePageClone(file.path, sourcePath)
  ).length
}

export function copyPageCloneElementsAcrossSameDevicePages<T extends { files: HtmlFile[] }>(
  project: T,
  sourcePath: string,
  sourceHtml: string,
  opts?: {
    seedMissingHtml?: (path: string, pageKey: PartnerWebsitePageKey) => string
  }
): { project: T; copiedPageCount: number; cloneCount: number; pageKeys: PartnerWebsitePageKey[] } {
  const clones = extractPageClones(sourceHtml)
  if (!clones.length) {
    return { project, copiedPageCount: 0, cloneCount: 0, pageKeys: [] }
  }
  const files = [...project.files]
  const pageKeys: PartnerWebsitePageKey[] = []
  const seen = new Set<string>()

  const write = (path: string, content: string, pageKey: PartnerWebsitePageKey | null) => {
    const index = files.findIndex((file) => file.path === path && file.kind === 'html')
    if (index >= 0) files[index] = { ...files[index], content }
    else files.push({ path, kind: 'html', content })
    if (pageKey && pageKey !== 'home') pageKeys.push(pageKey)
  }

  const applyToPath = (path: string, pageKey: PartnerWebsitePageKey | null) => {
    const norm = path.replace(/\\/g, '/')
    if (seen.has(norm) || !shouldReceivePageClone(norm, sourcePath)) return false
    seen.add(norm)
    const existing = files.find((file) => file.path === norm && file.kind === 'html')?.content || ''
    let current = existing.trim().length >= 40 ? existing : ''
    if (!current && pageKey && opts?.seedMissingHtml) {
      current = opts.seedMissingHtml(norm, pageKey) || ''
    }
    if (current.trim().length < 40) return false
    let next = current
    for (const clone of clones) next = placeCloneOnPage(next, clone)
    if (next === existing && existing.trim().length >= 40) return false
    write(norm, next, pageKey)
    return true
  }

  write(sourcePath.replace(/\\/g, '/'), sourceHtml, visualPageKeyFromHtmlPath(sourcePath))

  let copiedPageCount = 0
  for (const target of sameDeviceCatalogPageTargets(sourcePath)) {
    if (applyToPath(target.path, target.pageKey)) copiedPageCount += 1
  }
  for (const file of project.files) {
    if (file.kind !== 'html') continue
    if (applyToPath(file.path, visualPageKeyFromHtmlPath(file.path))) copiedPageCount += 1
  }

  return {
    project: { ...project, files },
    copiedPageCount,
    cloneCount: clones.length,
    pageKeys: [...new Set(pageKeys)],
  }
}
