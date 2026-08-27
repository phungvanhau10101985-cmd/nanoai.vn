/** Homepage / shop chrome saved by Sửa nhanh or seed — not React FashionHome. */
export function looksLikeVisualHomeHtml(html: string): boolean {
  const page = html.match(/\bdata-pw-page=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase() || ''
  return !page || page === 'home'
}

/** Factory / Sửa nhanh header — `pw-header`, not React `pw-shop-header` alone. */
export function htmlHasPartnerVisualChrome(html: string): boolean {
  const source = html.trim()
  if (source.length < 40) return false
  return (
    /\bdata-pw-region=["']header["']/i.test(source) &&
    (/\bpw-header\b/i.test(source) || /\bpw-topbar\b/i.test(source))
  )
}

export function shouldServeVisualHomepageHtml(html: string): boolean {
  const source = html.trim()
  return source.length >= 40 && looksLikeVisualHomeHtml(source) && htmlHasPartnerVisualChrome(source)
}
