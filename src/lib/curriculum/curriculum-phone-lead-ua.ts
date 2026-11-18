/** Điện thoại và trình duyệt trong app Facebook / Instagram mở trang xin link máy tính. */
export function isCurriculumPhoneLeadUserAgent(userAgent: string | null | undefined): boolean {
  const ua = String(userAgent || '')
  if (!ua.trim()) return false
  if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram/i.test(ua)) return true
  if (/iPhone|iPod/i.test(ua)) return true
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true
  if (/Windows Phone|IEMobile|Opera Mini/i.test(ua)) return true
  return false
}
