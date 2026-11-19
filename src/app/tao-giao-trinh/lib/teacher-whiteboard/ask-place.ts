export type ScreenBox = { minX: number; minY: number; maxX: number; maxY: number }

/** Đặt hộp hỏi vào chỗ trống, tránh đè hình vừa vẽ. */
export function dialogClearOfFigure(
  board: { w: number; h: number },
  figure: ScreenBox | null,
  card: { w: number; h: number },
  margin = 12,
): { left: number; top: number; width: number; height: number } {
  const boardW = Math.max(1, board.w)
  const boardH = Math.max(1, board.h)
  const cardW = Math.min(card.w, Math.max(160, boardW - margin * 2))
  const cardH = Math.min(card.h, Math.max(80, boardH - margin * 2))
  const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value))
  const fit = (left: number, top: number) => ({
    left: clamp(left, margin, Math.max(margin, boardW - cardW - margin)),
    top: clamp(top, margin, Math.max(margin, boardH - cardH - margin)),
    width: cardW,
    height: cardH,
  })
  if (!figure) return fit((boardW - cardW) / 2, boardH - cardH - margin)
  const fig = {
    l: figure.minX - 16,
    t: figure.minY - 16,
    r: figure.maxX + 16,
    b: figure.maxY + 16,
  }
  const slots = [
    fit((boardW - cardW) / 2, boardH - cardH - margin),
    fit((boardW - cardW) / 2, margin),
    fit(margin, (boardH - cardH) / 2),
    fit(boardW - cardW - margin, (boardH - cardH) / 2),
    fit(margin, margin),
    fit(boardW - cardW - margin, margin),
    fit(margin, boardH - cardH - margin),
    fit(boardW - cardW - margin, boardH - cardH - margin),
  ]
  const overlap = (slot: { left: number; top: number }) => {
    const right = slot.left + cardW
    const bottom = slot.top + cardH
    const ox = Math.max(0, Math.min(right, fig.r) - Math.max(slot.left, fig.l))
    const oy = Math.max(0, Math.min(bottom, fig.b) - Math.max(slot.top, fig.t))
    return ox * oy
  }
  const cx = (fig.l + fig.r) / 2
  const cy = (fig.t + fig.b) / 2
  let best = slots[0]
  let bestOverlap = Infinity
  let bestDist = -1
  for (const slot of slots) {
    const hit = overlap(slot)
    const dx = slot.left + cardW / 2 - cx
    const dy = slot.top + cardH / 2 - cy
    const dist = dx * dx + dy * dy
    if (hit < bestOverlap - 0.5 || (Math.abs(hit - bestOverlap) < 0.5 && dist > bestDist)) {
      best = slot
      bestOverlap = hit
      bestDist = dist
    }
  }
  return best
}
