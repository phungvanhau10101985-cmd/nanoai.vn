import { NextResponse } from 'next/server'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'
import { createHospitalityHoldPg } from '@/lib/db/hospitality-pg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })
  }

  let body: {
    room_type_id?: string
    customer_name?: string
    customer_phone?: string
    guests?: number
    checkin_at?: string
    checkout_at?: string
    expires_minutes?: number
    conversation_id?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const hold = await createHospitalityHoldPg({
    partner_id: partner.id,
    room_type_id: String(body.room_type_id ?? ''),
    conversation_id: body.conversation_id ?? null,
    customer_name: body.customer_name ?? null,
    customer_phone: body.customer_phone ?? null,
    guests: body.guests ?? 1,
    checkin_at: String(body.checkin_at ?? ''),
    checkout_at: String(body.checkout_at ?? ''),
    expires_minutes: body.expires_minutes ?? 15,
  })
  if (!hold) return NextResponse.json({ error: 'CREATE_HOLD_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true, hold })
}
