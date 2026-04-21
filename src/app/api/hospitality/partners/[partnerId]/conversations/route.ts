import { NextResponse } from 'next/server'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'
import { listHospitalityPartnerConversations } from '@/lib/hospitality/hospitality-conversation-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  req: Request,
  ctx: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50)))
  const rows = await listHospitalityPartnerConversations(partnerId, limit)
  if (rows === null) return NextResponse.json({ error: 'LOAD_CONVERSATIONS_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true, conversations: rows })
}

