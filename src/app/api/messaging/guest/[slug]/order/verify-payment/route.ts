import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { verifyOrderPaymentProof } from '@/lib/messaging/guest-chat-ordering'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  if (!thread) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as {
    orderId?: string
    proofImageStoragePath?: string
  } | null
  const orderId = String(body?.orderId ?? '').trim()
  const proofImageStoragePath = String(body?.proofImageStoragePath ?? '').trim()
  if (!orderId || !proofImageStoragePath) {
    return NextResponse.json({ error: 'Missing orderId or proof image.' }, { status: 400 })
  }

  const verified = await verifyOrderPaymentProof({
    partnerId: partner.partnerId,
    externalThreadId: thread.externalThreadId,
    orderId,
    proofImageStoragePath,
    linkedUserId: thread.linkedUserId,
    guestAccountId: thread.guestAccountId,
    anonymousSessionId: thread.anonymousSessionId,
  })
  if ('error' in verified) return NextResponse.json({ error: verified.error }, { status: 400 })
  return NextResponse.json({ ok: true, order: verified.order, verification: verified.verification })
}
