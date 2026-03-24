/**
 * Nén ảnh trước khi upload bài thi tự luận: giới hạn cạnh lớn nhất, xuất JPEG.
 * Chỉ gọi từ client (trình duyệt).
 */
const MAX_EDGE_PX = 2000
const JPEG_QUALITY = 0.82

export async function compressEssayImageForUpload(file: File): Promise<File> {
  if (typeof window === 'undefined') return file
  if (!file.type.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file)
    try {
      const w0 = bmp.width
      const h0 = bmp.height
      if (w0 <= 0 || h0 <= 0) return file
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(w0, h0))
      const tw = Math.max(1, Math.round(w0 * scale))
      const th = Math.max(1, Math.round(h0 * scale))
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.drawImage(bmp, 0, 0, tw, th)
      const blob: Blob | null = await new Promise((res) => {
        canvas.toBlob((b) => res(b), 'image/jpeg', JPEG_QUALITY)
      })
      if (!blob || blob.size === 0) return file
      if (blob.size >= file.size * 0.97) return file
      const base = file.name.replace(/\.[^.]+$/, '').trim() || 'essay'
      return new File([blob], `${base}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    } finally {
      bmp.close()
    }
  } catch {
    return file
  }
}
