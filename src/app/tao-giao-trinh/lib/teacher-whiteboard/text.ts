import type { WhiteboardText } from './types'

export const WHITEBOARD_TEXT_SIZE = 28
export const WHITEBOARD_TEXT_WIDTH = 320
export const WHITEBOARD_TEXT_SIZES = [20, 28, 40] as const
const LINE = 1.35

export function textLineHeight(size: number): number {
  return Math.max(1, size) * LINE
}

function charWidth(ch: string, size: number): number {
  if (ch === ' ' || ch === '\t') return size * 0.33
  const code = ch.codePointAt(0) ?? 0
  const wide = (code >= 0x1100 && code <= 0x11ff)
    || (code >= 0x2e80 && code <= 0x9fff)
    || (code >= 0xac00 && code <= 0xd7af)
    || (code >= 0xff00 && code <= 0xffef)
  return wide ? size : size * 0.55
}

/** Xuống dòng theo bề rộng khung. Giữ mỗi lần Enter của người viết. */
export function wrapTextLines(text: string, width: number, size: number): string[] {
  const limit = Math.max(size, width)
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para) {
      out.push('')
      continue
    }
    let line = ''
    let used = 0
    for (const ch of para) {
      const w = charWidth(ch, size)
      if (line && used + w > limit) {
        out.push(line.replace(/ +$/g, ''))
        line = ch === ' ' ? '' : ch
        used = ch === ' ' ? 0 : w
      } else {
        line += ch
        used += w
      }
    }
    out.push(line.replace(/ +$/g, ''))
  }
  return out.length > 0 ? out : ['']
}

function lineInkWidth(line: string, size: number): number {
  let used = 0
  for (const ch of line) used += charWidth(ch, size)
  return used
}

/** Khung ôm sát nét chữ, không lấy cả bề rộng ô soạn. */
export function textWorldBox(obj: Pick<WhiteboardText, 'text' | 'x' | 'y' | 'width' | 'size'>): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const lines = wrapTextLines(obj.text || '', obj.width, obj.size)
  const shown = lines.length > 0 ? lines : ['']
  let ink = 0
  for (const line of shown) ink = Math.max(ink, lineInkWidth(line, obj.size))
  const pad = obj.size * 0.08
  const height = (Math.max(1, shown.length) - 1) * textLineHeight(obj.size) + obj.size
  return {
    minX: obj.x - pad,
    minY: obj.y - pad,
    maxX: obj.x + Math.max(ink, obj.size * 0.35) + pad,
    maxY: obj.y + height + pad,
  }
}
