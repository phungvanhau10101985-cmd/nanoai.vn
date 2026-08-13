/**
 * Default workspace when opening «Tạo web» without an explicit partner.
 * Prefer the fashion shop tied to 188.com.vn when the same NanoAI account owns several channels.
 */
export function pickPreferredWebsitePartnerId(
  partners: Array<{
    id: string
    slug: string
    display_name?: string | null
    brand_name?: string | null
    industry_key?: string | null
  }>,
  requestedId?: string
): string {
  const requested = requestedId?.trim() ?? ''
  if (requested && partners.some((p) => p.id === requested)) return requested
  if (!partners.length) return ''

  const score = (p: (typeof partners)[number]) => {
    const industry = String(p.industry_key || 'fashion').toLowerCase()
    const hay = `${p.slug} ${p.display_name ?? ''} ${p.brand_name ?? ''}`.toLowerCase()
    let n = 0
    if (industry === 'fashion') n += 10
    if (hay.includes('188')) n += 25
    return n
  }

  return [...partners].sort((a, b) => score(b) - score(a))[0]!.id
}

export function looksLikeConnected188Shop(input: {
  slug?: string | null
  display_name?: string | null
  brand_name?: string | null
  external_shop_origin?: string | null
}): boolean {
  const hay = `${input.slug ?? ''} ${input.display_name ?? ''} ${input.brand_name ?? ''} ${input.external_shop_origin ?? ''}`.toLowerCase()
  return hay.includes('188.com.vn') || hay.includes('188')
}
