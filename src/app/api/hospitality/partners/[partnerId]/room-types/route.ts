import { NextResponse } from 'next/server'
import { createHospitalityRoomTypePg, fetchHospitalityRoomTypesPg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const items = await fetchHospitalityRoomTypesPg(partnerId)
  return NextResponse.json({ ok: true, items })
}

export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let body: {
    code?: string
    name?: string
    description?: string
    max_guests?: number
    base_hourly_rate?: number
    base_daily_rate?: number
    currency?: string
    amenities?: unknown[]
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }
  const row = await createHospitalityRoomTypePg({
    partner_id: partnerId,
    code: String(body.code ?? ''),
    name: String(body.name ?? ''),
    description: body.description ?? null,
    max_guests: body.max_guests ?? 2,
    base_hourly_rate: body.base_hourly_rate ?? null,
    base_daily_rate: body.base_daily_rate ?? null,
    currency: body.currency ?? 'VND',
    amenities: Array.isArray(body.amenities) ? body.amenities : [],
  })
  if (!row) return NextResponse.json({ error: 'CREATE_ROOM_TYPE_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true, room_type: row })
}
