import { NextResponse } from 'next/server'
import { fetchHospitalityRoomScheduleSlotsPg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  req: Request,
  ctx: { params: Promise<{ partnerId: string; roomId: string }> }
) {
  const { partnerId, roomId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const url = new URL(req.url)
  const fromAt = String(url.searchParams.get('from_at') ?? '').trim()
  const toAt = String(url.searchParams.get('to_at') ?? '').trim()
  if (!fromAt || !toAt) {
    return NextResponse.json({ error: 'MISSING_TIME_RANGE' }, { status: 400 })
  }

  const items = await fetchHospitalityRoomScheduleSlotsPg({
    partner_id: partnerId,
    room_id: roomId,
    from_at: fromAt,
    to_at: toAt,
  })
  return NextResponse.json({ ok: true, items })
}

