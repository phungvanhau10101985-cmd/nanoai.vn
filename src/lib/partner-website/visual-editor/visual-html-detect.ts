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

/**
 * HTML that is safe to freeze into Sửa nhanh. A `data-pw-page` + empty `<main>`
 * is "usable" for storage checks but must not lock the editor on a white canvas.
 * Blank-white canvas still qualifies via footer / paper.
 */
export function visualHtmlLooksCompleteForEditor(html: string): boolean {
  const source = html.trim()
  if (source.length < 40) return false
  if (htmlHasPartnerVisualChrome(source)) return true
  if (/\bdata-pw-footer=/i.test(source) || /\bdata-pw-region=["']footer["']/i.test(source)) return true
  if (/\bdata-pw-paper=/i.test(source)) return true
  if (/\bdata-pw-region=["'](banner|catalog|categories|gallery|pdp-info)["']/i.test(source)) return true
  if (/\bclass=["'][^"']*\bpw-header\b/i.test(source)) return true
  return false
}

/** `data-pw-page` + empty `<main>` — looks stored, but Sửa nhanh must not freeze it. */
export function visualHtmlLooksEmptyEditorShell(html: string): boolean {
  const source = html.trim()
  if (!source || visualHtmlLooksCompleteForEditor(source)) return false
  if (!/\bdata-pw-(?:page|region|edit-device)=/i.test(source)) return false
  const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length < 12
}

export function shouldServeVisualHomepageHtml(html: string): boolean {
  const source = html.trim()
  return source.length >= 40 && looksLikeVisualHomeHtml(source) && htmlHasPartnerVisualChrome(source)
}
