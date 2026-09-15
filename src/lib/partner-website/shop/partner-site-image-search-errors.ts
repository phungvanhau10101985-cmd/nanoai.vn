/** Chuẩn hóa lỗi image-search (Gemini embed) — cùng nhận diện 188 `nanoai-search-errors`. */

export function shouldRetryPartnerImageSearchTransient(error: string | null | undefined): boolean {
  if (!error || !String(error).trim()) return false
  const s = String(error)
  return (
    /gemini embed failed/i.test(s) ||
    /internal error encountered/i.test(s) ||
    /"status"\s*:\s*"INTERNAL"/i.test(s)
  )
}

export function classifyPartnerImageSearchError(
  raw: string | null | undefined
): 'html' | 'gemini' | 'raw' {
  const t = String(raw || '').trim()
  if (!t) return 'raw'
  if (
    /<!doctype\s+html/i.test(t) ||
    /<html[\s>]/i.test(t) ||
    /cloudflare/i.test(t) ||
    /cf-browser-verification/i.test(t)
  ) {
    return 'html'
  }
  if (shouldRetryPartnerImageSearchTransient(t)) return 'gemini'
  return 'raw'
}

export function looksLikeHttpUrl(text: string): boolean {
  const s = String(text || '').trim()
  if (!/^https?:\/\/.+/i.test(s)) return false
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.replace(/\.$/, '').toLowerCase()
    if (!host || host === 'www') return false
    if (!host.includes('.')) return false
    return /[a-z0-9]/i.test(host)
  } catch {
    return false
  }
}
