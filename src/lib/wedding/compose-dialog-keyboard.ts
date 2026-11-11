const KEYBOARD_OVERLAP_PX = 120

export type ComposeDialogKeyboardFrame = {
  top: number
  maxHeight: number
}

/**
 * Bàn phím mobile chồng lên layout (visual viewport thấp hơn đáy màn hình),
 * hoặc layout đã co lại sau lúc mở bàn phím.
 * Trả về mép trên và chiều cao hộp thoại nằm trọn trong vùng còn nhìn thấy.
 * Thanh trình duyệt hoặc desktop không đủ khoảng che thì giữ căn giữa.
 */
export function composeDialogKeyboardFrame(input: {
  mobile: boolean
  layoutHeight: number
  offsetTop: number
  visualHeight: number
  gap?: number
  /** true khi viewport đã thấp hơn lúc chưa gõ — Android co layout nên overlap có thể bằng 0. */
  keyboardOpen?: boolean
}): ComposeDialogKeyboardFrame | null {
  if (!input.mobile) return null
  if (!(input.layoutHeight > 0) || !(input.visualHeight > 0)) return null
  const gap = input.gap ?? 8
  const overlap = input.layoutHeight - (input.offsetTop + input.visualHeight)
  if (!(overlap > KEYBOARD_OVERLAP_PX) && input.keyboardOpen !== true) return null
  return {
    top: Math.max(0, Math.round(input.offsetTop + gap)),
    maxHeight: Math.max(180, Math.round(input.visualHeight - gap * 2)),
  }
}

/** Đưa mép dưới ô đang gõ sát mép dưới vùng cuộn (sát bàn phím khi hộp đã co). */
export function revealComposeField(field: HTMLElement, scroller: HTMLElement) {
  const visualBottom = (window.visualViewport?.height ?? window.innerHeight) - 8
  const fieldBottom = field.getBoundingClientRect().bottom
  scroller.scrollTop += fieldBottom - visualBottom
}
