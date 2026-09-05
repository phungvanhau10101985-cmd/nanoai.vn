import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { resolveActiveBirthdayDiscountPercentForCustomer } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { resolvePartnerCustomerLoyaltyStatusFromPg } from '@/lib/db/messaging-partner-loyalty-pg'
import { validatePromotionCodeFromPg } from '@/lib/db/messaging-partner-promotions-pg'
import { resolvePartnerCheckoutPriceLinesFromPg } from '@/lib/db/messaging-partner-sale-pricing-pg'
import { resolvePartnerSaleDiscountBreakdown } from '@/lib/partner-website/promotions/partner-sale-pricing'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type QuoteLineInput = {
  lineId?: string
  inventoryId?: string
  quantity?: number
  fallbackUnitPrice?: number
}

function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as {
    lines?: QuoteLineInput[]
    promoCode?: string
  } | null
  const sourceLines = Array.isArray(body?.lines) ? body.lines.slice(0, 100) : []
  const validLines = sourceLines
    .map((line, index) => ({
      lineId: String(line.lineId ?? index).slice(0, 120),
      inventoryId:
        typeof line.inventoryId === 'string' && UUID_RE.test(line.inventoryId)
          ? line.inventoryId
          : null,
      quantity: Math.max(1, Math.min(99, Math.floor(Number(line.quantity) || 1))),
      // A public quote must never accept the browser's price as authoritative.
      // Inventory `price_amount` / `price_hint` is the only source in production.
      fallbackUnitPrice: 0,
    }))
    .filter((line) => line.inventoryId)

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!visitor.thread.guestAccountId && !visitor.thread.linkedUserId) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'AUTH_REQUIRED_CART_LOGIN', requireAuth: true },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }
  const emailNormalized = await resolveSiteVisitorEmail(request, shop.partnerId)
  const identity = {
    emailNormalized,
    linkedUserId: visitor.thread.linkedUserId,
    guestAccountId: visitor.thread.guestAccountId,
  }
  const [priceLines, birthdayDiscountPercent, loyaltyStatus, paymentSettings] =
    await Promise.all([
      resolvePartnerCheckoutPriceLinesFromPg({
        partnerId: shop.partnerId,
        accountKey: visitor.accountKey,
        lines: validLines,
      }),
      resolveActiveBirthdayDiscountPercentForCustomer({
        partnerId: shop.partnerId,
        linkedUserId: visitor.thread.linkedUserId,
        emailNormalized,
      }),
      resolvePartnerCustomerLoyaltyStatusFromPg({
        partnerId: shop.partnerId,
        identity,
      }),
      fetchPartnerPaymentSettingsFromPg(shop.partnerId),
    ])

  const effectiveSubtotal = priceLines.reduce(
    (sum, line) => sum + line.effectiveUnitPrice * line.quantity,
    0
  )
  const promoCode = String(body?.promoCode ?? '').trim()
  let promo:
    | { id: string; code: string; name: string; requestedDiscountAmount: number }
    | null = null
  let promoError: string | null = null
  if (promoCode) {
    const result = await validatePromotionCodeFromPg({
      partnerId: shop.partnerId,
      code: promoCode,
      subtotal: effectiveSubtotal,
      cartLines: priceLines.flatMap((line) => {
        if (!line.inventoryId) return []
        return [{
          inventoryId: line.inventoryId,
          lineSubtotal: line.effectiveUnitPrice * line.quantity,
          listLineSubtotal: line.listUnitPrice * line.quantity,
          isClearance: line.isClearance === true,
        }]
      }),
      guestAccountId: visitor.thread.guestAccountId,
      linkedUserId: visitor.thread.linkedUserId,
      emailNormalized,
    })
    if (result.ok) {
      promo = {
        id: result.promotion.id,
        code: result.promotion.code,
        name: result.promotion.name,
        requestedDiscountAmount: result.discountAmount,
      }
    } else {
      promoError = result.error
    }
  }

  const loyaltyDiscountPercent = loyaltyStatus.enabled
    ? Math.max(0, loyaltyStatus.tier?.discount_percent ?? 0)
    : 0
  const breakdown = resolvePartnerSaleDiscountBreakdown({
    lines: priceLines,
    voucherDiscountAmount: promo?.requestedDiscountAmount ?? 0,
    birthdayDiscountPercent: promo ? 0 : (birthdayDiscountPercent ?? 0),
    loyaltyDiscountPercent,
  })
  const configuredFee = money(paymentSettings?.shipping_fee_amount)
  const configuredThreshold =
    paymentSettings?.shipping_free_threshold_amount == null
      ? null
      : money(paymentSettings.shipping_free_threshold_amount)
  const shippingFeeAmount =
    configuredFee > 0 &&
    !(configuredThreshold != null && breakdown.amountAfterDiscount >= configuredThreshold)
      ? configuredFee
      : 0

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      lines: priceLines.map((line, index) => ({
        lineId: validLines[index]?.lineId ?? String(index),
        inventoryId: line.inventoryId,
        quantity: line.quantity,
        listUnitPrice: line.listUnitPrice,
        effectiveUnitPrice: line.effectiveUnitPrice,
        isClearance: line.isClearance === true,
        googleDiscountAmount: money(line.googleDiscountAmount),
      })),
      breakdown,
      promo: promo
        ? {
            code: promo.code,
            name: promo.name,
            discountAmount: breakdown.voucherDiscountAmount,
          }
        : null,
      promoError,
      birthdayDiscountPercent: birthdayDiscountPercent ?? 0,
      loyalty: {
        enabled: loyaltyStatus.enabled,
        tierCode: loyaltyStatus.tier?.tier_code ?? '',
        tierName: loyaltyStatus.tier?.tier_name ?? '',
        discountPercent: loyaltyDiscountPercent,
      },
      shipping: {
        feeAmount: shippingFeeAmount,
        configuredFeeAmount: configuredFee,
        freeThresholdAmount: configuredThreshold,
        carrierLabel: paymentSettings?.shipping_carrier_label ?? '',
      },
      orderTotal: breakdown.amountAfterDiscount + shippingFeeAmount,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
