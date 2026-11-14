export type Rgb = { r: number; g: number; b: number }

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/** Host được phép kéo pixel về cùng origin để sửa trên canvas. */
export function isEditableTranslateImageUrl(
  raw: string,
  bunnyPublicBase?: string | null,
  options?: { allowLocal?: boolean }
): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  const local = host === 'localhost' || host === '127.0.0.1'
  if (local) {
    if (!options?.allowLocal) return false
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (url.port && url.port !== '3000') return false
    return /\.(png|jpe?g|webp|gif)$/i.test(url.pathname)
  }
  if (url.protocol !== 'https:') return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  if (host.endsWith('.b-cdn.net')) return true
  const base = bunnyPublicBase?.trim()
  if (!base) return false
  try {
    return host === new URL(base).hostname.toLowerCase()
  } catch {
    return false
  }
}

export function sniffImageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const mark = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    if (mark === 'WEBP') return 'image/webp'
  }
  return null
}

export function acceptedImageMime(contentType: string | null, bytes: Uint8Array): string | null {
  const declared = (contentType || '').split(';')[0].trim().toLowerCase()
  if (IMAGE_TYPES.has(declared)) return declared
  if (declared && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream') return null
  return sniffImageMime(bytes)
}

/** Xóa pixel gần `color` trong buffer (đặt alpha = 0). Trả về số pixel đã xóa. */
export function eraseMatchedColor(data: Uint8ClampedArray, color: Rgb, tolerance: number): number {
  const tol = Math.max(0, Math.min(255, Math.round(tolerance)))
  let changed = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    if (
      Math.abs(data[i] - color.r) <= tol &&
      Math.abs(data[i + 1] - color.g) <= tol &&
      Math.abs(data[i + 2] - color.b) <= tol
    ) {
      data[i + 3] = 0
      changed += 1
    }
  }
  return changed
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const n = Number.parseInt(match[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex(color: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(color.r)}${h(color.g)}${h(color.b)}`
}
