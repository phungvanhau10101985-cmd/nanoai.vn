/**
 * Link mở trang chat khách — ưu tiên đường dẫn gọn `/messaging/p/{slug}/tu-van/{uuid}` khi có id kho;
 * không thì fallback `?ctx_*` như `partner-guest-chat-client.tsx`.
 */
export type GuestConsultInventoryRow = {
  id: string
  image_url?: string | null
  product_url?: string | null
  sku?: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildGuestConsultChatPath(slug: string, row: GuestConsultInventoryRow): string {
  const s = slug.trim()
  if (!s) return ''
  const base = `/messaging/p/${encodeURIComponent(s)}`
  const inv = (row.id ?? '').trim()
  if (UUID_RE.test(inv)) {
    return `${base}/tu-van/${encodeURIComponent(inv)}`
  }
  const sp = new URLSearchParams()
  const iu = (row.image_url ?? '').trim()
  const pu = (row.product_url ?? '').trim()
  const sku = (row.sku ?? '').trim()
  if (iu && /^https?:\/\//i.test(iu)) sp.set('ctx_image', iu)
  if (pu && /^https?:\/\//i.test(pu)) sp.set('ctx_product_url', pu)
  if (sku) sp.set('ctx_sku', sku.slice(0, 128))
  const q = sp.toString()
  return q ? `${base}?${q}` : base
}

export function buildGuestConsultChatAbsoluteUrl(origin: string, slug: string, row: GuestConsultInventoryRow): string {
  const path = buildGuestConsultChatPath(slug, row)
  if (!path) return ''
  const o = origin.replace(/\/$/, '')
  return o ? `${o}${path}` : path
}
