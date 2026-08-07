import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchPartnerCategoryTreeForAdminFromPg,
  insertPartnerCategoryFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** W4.4 — danh sách cây danh mục (admin, gồm cả inactive) + tạo mới. Gate: quyền `inventory`. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const tree = await fetchPartnerCategoryTreeForAdminFromPg(pid)
  if (tree === null) return NextResponse.json({ error: 'Could not load categories' }, { status: 500 })
  return NextResponse.json({ tree })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    slug?: string
    parentId?: string | null
    imageUrl?: string
    description?: string
    seoTitle?: string
    seoDescription?: string
    seoIndex?: boolean
  }

  const name = String(body.name ?? '').trim()
  if (name.length < 1) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const result = await insertPartnerCategoryFromPg({
    partnerId: pid,
    parentId: body.parentId ? String(body.parentId).trim() : null,
    name,
    slug: body.slug ? String(body.slug).trim() : undefined,
    imageUrl: body.imageUrl,
    description: body.description,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    seoIndex: body.seoIndex,
  })

  if (!result.ok) {
    const status = result.error === 'parent_not_found' ? 404 : 409
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ success: true, category: result.row })
}
