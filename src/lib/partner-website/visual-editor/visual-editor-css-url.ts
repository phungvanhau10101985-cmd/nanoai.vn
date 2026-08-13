/** First `url(...)` in a CSS background-image value (skips gradients). */
export function extractFirstCssUrl(cssValue: string): string {
  const m = cssValue.match(/url\(\s*(['"]?)([^"')]+)\1\s*\)/i)
  return m?.[2]?.trim() ?? ''
}

/** Replace every `url(...)` in a background-image, keeping gradients. */
export function replaceCssBackgroundUrl(cssValue: string, nextUrl: string): string {
  const safe = nextUrl.replace(/['")]/g, '').trim()
  const wrapped = `url('${safe}')`
  if (!cssValue.trim() || !/url\(/i.test(cssValue)) return wrapped
  return cssValue.replace(/url\(\s*(['"]?)([^"')]+)\1\s*\)/gi, wrapped)
}

export function clampOverlayPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(80, Math.round(n)))
}

export function clampPaddingPx(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(160, Math.round(n)))
}

export function inferVisualEditImageKind(sel: {
  isLogo?: boolean
  isBgImage?: boolean
  width?: number
  height?: number
}): { kind: 'logo' | 'banner' | 'product_photo'; aspectRatio: string } {
  if (sel.isLogo) return { kind: 'logo', aspectRatio: '1:1' }
  const w = Number(sel.width) || 0
  const h = Number(sel.height) || 0
  if (sel.isBgImage) return { kind: 'banner', aspectRatio: '16:9' }
  if (w > 0 && h > 0) {
    const r = w / h
    if (r >= 1.4) return { kind: 'banner', aspectRatio: '16:9' }
    if (r <= 0.75) return { kind: 'product_photo', aspectRatio: '3:4' }
  }
  return { kind: 'product_photo', aspectRatio: '1:1' }
}
