import { NextResponse } from 'next/server'
import {
  deleteHospitalityRoomTypePg,
  updateHospitalityRoomTypePg,
} from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ partnerId: string; roomTypeId: string }> }
) {
  const { partnerId, roomTypeId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let body: {
    code?: string
    name?: string
    description?: string | null
    max_guests?: number
    base_hourly_rate?: number | null
    base_daily_rate?: number | null
    currency?: string
    amenities?: unknown[]
    is_active?: boolean
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const row = await updateHospitalityRoomTypePg({
    partner_id: partnerId,
    room_type_id: roomTypeId,
    ...body,
  })
  if (!row) return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true, room_type: row })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ partnerId: string; roomTypeId: string }> }
) {
  const { partnerId, roomTypeId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const ok = await deleteHospitalityRoomTypePg(partnerId, roomTypeId)
  if (!ok) return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
