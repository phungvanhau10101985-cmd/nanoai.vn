const KEYBOARD_OVERLAP_PX = 120

export type ComposeDialogKeyboardFrame = {
  top: number
  maxHeight: number
}

/**
 * Bàn phím mobile chồng lên layout (visual viewport thấp hơn đáy màn hình).
 * Trả về mép trên và chiều cao hộp thoại nằm trọn trong vùng còn nhìn thấy.
 * Thanh trình duyệt hoặc desktop không đủ khoảng che thì giữ căn giữa.
 */
export function composeDialogKeyboardFrame(input: {
  mobile: boolean
  layoutHeight: number
  offsetTop: number
  visualHeight: number
  gap?: number
}): ComposeDialogKeyboardFrame | null {
  if (!input.mobile) return null
  if (!(input.layoutHeight > 0) || !(input.visualHeight > 0)) return null
  const gap = input.gap ?? 8
  const overlap = input.layoutHeight - (input.offsetTop + input.visualHeight)
  if (!(overlap > KEYBOARD_OVERLAP_PX)) return null
  return {
    top: Math.max(0, Math.round(input.offsetTop + gap)),
    maxHeight: Math.max(180, Math.round(input.visualHeight - gap * 2)),
  }
}

export function revealComposeField(field: HTMLElement, scroller: HTMLElement) {
  const fieldRect = field.getBoundingClientRect()
  const box = scroller.getBoundingClientRect()
  const pad = 16
  if (fieldRect.bottom > box.bottom - pad) {
    scroller.scrollTop += fieldRect.bottom - box.bottom + pad
  } else if (fieldRect.top < box.top + pad) {
    scroller.scrollTop -= box.top + pad - fieldRect.top
  }
}
