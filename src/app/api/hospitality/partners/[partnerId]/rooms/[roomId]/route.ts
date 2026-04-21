import { NextResponse } from 'next/server'
import { deleteHospitalityRoomPg, updateHospitalityRoomPg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_STATUSES = new Set(['active', 'maintenance', 'inactive'])

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ partnerId: string; roomId: string }> }
) {
  const { partnerId, roomId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let body: { room_code?: string; floor_label?: string | null; status?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const status =
    body.status && ALLOWED_STATUSES.has(String(body.status))
      ? (body.status as 'active' | 'maintenance' | 'inactive')
      : undefined

  const row = await updateHospitalityRoomPg({
    partner_id: partnerId,
    room_id: roomId,
    room_code: body.room_code,
    floor_label: body.floor_label,
    status,
  })
  if (!row) return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true, room: row })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ partnerId: string; roomId: string }> }
) {
  const { partnerId, roomId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const ok = await deleteHospitalityRoomPg(partnerId, roomId)
  if (!ok) return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
