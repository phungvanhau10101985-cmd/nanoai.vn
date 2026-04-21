import { NextResponse } from 'next/server'
import { createHospitalityRoomPg, fetchHospitalityRoomsPg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const rooms = await fetchHospitalityRoomsPg(partnerId)
  return NextResponse.json({ ok: true, rooms })
}

export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: { room_type_id?: string; room_code?: string; floor_label?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const room = await createHospitalityRoomPg({
    partner_id: partnerId,
    room_type_id: String(body.room_type_id ?? ''),
    room_code: String(body.room_code ?? ''),
    floor_label: body.floor_label ?? null,
  })
  if (!room) return NextResponse.json({ error: 'CREATE_ROOM_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true, room })
}
