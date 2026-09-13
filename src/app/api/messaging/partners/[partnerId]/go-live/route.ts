import { NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { loadPartnerGoLiveFactsFromPg } from '@/lib/db/messaging-partner-go-live-pg'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  buildPartnerGoLiveChecklist,
  partnerGoLiveProgress,
} from '@/lib/partner-website/shop/partner-shop-go-live'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 })
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId)
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const facts = await loadPartnerGoLiveFactsFromPg(partnerId)
  if (!facts) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const items = buildPartnerGoLiveChecklist(facts)
  return NextResponse.json({
    ok: true,
    items,
    ...partnerGoLiveProgress(items),
  })
}
