import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventoryRowsByIdsInOrderFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fulfillmentSourceFromUrl, resolveInventoryFulfillmentUrl } from '@/lib/messaging/fulfillment/fulfillment-routing'
import { buildCheckoutSplitPlans } from '@/lib/messaging/fulfillment/checkout-split'
import { resolveActiveBirthdayOfferForCustomer } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { resolvePartnerCustomerLoyaltyStatusFromPg } from '@/lib/db/messaging-partner-loyalty-pg'
import { validatePromotionCodeFromPg } from '@/lib/db/messaging-partner-promotions-pg'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { resolvePartnerCheckoutPriceLinesFromPg } from '@/lib/db/messaging-partner-sale-pricing-pg'
import { partnerSaleLiveCountdownTo, resolvePartnerSaleDiscountBreakdown } from '@/lib/partner-website/promotions/partner-sale-pricing'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { resolvePartnerStorefrontSaleCalendarForRequest } from '@/lib/partner-website/promotions/partner-feature-test-storefront'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale } from '@/lib/i18n/config'
import { partnerSiteSaleCopy, partnerSiteSaleDateBadgeLabel, partnerSiteBirthdayOfferJson } from '@/lib/partner-website/promotions/partner-site-sale-display'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type QuoteLineInput = {
  lineId?: string
  inventoryId?: string
  quantity?: number
  fallbackUnitPrice?: number
  selected?: boolean
}

function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    return await postCartQuote(request, ctx)
  } catch (error) {
    console.error('[site-cart-quote]', error)
    return NextResponse.json({ ok: false, error: 'quote_failed' }, { status: 500 })
  }
}

async function postCartQuote(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
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
      selected: line.selected !== false,
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
  const locale = normalizeWebLocale(shop.site.locale) ?? DEFAULT_WEB_LOCALE
  const saleConfig = await fetchPartnerSaleCalendarConfigFromPg(shop.partnerId)
  const saleCalendar = await resolvePartnerStorefrontSaleCalendarForRequest({
    request,
    partnerId: shop.partnerId,
    visitorEmail: emailNormalized,
    settings: saleConfig,
  })
  const [priceLines, birthdayOfferRow, loyaltyStatus, paymentSettings] =
    await Promise.all([
      resolvePartnerCheckoutPriceLinesFromPg({
        partnerId: shop.partnerId,
        accountKey: visitor.accountKey,
        visitorEmail: emailNormalized,
        lines: validLines,
        saleConfig,
        calendarState: saleCalendar,
      }),
      resolveActiveBirthdayOfferForCustomer({
        partnerId: shop.partnerId,
        linkedUserId: visitor.thread.linkedUserId,
        emailNormalized,
        timezone: saleCalendar.timezone,
      }),
      resolvePartnerCustomerLoyaltyStatusFromPg({
        partnerId: shop.partnerId,
        identity,
      }),
      fetchPartnerPaymentSettingsFromPg(shop.partnerId),
    ])
  const birthdayDiscountPercent = birthdayOfferRow?.percent ?? 0

  const billedPriceLines = priceLines.filter((_, index) => validLines[index]?.selected !== false)
  const effectiveSubtotal = billedPriceLines.reduce(
    (sum, line) => sum + line.effectiveUnitPrice * line.quantity,
    0
  )
  const promoCode = String(body?.promoCode ?? '').trim()
  let promo:
    | { id: string; code: string; name: string; requestedDiscountAmount: number }
    | null = null
  let promoError: string | null = null
  if (promoCode && billedPriceLines.length > 0) {
    const result = await validatePromotionCodeFromPg({
      partnerId: shop.partnerId,
      code: promoCode,
      subtotal: effectiveSubtotal,
      cartLines: billedPriceLines.flatMap((line) => {
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
    lines: billedPriceLines,
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

  const billedInventoryIds = billedPriceLines.map((line) => line.inventoryId).filter((id): id is string => Boolean(id))
  const inventoryRows =
    billedInventoryIds.length > 0
      ? (await fetchPartnerInventoryRowsByIdsInOrderFromPg(shop.partnerId, billedInventoryIds)) || []
      : []
  const inventoryById = new Map(inventoryRows.map((row) => [row.id, row]))
  const checkoutPlans = buildCheckoutSplitPlans({
    lines: billedPriceLines.map((line) => {
      const inv = line.inventoryId ? inventoryById.get(line.inventoryId) : undefined
      const url = resolveInventoryFulfillmentUrl({
        catalogJson: inv?.catalog_json,
        productUrl: inv?.product_url,
      })
      return {
        fulfillmentSource: fulfillmentSourceFromUrl(url),
        sourcePlatform: null,
        sourceUrl: url,
        lineSubtotal: Math.max(0, Math.round(line.effectiveUnitPrice * line.quantity)),
        isWarehouseItem: inv?.is_clearance === true,
        depositRequired: inv?.deposit_required === true,
      }
    }),
    totalDiscount: breakdown.totalDiscountAmount,
    shippingFee: shippingFeeAmount,
    shopDepositMode: paymentSettings?.default_deposit_mode || 'percent',
    shopDepositPercent: paymentSettings?.default_deposit_percent ?? 30,
    shopDepositFixed: paymentSettings?.default_deposit_amount ?? 0,
  })
  const checkoutSplit = {
    orderCount: Math.max(1, checkoutPlans.length),
    shippingOnce: true,
    sources: checkoutPlans.map((plan) => plan.source),
    requiredAmount: checkoutPlans.reduce((sum, plan) => sum + Math.max(0, plan.requiredAmount), 0),
    plans: checkoutPlans.map((plan) => ({
      source: plan.source,
      requiredAmount: plan.requiredAmount,
      requiresDeposit: plan.requiresDeposit,
      shippingFee: plan.shippingFee,
      depositPercent: plan.depositPercent,
    })),
  }

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      lines: priceLines.map((line, index) => {
        const alreadyDiscounted = line.effectiveUnitPrice < line.listUnitPrice
        const expected =
          saleCalendar.phase === 'teaser' &&
          !line.isClearance &&
          !alreadyDiscounted &&
          line.priceKind !== 'flash' &&
          line.priceKind !== 'google' &&
          saleCalendar.discountPercent > 0
            ? Math.max(0, Math.round(line.listUnitPrice * (1 - saleCalendar.discountPercent / 100)))
            : null
        const copy = partnerSiteSaleCopy(locale)
        const saleBadge =
          line.priceKind === 'flash'
            ? partnerSiteSaleDateBadgeLabel({
                percent: line.flashPercent ?? 0,
                kind: 'flash',
                eventLabel: 'Flash sale',
                locale,
              })
            : line.priceKind === 'calendar' && saleCalendar.discountPercent > 0
              ? partnerSiteSaleDateBadgeLabel({
                  percent: saleCalendar.discountPercent,
                  eventDate: saleCalendar.eventDate ?? saleCalendar.saleDate,
                  eventLabel: saleCalendar.eventLabel,
                  kind: 'calendar',
                  locale,
                })
              : line.isClearance === true && alreadyDiscounted
                ? partnerSiteSaleDateBadgeLabel({
                    percent: Math.max(
                      1,
                      Math.round(
                        ((line.listUnitPrice - line.effectiveUnitPrice) * 100) / Math.max(1, line.listUnitPrice)
                      )
                    ),
                    kind: 'clearance',
                    isClearance: true,
                    locale,
                  })
                : null
        const programName =
          line.priceKind === 'flash'
            ? copy.flashName
            : line.priceKind === 'calendar'
              ? saleCalendar.eventLabel
              : line.isClearance === true
                ? copy.clearanceName
                : line.priceKind === 'google'
                  ? copy.googleName
                  : null
        return {
          lineId: validLines[index]?.lineId ?? String(index),
          inventoryId: line.inventoryId,
          quantity: line.quantity,
          listUnitPrice: line.listUnitPrice,
          effectiveUnitPrice: line.effectiveUnitPrice,
          isClearance: line.isClearance === true,
          googleDiscountAmount: money(line.googleDiscountAmount),
          priceKind: line.priceKind ?? (line.isClearance ? 'clearance' : 'list'),
          flashPercent: line.flashPercent ?? null,
          countdownTo: partnerSaleLiveCountdownTo(line.countdownTo),
          saleBadge,
          programName,
          expectedSaleUnitPrice:
            expected != null && expected > 0 && expected < line.listUnitPrice ? expected : null,
        }
      }),
      saleCalendar: {
        ...saleCalendar,
        countdownTo: partnerSaleLiveCountdownTo(saleCalendar.countdownTo),
      },
      birthdayOffer: partnerSiteBirthdayOfferJson(birthdayOfferRow),
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
      checkoutSplit,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
