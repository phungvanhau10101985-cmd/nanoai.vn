import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { pinChromeIconBadges } from '@/lib/partner-website/shop/pin-chrome-icon-badges'
import {
  isolateVisualHtmlForDevice,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

const EDITOR_STYLE_ID = 'nanoai-visual-editor-styles'
const EDITOR_SCRIPT_ID = 'nanoai-visual-editor-script'

function resetBottomNavChromeInlineStyles(clone: Element) {
  clone
    .querySelectorAll(
      '.pw-bottom-nav [data-pw-chrome-added], .pw-shop-bottom-nav [data-pw-chrome-added], .pw-bottom-nav > a, .pw-shop-bottom-nav > a'
    )
    .forEach((node) => {
      const el = node as HTMLElement
      if (!el.style) return
      el.style.removeProperty('transform')
      el.style.removeProperty('left')
      el.style.removeProperty('top')
      el.style.removeProperty('right')
      el.style.removeProperty('bottom')
      el.style.removeProperty('position')
      el.style.removeProperty('width')
      el.style.removeProperty('height')
      el.style.removeProperty('inset')
      if (!el.getAttribute('style')?.trim()) el.removeAttribute('style')
    })
}

function stripEditorAndRuntimeNodes(clone: Element) {
  clone.querySelector(`#${EDITOR_STYLE_ID}`)?.remove()
  clone.querySelector(`#${EDITOR_SCRIPT_ID}`)?.remove()
  clone.querySelector('#nanoai-pw-logo-guard')?.remove()
  clone.querySelector('#__NEXT_DATA__')?.remove()
  clone.querySelectorAll('script').forEach((el) => {
    const type = (el.getAttribute('type') || '').toLowerCase()
    if (type === 'application/ld+json') return
    el.remove()
  })
  clone.querySelectorAll('next-route-announcer, template[data-next-error-message]').forEach((el) => el.remove())
  clone.querySelectorAll('link[rel="preload"][as="script"], link[rel="modulepreload"]').forEach((el) => el.remove())
  clone.querySelectorAll('.nanoai-ve-highlight,.nanoai-ve-hover,.nanoai-ve-dragging').forEach((el) => {
    el.classList.remove('nanoai-ve-highlight', 'nanoai-ve-hover', 'nanoai-ve-dragging')
  })
  clone.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable')
  })
  clone
    .querySelectorAll(
      '.nanoai-ve-resize-handle,.nanoai-ve-ignore,.nanoai-ve-chrome-delete,.nanoai-ve-move-handle,.nanoai-ve-delete-handle,.nanoai-ve-drop-line,.nanoai-ve-guides,.nanoai-ve-layer-switch,.nanoai-ve-logo-btn,.nanoai-ve-logo-rect'
    )
    .forEach((el) => el.remove())
  clone.querySelectorAll('[data-nanoai-ve-selected],[data-nanoai-ve-ignore]').forEach((el) => {
    el.removeAttribute('data-nanoai-ve-selected')
    el.removeAttribute('data-nanoai-ve-ignore')
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

function ensureBaseHref(clone: Element, origin: string) {
  if (!origin) return
  const head = clone.querySelector('head')
  if (!head || head.querySelector('base')) return
  const base = clone.ownerDocument?.createElement('base')
  if (!base) return
  base.setAttribute('href', `${origin.replace(/\/$/, '')}/`)
  head.insertBefore(base, head.firstChild)
}

function inlineSameOriginStylesheets(doc: Document, clone: Element) {
  const origin = documentOrigin(doc)
  const byHref = new Map<string, string>()
  for (const sheet of Array.from(doc.styleSheets)) {
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

/** Strip visual-editor artifacts before persisting iframe HTML. */
export function serializeVisualEditorHtml(doc: Document, variant?: VisualDeviceVariant): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement
  stripEditorAndRuntimeNodes(clone)
  resetBottomNavChromeInlineStyles(clone)
  pinChromeIconBadges(clone)
  inlineSameOriginStylesheets(doc, clone)
  ensureViewportMeta(clone)
  ensureBaseHref(clone, documentOrigin(doc))
  const raw = injectPartnerShopChromeLayoutCss(`<!DOCTYPE html>\n${clone.outerHTML}`)
  return variant ? isolateVisualHtmlForDevice(raw, variant) : raw
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
  if (/class=["'][^"']*\b(pw-shop|pw-header|pw-shop-header|pw-hero)\b|data-pw-edit/i.test(withoutIframes)) {
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
