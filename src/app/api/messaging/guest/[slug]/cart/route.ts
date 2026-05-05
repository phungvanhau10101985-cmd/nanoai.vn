import { NextRequest, NextResponse } from 'next/server'
import type { Json } from '@/types/database.types'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'
import { fetchMessagingGuestCartFromPg, upsertMessagingGuestCartFromPg } from '@/lib/db/messaging-guest-cart-pg'

export const dynamic = 'force-dynamic'

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  if (active.industry_key === 'hotel') return { error: 'hospitality_uses_hospitality_api' as const }
  return { partnerId: active.id }
}

function accountKeyFromThread(thread: NonNullable<Awaited<ReturnType<typeof resolveWidgetOrderThreadFromRequest>>>): string {
  return (thread.guestAccountId || thread.linkedUserId || '').trim()
}

function sanitizeCartItems(raw: unknown): Json {
  if (!Array.isArray(raw)) return []
  const out: unknown[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const card = o.card
    if (!card || typeof card !== 'object' || Array.isArray(card)) continue
    const c = card as Record<string, unknown>
    const name = typeof c.name === 'string' ? c.name.trim().slice(0, 240) : ''
    const imageUrl = typeof c.image_url === 'string' ? c.image_url.trim().slice(0, 1000) : ''
    const productUrl = typeof c.product_url === 'string' ? c.product_url.trim().slice(0, 1000) : ''
    if (!name || !/^https?:\/\//i.test(imageUrl) || !/^https?:\/\//i.test(productUrl)) continue
    out.push({
      id: typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 120) : crypto.randomUUID(),
      card: {
        name,
        image_url: imageUrl,
        product_url: productUrl,
        ...(typeof c.price_hint === 'string' && c.price_hint.trim()
          ? { price_hint: c.price_hint.trim().slice(0, 120) }
          : {}),
        ...(typeof c.sku === 'string' && c.sku.trim() ? { sku: c.sku.trim().slice(0, 128) } : {}),
        ...(typeof c.inventory_id === 'string' && /^[0-9a-f-]{36}$/i.test(c.inventory_id.trim())
          ? { inventory_id: c.inventory_id.trim() }
          : {}),
      },
      quantity: Math.max(1, Math.min(99, Math.floor(Number(o.quantity) || 1))),
      color: typeof o.color === 'string' ? o.color.trim().slice(0, 240) : '',
      size: typeof o.size === 'string' ? o.size.trim().slice(0, 120) : '',
      note: typeof o.note === 'string' ? o.note.trim().slice(0, 500) : '',
      variantLineImages: Array.isArray(o.variantLineImages)
        ? o.variantLineImages
            .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
            .map((u) => u.trim().slice(0, 1000))
            .slice(0, 24)
        : undefined,
    })
    if (out.length >= 50) break
  }
  return out as Json
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  const accountKey = thread ? accountKeyFromThread(thread) : ''
  if (!accountKey) return NextResponse.json({ ok: true, items: [], sync: false })
  const items = await fetchMessagingGuestCartFromPg({ partnerId: partner.partnerId, accountKey })
  return NextResponse.json({ ok: true, items: Array.isArray(items) ? items : [], sync: true })
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  const accountKey = thread ? accountKeyFromThread(thread) : ''
  if (!accountKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null
  const items = sanitizeCartItems(body?.items)
  const ok = await upsertMessagingGuestCartFromPg({ partnerId: partner.partnerId, accountKey, cartItems: items })
  if (!ok) return NextResponse.json({ error: 'Could not save cart.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
