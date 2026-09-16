export type GuestPurchaseFlow = 'in_chat' | 'external_site' | 'external_cart_url'

/** Query `from=` trên `/cart/add/{sku}` — đóng modal thì quay lại chat NanoAI. */
export const GUEST_CART_ADD_FROM_NANOAI = 'nanoai'

export function normalizeGuestPurchaseFlow(v: unknown): GuestPurchaseFlow {
  if (v === 'external_cart_url') return 'external_cart_url'
  if (v === 'external_site') return 'external_site'
  return 'in_chat'
}

export function isGuestCartAddFromNanoAi(from: string | null | undefined): boolean {
  return String(from ?? '').trim().toLowerCase() === GUEST_CART_ADD_FROM_NANOAI
}

/** SKU trên `/cart/add/...` — một segment đã encode hoặc catch-all có `/`. */
export function decodePartnerShopCartAddSkuParam(skuSegments: string | string[] | undefined): string {
  const raw = Array.isArray(skuSegments) ? skuSegments.filter(Boolean).join('/') : String(skuSegments ?? '')
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    return decodeURIComponent(trimmed).trim().slice(0, 256)
  } catch {
    return trimmed.slice(0, 256)
  }
}

export function parseGuestExternalCartUrlTemplate(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim().slice(0, 2048)
  if (!t || !/\{sku\}/i.test(t) || !/^https?:\/\//i.test(t)) return null
  try {
    const probe = t.replace(/\{sku\}/gi, 'SKU')
    const parsed = new URL(probe)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  } catch {
    return null
  }
  return t
}

/** Shop SaaS cùng hệ thống: `{publicUrl}/cart/add/{sku}?from=nanoai` — không dán tay, không API key. */
export function buildPartnerShopCartAddUrlTemplate(publicBaseUrl: string): string | null {
  const base = publicBaseUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base)) return null
  return parseGuestExternalCartUrlTemplate(`${base}/cart/add/{sku}?from=${GUEST_CART_ADD_FROM_NANOAI}`)
}

/** URL web khách đã lưu thắng mẫu SaaS tự gắn — workspace 188.com.vn không bị đè. */
export function pickGuestExternalCartUrlTemplate(
  storedTemplate: string | null | undefined,
  saasAutoTemplate: string | null | undefined
): string | null {
  return parseGuestExternalCartUrlTemplate(storedTemplate) || parseGuestExternalCartUrlTemplate(saasAutoTemplate)
}

/** Ẩn ô dán URL khi shop đã có web trên hệ thống và chưa có mẫu web khách. */
export function guestPurchaseUsesSaasAutoCart(input: {
  saasLinked: boolean
  storedTemplate?: string | null
}): boolean {
  return Boolean(input.saasLinked) && !parseGuestExternalCartUrlTemplate(input.storedTemplate)
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

/** Tín hiệu mua trên chat = nút Mua / Thêm giỏ / Đặt hàng. Chat mua, Tư vấn, bấm ảnh thẻ = không. */
export type GuestChatProductAction = 'buy' | 'add_cart' | 'order' | 'card_click' | 'consult' | 'view_details'

export function guestChatActionOpensExternalPurchase(
  flow: GuestPurchaseFlow,
  action: GuestChatProductAction
): boolean {
  if (action !== 'buy' && action !== 'add_cart' && action !== 'order') return false
  return guestPurchaseOpensExternalUrl(flow)
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
