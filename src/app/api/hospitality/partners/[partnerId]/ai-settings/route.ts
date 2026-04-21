import { NextResponse } from 'next/server'
import { fetchHospitalityAiSettingsPg, upsertHospitalityAiSettingsPg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const settings = await fetchHospitalityAiSettingsPg(partnerId)
  return NextResponse.json({ ok: true, settings })
}

export async function PUT(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: {
    enabled?: boolean
    tone_instructions?: string
    policy_text?: string
    default_locale?: string
    auto_reply_enabled?: boolean
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }
  const ok = await upsertHospitalityAiSettingsPg({
    partner_id: partnerId,
    enabled: body.enabled,
    tone_instructions: body.tone_instructions,
    policy_text: body.policy_text,
    default_locale: body.default_locale,
    auto_reply_enabled: body.auto_reply_enabled,
  })
  if (!ok) return NextResponse.json({ error: 'UPSERT_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
