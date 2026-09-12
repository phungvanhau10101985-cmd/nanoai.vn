/** Stash checkout payload so the deposit page paints before GET finishes. */

export const PARTNER_SITE_CHECKOUT_HANDOFF_KEY_PREFIX = 'pw_checkout_handoff_v1:'
const HANDOFF_TTL_MS = 120_000

export type PartnerSiteDepositPaymentDisplay =
  | { kind: 'bank'; bank_name: string; account_number: string; account_holder: string }
  | { kind: 'ewallet'; provider_label: string; account_name: string; account_number: string; qr_url: string }

export type PartnerSiteCheckoutHandoffOrder = {
  id: string
  status: string
  payment_reference?: string | null
  customer_email?: string | null
  created_at?: string | null
  required_amount?: number | null
  paid_amount?: number | null
  amount_after_discount?: number | null
  subtotal_amount?: number | null
  shipping_fee_amount?: number | null
  deposit_percent?: number | null
  payment_qr_url?: string | null
  payment_method?: string | null
  product_name?: string | null
  promo_code?: string | null
  loyalty_tier_name?: string | null
  fulfillment_source?: 'vietnam' | 'china' | null
  source_platform?: string | null
  tracking_number?: string | null
  shipping_status?: string | null
}

export type PartnerSiteCheckoutHandoff = {
  orderId: string
  order: PartnerSiteCheckoutHandoffOrder
  payment_display?: PartnerSiteDepositPaymentDisplay | null
  default_deposit_percent?: number
  at: number
}

export function partnerSiteCheckoutHandoffKey(siteSlug: string): string {
  return `${PARTNER_SITE_CHECKOUT_HANDOFF_KEY_PREFIX}${siteSlug.trim().toLowerCase()}`
}

function asPaymentDisplay(raw: unknown): PartnerSiteDepositPaymentDisplay | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.kind === 'ewallet') {
    return {
      kind: 'ewallet',
      provider_label: String(o.provider_label ?? '').trim(),
      account_name: String(o.account_name ?? '').trim(),
      account_number: String(o.account_number ?? '').trim(),
      qr_url: String(o.qr_url ?? '').trim(),
    }
  }
  if (o.kind === 'bank') {
    return {
      kind: 'bank',
      bank_name: String(o.bank_name ?? '').trim(),
      account_number: String(o.account_number ?? '').trim(),
      account_holder: String(o.account_holder ?? '').trim(),
    }
  }
  return null
}

function asOrder(raw: unknown): PartnerSiteCheckoutHandoffOrder | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = String(o.id ?? '').trim()
  if (!id) return null
  return {
    id,
    status: String(o.status ?? '').trim() || 'awaiting_payment',
    payment_reference: typeof o.payment_reference === 'string' ? o.payment_reference : null,
    customer_email: typeof o.customer_email === 'string' ? o.customer_email : null,
    created_at: typeof o.created_at === 'string' ? o.created_at : null,
    required_amount: Number.isFinite(Number(o.required_amount)) ? Number(o.required_amount) : null,
    paid_amount: Number.isFinite(Number(o.paid_amount)) ? Number(o.paid_amount) : null,
    amount_after_discount: Number.isFinite(Number(o.amount_after_discount))
      ? Number(o.amount_after_discount)
      : null,
    subtotal_amount: Number.isFinite(Number(o.subtotal_amount)) ? Number(o.subtotal_amount) : null,
    shipping_fee_amount: Number.isFinite(Number(o.shipping_fee_amount))
      ? Number(o.shipping_fee_amount)
      : null,
    deposit_percent: Number.isFinite(Number(o.deposit_percent)) ? Number(o.deposit_percent) : null,
    payment_qr_url: typeof o.payment_qr_url === 'string' ? o.payment_qr_url : null,
    payment_method: typeof o.payment_method === 'string' ? o.payment_method : null,
    product_name: typeof o.product_name === 'string' ? o.product_name : null,
    promo_code: typeof o.promo_code === 'string' ? o.promo_code : null,
    loyalty_tier_name: typeof o.loyalty_tier_name === 'string' ? o.loyalty_tier_name : null,
    fulfillment_source: o.fulfillment_source === 'china' || o.fulfillment_source === 'vietnam' ? o.fulfillment_source : null,
    source_platform: typeof o.source_platform === 'string' ? o.source_platform : null,
    tracking_number: typeof o.tracking_number === 'string' ? o.tracking_number : null,
    shipping_status: typeof o.shipping_status === 'string' ? o.shipping_status : null,
  }
}

export function stashPartnerSiteCheckoutHandoff(
  siteSlug: string,
  payload: Omit<PartnerSiteCheckoutHandoff, 'at'>
): void {
  if (typeof window === 'undefined') return
  const orderId = String(payload.orderId || payload.order?.id || '').trim()
  if (!orderId || !payload.order) return
  try {
    window.sessionStorage.setItem(
      partnerSiteCheckoutHandoffKey(siteSlug),
      JSON.stringify({
        orderId,
        order: payload.order,
        payment_display: payload.payment_display ?? null,
        default_deposit_percent: payload.default_deposit_percent,
        at: Date.now(),
      } satisfies PartnerSiteCheckoutHandoff)
    )
  } catch {
    /* private */
  }
}

export function readPartnerSiteCheckoutHandoff(
  siteSlug: string,
  orderId: string
): PartnerSiteCheckoutHandoff | null {
  if (typeof window === 'undefined') return null
  const want = orderId.trim()
  if (!want) return null
  const key = partnerSiteCheckoutHandoffKey(siteSlug)
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PartnerSiteCheckoutHandoff
    if (String(parsed.orderId || '').trim() !== want) return null
    if (!Number.isFinite(parsed.at) || Date.now() - parsed.at > HANDOFF_TTL_MS) {
      window.sessionStorage.removeItem(key)
      return null
    }
    const order = asOrder(parsed.order)
    if (!order) return null
    return {
      orderId: want,
      order,
      payment_display: asPaymentDisplay(parsed.payment_display),
      default_deposit_percent: Number.isFinite(Number(parsed.default_deposit_percent))
        ? Number(parsed.default_deposit_percent)
        : undefined,
      at: parsed.at,
    }
  } catch {
    return null
  }
}

export function clearPartnerSiteCheckoutHandoff(siteSlug: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(partnerSiteCheckoutHandoffKey(siteSlug))
  } catch {
    /* ignore */
  }
}

/** Đọc rồi xóa — dùng khi chắc chỉ một lần (không React Strict Mode remount). */
export function takePartnerSiteCheckoutHandoff(
  siteSlug: string,
  orderId: string
): PartnerSiteCheckoutHandoff | null {
  const row = readPartnerSiteCheckoutHandoff(siteSlug, orderId)
  if (row) clearPartnerSiteCheckoutHandoff(siteSlug)
  return row
}
