/** Thứ tự mặt thiệp khi xếp nền từ trên xuống. */
const WEDDING_BACKGROUND_FACE_ORDER = ['cover', 'invitation', 'album', 'event', 'gift_qr', 'rsvp', 'thanks'] as const

type BackgroundPlateImage = {
  type: string
  imageUrl: string
  createdAt?: string
}

/**
 * Các ảnh nền đã xong, mới nhất mỗi loại, xếp theo thứ tự lướt thiệp.
 * Ảnh master đứng sau mặt bìa. Thiếu mặt nào thì bỏ qua, không chèn trùng.
 */
export function weddingBackgroundPlateUrls(
  masterImageUrl: string | null | undefined,
  images: BackgroundPlateImage[],
): string[] {
  const sorted = [...images].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const latest = new Map<string, string>()
  for (const image of sorted) {
    const url = image.imageUrl.trim()
    if (!url || latest.has(image.type)) continue
    latest.set(image.type, url)
  }
  const master = (masterImageUrl || '').trim() || latest.get('master') || ''
  const ordered: string[] = []
  const push = (url: string) => {
    if (!url || ordered.includes(url)) return
    ordered.push(url)
  }
  push(latest.get('cover') || '')
  push(master)
  for (const type of WEDDING_BACKGROUND_FACE_ORDER) {
    if (type === 'cover') continue
    push(latest.get(type) || '')
  }
  return ordered
}
