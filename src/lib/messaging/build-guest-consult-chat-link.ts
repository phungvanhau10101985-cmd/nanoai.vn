/**
 * Link mở trang chat khách `/messaging/p/{slug}?ctx_*` — ảnh / URL SP / SKU / id kho
 * khớp `partner-guest-chat-client.tsx` (ctx_image, ctx_product_url, ctx_sku, ctx_inventory).
 */
export type GuestConsultInventoryRow = {
  id: string
  image_url?: string | null
  product_url?: string | null
  sku?: string | null
}

export function buildGuestConsultChatPath(slug: string, row: GuestConsultInventoryRow): string {
  const s = slug.trim()
  if (!s) return ''
  const base = `/messaging/p/${encodeURIComponent(s)}`
  const sp = new URLSearchParams()
  const iu = (row.image_url ?? '').trim()
  const pu = (row.product_url ?? '').trim()
  const sku = (row.sku ?? '').trim()
  const inv = (row.id ?? '').trim()
  if (iu && /^https?:\/\//i.test(iu)) sp.set('ctx_image', iu)
  if (pu && /^https?:\/\//i.test(pu)) sp.set('ctx_product_url', pu)
  if (sku) sp.set('ctx_sku', sku.slice(0, 128))
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv)) {
    sp.set('ctx_inventory', inv)
  }
  const q = sp.toString()
  return q ? `${base}?${q}` : base
}

export function buildGuestConsultChatAbsoluteUrl(origin: string, slug: string, row: GuestConsultInventoryRow): string {
  const path = buildGuestConsultChatPath(slug, row)
  if (!path) return ''
  const o = origin.replace(/\/$/, '')
  return o ? `${o}${path}` : path
}
