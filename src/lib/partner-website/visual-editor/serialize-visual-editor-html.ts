const EDITOR_STYLE_ID = 'nanoai-visual-editor-styles'
const EDITOR_SCRIPT_ID = 'nanoai-visual-editor-script'

/** Strip visual-editor artifacts before persisting iframe HTML. */
export function serializeVisualEditorHtml(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement
  clone.querySelector(`#${EDITOR_STYLE_ID}`)?.remove()
  clone.querySelector(`#${EDITOR_SCRIPT_ID}`)?.remove()
  clone.querySelector('#nanoai-pw-logo-guard')?.remove()
  clone.querySelectorAll('script').forEach((el) => {
    const text = el.textContent || ''
    if (
      text.includes('nanoai-partner-site') ||
      text.includes('/personalization') ||
      text.includes('hydrateBlock') ||
      text.includes('data-nanoai-open-chat')
    ) {
      el.remove()
    }
  })
  clone.querySelectorAll('.nanoai-ve-highlight').forEach((el) => {
    el.classList.remove('nanoai-ve-highlight')
  })
  clone.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable')
  })
  clone.querySelectorAll('.nanoai-ve-resize-handle').forEach((el) => el.remove())
  clone.querySelectorAll('[data-nanoai-ve-selected]').forEach((el) => {
    el.removeAttribute('data-nanoai-ve-selected')
  })
  return `<!DOCTYPE html>\n${clone.outerHTML}`
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
