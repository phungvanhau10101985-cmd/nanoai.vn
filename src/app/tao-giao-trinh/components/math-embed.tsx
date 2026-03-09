'use client'

/**
 * Nhúng GeoGebra và Desmos vào slide/worksheet.
 * - GeoGebra: [geogebra:material_id] hoặc [geogebra:url]
 * - Desmos: [desmos:graph_url] – dùng link share từ desmos.com/calculator
 */

export interface MathEmbedProps {
  type: 'geogebra' | 'desmos'
  urlOrId: string
  width?: number
  height?: number
  className?: string
}

export function MathEmbed({ type, urlOrId, width = 600, height = 400, className = '' }: MathEmbedProps) {
  const src = getEmbedSrc(type, urlOrId)
  if (!src) return null

  return (
    <div className={`my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 ${className}`}>
      <iframe
        src={src}
        width={width}
        height={height}
        className="w-full border-0"
        allowFullScreen
        allow="fullscreen"
        title={type === 'geogebra' ? 'GeoGebra' : 'Desmos'}
      />
    </div>
  )
}

function getEmbedSrc(type: 'geogebra' | 'desmos', urlOrId: string): string | null {
  const raw = urlOrId.trim()
  if (!raw) return null

  if (type === 'geogebra') {
    if (raw.startsWith('http') && raw.includes('geogebra.org')) {
      return raw.includes('?embed') ? raw : raw + (raw.includes('?') ? '&embed' : '?embed')
    }
    const calculatorMatch = raw.match(/geogebra\.org\/calculator\/([a-zA-Z0-9]+)/)
    const materialMatch = raw.match(/geogebra\.org\/m\/([a-zA-Z0-9]+)/)
    const idMatch = raw.match(/\/([a-zA-Z0-9]{6,})\/?(\?|$)/)
    const id = calculatorMatch?.[1] ?? materialMatch?.[1] ?? idMatch?.[1] ?? (raw.length < 25 ? raw : null)
    if (id) {
      return `https://www.geogebra.org/calculator/${id}?embed`
    }
    return `https://www.geogebra.org/calculator/${raw}?embed`
  }

  if (type === 'desmos') {
    const graphMatch = raw.match(/desmos\.com\/calculator\/([a-zA-Z0-9]+)/)
    const id = graphMatch?.[1] ?? (raw.startsWith('http') ? null : raw)
    if (id) {
      return `https://www.desmos.com/calculator/${id}?embed`
    }
    if (raw.startsWith('https://www.desmos.com/')) return raw.includes('?embed') ? raw : `${raw}?embed`
    return null
  }

  return null
}

/** Parse nội dung tìm [geogebra:...] hoặc [desmos:...] */
export function parseMathEmbeds(content: string): Array<{ type: 'geogebra' | 'desmos'; urlOrId: string; index: number }> {
  const embeds: Array<{ type: 'geogebra' | 'desmos'; urlOrId: string; index: number }> = []
  const geogebraRe = /\[geogebra:\s*([^\]]+)\]/gi
  const desmosRe = /\[desmos:\s*([^\]]+)\]/gi

  let m: RegExpExecArray | null
  while ((m = geogebraRe.exec(content)) !== null) {
    embeds.push({ type: 'geogebra', urlOrId: m[1].trim(), index: m.index })
  }
  while ((m = desmosRe.exec(content)) !== null) {
    embeds.push({ type: 'desmos', urlOrId: m[1].trim(), index: m.index })
  }

  return embeds.sort((a, b) => a.index - b.index)
}

/** Chia nội dung thành các phần: text | embed. rawMarker dùng để xóa chính xác. */
export function splitContentWithEmbeds(content: string): Array<{ type: 'text'; value: string } | { type: 'embed'; embedType: 'geogebra' | 'desmos'; urlOrId: string; rawMarker: string }> {
  const embeds = parseMathEmbeds(content)
  if (embeds.length === 0) return [{ type: 'text', value: content }]

  const parts: Array<{ type: 'text'; value: string } | { type: 'embed'; embedType: 'geogebra' | 'desmos'; urlOrId: string; rawMarker: string }> = []
  const geogebraRe = /\[geogebra:\s*([^\]]+)\]/gi
  const desmosRe = /\[desmos:\s*([^\]]+)\]/gi

  let lastEnd = 0
  const allMatches: Array<{ start: number; end: number; type: 'geogebra' | 'desmos'; urlOrId: string; rawMarker: string }> = []

  let m: RegExpExecArray | null
  while ((m = geogebraRe.exec(content)) !== null) {
    allMatches.push({ start: m.index, end: m.index + m[0].length, type: 'geogebra', urlOrId: m[1].trim(), rawMarker: m[0] })
  }
  while ((m = desmosRe.exec(content)) !== null) {
    allMatches.push({ start: m.index, end: m.index + m[0].length, type: 'desmos', urlOrId: m[1].trim(), rawMarker: m[0] })
  }
  allMatches.sort((a, b) => a.start - b.start)

  for (const match of allMatches) {
    if (match.start > lastEnd) {
      parts.push({ type: 'text', value: content.slice(lastEnd, match.start) })
    }
    parts.push({ type: 'embed', embedType: match.type, urlOrId: match.urlOrId, rawMarker: match.rawMarker })
    lastEnd = match.end
  }
  if (lastEnd < content.length) {
    parts.push({ type: 'text', value: content.slice(lastEnd) })
  }

  return parts
}
