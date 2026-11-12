export type SystemKeyboardSignals = {
  pointerCoarse: boolean
  hoverNone: boolean
  maxTouchPoints?: number
  platform?: string
  userAgent?: string
}

/** Điện thoại và máy tính bảng dùng bàn phím của máy. Desktop giữ bộ gõ trong app. */
export function usesSystemKeyboard(input: SystemKeyboardSignals): boolean {
  if (input.pointerCoarse && input.hoverNone) return true
  const touch = Number(input.maxTouchPoints || 0)
  const appleTablet = touch > 1 && (input.platform === 'MacIntel' || /macintosh/i.test(input.userAgent || ''))
  return appleTablet
}
