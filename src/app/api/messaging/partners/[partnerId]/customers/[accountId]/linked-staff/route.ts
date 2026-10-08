import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { setPartnerCustomerLinkedStaffFromPg } from '@/lib/db/messaging-partner-customers-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { isLinkedStaffRole } from '@/lib/messaging/partner-shop-member-staff'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ partnerId: string; accountId: string }> }) {
  const { partnerId, accountId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const pid = partnerId.trim()
  const id = accountId.trim()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website_customers')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => null)) as { staffRole?: unknown; modules?: unknown } | null
  if (!isLinkedStaffRole(body?.staffRole)) {
    return NextResponse.json({ error: 'staffRole' }, { status: 400 })
  }
  const modules = Array.isArray(body?.modules) ? body.modules.filter((item) => typeof item === 'string') : null
  const result = await setPartnerCustomerLinkedStaffFromPg({
    partnerId: pid,
    ownerUserId: auth.user.id,
    accountId: id,
    staffRole: body.staffRole,
    modules,
  })
  if (!result.ok) {
    const status = result.error === 'forbidden' ? 403 : result.error === 'not_found' ? 404 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ ok: true })
}
