import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  listPartnerWebsiteLeadsPg,
  markPartnerWebsiteLeadReadPg,
} from '@/lib/db/partner-website-leads-pg'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { partnerId } = await ctx.params
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const leads = await listPartnerWebsiteLeadsPg(partnerId)
  return NextResponse.json({ leads })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { partnerId } = await ctx.params
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = (await req.json()) as { leadId?: string; action?: string }
  if (body.action === 'mark_read' && body.leadId) {
    await markPartnerWebsiteLeadReadPg({ partnerId, leadId: body.leadId })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
