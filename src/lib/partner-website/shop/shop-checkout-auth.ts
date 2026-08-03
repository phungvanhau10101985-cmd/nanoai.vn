import { pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

/** Default true — backward compatible with existing shops. */
export function normalizeShopCheckoutLoginRequired(value: unknown): boolean {
  return value !== false
}

export async function fetchShopCheckoutLoginRequiredForPartnerFromPg(
  partnerId: string
): Promise<boolean> {
  if (!isPgConfigured()) return true
  try {
    const row = await pgQueryOne<{ shop_checkout_login_required: boolean | null }>(
      `select coalesce(shop_checkout_login_required, true) as shop_checkout_login_required
       from public.messaging_partner_ai_settings
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    if (!row) return true
    return normalizeShopCheckoutLoginRequired(row.shop_checkout_login_required)
  } catch (e) {
    console.warn('[fetchShopCheckoutLoginRequiredForPartnerFromPg]', e)
    return true
  }
}

/** Partner site cart/checkout only — chat widget keeps login requirement. */
export function isPartnerSiteCheckoutRequest(request: Request): boolean {
  return request.headers.get('x-partner-site-checkout') === '1'
}
