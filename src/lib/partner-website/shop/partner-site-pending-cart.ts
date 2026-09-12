export const PARTNER_SITE_PENDING_CART_KEY_PREFIX = 'pw_pending_cart_v1:'

export type PartnerSitePendingCartLine = {
  inventory_id: string
  name?: string
  image_url?: string
  product_url?: string
  price_hint?: string
  sku?: string
  color?: string
  size?: string
  quantity?: number
  buyNow?: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function partnerSitePendingCartKey(siteSlug: string): string {
  return `${PARTNER_SITE_PENDING_CART_KEY_PREFIX}${siteSlug.trim().toLowerCase()}`
}

function sameLine(a: PartnerSitePendingCartLine, b: PartnerSitePendingCartLine): boolean {
  return (
    a.inventory_id === b.inventory_id &&
    (a.size || '') === (b.size || '') &&
    (a.color || '') === (b.color || '')
  )
}

function sanitizeLine(raw: unknown): PartnerSitePendingCartLine | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const inventoryId = String(row.inventory_id || '').trim()
  if (!UUID_RE.test(inventoryId)) return null
  const quantity = Math.min(99, Math.max(1, Math.round(Number(row.quantity) || 1)))
  return {
    inventory_id: inventoryId,
    name: String(row.name || '').trim() || undefined,
    image_url: String(row.image_url || '').trim() || undefined,
    product_url: String(row.product_url || '').trim() || undefined,
    price_hint: String(row.price_hint || '').trim() || undefined,
    sku: String(row.sku || '').trim() || undefined,
    color: String(row.color || '').trim() || undefined,
    size: String(row.size || '').trim() || undefined,
    quantity,
    buyNow: Boolean(row.buyNow),
  }
}

export function readPartnerSitePendingCart(siteSlug: string): PartnerSitePendingCartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(partnerSitePendingCartKey(siteSlug))
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeLine).filter((row): row is PartnerSitePendingCartLine => Boolean(row))
  } catch {
    return []
  }
}

export function clearPartnerSitePendingCart(siteSlug: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(partnerSitePendingCartKey(siteSlug))
  } catch {
    /* ignore */
  }
}

/** Đọc rồi xóa — JS một luồng nên hai caller không lấy trùng. */
export function takePartnerSitePendingCart(siteSlug: string): PartnerSitePendingCartLine[] {
  const list = readPartnerSitePendingCart(siteSlug)
  if (list.length) clearPartnerSitePendingCart(siteSlug)
  return list
}

export function queuePartnerSitePendingCart(
  siteSlug: string,
  item: PartnerSitePendingCartLine,
  opts?: { buyNow?: boolean }
): void {
  if (typeof window === 'undefined') return
  const next = sanitizeLine({ ...item, buyNow: opts?.buyNow ?? item.buyNow })
  if (!next) return
  try {
    const list = readPartnerSitePendingCart(siteSlug).map((row) => ({ ...row }))
    const idx = list.findIndex((row) => sameLine(row, next))
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ...next,
        quantity: Math.min(99, (list[idx].quantity || 1) + (next.quantity || 1)),
        buyNow: Boolean(list[idx].buyNow || next.buyNow),
      }
    } else {
      list.push(next)
    }
    window.sessionStorage.setItem(partnerSitePendingCartKey(siteSlug), JSON.stringify(list))
  } catch {
    try {
      window.sessionStorage.setItem(partnerSitePendingCartKey(siteSlug), JSON.stringify([next]))
    } catch {
      /* ignore */
    }
  }
}
