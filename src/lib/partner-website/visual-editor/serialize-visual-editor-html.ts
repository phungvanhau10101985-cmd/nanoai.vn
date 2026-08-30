import { injectPartnerShopChromeLayoutStyles } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { stampPartnerSiteChromeWidgetHooksInHtml } from '@/lib/partner-website/shop/stamp-partner-site-chrome-widget-hooks'
import { resetChromeCountBadges } from '@/lib/partner-website/shop/chrome-count-badges'
import { stripEmptyLogoPlaceholdersFromHtml } from '@/lib/partner-website/visual-editor/strip-empty-logo-placeholders'
import { pinChromeIconBadges } from '@/lib/partner-website/shop/pin-chrome-icon-badges'
import { releaseStickHeaderPins } from '@/lib/partner-website/shop/stick-header-elements'
import { prepareVisualDomForStore } from '@/lib/partner-website/shop/stay-scroll-elements'
import { stripPartnerInfoPageSeoCoachFromHtml } from '@/lib/partner-website/pages/partner-info-page-advanced-seo'
import {
  ensureVisualHtmlLiveReady,
  isolateVisualHtmlForDevice,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { refreshCloneBoxesInDocument } from '@/lib/partner-website/visual-editor/copy-element-across-pages'
import {
  isInFlowCatalogChromeElement,
  reflowInFlowStackHosts,
} from '@/lib/partner-website/visual-editor/in-flow-catalog-chrome'
import { normalizeVisualCoordinateContract } from '@/lib/partner-website/visual-editor/normalize-visual-coordinate-contract'
import {
  pwCoordinateDevice,
  pwSceneBoxLeftCss,
  pwSceneBoxTopPx,
  pwSceneWidth,
} from '@/lib/partner-website/visual-editor/pw-coordinate-space'

const EDITOR_STYLE_ID = 'nanoai-visual-editor-styles'
const EDITOR_SCRIPT_ID = 'nanoai-visual-editor-script'

function roundCoordinate(value: number, precision = 3): string {
  const factor = 10 ** precision
  return String(Math.round(value * factor) / factor)
}

/**
 * Save is the final authority for authored geometry. Read the box the user is
 * actually seeing so a stale pre-drag data-pw-box cannot overwrite a newer
 * transform when canonical HTML removes transient transforms.
 */
function sceneRootOfDocument(doc: Document): HTMLElement | null {
  const body = doc.body
  if (!body) return null
  const stamped =
    body.querySelector<HTMLElement>('[data-pw-scene-root="1"]') ||
    body.querySelector<HTMLElement>('main, .pw-shop-main, .pw-main')
  if (stamped && stamped !== body) {
    stamped.setAttribute('data-pw-scene-root', '1')
    return stamped
  }
  return body
}

function elementLeftHeaderHost(el: HTMLElement, host: HTMLElement): boolean {
  try {
    const er = el.getBoundingClientRect()
    const hr = host.getBoundingClientRect()
    if (!(er.width > 0) || !(er.height > 0)) return false
    const overlapX = Math.min(er.right, hr.right) - Math.max(er.left, hr.left)
    const overlapY = Math.min(er.bottom, hr.bottom) - Math.max(er.top, hr.top)
    const overlap = Math.max(0, overlapX) * Math.max(0, overlapY)
    return overlap < er.width * er.height * 0.45
  } catch {
    return el.getAttribute('data-pw-user-move') === '1'
  }
}

function isHeaderLogoElement(el: HTMLElement): boolean {
  if (
    el.getAttribute('data-pw-logo-float') === '1' ||
    el.getAttribute('data-pw-logo-floated') === '1' ||
    el.getAttribute('data-pw-logo-frame') === '1' ||
    el.getAttribute('data-pw-logo-home') === '1' ||
    el.getAttribute('data-pw-el') === 'logo' ||
    el.getAttribute('data-pw-logo-added') === '1'
  ) {
    return true
  }
  const cls = ` ${el.className || ''} `
  if (
    cls.includes(' pw-logo ') ||
    cls.includes(' pw-shop-logo ') ||
    cls.includes(' pw-logo-frame ') ||
    cls.includes(' pw-brand ') ||
    cls.includes(' pw-shop-brand ')
  ) {
    return true
  }
  return !!el.closest?.(
    '[data-pw-logo-float="1"],[data-pw-logo-frame="1"],.pw-logo-frame,a.pw-brand,a.pw-shop-brand,a[data-pw-logo-home]'
  )
}

function shouldKeepHeaderChromeInPlace(el: HTMLElement): boolean {
  if (el.getAttribute('data-pw-chrome-float') === '1') return false
  if (el.getAttribute('data-pw-added-text') === '1') return false
  if (el.getAttribute('data-pw-added-btn') === '1') return false
  if (el.getAttribute('data-pw-added-bg') === '1') return false
  if (el.getAttribute('data-pw-chrome-added') === '1') return false
  if (isHeaderLogoElement(el)) return true
  const header = el.closest<HTMLElement>('header, .pw-header, .pw-shop-header')
  if (!header) return false
  return !elementLeftHeaderHost(el, header)
}

function refreshMovedElementPlacementsInDocument(
  doc: Document,
  variant?: VisualDeviceVariant
): void {
  const body = doc.body
  const sceneRoot = sceneRootOfDocument(doc)
  if (!body || !sceneRoot) return
  reflowInFlowStackHosts(sceneRoot)
  const device = pwCoordinateDevice(
    variant ||
      doc.documentElement.getAttribute('data-pw-edit-device') ||
      doc.documentElement.getAttribute('data-pw-scene-lock')
  )
  const sceneWidth = pwSceneWidth(device)
  let sceneRect: DOMRect
  try {
    sceneRect = sceneRoot.getBoundingClientRect()
  } catch {
    return
  }
  const viewportWidth =
    doc.defaultView?.innerWidth || doc.documentElement.clientWidth || sceneWidth
  const viewportScale = viewportWidth > 8 ? viewportWidth / sceneWidth : 1

  doc
    .querySelectorAll<HTMLElement>(
      '[data-pw-user-move="1"],[data-pw-placement="scene-absolute"],[data-pw-placement="viewport-fixed"]'
    )
    .forEach((el) => {
      const fixed =
        el.getAttribute('data-pw-placement') === 'viewport-fixed' ||
        el.getAttribute('data-pw-stay-scroll') === '1' ||
        el.getAttribute('data-pw-pin-screen') === '1' ||
        el.getAttribute('data-pw-chrome-float') === '1'
      if (
        el.closest(
          '.pw-bottom-nav,.pw-shop-bottom-nav,[data-pw-pdp-bottom],[data-pw-stay-layer],[data-pw-live-fixed-layer]'
        ) &&
        el.getAttribute('data-pw-placement') !== 'viewport-fixed'
      ) {
        return
      }
      if (
        el.closest('[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]') ||
        (el.getAttribute('data-pw-chrome-float') === '1' && el.getAttribute('data-pw-chrome-kit') === '1')
      ) {
        return
      }
      if (isHeaderLogoElement(el)) return
      if (isInFlowCatalogChromeElement(el)) return
      if (!fixed && shouldKeepHeaderChromeInPlace(el)) return
      let rect: DOMRect
      try {
        rect = el.getBoundingClientRect()
      } catch {
        return
      }
      if (!(rect.width > 0) || !(rect.height > 0)) return
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      if (fixed) {
        el.setAttribute('data-pw-placement', 'viewport-fixed')
        el.setAttribute('data-pw-fixed-x', roundCoordinate((centerX - viewportWidth / 2) / viewportScale))
        el.setAttribute('data-pw-fixed-y', roundCoordinate(centerY / viewportScale))
        el.setAttribute('data-pw-fixed-w', roundCoordinate(rect.width / viewportScale))
        el.setAttribute('data-pw-fixed-h', roundCoordinate(rect.height / viewportScale))
        return
      }
      const placementRootRect = sceneRect.width > 8
        ? sceneRect
        : ({
            left: 0,
            top: 0,
            width: viewportWidth,
            height: doc.documentElement.scrollHeight,
          } as DOMRect)
      const rootScale =
        placementRootRect.width > 8 ? placementRootRect.width / sceneWidth : 1
      const rootOriginX = placementRootRect.left + placementRootRect.width / 2
      const rootOriginY = placementRootRect.top
      const x = (centerX - rootOriginX) / rootScale
      const y = (centerY - rootOriginY) / rootScale
      const width = rect.width / rootScale
      const height = rect.height / rootScale
      const formerHeader = el.closest<HTMLElement>('header,.pw-header,.pw-shop-header')
      const formerHeaderMain =
        formerHeader?.querySelector<HTMLElement>('.pw-header-main,.pw-shop-header-inner') ||
        formerHeader
      if (formerHeaderMain && formerHeaderMain !== el) {
        const hostRect = formerHeaderMain.getBoundingClientRect()
        const reservedHeight = hostRect.height / rootScale
        const existingMin = Number.parseFloat(formerHeaderMain.style.minHeight || '0') || 0
        if (reservedHeight > existingMin) {
          formerHeaderMain.style.setProperty(
            'min-height',
            `${roundCoordinate(reservedHeight)}px`,
            'important'
          )
        }
      }
      if (el.parentElement !== sceneRoot) sceneRoot.appendChild(el)
      el.setAttribute('data-pw-placement', 'scene-absolute')
      el.setAttribute('data-pw-coordinate-root', 'scene')
      el.setAttribute('data-pw-box-x', roundCoordinate(x))
      el.setAttribute('data-pw-box-y', roundCoordinate(y))
      el.setAttribute('data-pw-box-w', roundCoordinate(width))
      el.setAttribute('data-pw-box-h', roundCoordinate(height))
      el.style.setProperty('position', 'absolute', 'important')
      el.style.setProperty('left', pwSceneBoxLeftCss(x, width), 'important')
      el.style.setProperty('top', `${pwSceneBoxTopPx(y, height)}px`, 'important')
      el.style.setProperty('right', 'auto', 'important')
      el.style.setProperty('bottom', 'auto', 'important')
      el.style.setProperty('transform', 'none', 'important')
      el.style.setProperty('margin', '0', 'important')
      if (width > 0) el.style.setProperty('width', `${roundCoordinate(width)}px`, 'important')
      if (height > 0) el.style.setProperty('height', `${roundCoordinate(height)}px`, 'important')
    })
}

function removeRuntimeNode(el: Element | null): void {
  if (!el) return
  const previous = el.previousSibling
  el.remove()
  if (previous?.nodeType === 3 && !String(previous.textContent || '').trim()) {
    previous.parentNode?.removeChild(previous)
  }
}

function restoreDeferredPdpGalleryMedia(clone: Element) {
  clone.querySelectorAll('img[data-pw-deferred-src]').forEach((img) => {
    const url = img.getAttribute('data-pw-deferred-src')
    if (url) img.setAttribute('src', url)
    img.removeAttribute('data-pw-deferred-src')
  })
}

function stripEditorAndRuntimeNodes(clone: Element) {
  restoreDeferredPdpGalleryMedia(clone)
  removeRuntimeNode(clone.querySelector(`#${EDITOR_STYLE_ID}`))
  removeRuntimeNode(clone.querySelector(`#${EDITOR_SCRIPT_ID}`))
  removeRuntimeNode(clone.querySelector('#nanoai-ve-hover-name'))
  removeRuntimeNode(clone.querySelector('#nanoai-pw-overlay-style'))
  removeRuntimeNode(clone.querySelector('#nanoai-pw-logo-guard'))
  removeRuntimeNode(clone.querySelector('#pw-catalog-card-css'))
  removeRuntimeNode(clone.querySelector('#pw-related-css'))
  removeRuntimeNode(clone.querySelector('#pw-outfit-css'))
  removeRuntimeNode(clone.querySelector('#__NEXT_DATA__'))
  clone.querySelectorAll('script').forEach((el) => {
    const type = (el.getAttribute('type') || '').toLowerCase()
    if (type === 'application/ld+json') return
    removeRuntimeNode(el)
  })
  clone.querySelectorAll('next-route-announcer, template[data-next-error-message]').forEach((el) => el.remove())
  clone.querySelectorAll('link[rel="preload"][as="script"], link[rel="modulepreload"]').forEach((el) => el.remove())
  clone.querySelectorAll('[data-pw-ve-chat-preview]').forEach((el) => el.remove())
  clone.querySelectorAll('[data-pw-seo-coach],[data-pw-article-editor]').forEach((el) => el.remove())
  clone.querySelectorAll('[data-pw-article-box]').forEach((el) => el.removeAttribute('data-pw-article-box'))
  const footer = clone.querySelector('footer, .pw-footer, .pw-shop-footer, [data-pw-region="footer"]')
  if (footer) {
    clone.querySelectorAll('[data-pw-info-article],[data-pw-info-body],[data-pw-region="content"][data-pw-text-article]').forEach((el) => {
      if (el === footer || footer.contains(el) || el.contains(footer)) return
      try {
        if (el.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_PRECEDING) el.remove()
      } catch {
        /* ignore */
      }
    })
  }
  clone
    .querySelectorAll(
      '.nanoai-ve-active,.nanoai-ve-selected,.nanoai-ve-highlight,.nanoai-ve-hover,.nanoai-ve-dragging,.nanoai-ve-photo-edit,.nanoai-ve-paper-pan,.nanoai-ve-chrome-dup'
    )
    .forEach((el) => {
      el.classList.remove(
        'nanoai-ve-active',
        'nanoai-ve-selected',
        'nanoai-ve-highlight',
        'nanoai-ve-hover',
        'nanoai-ve-dragging',
        'nanoai-ve-photo-edit',
        'nanoai-ve-paper-pan',
        'nanoai-ve-chrome-dup'
      )
      if (!el.getAttribute('class')?.trim()) el.removeAttribute('class')
    })
  clone.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable')
  })
  clone.querySelectorAll('[data-pw-edit-placeholder]').forEach((el) => {
    if (el instanceof HTMLInputElement) {
      const typed = el.value.trim()
      if (typed) el.setAttribute('placeholder', typed)
      el.value = ''
      el.removeAttribute('value')
    }
    el.removeAttribute('data-pw-edit-placeholder')
  })
  clone
    .querySelectorAll(
      '.nanoai-ve-resize-handle,.nanoai-ve-ignore,.nanoai-ve-chrome-delete,.nanoai-ve-move-handle,.nanoai-ve-delete-handle,.nanoai-ve-drop-line,.nanoai-ve-guides,.nanoai-ve-layer-switch,.nanoai-ve-logo-btn,.nanoai-ve-logo-rect,.nanoai-ve-gap-plus,.nanoai-ve-gap-pluses'
    )
    .forEach((el) => el.remove())
  clone.querySelectorAll('[data-nanoai-ve-selected],[data-nanoai-ve-ignore]').forEach((el) => {
    el.removeAttribute('data-nanoai-ve-selected')
    el.removeAttribute('data-nanoai-ve-ignore')
  })
  clone.querySelectorAll('[data-pw-ve-dup-center]').forEach((el) => {
    const pos = el.getAttribute('data-pw-ve-dup-pos')
    const left = el.getAttribute('data-pw-ve-dup-left')
    const top = el.getAttribute('data-pw-ve-dup-top')
    const right = el.getAttribute('data-pw-ve-dup-right')
    const bottom = el.getAttribute('data-pw-ve-dup-bottom')
    const z = el.getAttribute('data-pw-ve-dup-z')
    const tf = el.getAttribute('data-pw-ve-dup-tf')
    const mg = el.getAttribute('data-pw-ve-dup-mg')
    const hadMove = el.getAttribute('data-pw-ve-dup-had-move')
    if (el instanceof HTMLElement) {
      if (pos) el.style.position = pos
      else el.style.removeProperty('position')
      if (left) el.style.left = left
      else el.style.removeProperty('left')
      if (top) el.style.top = top
      else el.style.removeProperty('top')
      if (right) el.style.right = right
      else el.style.removeProperty('right')
      if (bottom) el.style.bottom = bottom
      else el.style.removeProperty('bottom')
      if (z) el.style.zIndex = z
      else el.style.removeProperty('z-index')
      if (tf) el.style.transform = tf
      else el.style.removeProperty('transform')
      if (mg) el.style.margin = mg
      else el.style.removeProperty('margin')
    }
    el.removeAttribute('data-pw-ve-dup-center')
    el.removeAttribute('data-pw-ve-dup-left')
    el.removeAttribute('data-pw-ve-dup-top')
    el.removeAttribute('data-pw-ve-dup-right')
    el.removeAttribute('data-pw-ve-dup-bottom')
    el.removeAttribute('data-pw-ve-dup-pos')
    el.removeAttribute('data-pw-ve-dup-z')
    el.removeAttribute('data-pw-ve-dup-tf')
    el.removeAttribute('data-pw-ve-dup-mg')
    el.removeAttribute('data-pw-ve-dup-had-move')
    if (hadMove !== '1') el.removeAttribute('data-pw-user-move')
  })
}

function ensureViewportMeta(clone: Element) {
  const head = clone.querySelector('head')
  if (!head || head.querySelector('meta[name="viewport"]')) return
  const meta = clone.ownerDocument?.createElement('meta')
  if (!meta) return
  meta.setAttribute('name', 'viewport')
  meta.setAttribute('content', 'width=device-width, initial-scale=1')
  head.insertBefore(meta, head.firstChild)
}

function ensureBaseHref(clone: Element) {
  const head = clone.querySelector('head')
  if (!head) return
  const existing = head.querySelector('base')
  // Root-relative base stays valid on custom domains. An origin like https://nanoai.vn/
  // makes inner-page clicks leave the customer host and fail inside an iframe
  // (Chrome: "nanoai.vn refused to connect" / X-Frame-Options SAMEORIGIN).
  if (existing) {
    existing.setAttribute('href', '/')
    return
  }
  const base = clone.ownerDocument?.createElement('base')
  if (!base) return
  base.setAttribute('href', '/')
  head.insertBefore(base, head.firstChild)
}

function stripExecutableScriptsFromStoredHtml(html: string): string {
  return html.replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, (full, attrs: string) => {
    return /\btype=(["'])application\/ld\+json\1/i.test(attrs) ? full : ''
  })
}

function collapseEmptyInterTagLines(html: string): string {
  return html.replace(/>(?:[ \t]*\r?\n){2,}[ \t]*(?=<)/g, '>\n')
}

function inlineSameOriginStylesheets(doc: Document, clone: Element) {
  const origin = documentOrigin(doc)
  const byHref = new Map<string, string>()
  for (const sheet of doc.styleSheets ? Array.from(doc.styleSheets) : []) {
    let href = ''
    try {
      href = sheet.href || ''
    } catch {
      continue
    }
    if (!href) continue
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      if (css.trim()) byHref.set(href, css)
    } catch {
      /* unreadable sheet */
    }
  }
  clone.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href') || ''
    if (!href) return
    let css = ''
    try {
      const abs = origin ? new URL(href, `${origin}/`).href : href
      css = byHref.get(abs) || ''
    } catch {
      css = ''
    }
    if (!css) {
      for (const [sheetHref, text] of byHref) {
        if (sheetHref.includes(href) || href.includes(sheetHref)) {
          css = text
          break
        }
      }
    }
    if (!css) return
    const style = (clone.ownerDocument || doc).createElement('style')
    style.setAttribute('data-inlined-href', href)
    style.textContent = css
    link.replaceWith(style)
  })
}

function documentOrigin(doc: Document): string {
  try {
    const loc = doc.location
    if (loc?.protocol === 'http:' || loc?.protocol === 'https:') return loc.origin
  } catch {
    /* srcdoc */
  }
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return ''
}

/**
 * Strip visual-editor artifacts before persisting iframe HTML.
 *
 * Saving must not change layout. Only editor overlays, scroll-transient pins and
 * live-data values may be touched here — anything that clamps or reseats authored
 * geometry belongs in the editor runtime, where the user can see it happen.
 */
export function serializeVisualEditorHtml(doc: Document, variant?: VisualDeviceVariant): string {
  refreshMovedElementPlacementsInDocument(doc, variant)
  refreshCloneBoxesInDocument(doc)
  const clone = doc.documentElement.cloneNode(true) as HTMLElement
  prepareVisualDomForStore(clone)
  stripEditorAndRuntimeNodes(clone)
  releaseStickHeaderPins(clone)
  pinChromeIconBadges(clone)
  resetChromeCountBadges(clone)
  inlineSameOriginStylesheets(doc, clone)
  ensureViewportMeta(clone)
  ensureBaseHref(clone)
  const raw = injectPartnerShopChromeLayoutStyles(
    stripEmptyLogoPlaceholdersFromHtml(
      stripPartnerInfoPageSeoCoachFromHtml(`<!DOCTYPE html>\n${clone.outerHTML}`)
    )
  )
  const canonical = normalizeVisualCoordinateContract(raw, {
    variant,
    writeCanonicalOnly: true,
  })
  const stored = collapseEmptyInterTagLines(
    sanitizeVisualHtmlForStore(
      stripExecutableScriptsFromStoredHtml(stampPartnerSiteChromeWidgetHooksInHtml(canonical))
    )
  )
  if (!variant) return stored
  // Always persist the isolated device document. Falling back to `stored` can write a
  // composed desktop+laptop+tablet+mobile page into a single device file.
  return collapseEmptyInterTagLines(
    sanitizeVisualHtmlForStore(
      normalizeVisualCoordinateContract(
        ensureVisualHtmlLiveReady(isolateVisualHtmlForDevice(stored, variant), variant),
        { variant, writeCanonicalOnly: true }
      )
    )
  )
}

/** Postgres jsonb/text reject NUL; strip before persist. */
export function sanitizeVisualHtmlForStore(html: string): string {
  return String(html || '').replace(/\u0000/g, '')
}

/** Freeze the live React preview into static HTML so Sửa nhanh tools (drag, add, hide…) work. */
export function freezeDocumentForVisualEditor(doc: Document, variant?: VisualDeviceVariant): string {
  return serializeVisualEditorHtml(doc, variant)
}

export function mergeVisualHtmlIntoProject(
  project: { entryPath: string; files: Array<{ path: string; kind: string; content: string }> },
  html: string,
  htmlPath?: string
): typeof project {
  const path = (htmlPath || 'index.html').trim() || 'index.html'
  let found = false
  const files = project.files.map((f) => {
    if (f.path === path && f.kind === 'html') {
      found = true
      return { ...f, content: html }
    }
    return f
  })
  if (!found) {
    files.push({ path, kind: 'html', content: html })
  }
  return { ...project, files }
}

export function stubVisualEditorProject(htmlSource?: string | null): {
  entryPath: string
  files: Array<{ path: string; kind: 'html'; content: string }>
} {
  return {
    entryPath: 'index.html',
    files: [
      {
        path: 'index.html',
        kind: 'html',
        content: htmlSource?.trim() || '<!DOCTYPE html><html><body></body></html>',
      },
    ],
  }
}

export function resolveSavedVisualEditorHtml(input: {
  htmlSource?: string | null
  project?: { entryPath?: string; files?: Array<{ path: string; kind: string; content: string }> } | null
}): string {
  const source = input.htmlSource?.trim() || ''
  if (visualHtmlLooksUsable(source)) return source
  const files = input.project?.files ?? []
  const entry = input.project?.entryPath || 'index.html'
  const hit =
    files.find((f) => f.path === entry && f.kind === 'html') || files.find((f) => f.kind === 'html')
  const fileHtml = hit?.content?.trim() || ''
  return visualHtmlLooksUsable(fileHtml) ? fileHtml : ''
}

/** Stub / empty body must not open Sửa nhanh as a blank white page. */
export function visualHtmlLooksUsable(html: string): boolean {
  const s = html.trim()
  if (s.length < 40) return false
  const body = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? s
  const content = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  if (!content.trim()) return false
  const withoutIframes = content
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
  if (
    /class=["'][^"']*\b(pw-shop|pw-header|pw-shop-header|pw-hero)\b|data-pw-edit|data-pw-region|data-pw-page/i.test(
      withoutIframes
    )
  ) {
    return true
  }
  const text = withoutIframes
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (
    text.length >= 4 &&
    /<(h[1-6]|p|div|span|a|img|svg|section|header|main|nav|article)\b/i.test(withoutIframes)
  )
}
