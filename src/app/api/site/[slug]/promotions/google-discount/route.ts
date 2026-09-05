import { NextRequest, NextResponse } from 'next/server'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import {
  googleDiscountLockExpiresAt,
  googleDiscountTokenFingerprint,
  verifyGoogleAutomatedDiscountToken,
} from '@/lib/partner-website/promotions/google-automated-discount'
import { writePartnerSaleAuditFromPg } from '@/lib/db/messaging-partner-sale-audit-pg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type GoogleSettingsRow = {
  enabled: boolean
  issuer: string
  audience: string
  public_key_pem: string
  lock_hours: number
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const body = (await request.json().catch(() => null)) as {
    token?: string
    inventoryId?: string
  } | null
  const token = body?.token?.trim() ?? ''
  const inventoryId = body?.inventoryId?.trim() ?? ''
  if (!token || !inventoryId) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
  const [settings, inventory] = await Promise.all([
    pgQueryOne<GoogleSettingsRow>(
      `select enabled, issuer, audience, public_key_pem, lock_hours
       from public.messaging_partner_google_discount_settings
       where partner_id = $1::uuid`,
      [shop.partnerId]
    ),
    pgQueryOne<{ id: string; offer_id: string; list_price: string | number | null }>(
      `select id::text, coalesce(nullif(remarketing_id, ''), id::text) as offer_id,
              price_amount as list_price
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = $2::uuid and is_active = true`,
      [shop.partnerId, inventoryId]
    ),
  ])
  if (!settings?.enabled || !inventory) {
    return NextResponse.json({ ok: false, error: 'not_enabled' }, { status: 409 })
  }
  try {
    const payload = verifyGoogleAutomatedDiscountToken({
      token,
      expectedOfferId: inventory.offer_id,
      expectedMerchantId: settings.audience,
      publicKeyPem: settings.public_key_pem,
    })
    const listPrice = Math.max(0, Math.round(Number(inventory.list_price) || 0))
    if (listPrice > 0 && payload.price >= listPrice) {
      return NextResponse.json({ ok: false, error: 'discount_not_lower' }, { status: 400 })
    }
    const expiresAt = googleDiscountLockExpiresAt(payload.expiresAt, settings.lock_hours)
    await pgQuery(
      `insert into public.messaging_partner_google_discount_locks (
         partner_id, account_key, inventory_id, offer_id, locked_unit_price,
         token_fingerprint, expires_at
       ) values ($1::uuid,$2,$3::uuid,$4,$5,$6,$7::timestamptz)
       on conflict (partner_id, account_key, inventory_id, offer_id) do update set
         locked_unit_price = excluded.locked_unit_price,
         token_fingerprint = excluded.token_fingerprint,
         expires_at = excluded.expires_at`,
      [
        shop.partnerId,
        visitor.accountKey,
        inventory.id,
        payload.offerId || inventory.offer_id,
        payload.price,
        googleDiscountTokenFingerprint(token),
        expiresAt.toISOString(),
      ]
    )
    void writePartnerSaleAuditFromPg({
      partnerId: shop.partnerId,
      eventType: 'google_discount_locked',
      actorKey: visitor.accountKey,
      entityType: 'inventory',
      entityId: inventory.id,
      detail: { price: payload.price, expiresAt: expiresAt.toISOString() },
    })
    return NextResponse.json({
      ok: true,
      price: payload.price,
      priorPrice: payload.priorPrice,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_token'
    console.warn('[partner-google-discount]', { partnerId: shop.partnerId, inventoryId, code })
    void writePartnerSaleAuditFromPg({
      partnerId: shop.partnerId,
      eventType: 'google_discount_rejected',
      actorKey: visitor.accountKey,
      entityType: 'inventory',
      entityId: inventoryId,
      detail: { code },
    })
    return NextResponse.json({ ok: false, error: code }, { status: 400 })
  }
}
