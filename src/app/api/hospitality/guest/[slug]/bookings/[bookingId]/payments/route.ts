import { NextResponse } from 'next/server'
import { createHospitalityPaymentPg } from '@/lib/db/hospitality-pg'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; bookingId: string }> }) {
  const { slug, bookingId } = await ctx.params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })
  }
  let body: {
    provider?: string
    provider_txn_id?: string
    amount?: number
    currency?: string
    status?: 'pending' | 'paid' | 'failed' | 'refunded'
    raw_payload?: Record<string, unknown>
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const ok = await createHospitalityPaymentPg({
    partner_id: partner.id,
    booking_id: bookingId,
    provider: String(body.provider ?? 'manual'),
    provider_txn_id: body.provider_txn_id ?? null,
    amount: Number(body.amount ?? 0),
    currency: body.currency ?? 'VND',
    status: body.status ?? 'paid',
    raw_payload: body.raw_payload ?? {},
  })
  if (!ok) return NextResponse.json({ error: 'PAYMENT_CREATE_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
