/**
 * `variant_image_urls` on messaging_partner_orders: JSON stringified string[].
 */
export function parsePartnerOrderVariantImageUrls(raw: string | null | undefined): string[] {
  const s = String(raw ?? '').trim()
  if (!s) return []
  try {
    const j = JSON.parse(s) as unknown
    if (Array.isArray(j)) {
      const out: string[] = []
      for (const x of j) {
        if (typeof x !== 'string') continue
        const u = x.trim()
        if (/^https?:\/\//i.test(u)) out.push(u)
      }
      return out
    }
  } catch {
    // ignore
  }
  return []
}
