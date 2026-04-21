import { NextResponse } from 'next/server'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'
import { fetchHospitalityRoomTypesPg } from '@/lib/db/hospitality-pg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })
  }
  const items = await fetchHospitalityRoomTypesPg(partner.id)
  return NextResponse.json({ ok: true, items })
}
