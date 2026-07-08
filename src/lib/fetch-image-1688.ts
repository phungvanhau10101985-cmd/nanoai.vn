import { rewriteAllMessagingCdnUrls } from '@/lib/shop188-cdn-url'

/**
 * Tải ảnh từ URL với cơ chế vượt chặn cho 1688, alibaba, alicdn, taobao, tmall…
 * Dùng cho cả server actions và API routes.
 */

/** URL ảnh thường chặn bot nếu thiếu User-Agent / Referer giống trình duyệt */
export const is1688ImageUrl = (url: string) =>
  /1688\.com|alibaba\.com|alicdn\.com|taobao\.com|tmall\.com|aliexpress\.com|lazada\./i.test(url)

const is1688Url = is1688ImageUrl

/** Host phụ Alibaba CDN (cbu01, sc01, …) — thường chặn hotlink trình duyệt; img.alicdn.com thì OK. */
export function isAlternativeAlicdnHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h.endsWith('.alicdn.com') && h !== 'img.alicdn.com' && h !== 'gw.alicdn.com'
}

/**
 * Đổi cbu01/sc01… → img.alicdn.com (cùng path) — dùng trước khi tải server hoặc hiển thị.
 */
export function normalizeAlicdnImageUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  try {
    const withProto = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
    const u = new URL(withProto)
    if (isAlternativeAlicdnHost(u.hostname)) {
      u.hostname = 'img.alicdn.com'
      return u.toString()
    }
    return trimmed.startsWith('//') ? u.toString() : trimmed
  } catch {
    return trimmed
  }
}

/**
 * URL hiển thị `<img>` trên client: proxy same-origin khi CDN Alibaba chặn hotlink (vd. cbu01.alicdn.com).
 * `img.alicdn.com` vẫn tải trực tiếp (hotlink OK).
 */
export function resolveExternalImageDisplayUrl(imageUrl: string): string {
  const trimmed = rewriteAllMessagingCdnUrls(imageUrl.trim())
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('/')) {
    return trimmed
  }
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed, window.location.origin)
      if (u.origin === window.location.origin) return trimmed
    } catch {
      /* ignore */
    }
  }
  try {
    const u = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed)
    if (isAlternativeAlicdnHost(u.hostname)) {
      return `/api/fetch-image?url=${encodeURIComponent(trimmed)}`
    }
  } catch {
    /* ignore */
  }
  return normalizeAlicdnImageUrl(trimmed)
}

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const fetch1688Headers: Record<string, string> = {
  'User-Agent': CHROME_UA,
  Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  /** Nhiều host img.alicdn.com/ibank… kiểm tra referer thương mại điện tử */
  Referer: 'https://detail.1688.com/',
}

/** Header tối thiểu giống Chrome — dùng khi tải ảnh từ CDN lạ / chặn fetch mặc định Node */
export const browserLikeImageFetchHeaders: Record<string, string> = {
  'User-Agent': CHROME_UA,
  Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

export function isImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false
  const h = buf.subarray(0, 12)
  return (
    (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e) ||
    (h[0] === 0xff && h[1] === 0xd8) ||
    (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) ||
    (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46)
  )
}

/** Khi CDN không trả Content-Type đúng, suy ra từ magic bytes */
export function sniffImageContentType(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export async function fetchImageWith1688Bypass(url: string): Promise<Buffer> {
  const headers: Record<string, string> = { ...browserLikeImageFetchHeaders }
  if (is1688Url(url)) Object.assign(headers, fetch1688Headers)

  const res = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    redirect: 'follow',
    headers,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const contentType = (blob.type || '').toLowerCase()
  const buf = Buffer.from(await blob.arrayBuffer())

  if (contentType.startsWith('image/') || isImageBuffer(buf)) return buf

  if (is1688Url(url) && (contentType.includes('html') || contentType.includes('text') || buf.length > 1000)) {
    const html = buf.toString('utf-8')
    const imgMatch =
      html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^"'\s]*)?/gi)?.[0] ||
      html.match(/https?:\/\/[^"'\s]*\.alicdn\.com[^"'\s]*/i)?.[0]
    if (imgMatch) {
      const imgUrl = imgMatch.replace(/&amp;/g, '&')
      const imgRes = await fetch(imgUrl, {
        signal: AbortSignal.timeout(45000),
        redirect: 'follow',
        headers: is1688Url(imgUrl) ? { ...headers, ...fetch1688Headers } : headers,
      })
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status} khi tải ảnh từ trang`)
      const imgBuf = Buffer.from(await imgRes.arrayBuffer())
      if (!isImageBuffer(imgBuf)) throw new Error('Trang không chứa ảnh hợp lệ')
      return imgBuf
    }
  }
  throw new Error('Không phải ảnh')
}

const CATALOG_MIN_BYTES = 32
const CATALOG_MAX_BYTES = 20 * 1024 * 1024

/**
 * Tải ảnh cho pipeline server (Vision catalog, v.v.): UA giống Chrome + bypass Alibaba/alicdn.
 * Trả null thay vì throw khi lỗi / không phải ảnh.
 */
export async function fetchRemoteImageForCatalog(
  url: string,
  opts?: { timeoutMs?: number }
): Promise<{ buf: Buffer; contentType: string } | null> {
  const timeoutMs = opts?.timeoutMs ?? 25_000
  const fetchUrl = rewriteAllMessagingCdnUrls(normalizeAlicdnImageUrl(url.trim()))
  if (!fetchUrl || !/^https?:\/\//i.test(fetchUrl)) return null
  try {
    if (is1688Url(fetchUrl)) {
      const buf = await fetchImageWith1688Bypass(fetchUrl)
      const contentType = sniffImageContentType(buf) || (isImageBuffer(buf) ? 'image/jpeg' : '')
      if (!contentType.startsWith('image/')) return null
      if (buf.length < CATALOG_MIN_BYTES || buf.length > CATALOG_MAX_BYTES) return null
      return { buf, contentType }
    }

    const res = await fetch(fetchUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: browserLikeImageFetchHeaders,
    })
    if (!res.ok) return null
    const ctHeader = res.headers.get('content-type')?.split(';')[0]?.trim() || ''
    const buf = Buffer.from(await res.arrayBuffer())
    const contentType = ctHeader.startsWith('image/')
      ? ctHeader
      : sniffImageContentType(buf) || (isImageBuffer(buf) ? 'image/jpeg' : '')
    if (!contentType.startsWith('image/')) return null
    if (buf.length < CATALOG_MIN_BYTES || buf.length > CATALOG_MAX_BYTES) return null
    return { buf, contentType }
  } catch {
    return null
  }
}
