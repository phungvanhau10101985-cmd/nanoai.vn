import { NextResponse } from 'next/server'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'
import { fetchHospitalityAvailabilityPg } from '@/lib/db/hospitality-pg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })
  }

  const url = new URL(req.url)
  const checkinAt = url.searchParams.get('checkin_at') || ''
  const checkoutAt = url.searchParams.get('checkout_at') || ''
  if (!checkinAt || !checkoutAt) {
    return NextResponse.json({ error: 'MISSING_TIME_RANGE' }, { status: 400 })
  }

  const availability = await fetchHospitalityAvailabilityPg({
    partner_id: partner.id,
    checkin_at: checkinAt,
    checkout_at: checkoutAt,
  })
  return NextResponse.json({ ok: true, items: availability })
}
