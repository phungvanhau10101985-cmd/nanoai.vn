import { NextResponse } from 'next/server'
import { updateHospitalityBookingStatusPg } from '@/lib/db/hospitality-pg'
import { resolvePmsConnector } from '@/lib/hospitality/pms-connector'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(req: Request, ctx: { params: Promise<{ partnerId: string; bookingId: string }> }) {
  const { partnerId, bookingId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: {
    status?: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
    pms_connector?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }
  const status = body.status
  if (!status) return NextResponse.json({ error: 'MISSING_STATUS' }, { status: 400 })

  const ok = await updateHospitalityBookingStatusPg({
    partner_id: partnerId,
    booking_id: bookingId,
    status,
  })
  if (!ok) return NextResponse.json({ error: 'UPDATE_STATUS_FAILED' }, { status: 400 })

  const pms = resolvePmsConnector(body.pms_connector ?? 'other')
  await pms.push(partnerId, {
    entity_type: 'booking',
    entity_id: bookingId,
    payload: { booking_id: bookingId, status },
  })
  return NextResponse.json({ ok: true })
}
