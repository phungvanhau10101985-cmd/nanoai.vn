import { NextResponse } from 'next/server'
import { fetchHospitalityOwnerReportPg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const report = await fetchHospitalityOwnerReportPg(partnerId)
  return NextResponse.json({ ok: true, report })
}
