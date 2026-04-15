/**
 * Mở liên kết từ cửa sổ chat khách (SP, đơn, URL trong tin…).
 * Luôn **cùng tab** (`location.assign`) — kể cả desktop và iOS — để phiên chat / widget
 * không bị tách sang tab khác hoặc trang trắng.
 */
export function openGuestProductDetailUrl(url: string): void {
  const u = typeof url === 'string' ? url.trim() : ''
  if (!u) return
  if (typeof window === 'undefined') return
  window.location.assign(u)
}
