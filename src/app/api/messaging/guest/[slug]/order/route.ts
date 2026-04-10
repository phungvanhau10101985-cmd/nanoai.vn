import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { readGuestSessionIdFromRequest } from '@/lib/messaging/guest-auth-session'
import { readGuestAccountIdFromRequest } from '@/lib/messaging/guest-account-session'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import {
  completeOrderCheckout,
  createOrderDraftFromProductPick,
  getCustomerDeliveryProfile,
  getProductPurchaseOptions,
  listRelatedBuyProducts,
} from '@/lib/messaging/guest-chat-ordering'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, displayName: active.display_name }
}

async function resolveThread(request: NextRequest): Promise<{ externalThreadId: string; linkedUserId: string | null; guestAccountId: string | null } | null> {
  const user = await getEmailSessionUser()
  if (user?.id) return { externalThreadId: user.id, linkedUserId: user.id, guestAccountId: null }
  const accountId = readGuestAccountIdFromRequest(request)
  if (accountId) return { externalThreadId: accountId, linkedUserId: null, guestAccountId: accountId }
  const sessionId = readGuestSessionIdFromRequest(request)
  if (!sessionId) return null
  return { externalThreadId: sessionId, linkedUserId: null, guestAccountId: null }
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
  if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  return price_hint ? { name, image_url, product_url, price_hint } : { name, image_url, product_url }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const thread = await resolveThread(request)
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
    })
    return NextResponse.json({ ok: true, products: related })
  }
  const loginUser = await getEmailSessionUser()
  if (!loginUser?.id) {
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
    })
    const profile =
      loginUser?.email?.trim()
        ? await getCustomerDeliveryProfile({
            partnerId: partner.partnerId,
            emailNormalized: loginUser.email.trim().toLowerCase(),
          })
        : null
    return NextResponse.json({ ok: true, options, profile })
  }
  const card = asCard(body?.productCard ?? null)
  if (!card) return NextResponse.json({ error: 'Invalid product card.' }, { status: 400 })
  const created = await createOrderDraftFromProductPick({
    partnerId: partner.partnerId,
    externalThreadId: thread.externalThreadId,
    customerName: guestName(loginUser?.email ?? null),
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
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const loginUser = await getEmailSessionUser()
  if (!loginUser?.id) {
    return NextResponse.json(
      { error: 'AUTH_REQUIRED_PURCHASE_LOGIN', requireAuth: true },
      { status: 401 }
    )
  }
  const thread = await resolveThread(request)
  if (!thread) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      depositPercent?: 30 | 100
    }
  } | null
  const orderId = String(body?.orderId ?? '').trim()
  if (!orderId) return NextResponse.json({ error: 'Missing orderId.' }, { status: 400 })
  const f = body?.form ?? {}
  const sessionEmail = String(loginUser?.email ?? '').trim().toLowerCase()
  const done = await completeOrderCheckout({
    partnerId: partner.partnerId,
    externalThreadId: thread.externalThreadId,
    orderId,
    linkedUserId: thread.linkedUserId,
    guestAccountId: thread.guestAccountId,
    form: {
      customerName: String(f.customerName ?? '').trim(),
      customerEmail: sessionEmail,
      customerPhone: String(f.customerPhone ?? '').trim(),
      shippingAddress: String(f.shippingAddress ?? '').trim(),
      color: String(f.color ?? '').trim(),
      size: String(f.size ?? '').trim(),
      quantity: Math.max(1, Math.floor(Number(f.quantity) || 1)),
      note: String(f.note ?? '').trim(),
      depositPercent: f.depositPercent === 100 ? 100 : 30,
    },
  })
  if ('error' in done) return NextResponse.json({ error: done.error }, { status: 400 })
  return NextResponse.json({ ok: true, order: done.order })
}
