/**
 * Nén / thu cạnh ảnh trước khi gửi server cho Thiết kế nội ngoại thất (chỉ browser).
 * Giữ JPEG chất lượng cao và giới hạn cạnh dài theo 2K/4K để giảm upload & tải cho AI.
 */

const MAX_EDGE_2K = 2688
const MAX_EDGE_4K = 3200
const JPEG_QUALITY = 0.9
/** Ảnh lớn hơn mức này: tái mã hóa JPEG cùng kích thước (hoặc thu nhỏ nếu vượt maxEdge). */
const LARGE_FILE_BYTES = 1_800_000

export async function compressInteriorImageForAi(
  file: File,
  options?: { imageQuality?: '2K' | '4K' }
): Promise<File> {
  if (typeof window === 'undefined') return file
  if (!file.type.startsWith('image/')) return file

  const maxEdge = options?.imageQuality === '4K' ? MAX_EDGE_4K : MAX_EDGE_2K

  try {
    const bmp = await createImageBitmap(file)
    try {
      const w0 = bmp.width
      const h0 = bmp.height
      if (w0 <= 0 || h0 <= 0) return file

      const maxDim = Math.max(w0, h0)
      const needsResize = maxDim > maxEdge
      const needsReencode = file.size > LARGE_FILE_BYTES
      if (!needsResize && !needsReencode) return file

      const scale = needsResize ? maxEdge / maxDim : 1
      const tw = Math.max(1, Math.round(w0 * scale))
      const th = Math.max(1, Math.round(h0 * scale))

      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bmp, 0, 0, tw, th)

      const blob: Blob | null = await new Promise((res) => {
        canvas.toBlob((b) => res(b), 'image/jpeg', JPEG_QUALITY)
      })
      if (!blob || blob.size === 0) return file
      if (!needsResize && blob.size >= file.size * 0.97) return file

      const base = file.name.replace(/\.[^.]+$/, '').trim() || 'interior'
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
