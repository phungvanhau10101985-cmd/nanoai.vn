import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { deletePartnerSearchAliasFromPg } from '@/lib/db/messaging-partner-search-aliases-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M3.4 — delete one search alias. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; aliasId: string }> }
) {
  const { partnerId, aliasId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ok = await deletePartnerSearchAliasFromPg(pid, aliasId.trim())
  if (!ok) return NextResponse.json({ error: 'Could not delete alias' }, { status: 500 })
  return NextResponse.json({ success: true })
}
