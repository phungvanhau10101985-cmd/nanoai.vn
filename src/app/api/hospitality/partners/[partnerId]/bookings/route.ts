import { NextResponse } from 'next/server'
import { fetchHospitalityBookingsPg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? '50')
  const bookings = await fetchHospitalityBookingsPg(partnerId, limit)
  return NextResponse.json({ ok: true, bookings })
}
