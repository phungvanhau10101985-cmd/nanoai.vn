/**
 * URL trỏ tới video/stream — không dùng làm thumbnail `<img>` / tải như ảnh ngữ cảnh.
 * (Trang shop đôi khi đặt link .mp4 vào `data-src` của `<img>` ô video; `src` mới là poster JPG.)
 */
export function isLikelyVideoOrStreamUrl(url: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw) return false
  const pathOnly = raw.split(/[?#]/)[0] ?? raw
  if (/\.(mp4|webm|m3u8|mov|mkv|ogv|ogg|avi)$/i.test(pathOnly)) return true
  if (/\.(mp4|webm|m3u8)([?&]|$)/i.test(raw)) return true
  return false
}
