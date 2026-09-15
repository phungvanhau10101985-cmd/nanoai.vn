import { looksLikeHttpUrl } from '@/lib/partner-website/shop/partner-site-image-search-errors'

/** Resolve shop/CDN/relative image URLs the same way 188 `imageUrlToFile` + `/api/fetch-image` do. */
export function toFetchableImageUrl(raw: string, origin?: string): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  if (looksLikeHttpUrl(trimmed)) return trimmed
  const base =
    origin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
  if (!base) return trimmed
  try {
    return new URL(trimmed, base).href
  } catch {
    return trimmed
  }
}

export async function imageUrlToFile(raw: string): Promise<File> {
  const href = toFetchableImageUrl(raw)
  if (!looksLikeHttpUrl(href)) {
    throw new Error('protocol')
  }
  const hrefs = [href, `/api/fetch-image?url=${encodeURIComponent(href)}`]
  let last: Error | null = null
  for (const next of hrefs) {
    try {
      const res = await fetch(next, next.startsWith('/') ? { credentials: 'same-origin' } : { mode: 'cors' })
      if (!res.ok) throw new Error(`http ${res.status}`)
      const blob = await res.blob()
      if (!String(blob.type || '').startsWith('image/')) throw new Error('type')
      const sub = blob.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg'
      const ext = sub === 'jpeg' ? 'jpg' : sub
      return new File([blob], `anh-tu-link.${ext}`, { type: blob.type })
    } catch (e) {
      last = e instanceof Error ? e : new Error('fetch')
    }
  }
  throw last || new Error('fetch')
}
