/** Ảnh dán vào ô chat: file clipboard, link http(s), hoặc data URL. Không phụ thuộc Node. */

export const PASTE_IMAGE_MAX_BYTES = 15 * 1024 * 1024

export type PasteImageErrorCode = 'not-image' | 'failed' | 'too-large' | 'blocked'

export class PasteImageError extends Error {
  readonly code: PasteImageErrorCode

  constructor(code: PasteImageErrorCode) {
    super(code)
    this.name = 'PasteImageError'
    this.code = code
  }
}

type ClipboardFileItem = {
  kind: string
  type: string
  getAsFile: () => File | null
}

export type ClipboardLike = {
  files?: ArrayLike<File> | null
  items?: ArrayLike<ClipboardFileItem> | null
  getData?: (type: string) => string
}

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata.internal'])

export function singleHttpUrl(text: string): string | null {
  const raw = text.trim()
  if (!raw || /\s/.test(raw)) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  return url.toString()
}

const NOT_IMAGE_EXT = /\.(?:html?|php|aspx?|pdf|docx?|xlsx?|pptx?|zip|rar|7z|mp4|webm|mp3|wav|txt|json|xml|css|js|mjs)$/i

/** Một link http(s) có thể là ảnh. Trang .html, file tài liệu thì giữ là chữ. */
export function mightBeRemoteImage(text: string): boolean {
  if (singleImageDataUrl(text)) return true
  const http = singleHttpUrl(text)
  if (!http) return false
  const path = new URL(http).pathname.toLowerCase()
  return !NOT_IMAGE_EXT.test(path)
}

export function singleImageDataUrl(text: string): string | null {
  const raw = text.trim()
  if (!raw.startsWith('data:image/')) return null
  if (/^data:image\/svg/i.test(raw)) return null
  if (/\s/.test(raw)) return null
  return raw
}

export function clipboardPlainText(data: ClipboardLike | null): string {
  if (!data?.getData) return ''
  return data.getData('text/plain') || data.getData('text') || ''
}

export function clipboardImageFiles(data: ClipboardLike | null): File[] {
  if (!data) return []
  const out: File[] = []
  const seen = new Set<string>()
  const push = (file: File | null | undefined) => {
    if (!file || file.size <= 0) return
    const type = file.type.toLowerCase()
    if (!type.startsWith('image/') || type === 'image/svg+xml') return
    const key = `${type}:${file.size}:${file.name}:${file.lastModified}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(file)
  }
  const files = data.files
  if (files) {
    for (let i = 0; i < files.length; i += 1) push(files[i])
  }
  const items = data.items
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (!item || item.kind !== 'file' || !item.type.toLowerCase().startsWith('image/')) continue
      push(item.getAsFile())
    }
  }
  return out
}

export function isBlockedPasteHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host) return true
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  if (BLOCKED_HOSTS.has(bare) || bare.endsWith('.localhost') || bare.endsWith('.local')) return true
  return isBlockedIp(bare)
}

export function isBlockedIp(address: string): boolean {
  const ip = address.trim().toLowerCase()
  if (!ip) return true
  if (ip === '::1' || ip === '::') return true
  if (/^fe[89ab][0-9a-f]:/.test(ip) || ip.startsWith('fc') || ip.startsWith('fd')) return true
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const v4 = mapped?.[1] ?? (ip.includes(':') ? '' : ip)
  if (!v4) return false
  const parts = v4.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export function normalizeImageMime(value: string, bytes?: Uint8Array): string | null {
  const raw = value.split(';')[0]?.trim().toLowerCase() ?? ''
  if (raw === 'image/jpg') return 'image/jpeg'
  if (raw === 'image/jpeg' || raw === 'image/png' || raw === 'image/webp' || raw === 'image/gif') return raw
  if (raw === 'image/svg+xml') return null
  if (bytes && (raw === '' || raw === 'application/octet-stream' || raw === 'binary/octet-stream')) {
    return sniffImageMime(bytes)
  }
  if (raw.startsWith('image/')) return null
  return bytes ? sniffImageMime(bytes) : null
}

export function fileNameForImage(source: string, mime: string): string {
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'gif'
  let base = 'image'
  try {
    if (source.startsWith('data:')) base = 'pasted-image'
    else {
      const path = new URL(source).pathname.split('/').filter(Boolean).pop() || ''
      const cleaned = decodeURIComponent(path).replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '')
      if (cleaned) base = cleaned.slice(0, 80)
    }
  } catch {
    base = 'image'
  }
  if (/\.(jpe?g|png|webp|gif)$/i.test(base)) return base
  return `${base}.${ext}`
}
