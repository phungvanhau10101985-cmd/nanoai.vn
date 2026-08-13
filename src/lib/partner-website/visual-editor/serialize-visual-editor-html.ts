const EDITOR_STYLE_ID = 'nanoai-visual-editor-styles'
const EDITOR_SCRIPT_ID = 'nanoai-visual-editor-script'

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
      '.nanoai-ve-resize-handle,.nanoai-ve-ignore,.nanoai-ve-chrome-delete,.nanoai-ve-move-handle,.nanoai-ve-delete-handle,.nanoai-ve-drop-line,.nanoai-ve-guides'
    )
    .forEach((el) => el.remove())
  clone.querySelectorAll('[data-nanoai-ve-selected],[data-nanoai-ve-ignore]').forEach((el) => {
    el.removeAttribute('data-nanoai-ve-selected')
    el.removeAttribute('data-nanoai-ve-ignore')
  })
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
export function serializeVisualEditorHtml(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement
  stripEditorAndRuntimeNodes(clone)
  inlineSameOriginStylesheets(doc, clone)
  ensureBaseHref(clone, documentOrigin(doc))
  return `<!DOCTYPE html>\n${clone.outerHTML}`
}

/** Freeze the live React preview into static HTML so Sửa nhanh tools (drag, add, hide…) work. */
export function freezeDocumentForVisualEditor(doc: Document): string {
  return serializeVisualEditorHtml(doc)
}

export function mergeVisualHtmlIntoProject(
  project: { entryPath: string; files: Array<{ path: string; kind: string; content: string }> },
  html: string
): typeof project {
  const entry = project.entryPath || 'index.html'
  let found = false
  const files = project.files.map((f) => {
    if (f.path === entry || (f.kind === 'html' && !found)) {
      found = true
      return { ...f, path: entry, kind: 'html', content: html }
    }
    return f
  })
  if (!found) {
    files.unshift({ path: entry, kind: 'html', content: html })
  }
  return { ...project, entryPath: entry, files }
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
  if (source.length >= 40) return source
  const files = input.project?.files ?? []
  const entry = input.project?.entryPath || 'index.html'
  const hit =
    files.find((f) => f.path === entry && f.kind === 'html') || files.find((f) => f.kind === 'html')
  return hit?.content?.trim() || ''
}
