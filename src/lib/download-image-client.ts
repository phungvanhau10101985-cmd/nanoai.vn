/**
 * Tải ảnh từ URL trên client — dùng proxy same-origin cho CDN ngoài để tránh CORS.
 */

export function isRestrictedInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /(FBAN|FBAV|FB_IAB|Instagram|Line\/|Zalo|TikTok)/i.test(ua)
}

function openDirectImage(url: string): void {
  if (typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function isBlobOrDataUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:')
}

function isSameOriginUrl(url: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const u = new URL(url, window.location.origin)
    return u.origin === window.location.origin
  } catch {
    return false
  }
}

/** URL fetch same-origin (proxy server khi ảnh nằm trên CDN khác). */
export function resolveImageDownloadFetchUrl(imageUrl: string): string {
  if (!imageUrl || isBlobOrDataUrl(imageUrl) || isSameOriginUrl(imageUrl)) return imageUrl
  return `/api/fetch-image?url=${encodeURIComponent(imageUrl)}`
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = src
  })
}

async function blobToFormat(blob: Blob, format: 'png' | 'jpeg'): Promise<Blob> {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  if (blob.type === mime) return blob

  const objUrl = URL.createObjectURL(blob)
  try {
    const img = await loadImageElement(objUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas_unavailable')
    if (format === 'jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, 0, 0)
    const converted = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, format === 'jpeg' ? 0.95 : undefined)
    })
    if (!converted) throw new Error('blob_convert_failed')
    return converted
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}

function normalizeFilename(base: string, format: 'png' | 'jpeg'): string {
  const stem = base.replace(/\.[^.]+$/, '').replace(/\s+/g, '-') || 'image'
  return `${stem}.${format === 'jpeg' ? 'jpg' : 'png'}`
}

/**
 * Tải ảnh về máy (PNG/JPG). Ảnh CDN ngoài đi qua GET /api/fetch-image.
 */
export async function downloadImageFromUrl(
  imageUrl: string,
  format: 'png' | 'jpeg',
  filename = 'image'
): Promise<void> {
  if (!imageUrl) throw new Error('missing_url')
  if (isRestrictedInAppBrowser()) {
    openDirectImage(imageUrl)
    return
  }

  const downloadName = normalizeFilename(filename, format)
  const fetchUrl = resolveImageDownloadFetchUrl(imageUrl)

  try {
    const res = await fetch(fetchUrl, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`http_${res.status}`)
    const rawBlob = await res.blob()
    const outBlob = await blobToFormat(rawBlob, format)
    triggerBlobDownload(outBlob, downloadName)
  } catch {
    if (isBlobOrDataUrl(imageUrl) || isSameOriginUrl(imageUrl)) {
      try {
        const img = await loadImageElement(imageUrl)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas_unavailable')
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(img, 0, 0)
        const converted = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(
            (b) => resolve(b),
            format === 'jpeg' ? 'image/jpeg' : 'image/png',
            format === 'jpeg' ? 0.95 : undefined
          )
        })
        if (!converted) throw new Error('blob_convert_failed')
        triggerBlobDownload(converted, downloadName)
        return
      } catch {
        // fall through
      }
    }
    openDirectImage(imageUrl)
  }
}
