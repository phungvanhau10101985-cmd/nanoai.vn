/** Ảnh chèn trên bảng. Giữ nhỏ để bản đồng bộ máy khác còn chỗ. */
export const WHITEBOARD_IMAGE_SRC_MAX = 100_000

export function isWhiteboardImageSrc(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  if (raw.length < 48 || raw.length > WHITEBOARD_IMAGE_SRC_MAX) return false
  return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)
}

/** Thu ảnh về jpeg, kích thước thế giới vừa một ô trên bảng. */
export async function compressWhiteboardImage(file: Blob): Promise<{ src: string; w: number; h: number } | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }
  try {
    let edge = 800
    let quality = 0.8
    let src = ''
    let pw = 1
    let ph = 1
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
      pw = Math.max(1, Math.round(bitmap.width * scale))
      ph = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = pw
      canvas.height = ph
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pw, ph)
      ctx.drawImage(bitmap, 0, 0, pw, ph)
      src = canvas.toDataURL('image/jpeg', quality)
      if (src.length <= WHITEBOARD_IMAGE_SRC_MAX) break
      edge = Math.round(edge * 0.72)
      quality = Math.max(0.46, quality - 0.12)
    }
    if (!isWhiteboardImageSrc(src)) return null
    const aspect = pw / Math.max(1, ph)
    let w = 280
    let h = w / aspect
    if (h > 220) {
      h = 220
      w = h * aspect
    }
    if (w > 360) {
      w = 360
      h = w / aspect
    }
    return { src, w: Math.max(48, Math.round(w)), h: Math.max(36, Math.round(h)) }
  } finally {
    bitmap.close()
  }
}
