/** Host Bunny mặc định (pull zone cũ) — dùng để nhận diện URL legacy, không dùng làm CDN public. */
export const LEGACY_BUNNY_PULL_ZONE_HOST = 'nanoai.b-cdn.net'

const LEGACY_BUNNY_HOST_SUFFIX = '.b-cdn.net'

/** Base URL CDN public — ưu tiên NEXT_PUBLIC (client + build), rồi BUNNY_STORAGE (server). */
export function getBunnyPublicBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL?.trim() ||
    process.env.BUNNY_STORAGE_PUBLIC_BASE_URL?.trim()
  return raw?.replace(/\/$/, '') ?? ''
}

/** Ghép path với CDN base từ env. Path có thể bắt đầu bằng `/`. */
export function bunnyCdnUrl(path: string): string {
  const p = String(path || '').trim()
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return rewriteLegacyBunnyCdnUrl(p)
  const base = getBunnyPublicBase()
  if (!base) return p.startsWith('/') ? p : `/${p}`
  const normalized = p.startsWith('/') ? p : `/${p}`
  return `${base}${normalized}`
}

/**
 * Đổi host `*.b-cdn.net` sang CDN custom (NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL).
 * URL cũ trong DB / JSON không cần migrate hàng loạt khi gọi hàm này lúc render.
 */
export function rewriteLegacyBunnyCdnUrl(url: string | null | undefined): string {
  const t = String(url ?? '').trim()
  if (!t) return ''
  if (!/^https?:\/\//i.test(t)) return t

  try {
    const u = new URL(t)
    if (!u.hostname.endsWith(LEGACY_BUNNY_HOST_SUFFIX)) return t
    const base = getBunnyPublicBase()
    if (!base) return t
    return `${base}${u.pathname}${u.search}${u.hash}`
  } catch {
    return t
  }
}
