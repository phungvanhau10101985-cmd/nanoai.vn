/** Retry rồi mới báo «Không tải được tin nhắn» — mọi shop Chat mua. */

export const GUEST_CHAT_LOAD_RETRY_DELAYS_MS = [400, 1200] as const

export function isGuestChatLoadAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const message = 'message' in error ? String(error.message) : ''
  return name === 'AbortError' || /aborted|AbortError/i.test(message)
}

/** Toast chỉ lần mở hội thoại / tải tin cũ — không lúc poll im lặng. */
export function guestChatLoadShouldToast(input: {
  appendOlder: boolean
  silent: boolean
  hasLoadedOnce: boolean
}): boolean {
  return input.appendOlder || (!input.silent && !input.hasLoadedOnce)
}

export function guestChatHttpStatusShouldRetry(status: number): boolean {
  if (!Number.isFinite(status) || status <= 0) return true
  if (status === 408 || status === 425 || status === 429) return true
  return status >= 500
}

/** `attemptIndex` = số lần đã thử (0 = lần đầu vừa xong). */
export function nextGuestChatLoadRetryDelayMs(attemptIndex: number): number | null {
  const n = Math.floor(Number(attemptIndex) || 0)
  if (n < 0 || n >= GUEST_CHAT_LOAD_RETRY_DELAYS_MS.length) return null
  return GUEST_CHAT_LOAD_RETRY_DELAYS_MS[n]
}
