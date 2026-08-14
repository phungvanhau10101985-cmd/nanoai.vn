import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { listPartnerCategoryMaterialsFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** L3 — dropdown chất liệu theo danh mục, giống 188 GET /admin/ladipages/materials. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const categoryId = String(req.nextUrl.searchParams.get('categoryId') ?? '').trim()
  if (!categoryId) return NextResponse.json({ error: 'categoryId required' }, { status: 400 })

  const items = await listPartnerCategoryMaterialsFromPg(pid, categoryId)
  return NextResponse.json({ items })
}
