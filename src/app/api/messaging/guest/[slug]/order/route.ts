import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { fetchGuestAccountEmailByIdPg } from '@/lib/db/messaging-guest-pg'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import {
  completeOrderCheckout,
  createOrderDraftFromProductPick,
  getCustomerDeliveryProfile,
  getProductPurchaseOptions,
  listRelatedBuyProducts,
} from '@/lib/messaging/guest-chat-ordering'
import { runMetaPurchaseAfterOrderComplete } from '@/lib/tracking/meta-purchase-after-order'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  if (active.industry_key === 'hotel') return { error: 'hospitality_uses_hospitality_api' as const }
  return { partnerId: active.id, displayName: active.display_name }
}

function guestName(userEmail: string | null): string {
  const em = (userEmail || '').trim()
  return em ? `Guest ${em}` : 'Guest'
}

function asCard(x: unknown): PartnerAiProductCard | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const image_url = typeof o.image_url === 'string' ? o.image_url.trim() : ''
  const product_url = typeof o.product_url === 'string' ? o.product_url.trim() : ''
  const price_hint = typeof o.price_hint === 'string' ? o.price_hint.trim() : ''
  const sku = typeof o.sku === 'string' ? o.sku.trim().slice(0, 128) : ''
  if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  const base = price_hint ? { name, image_url, product_url, price_hint } : { name, image_url, product_url }
  return sku ? { ...base, sku } : base
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) {
    const status = partner.error === 'hospitality_uses_hospitality_api' ? 409 : 404
    const error =
      partner.error === 'hospitality_uses_hospitality_api'
        ? 'Hospitality uses dedicated booking APIs.'
        : 'Not found'
    return NextResponse.json({ error }, { status })
  }
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  if (!thread) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as
    | {
        action?: 'related_products' | 'product_options'
        productCard?: unknown
        recentCards?: unknown[]
        productUrl?: string
      }
    | null
  const action = body?.action
  if (action === 'related_products') {
    const recentRaw = Array.isArray(body?.recentCards) ? body.recentCards : []
    const recentCards: PartnerAiProductCard[] = []
    for (const x of recentRaw) {
      const c = asCard(x)
      if (c) recentCards.push(c)
      if (recentCards.length >= 40) break
    }
    const related = await listRelatedBuyProducts({
      partnerId: partner.partnerId,
      recentCards,
      limit: 20,
      linkedUserId: thread.linkedUserId,
    })
    return NextResponse.json({ ok: true, products: related })
  }
  const loginUser = await getEmailSessionUser()
  const accountEmail = thread.guestAccountId
    ? await fetchGuestAccountEmailByIdPg(partner.partnerId, thread.guestAccountId)
    : null
  const sessionEmailNormalized =
    loginUser?.email?.trim().toLowerCase()
    || accountEmail?.emailNormalized
    || ''
  if (!loginUser?.id && !thread.guestAccountId) {
    return NextResponse.json(
      { error: 'AUTH_REQUIRED_PURCHASE_LOGIN', requireAuth: true },
      { status: 401 }
    )
  }
  if (action === 'product_options') {
    const productUrl = String(body?.productUrl ?? '').trim()
    if (!productUrl) return NextResponse.json({ error: 'Missing productUrl.' }, { status: 400 })
    const options = await getProductPurchaseOptions({
      partnerId: partner.partnerId,
      productUrl,
      linkedUserId: thread.linkedUserId,
    })
    const profile = sessionEmailNormalized
      ? await getCustomerDeliveryProfile({
          partnerId: partner.partnerId,
          emailNormalized: sessionEmailNormalized,
        })
      : null
    return NextResponse.json({ ok: true, options, profile })
  }
  const card = asCard(body?.productCard ?? null)
  if (!card) return NextResponse.json({ error: 'Invalid product card.' }, { status: 400 })
  const created = await createOrderDraftFromProductPick({
    partnerId: partner.partnerId,
    externalThreadId: thread.externalThreadId,
    customerName: guestName(sessionEmailNormalized || null),
    linkedUserId: thread.linkedUserId,
    guestAccountId: thread.guestAccountId,
    card,
  })
  if ('error' in created) return NextResponse.json({ error: created.error }, { status: 400 })
  return NextResponse.json({ ok: true, order: created.order })
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) {
    const status = partner.error === 'hospitality_uses_hospitality_api' ? 409 : 404
    const error =
      partner.error === 'hospitality_uses_hospitality_api'
        ? 'Hospitality uses dedicated booking APIs.'
        : 'Not found'
    return NextResponse.json({ error }, { status })
  }
  const loginUser = await getEmailSessionUser()
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  if (!thread) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accountEmail = thread.guestAccountId
    ? await fetchGuestAccountEmailByIdPg(partner.partnerId, thread.guestAccountId)
    : null
  const sessionEmail = loginUser?.email?.trim().toLowerCase() || accountEmail?.emailNormalized || ''
  if (!sessionEmail) {
    return NextResponse.json(
      { error: 'AUTH_REQUIRED_PURCHASE_LOGIN', requireAuth: true },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    orderId?: string
    form?: {
      customerName?: string
      customerPhone?: string
      shippingAddress?: string
      color?: string
      size?: string
      quantity?: number
      note?: string
      variantLineImages?: unknown
    }
  } | null
  const orderId = String(body?.orderId ?? '').trim()
  if (!orderId) return NextResponse.json({ error: 'Missing orderId.' }, { status: 400 })
  const f = body?.form ?? {}
  const customerName = String(f.customerName ?? '').trim()
  const customerPhone = String(f.customerPhone ?? '').trim()
  const shippingAddress = String(f.shippingAddress ?? '').trim()
  const color = String(f.color ?? '').trim()
  const size = String(f.size ?? '').trim()
  /** Tránh Number(null)=0 làm nhầm với thiếu field; JSON có thể gửi null nếu client lỗi NaN. */
  let quantityRaw = 0
  if (f.quantity !== undefined && f.quantity !== null) {
    const n = Number(f.quantity)
    if (Number.isFinite(n)) quantityRaw = Math.floor(n)
  }
  const missing: string[] = []
  if (!customerName) missing.push('customerName')
  if (!customerPhone) missing.push('customerPhone')
  if (!shippingAddress) missing.push('shippingAddress')
  if (!color) missing.push('color')
  if (!size) missing.push('size')
  if (quantityRaw < 1) missing.push('quantity')
  if (missing.length > 0) {
    const labelMap: Record<string, string> = {
      customerName: 'Họ tên',
      customerPhone: 'Số điện thoại',
      shippingAddress: 'Địa chỉ',
      color: 'Màu',
      size: 'Size',
      quantity: 'Số lượng',
    }
    const labels = missing.map((k) => labelMap[k] ?? k)
    return NextResponse.json(
      { error: `Vui lòng điền đầy đủ thông tin bắt buộc: ${labels.join(', ')}`, missingFields: missing },
      { status: 400 }
    )
  }
  const quantity = Math.max(1, Math.min(99, quantityRaw))
  const rawVariantImgs = f.variantLineImages
  const variantLineImages = Array.isArray(rawVariantImgs)
    ? rawVariantImgs.filter((x): x is string => typeof x === 'string').slice(0, 24)
    : undefined
  const done = await completeOrderCheckout({
    partnerId: partner.partnerId,
    externalThreadId: thread.externalThreadId,
    orderId,
    linkedUserId: thread.linkedUserId,
    guestAccountId: thread.guestAccountId,
    anonymousSessionId: thread.anonymousSessionId,
    form: {
      customerName,
      customerEmail: sessionEmail,
      customerPhone,
      shippingAddress,
      color,
      size,
      quantity,
      note: String(f.note ?? '').trim(),
      ...(variantLineImages && variantLineImages.length > 0 ? { variantLineImages } : {}),
    },
  })
  if ('error' in done) {
    const code = 'code' in done ? done.code : undefined
    const status =
      code === 'ORDER_NOT_FOUND' ? 404 : code === 'ORDER_ACCESS_DENIED' ? 403 : 400
    return NextResponse.json(
      { error: done.error, ...(code ? { code } : {}) },
      { status }
    )
  }

  let metaPurchase = null as Awaited<ReturnType<typeof runMetaPurchaseAfterOrderComplete>>
  if (isPgConfigured()) {
    try {
      metaPurchase = await runMetaPurchaseAfterOrderComplete({
        partnerId: partner.partnerId,
        order: done.order,
        request,
      })
    } catch (e) {
      console.warn('[order PATCH] meta purchase', e)
    }
  }

  return NextResponse.json({
    ok: true,
    order: done.order,
    ...(metaPurchase ? { metaPurchase } : {}),
  })
}
