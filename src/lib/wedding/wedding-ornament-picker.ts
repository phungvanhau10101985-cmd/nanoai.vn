/** Vuốt catalog quá ngưỡng này thì không chọn hoa. */
export const ORNAMENT_PICKER_TAP_SLOP_PX = 14

export type OrnamentPickerDecision = { kind: 'select'; src: string } | { kind: 'idle' }

/** Chạm nhẹ hoặc vuốt không thêm hoa. Chỉ chọn khi ngón tay nhấc gần chỗ chạm. */
export function decideOrnamentPickerTap(input: {
  src: string
  movedPx: number
  slopPx?: number
}): OrnamentPickerDecision {
  const src = input.src.trim()
  if (!src) return { kind: 'idle' }
  if (input.movedPx > (input.slopPx ?? ORNAMENT_PICKER_TAP_SLOP_PX)) return { kind: 'idle' }
  return { kind: 'select', src }
}

/** Chỉ thêm khi đã chọn một hoa và người dùng bấm xác nhận. */
export function ornamentPickerConfirmSrc(selected: string | null | undefined): string | null {
  const src = selected?.trim() ?? ''
  return src ? src : null
}
