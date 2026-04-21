import { NextResponse } from 'next/server'
import { createHospitalityBookingFromHoldPg, fetchHospitalityBookingsPg } from '@/lib/db/hospitality-pg'
import { resolvePmsConnector } from '@/lib/hospitality/pms-connector'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })
  }
  const bookings = await fetchHospitalityBookingsPg(partner.id, 20)
  return NextResponse.json({ ok: true, bookings })
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })
  }
  let body: {
    hold_id?: string
    customer_name?: string
    customer_phone?: string
    customer_email?: string
    note?: string
    total_amount?: number
    currency?: string
    pms_connector?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const booking = await createHospitalityBookingFromHoldPg({
    partner_id: partner.id,
    hold_id: String(body.hold_id ?? ''),
    customer_name: String(body.customer_name ?? ''),
    customer_phone: body.customer_phone ?? null,
    customer_email: body.customer_email ?? null,
    note: body.note ?? null,
    total_amount: body.total_amount ?? 0,
    currency: body.currency ?? 'VND',
    channel: 'widget',
  })
  if (!booking) return NextResponse.json({ error: 'CREATE_BOOKING_FAILED' }, { status: 400 })

  const pms = resolvePmsConnector(body.pms_connector ?? 'other')
  await pms.push(partner.id, {
    entity_type: 'booking',
    entity_id: booking.id,
    payload: { booking_id: booking.id, status: booking.status },
  })
  return NextResponse.json({ ok: true, booking })
}
