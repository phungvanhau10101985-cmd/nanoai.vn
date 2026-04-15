/**
 * Session ID ổn định cho khách (widget / trang guest NanoAI).
 * Khớp với RFC 4122 UUID (version & variant) để tránh chuỗi 36 ký tự tùy ý.
 */
export const MESSAGING_GUEST_SESSION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Chuỗi UUID 8-4-4-4-12 hex — dùng khi so khớp với giá trị đã lưu (đơn/hội thoại),
 * ví dụ UUID từ DB hoặc legacy không qua bộ lọc variant/version ở trên.
 */
export const LOOSE_RFC4122_UUID_STRING_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidMessagingGuestSessionId(value: string): boolean {
  return MESSAGING_GUEST_SESSION_UUID_RE.test(value.trim())
}
