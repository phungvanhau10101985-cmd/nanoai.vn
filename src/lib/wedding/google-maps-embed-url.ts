/**
 * Tạo URL phù hợp cho iframe Google Maps (không cần API key).
 * Hỗ trợ link chứa @lat,lng, tham số ?q=, /place/..., link ngắn — fallback dùng encode toàn href.
 */
export function mapsUrlToIframeSrc(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`

  let href: string
  try {
    href = new URL(withProtocol).toString()
  } catch {
    return `https://www.google.com/maps?q=${encodeURIComponent(input)}&output=embed`
  }

  const lower = href.toLowerCase()

  if (lower.includes('/maps/embed') || lower.includes('output=embed')) {
    return href
  }

  const atMatch = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z\b)?/i)
  if (atMatch && atMatch[1] && atMatch[2]) {
    const zoomRaw = atMatch[3]
    let z = 16
    if (zoomRaw) {
      const n = Number.parseFloat(zoomRaw)
      if (Number.isFinite(n)) z = Math.min(21, Math.max(1, Math.round(n)))
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(`${atMatch[1]},${atMatch[2]}`)}&z=${z}&output=embed`
  }

  try {
    const u = new URL(href)
    const q = u.searchParams.get('q')
    if (q?.trim()) {
      return `https://www.google.com/maps?q=${encodeURIComponent(q.trim())}&output=embed`
    }
    const ll = u.searchParams.get('ll')
    if (ll?.includes(',')) {
      const [la, ln] = ll.split(',').map((s) => s.trim())
      if (la && ln) return `https://www.google.com/maps?q=${encodeURIComponent(`${la},${ln}`)}&output=embed`
    }
  } catch {
    /* fallback below */
  }

  const place = href.match(/\/maps\/place\/([^/?#]+)/i)
  if (place?.[1]) {
    let name = place[1]
    try {
      name = decodeURIComponent(name.replace(/\+/g, '%20'))
    } catch {
      /* keep raw */
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(name)}&output=embed`
  }

  if (/\/maps\b/i.test(href) || /goo\.gl|maps\.app\.goo\.gl/i.test(href)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(href)}&output=embed`
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(href)}&output=embed`
}
