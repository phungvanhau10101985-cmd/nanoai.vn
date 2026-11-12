/** Khoảng trống giữa mép dưới ô đang gõ và mép trên bàn phím. */
export const KEYBOARD_FIELD_GAP_PX = 8

/** Dưới ngưỡng này coi như thanh trình duyệt, chưa phải bàn phím. */
export const KEYBOARD_OPEN_PX = 80

/** Thanh sticky cao hơn nội dung từng này thì coi là bị bàn phím kéo giãn. */
export const STICKY_STRETCH_SLOP_PX = 16

export type StickyChildBox = {
  height: number
  marginTop: number
  marginBottom: number
  skip: boolean
}

export type ScrollRoom = {
  scrollTop: number
  maxScroll: number
}

export function keyboardOverlapPx(layoutHeight: number, offsetTop: number, visualHeight: number): number {
  if (!(layoutHeight > 0) || !(visualHeight > 0)) return 0
  return Math.round(layoutHeight - (Math.max(0, offsetTop) + visualHeight))
}

/** Bàn phím đã mở: hoặc che layout, hoặc viewport đã co lại sau lúc chạm. */
export function keyboardIsOpen(input: {
  layoutHeight: number
  offsetTop: number
  visualHeight: number
  heightBeforeFocus: number
}): boolean {
  if (keyboardOverlapPx(input.layoutHeight, input.offsetTop, input.visualHeight) >= KEYBOARD_OPEN_PX) return true
  return input.heightBeforeFocus - input.visualHeight >= KEYBOARD_OPEN_PX
}

/**
 * Chiều cao khung thanh gõ = phần đệm + viền + từng khối con đang hiện.
 * Khối absolute (gợi ý bộ gõ) không tính, kẻo khóa chiều cao nuốt hàng gợi ý.
 */
export function stickyContentHeightPx(
  paddingTop: number,
  paddingBottom: number,
  borderTop: number,
  borderBottom: number,
  children: StickyChildBox[],
): number {
  let total = paddingTop + paddingBottom + borderTop + borderBottom
  for (const child of children) {
    if (child.skip) continue
    const height = Number.isFinite(child.height) ? child.height : 0
    if (height <= 0) continue
    const marginTop = Number.isFinite(child.marginTop) ? Math.max(0, child.marginTop) : 0
    const marginBottom = Number.isFinite(child.marginBottom) ? Math.max(0, child.marginBottom) : 0
    total += height + marginTop + marginBottom
  }
  return Math.ceil(total)
}

/** Khóa khi khung đã cao hơn nội dung, hoặc đang khóa rồi thì cập nhật theo nội dung mới. */
export function shouldLockStickyBox(boxHeight: number, contentHeight: number, alreadyLocked: boolean): boolean {
  if (!(contentHeight > 0) || !(boxHeight > 0)) return false
  if (alreadyLocked) return true
  return boxHeight > contentHeight + STICKY_STRETCH_SLOP_PX
}

/** Dương: ô đang thấp hơn mép bàn phím. Âm: ô đang cách bàn phím quá xa phía trên. */
export function fieldPinDeltaPx(fieldBottom: number, visualHeight: number, gap = KEYBOARD_FIELD_GAP_PX): number {
  if (!(visualHeight > 0)) return 0
  return Math.round(fieldBottom - (visualHeight - gap))
}

/**
 * Thanh hội thoại chỉ được kéo lên khi bàn phím che đáy thanh.
 * Kéo xuống sẽ chừa khoảng trắng giữa câu thầy và ô gõ.
 */
export function composerUncoverPx(boxBottom: number, visualHeight: number, gap = KEYBOARD_FIELD_GAP_PX): number {
  const covered = fieldPinDeltaPx(boxBottom, visualHeight, gap)
  return covered > 0 ? covered : 0
}

/** Đẩy delta vào từng vùng cuộn, trong trước ngoài sau. Phần dư là khoảng không cuộn hết. */
export function applyPinAcrossScrollers(
  rooms: ScrollRoom[],
  delta: number,
): { scrollTops: number[]; remain: number } {
  let remain = delta
  const scrollTops: number[] = []
  for (const room of rooms) {
    const maxScroll = Math.max(0, room.maxScroll)
    const next = Math.min(maxScroll, Math.max(0, room.scrollTop + remain))
    scrollTops.push(next)
    remain -= next - room.scrollTop
  }
  return { scrollTops, remain }
}

/**
 * Hộp thoại mobile bám vùng còn nhìn thấy.
 * `top` theo layout viewport (position:fixed). Đáy hộp nằm sát mép trên bàn phím.
 */
export function typingSheetFrame(input: {
  mobile: boolean
  offsetTop: number
  visualHeight: number
  gap?: number
}): { top: number; height: number } | null {
  if (!input.mobile || !(input.visualHeight > 0)) return null
  const gap = input.gap ?? KEYBOARD_FIELD_GAP_PX
  return {
    top: Math.max(0, Math.round(Math.max(0, input.offsetTop) + gap)),
    height: Math.max(180, Math.round(input.visualHeight - gap * 2)),
  }
}
