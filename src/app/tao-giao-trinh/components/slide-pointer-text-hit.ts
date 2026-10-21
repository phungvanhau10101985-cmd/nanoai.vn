export type PointerTextHit = {
  textOffset: number
  lineRelX: number
  lineRelY: number
}

function caretAt(doc: Document, clientX: number, clientY: number): { node: Node; offset: number } | null {
  const withRange = doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
  if (typeof withRange.caretRangeFromPoint === 'function') {
    const range = withRange.caretRangeFromPoint(clientX, clientY)
    if (range) return { node: range.startContainer, offset: range.startOffset }
  }
  const withPos = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (typeof withPos.caretPositionFromPoint === 'function') {
    const pos = withPos.caretPositionFromPoint(clientX, clientY)
    if (pos?.offsetNode) return { node: pos.offsetNode, offset: pos.offset }
  }
  return null
}

function textNodeAt(node: Node, offset: number): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text
    const len = text.data.length
    if (len <= 0) return null
    return { node: text, offset: Math.max(0, Math.min(len - 1, offset >= len ? len - 1 : offset)) }
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as HTMLElement
  const child = el.childNodes[Math.max(0, Math.min(el.childNodes.length - 1, offset))] ?? el.childNodes[el.childNodes.length - 1]
  if (!child) return null
  if (child.nodeType === Node.TEXT_NODE) {
    const text = child as Text
    return text.data.length > 0 ? { node: text, offset: 0 } : null
  }
  const walker = el.ownerDocument.createTreeWalker(child, NodeFilter.SHOW_TEXT)
  const first = walker.nextNode()
  if (first && first.nodeType === Node.TEXT_NODE && (first as Text).data.length > 0) {
    return { node: first as Text, offset: 0 }
  }
  return null
}

function offsetOfText(root: HTMLElement, target: Text, local: number): number | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let count = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (n === target) return count + local
    count += (n as Text).data.length
  }
  return null
}

function hitFromCharRect(
  textOffset: number,
  rect: DOMRect,
  clientX: number,
  clientY: number
): PointerTextHit {
  return {
    textOffset,
    lineRelX: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1))),
    lineRelY: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
  }
}

type CharBox = { offset: number; rect: DOMRect }

/** Bỏ hộp rộng 0 ở chỗ ngắt dòng — hộp đó nằm ở cuối dòng trên, không phải chữ đang vẽ. */
function usableCharRects(range: Range): DOMRect[] {
  const list = range.getClientRects()
  const out: DOMRect[] = []
  for (let i = 0; i < list.length; i++) {
    const rect = list[i]
    if (rect && rect.height >= 1 && rect.width >= 0.4) out.push(rect)
  }
  return out
}

/** Hộp thấp nhất là nét chữ. Hộp cao hơn là dòng, dễ đè sang hàng trên và hàng dưới. */
function tightGlyph(rects: DOMRect[]): DOMRect | null {
  if (rects.length === 0) return null
  return rects.reduce((best, rect) => (rect.height < best.height - 0.5 ? rect : best))
}

function collectCharBoxes(root: HTMLElement, scope: Node): CharBox[] {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  const boxes: CharBox[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    const text = n as Text
    if (!root.contains(text) || text.data.length === 0) continue
    const base = offsetOfText(root, text, 0)
    if (base == null) continue
    for (let i = 0; i < text.data.length; i++) {
      const range = doc.createRange()
      range.setStart(text, i)
      range.setEnd(text, i + 1)
      const drawn = tightGlyph(usableCharRects(range))
      if (drawn) boxes.push({ offset: base + i, rect: drawn })
    }
  }
  return boxes
}

type Ink = { left: number; right: number; top: number; bottom: number; mid: number }

/** Dải giữa nét chữ. Hàng trên và hàng dưới không còn nằm trong vùng bấm của hàng giữa. */
function inkOf(rect: DOMRect): Ink {
  const inkH = Math.max(6, rect.height * 0.62)
  const top = rect.top + (rect.height - inkH) / 2
  const bottom = top + inkH
  return { left: rect.left, right: rect.right, top, bottom, mid: (top + bottom) / 2 }
}

/**
 * Chữ nào có nét gần chuột nhất thì lấy chữ đó.
 * Không gộp hàng theo khoảng giữa — hàng trên và hàng cuối không bị hàng giữa nhận.
 */
function hitTextIn(root: HTMLElement, scope: Node, clientX: number, clientY: number): PointerTextHit | null {
  const boxes = collectCharBoxes(root, scope)
  if (boxes.length === 0) return null
  let best = boxes[0]
  let bestScore = Infinity
  for (const box of boxes) {
    const ink = inkOf(box.rect)
    const dx = clientX < ink.left ? ink.left - clientX : clientX > ink.right ? clientX - ink.right : 0
    const dy = clientY < ink.top ? ink.top - clientY : clientY > ink.bottom ? clientY - ink.bottom : 0
    const cx = (ink.left + ink.right) / 2
    const center = Math.hypot(clientX - cx, clientY - ink.mid)
    const score = (dx === 0 && dy === 0 ? 0 : 1_000_000) + center
    if (score < bestScore) {
      bestScore = score
      best = box
    }
  }
  return hitFromCharRect(best.offset, best.rect, clientX, clientY)
}

/** Ký tự dưới chuột trong khối nội dung — hai giao diện cùng chỉ vào chữ đó. */
export function readPointerTextHit(root: HTMLElement, clientX: number, clientY: number): PointerTextHit | null {
  const direct = hitTextIn(root, root, clientX, clientY)
  if (direct) return direct
  const caret = caretAt(root.ownerDocument, clientX, clientY)
  if (!caret || !root.contains(caret.node)) return null
  const placed = textNodeAt(caret.node, caret.offset)
  if (!placed || !root.contains(placed.node)) return null
  const textOffset = offsetOfText(root, placed.node, placed.offset)
  if (textOffset == null) return null
  const range = root.ownerDocument.createRange()
  range.setStart(placed.node, placed.offset)
  range.setEnd(placed.node, Math.min(placed.node.data.length, placed.offset + 1))
  const rect = range.getClientRects()[0]
  if (!rect || rect.height < 1) return { textOffset, lineRelX: 0, lineRelY: 0.5 }
  return hitFromCharRect(textOffset, rect, clientX, clientY)
}

export function clientPointForPointerTextHit(
  root: HTMLElement,
  hit: { textOffset: number; lineRelX: number; lineRelY: number }
): { x: number; y: number } | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let count = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    const text = n as Text
    const len = text.data.length
    if (len > 0 && count + len > hit.textOffset) {
      const local = Math.max(0, Math.min(len - 1, hit.textOffset - count))
      const range = root.ownerDocument.createRange()
      range.setStart(text, local)
      range.setEnd(text, local + 1)
      const rect = tightGlyph(usableCharRects(range))
      if (rect) {
        return {
          x: rect.left + Math.max(rect.width, 1) / 2,
          y: rect.top + rect.height / 2,
        }
      }
    }
    count += len
  }
  return null
}

/** Chỉ số ký tự (con của `[data-sync-char-reveal]`) đang bắt đầu một hàng mới. */
export function readCharRevealLineBreaks(reveal: HTMLElement): number[] {
  const doc = reveal.ownerDocument
  const breaks: number[] = []
  let prevTop = -1
  const kids = reveal.children
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i]
    if (!(kid instanceof HTMLElement)) continue
    const walker = doc.createTreeWalker(kid, NodeFilter.SHOW_TEXT)
    const text = walker.nextNode() as Text | null
    if (!text || text.data.length === 0) {
      if (kid.querySelector('br')) prevTop = -1
      continue
    }
    const range = doc.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 1)
    const rect = tightGlyph(usableCharRects(range))
    if (!rect) continue
    if (prevTop >= 0 && rect.top > prevTop + 4) breaks.push(i)
    prevTop = rect.top
  }
  return breaks
}
