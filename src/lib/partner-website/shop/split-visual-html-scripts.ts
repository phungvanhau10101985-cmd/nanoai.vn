/**
 * Live visual HTML is streamed as a Server Component. Scripts inside
 * `dangerouslySetInnerHTML` do not run; hoist them to real `<script>` tags.
 * JSON-LD stays in markup.
 */

export type VisualHtmlHoistedScript = {
  src: string
  defer: boolean
  async: boolean
  id: string
  type: string
  body: string
  dataAttrs: Array<[string, string]>
}

const EXECUTABLE_TYPE = /^(?:text\/javascript|application\/javascript|module|)$/i

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) {
    const name = match[1].toLowerCase()
    if (name === '/') continue
    out[name] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return out
}

export function splitVisualHtmlBodyScripts(body: string): {
  markup: string
  scripts: VisualHtmlHoistedScript[]
} {
  const scripts: VisualHtmlHoistedScript[] = []
  const markup = String(body || '').replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, rawAttrs: string, inner: string) => {
      const attrs = parseAttrs(rawAttrs)
      const type = String(attrs.type || '').trim()
      if (type && !EXECUTABLE_TYPE.test(type)) return full
      const dataAttrs = Object.entries(attrs).filter(([name]) => name.startsWith('data-'))
      scripts.push({
        src: String(attrs.src || '').trim(),
        defer: 'defer' in attrs,
        async: 'async' in attrs,
        id: String(attrs.id || '').trim(),
        type,
        body: String(inner || ''),
        dataAttrs,
      })
      return ''
    }
  )
  return { markup, scripts }
}
