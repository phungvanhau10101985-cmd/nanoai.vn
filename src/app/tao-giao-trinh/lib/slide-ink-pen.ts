import type { SlideInkLine } from './slide-infographic'

export type SlideInkBand = { x: number; y: number; w: number; h: number }

export type SlideInkPenFrame = {
  enabled: boolean
  playing: boolean
  imageUrl: string
  bands: SlideInkBand[]
  pen: { x: number; y: number } | null
}

type InkBox = {
  lines: SlideInkLine[]
  contentLeft: number
  contentRight: number
  contentTop: number
  contentBottom: number
  left: number
  right: number
  top: number
  bottom: number
  segment: number
  chars: number
}

function foldLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function lineChars(line: SlideInkLine): number {
  return Math.max(1, line.text.replace(/\s/g, '').length)
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function headerIndexOf(line: SlideInkLine, foldedHeaders: string[]): number {
  const text = foldLabel(line.text)
  if (!text) return -1
  for (let index = 0; index < foldedHeaders.length; index += 1) {
    const header = foldedHeaders[index]
    if (!header || header.length < 2) continue
    if (text === header || (text.includes(header) && text.length <= header.length + 4)) return index
  }
  return -1
}

function boundsOf(lines: SlideInkLine[]) {
  let contentLeft = Infinity
  let contentRight = -Infinity
  let contentTop = Infinity
  let contentBottom = -Infinity
  for (const line of lines) {
    contentLeft = Math.min(contentLeft, line.x)
    contentRight = Math.max(contentRight, line.x + line.w)
    contentTop = Math.min(contentTop, line.y)
    contentBottom = Math.max(contentBottom, line.y + line.h)
  }
  return { contentLeft, contentRight, contentTop, contentBottom }
}

function makeBox(lines: SlideInkLine[]): InkBox {
  const content = boundsOf(lines)
  const chars = lines.reduce((sum, line) => sum + lineChars(line), 0)
  return {
    lines,
    ...content,
    left: content.contentLeft,
    right: content.contentRight,
    top: content.contentTop,
    bottom: content.contentBottom,
    segment: 0,
    chars: Math.max(1, chars),
  }
}

function groupByGap(lines: SlideInkLine[], cut: number): SlideInkLine[][] {
  const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x)
  const groups: SlideInkLine[][] = []
  for (const line of sorted) {
    const current = groups[groups.length - 1]
    if (!current) {
      groups.push([line])
      continue
    }
    const bottom = Math.max(...current.map((item) => item.y + item.h))
    if (line.y - bottom > cut) groups.push([line])
    else current.push(line)
  }
  return groups.filter((group) => group.length > 0)
}

function clusterParagraphs(lines: SlideInkLine[], foldedHeaders: string[], medianH: number, height: number): SlideInkLine[][] {
  const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x)
  const groups: SlideInkLine[][] = []
  const cut = Math.max(medianH * 1.55, height * 0.045)
  for (const line of sorted) {
    const current = groups[groups.length - 1]
    if (!current) {
      groups.push([line])
      continue
    }
    const box = boundsOf(current)
    const gap = line.y - box.contentBottom
    const xOverlap = line.x < box.contentRight + medianH && box.contentLeft < line.x + line.w + medianH
    const header = headerIndexOf(line, foldedHeaders)
    const startsHeader = header >= 0 && current.some((existing) => headerIndexOf(existing, foldedHeaders) !== header)
    if (startsHeader || gap > cut || !xOverlap) groups.push([line])
    else current.push(line)
  }
  return groups
}

function nearestParagraph(line: SlideInkLine, groups: SlideInkLine[][]): SlideInkLine[] | null {
  let best: SlideInkLine[] | null = null
  let bestDist = Infinity
  const center = line.y + line.h / 2
  for (const group of groups) {
    const box = boundsOf(group)
    const dist = center < box.contentTop
      ? box.contentTop - center
      : center > box.contentBottom
        ? center - box.contentBottom
        : 0
    if (dist < bestDist) {
      bestDist = dist
      best = group
    }
  }
  return best
}

function splitAtCardGutters(lines: SlideInkLine[], paragraphs: InkBox[], height: number): SlideInkLine[][] {
  if (lines.length <= 1 || paragraphs.length <= 1) return lines.length ? [lines] : []
  const cards = [...paragraphs].sort((a, b) => a.contentTop - b.contentTop)
  const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x)
  const groups: SlideInkLine[][] = [[sorted[0]]]
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]
    const line = sorted[index]
    const gapTop = prev.y + prev.h
    const gapBottom = line.y
    const splitsCard = cards.some((card, cardIndex) => {
      const next = cards[cardIndex + 1]
      if (!next || next.contentTop - card.contentBottom < height * 0.03) return false
      return gapTop <= card.contentBottom + 6 && gapBottom >= next.contentTop - 6
    })
    if (splitsCard && gapBottom - gapTop > height * 0.04) groups.push([])
    groups[groups.length - 1].push(line)
  }
  return groups.filter((group) => group.length > 0)
}

function stretchBeside(box: InkBox, paragraphs: InkBox[]) {
  const center = (box.contentLeft + box.contentRight) / 2
  let top = box.contentTop
  let bottom = box.contentBottom
  let hit = false
  for (const card of paragraphs) {
    const cardCenter = (card.contentLeft + card.contentRight) / 2
    if (Math.abs(cardCenter - center) < Math.max(48, (box.contentRight - box.contentLeft) * 0.2)) continue
    const overlap = Math.min(box.contentBottom, card.contentBottom) - Math.max(box.contentTop, card.contentTop)
    if (overlap <= 0) continue
    hit = true
    top = Math.min(top, card.contentTop)
    bottom = Math.max(bottom, card.contentBottom)
  }
  if (!hit) return
  box.contentTop = top
  box.contentBottom = bottom
}

function buildBoxes(lines: SlideInkLine[], width: number, height: number, headers: string[]): InkBox[] {
  const medianH = median(lines.map((line) => line.h)) || height * 0.04
  const folded = headers.map((header) => foldLabel(header))
  const banners: SlideInkLine[] = []
  const texts: SlideInkLine[] = []
  const shorts: SlideInkLine[] = []
  for (const line of lines) {
    const chars = line.text.replace(/\s/g, '').length
    if (headerIndexOf(line, folded) < 0 && line.w >= width * 0.58) banners.push(line)
    else if (headerIndexOf(line, folded) >= 0 || line.w >= width * 0.18 || chars >= 16) texts.push(line)
    else shorts.push(line)
  }
  const paragraphLines = clusterParagraphs(texts, folded, medianH, height)
  const loose: SlideInkLine[] = []
  const draftBoxes = paragraphLines.map((group) => boundsOf(group))
  const textLeft = draftBoxes.length ? Math.min(...draftBoxes.map((box) => box.contentLeft)) : width
  const textRight = draftBoxes.length ? Math.max(...draftBoxes.map((box) => box.contentRight)) : 0
  for (const line of shorts) {
    const center = line.x + line.w / 2
    if (paragraphLines.length && center >= textLeft && center <= textRight) {
      nearestParagraph(line, paragraphLines)?.push(line)
    } else loose.push(line)
  }
  const boxes: InkBox[] = []
  for (const group of groupByGap(banners, Math.max(medianH * 1.4, height * 0.03))) boxes.push(makeBox(group))
  const paragraphs = paragraphLines.map((group) => makeBox(group))
  boxes.push(...paragraphs)
  if (!paragraphLines.length) {
    if (loose.length) boxes.push(makeBox(loose))
    return boxes
  }
  const leftLines = loose.filter((line) => line.x + line.w / 2 < textLeft)
  const rightLines = loose.filter((line) => line.x + line.w / 2 > textRight)
  const sideGroups = [
    ...splitAtCardGutters(leftLines, paragraphs, height),
    ...splitAtCardGutters(rightLines, paragraphs, height),
  ]
  for (const group of sideGroups) {
    const box = makeBox(group)
    stretchBeside(box, paragraphs)
    boxes.push(box)
  }
  return boxes
}

function orderBoxes(boxes: InkBox[]): InkBox[] {
  const pending = boxes.slice()
  const ordered: InkBox[] = []
  while (pending.length) {
    let top = pending[0]
    for (const box of pending) {
      if (box.contentTop < top.contentTop - 0.5 || (Math.abs(box.contentTop - top.contentTop) <= 0.5 && box.contentLeft < top.contentLeft)) {
        top = box
      }
    }
    const band = pending.filter((box) => {
      if (box === top) return true
      const overlap = Math.min(box.contentBottom, top.contentBottom) - Math.max(box.contentTop, top.contentTop)
      return overlap > 8
    })
    let next = band[0]
    for (const box of band) {
      if (box.contentLeft < next.contentLeft - 0.5 || (Math.abs(box.contentLeft - next.contentLeft) <= 0.5 && box.contentTop < next.contentTop)) {
        next = box
      }
    }
    ordered.push(next)
    pending.splice(pending.indexOf(next), 1)
  }
  return ordered
}

function assignBoxSegments(boxes: InkBox[], headers: string[], segmentCount: number) {
  const folded = headers.map((header) => foldLabel(header))
  let any = false
  for (const box of boxes) {
    box.segment = -1
    for (let index = 0; index < folded.length; index += 1) {
      if (box.lines.some((line) => headerIndexOf(line, folded) === index)) {
        box.segment = index
        any = true
        break
      }
    }
  }
  if (!any) {
    const count = Math.max(1, segmentCount)
    boxes.forEach((box, index) => {
      box.segment = Math.min(count - 1, Math.floor((index * count) / Math.max(1, boxes.length)))
    })
    return
  }
  for (let index = 0; index < boxes.length; index += 1) {
    if (boxes[index].segment >= 0) continue
    for (let next = index + 1; next < boxes.length; next += 1) {
      if (boxes[next].segment >= 0) {
        boxes[index].segment = boxes[next].segment
        break
      }
    }
  }
  for (let index = 0; index < boxes.length; index += 1) {
    if (boxes[index].segment >= 0) continue
    for (let prev = index - 1; prev >= 0; prev -= 1) {
      if (boxes[prev].segment >= 0) {
        boxes[index].segment = boxes[prev].segment
        break
      }
    }
    if (boxes[index].segment < 0) boxes[index].segment = 0
  }
}

function tileBoxes(boxes: InkBox[], width: number, height: number) {
  for (const box of boxes) {
    let left = 0
    let right = width
    let top = 0
    let bottom = height
    for (const other of boxes) {
      if (other === box) continue
      const yOverlap = Math.min(box.contentBottom, other.contentBottom) - Math.max(box.contentTop, other.contentTop)
      const xOverlap = Math.min(box.contentRight, other.contentRight) - Math.max(box.contentLeft, other.contentLeft)
      if (yOverlap > 0 && other.contentRight <= box.contentLeft + 1) {
        left = Math.max(left, (other.contentRight + box.contentLeft) / 2)
      }
      if (yOverlap > 0 && other.contentLeft >= box.contentRight - 1) {
        right = Math.min(right, (box.contentRight + other.contentLeft) / 2)
      }
      if (xOverlap > 0 && other.contentBottom <= box.contentTop + 1) {
        top = Math.max(top, (other.contentBottom + box.contentTop) / 2)
      }
      if (xOverlap > 0 && other.contentTop >= box.contentBottom - 1) {
        bottom = Math.min(bottom, (box.contentBottom + other.contentTop) / 2)
      }
    }
    box.left = left
    box.right = Math.max(left + 1, right)
    box.top = top
    box.bottom = Math.max(top + 1, bottom)
  }
  for (let pass = 0; pass < 2; pass += 1) {
    for (const box of boxes) {
      for (const other of boxes) {
        if (other === box) continue
        const xOverlap = Math.min(box.right, other.right) - Math.max(box.left, other.left)
        const yOverlap = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top)
        if (xOverlap > 8 && other.bottom <= box.top + 1 && box.top - other.bottom < height * 0.08 && box.top - other.bottom > 0) {
          box.top = other.bottom
        }
        if (yOverlap > 8 && other.right <= box.left + 1 && box.left - other.right < width * 0.08 && box.left - other.right > 0) {
          box.left = other.right
        }
      }
    }
  }
}

function pushSlice(box: InkBox, frac: number, width: number, height: number, bands: SlideInkBand[]) {
  const span = Math.min(1, Math.max(0, frac))
  if (span <= 0) return
  const x = clamp01(box.left / width)
  const y = clamp01(box.top / height)
  const w = Math.min(1 - x, Math.max(0, (box.right - box.left) / width))
  const h = Math.min(1 - y, Math.max(0, ((box.bottom - box.top) * span) / height))
  if (w <= 0.001 || h <= 0.001) return
  bands.push({ x, y, w, h })
}

function penAt(box: InkBox, frac: number, width: number, height: number) {
  const span = Math.min(1, Math.max(0, frac))
  const y = box.top + (box.bottom - box.top) * span
  const x = box.left + Math.min(box.right - box.left, Math.max(12, (box.right - box.left) * 0.12))
  return { x: clamp01(x / width), y: clamp01(y / height) }
}

export function planSlideInk(input: {
  lines: SlideInkLine[]
  width: number
  height: number
  headers: string[]
  segmentIndex: number
  segmentCount: number
  cumulative: boolean
  progress: number
}): { bands: SlideInkBand[]; pen: { x: number; y: number } | null; rowCount: number } {
  const width = input.width
  const height = input.height
  if (!(width > 0) || !(height > 0) || input.lines.length === 0) {
    return { bands: [], pen: null, rowCount: 0 }
  }
  const ordered = orderBoxes(buildBoxes(input.lines, width, height, input.headers))
  assignBoxSegments(ordered, input.headers, input.segmentCount)
  tileBoxes(ordered, width, height)
  const segment = Math.max(0, Math.min(input.segmentIndex, Math.max(0, input.segmentCount - 1)))
  const openBoxes = ordered.filter((box) => box.segment === segment)
  const progress = clamp01(input.progress)
  const bands: SlideInkBand[] = []
  for (const box of ordered) {
    if (input.cumulative && box.segment < segment) pushSlice(box, 1, width, height, bands)
  }
  const weights = openBoxes.map((box) => Math.max(1, box.chars))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1
  let remain = progress * totalWeight
  let pen: { x: number; y: number } | null = null
  for (let index = 0; index < openBoxes.length; index += 1) {
    const box = openBoxes[index]
    const weight = weights[index] ?? 1
    if (remain >= weight - 0.0001) {
      pushSlice(box, 1, width, height, bands)
      remain -= weight
      if (index === openBoxes.length - 1) pen = penAt(box, 1, width, height)
      continue
    }
    const frac = Math.max(0, remain) / weight
    if (frac > 0) pushSlice(box, frac, width, height, bands)
    pen = penAt(box, frac, width, height)
    break
  }
  if (!pen && openBoxes[0]) pen = penAt(openBoxes[0], 0, width, height)
  return { bands, pen, rowCount: openBoxes.length }
}

/** Cùng nhịp bộ gõ: đoạn đang mở đi hết khi chữ của đoạn đó gõ hết. */
export function slideInkProgressFromTyping(input: {
  segmentIndex: number
  titleTotal: number
  titleRevealed: number
  blockTotal: number
  blockRevealed: number
  typingOn: boolean
}): number {
  if (!input.typingOn) return 1
  const blockTotal = Math.max(0, input.blockTotal)
  const blockRevealed = Math.min(blockTotal, Math.max(0, input.blockRevealed))
  if (input.segmentIndex > 0) {
    if (blockTotal <= 0) return 1
    return blockRevealed / blockTotal
  }
  const titleTotal = Math.max(0, input.titleTotal)
  const titleRevealed = Math.min(titleTotal, Math.max(0, input.titleRevealed))
  const total = titleTotal + blockTotal
  if (total <= 0) return 1
  return (titleRevealed + blockRevealed) / total
}

export function readSlideInkPenFrame(raw: unknown): SlideInkPenFrame | null {
  if (!raw || typeof raw !== 'object') return null
  const frame = raw as Partial<SlideInkPenFrame>
  const imageUrl = String(frame.imageUrl ?? '').trim()
  if (!imageUrl || !Array.isArray(frame.bands)) return null
  const bands: SlideInkBand[] = []
  for (const band of frame.bands) {
    if (bands.length >= 80) break
    const x = clamp01(Number(band?.x))
    const y = clamp01(Number(band?.y))
    const w = clamp01(Number(band?.w))
    const h = clamp01(Number(band?.h))
    if (w <= 0 || h <= 0) continue
    bands.push({ x, y, w, h })
  }
  const penRaw = frame.pen
  const pen = penRaw && Number.isFinite(Number(penRaw.x)) && Number.isFinite(Number(penRaw.y))
    ? { x: clamp01(Number(penRaw.x)), y: clamp01(Number(penRaw.y)) }
    : null
  return {
    enabled: frame.enabled !== false,
    playing: frame.playing === true,
    imageUrl,
    bands,
    pen,
  }
}
