export type GuestPurchaseFlow = 'in_chat' | 'external_site' | 'external_cart_url'

export function normalizeGuestPurchaseFlow(v: unknown): GuestPurchaseFlow {
  if (v === 'external_cart_url') return 'external_cart_url'
  if (v === 'external_site') return 'external_site'
  return 'in_chat'
}

export type GuestPurchaseNavigateInput = {
  product_url: string
  sku?: string | null
}

/** Chuyển thẻ SP → input mua (dùng chung mọi nút Đặt hàng / Thêm giỏ). */
export function guestPurchaseInputFromProductCard(card: {
  name: string
  image_url: string
  product_url: string
  price_hint?: string
  sku?: string
  inventory_id?: string
}): GuestPurchaseNavigateInput & {
  name: string
  image_url: string
  price_hint?: string
  inventory_id?: string
} {
  const product_url = (card.product_url ?? '').trim()
  const sku = (card.sku ?? '').trim().slice(0, 128) || null
  const invId = (card.inventory_id ?? '').trim()
  return {
    name: card.name,
    image_url: card.image_url,
    product_url,
    price_hint: card.price_hint,
    sku,
    ...(invId ? { inventory_id: invId } : {}),
  }
}

export type GuestPurchaseNavigateFailure =
  | 'missing_product_url'
  | 'missing_sku'
  | 'missing_template'
  | 'invalid_template'

/** Mua / Thêm giỏ không dùng form chat — mở URL ngoài. */
export function guestPurchaseOpensExternalUrl(flow: GuestPurchaseFlow): boolean {
  return flow === 'external_site' || flow === 'external_cart_url'
}

export function buildGuestExternalCartUrl(template: string, sku: string): string | null {
  const t = template.trim()
  const s = sku.trim().slice(0, 128)
  if (!t || !s || !/\{sku\}/i.test(t)) return null
  const url = t.replace(/\{sku\}/gi, encodeURIComponent(s))
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.href
  } catch {
    return null
  }
}

export function resolveGuestPurchaseButtonUrl(
  flow: GuestPurchaseFlow,
  cartUrlTemplate: string | null | undefined,
  input: GuestPurchaseNavigateInput
): { ok: true; url: string } | { ok: false; reason: GuestPurchaseNavigateFailure } {
  const productUrl = (input.product_url ?? '').trim()
  const sku = (input.sku ?? '').trim().slice(0, 128)

  if (flow === 'external_cart_url') {
    const built = buildGuestExternalCartUrl(cartUrlTemplate ?? '', sku)
    if (built) return { ok: true, url: built }
    if (!sku) return { ok: false, reason: 'missing_sku' }
    const tpl = (cartUrlTemplate ?? '').trim()
    if (!tpl || !/\{sku\}/i.test(tpl)) return { ok: false, reason: 'missing_template' }
    return { ok: false, reason: 'invalid_template' }
  }

  if (flow === 'external_site') {
    if (/^https?:\/\//i.test(productUrl)) return { ok: true, url: productUrl }
    return { ok: false, reason: 'missing_product_url' }
  }

  return { ok: false, reason: 'missing_product_url' }
}
