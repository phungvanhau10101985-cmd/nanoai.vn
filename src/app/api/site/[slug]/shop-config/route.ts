import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { fetchShopCheckoutLoginRequiredForPartnerFromPg } from '@/lib/partner-website/shop/shop-checkout-auth'
import { partnerCommerceCartEnabled } from '@/lib/partner-website/partner-capabilities'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { normalizePartnerShopCurrency } from '@/lib/partner-website/shop/partner-shop-currency'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [checkoutLoginRequired, paymentSettings] = await Promise.all([
    fetchShopCheckoutLoginRequiredForPartnerFromPg(shop.partnerId),
    fetchPartnerPaymentSettingsFromPg(shop.partnerId),
  ])
  return NextResponse.json({
    ok: true,
    checkoutLoginRequired,
    cartEnabled: partnerCommerceCartEnabled(shop.capabilities),
    capabilities: shop.capabilities,
    // S0.10 — display/tracking currency (no FX).
    defaultCurrency: normalizePartnerShopCurrency(shop.site.defaultCurrency),
    // W1.7 — dùng để hiển thị phí ship ước tính + cho phép chọn ví điện tử trên trang giỏ hàng.
    shippingPolicy: {
      feeAmount: Math.max(0, Math.round(paymentSettings?.shipping_fee_amount ?? 0)),
      carrierLabel: String(paymentSettings?.shipping_carrier_label ?? '').trim() || null,
      freeThresholdAmount:
        paymentSettings?.shipping_free_threshold_amount == null
          ? null
          : Math.max(0, Math.round(paymentSettings.shipping_free_threshold_amount)),
    },
    ewalletAvailable: Boolean(paymentSettings?.ewallet_enabled && String(paymentSettings?.ewallet_qr_url ?? '').trim()),
  })
}
