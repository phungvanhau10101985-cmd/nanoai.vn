import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  insertPartnerSearchAliasFromPg,
  listPartnerSearchAliasesFromPg,
} from '@/lib/db/messaging-partner-search-aliases-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M3.4 — list + create search keyword aliases. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const aliases = await listPartnerSearchAliasesFromPg(pid)
  if (aliases === null) return NextResponse.json({ error: 'Could not load aliases' }, { status: 500 })
  return NextResponse.json({ aliases })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as {
    keyword?: string
    inventoryId?: string | null
    categoryId?: string | null
  }
  const result = await insertPartnerSearchAliasFromPg({
    partnerId: pid,
    keyword: String(body.keyword ?? ''),
    inventoryId: body.inventoryId ?? null,
    categoryId: body.categoryId ?? null,
  })
  if (!result.ok) {
    const status =
      result.error === 'duplicate_keyword' || result.error === 'target_required' || result.error === 'invalid_input'
        ? 400
        : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ success: true, alias: result.row })
}
