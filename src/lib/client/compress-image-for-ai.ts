/**
 * Thu cạnh / mã lại JPEG trước server action ảnh.
 * Ảnh iPhone gốc dễ làm Safari cắt POST (nginx 499, toast "Load failed").
 */

const MAX_EDGE_2K = 2688
const MAX_EDGE_4K = 3200
const JPEG_QUALITY = 0.9
const LARGE_FILE_BYTES = 1_800_000

function looksLikeImage(file: File): boolean {
  const type = (file.type || '').split(';')[0].trim().toLowerCase()
  if (type.startsWith('image/')) return true
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '')
}

async function blobToJpegFile(blob: Blob, file: File): Promise<File | null> {
  if (!blob.size) return null
  const base = (file.name || 'image').replace(/\.[^.]+$/, '').trim() || 'image'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

async function drawToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge: number,
  file: File
): Promise<File | null> {
  if (width <= 0 || height <= 0) return null
  const maxDim = Math.max(width, height)
  const needsResize = maxDim > maxEdge
  const needsReencode = file.size > LARGE_FILE_BYTES || !/^image\/jpe?g$/i.test(file.type || '')
  if (!needsResize && !needsReencode) return file

  const scale = needsResize ? maxEdge / maxDim : 1
  const tw = Math.max(1, Math.round(width * scale))
  const th = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, tw, th)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob || blob.size === 0) return null
  if (!needsResize && blob.size >= file.size * 0.97) return file
  return blobToJpegFile(blob, file)
}

async function compressViaImageElement(file: File, maxEdge: number): Promise<File | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = url
    })
    return drawToJpeg(img, img.naturalWidth, img.naturalHeight, maxEdge, file)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Giữ file gốc nếu trình duyệt không vẽ được (HEIC lạ). */
export async function compressImageFileForAi(
  file: File,
  options?: { imageQuality?: '2K' | '4K' }
): Promise<File> {
  if (typeof window === 'undefined') return file
  if (!looksLikeImage(file)) return file
  const maxEdge = options?.imageQuality === '4K' ? MAX_EDGE_4K : MAX_EDGE_2K

  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file)
      try {
        const next = await drawToJpeg(bmp, bmp.width, bmp.height, maxEdge, file)
        if (next) return next
      } finally {
        bmp.close()
      }
    }
  } catch {
    /* HEIC trên một số WebView không qua createImageBitmap. */
  }

  try {
    const next = await compressViaImageElement(file, maxEdge)
    if (next) return next
  } catch {
    /* Giữ file gốc. */
  }
  return file
}
