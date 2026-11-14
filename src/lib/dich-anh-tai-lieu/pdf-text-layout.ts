export type PdfTextLine = {
  text: string
  x: number
  y: number
  w: number
  h: number
}

export type PdfPageLayout = {
  widthPt: number
  heightPt: number
  lines: PdfTextLine[]
}

function attr(source: string, name: string): number {
  const match = new RegExp(`\\b${name}="([0-9.]+)"`).exec(source)
  return match ? Number(match[1]) : 0
}

function decodeXml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code)
      return Number.isFinite(point) ? String.fromCodePoint(point) : ''
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function lineFromTag(tag: string, inner: string): PdfTextLine | null {
  const words = [...inner.matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/g)]
  const text = (words.length > 0 ? words.map((word) => decodeXml(word[2])).filter(Boolean).join(' ') : decodeXml(inner)).trim()
  if (!text) return null
  const xMin = attr(tag, 'xMin')
  const yMin = attr(tag, 'yMin')
  const xMax = attr(tag, 'xMax')
  const yMax = attr(tag, 'yMax')
  if (xMax <= xMin || yMax <= yMin) return null
  return { text, x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin }
}

/** Đọc XHTML bbox của Poppler. Gốc tọa độ là góc trên trái, đơn vị point. */
export function parsePopplerXhtmlLayout(xhtml: string): PdfPageLayout[] {
  const pages: PdfPageLayout[] = []
  for (const pageMatch of xhtml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)) {
    const tag = pageMatch[1]
    const body = pageMatch[2]
    const lines: PdfTextLine[] = []
    const lineTags = [...body.matchAll(/<line\b([^>]*)>([\s\S]*?)<\/line>/g)]
    if (lineTags.length > 0) {
      for (const lineTag of lineTags) {
        const line = lineFromTag(lineTag[1], lineTag[2])
        if (line) lines.push(line)
      }
    } else {
      for (const wordTag of body.matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/g)) {
        const line = lineFromTag(wordTag[1], wordTag[2])
        if (line) lines.push(line)
      }
    }
    pages.push({
      widthPt: attr(tag, 'width'),
      heightPt: attr(tag, 'height'),
      lines,
    })
  }
  return pages
}
