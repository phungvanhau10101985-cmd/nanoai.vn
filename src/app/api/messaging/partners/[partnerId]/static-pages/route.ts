import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchPartnerStaticPagesForAdminFromPg,
  insertPartnerStaticPageFromPg,
  type UpsertStaticPageInput,
} from '@/lib/db/messaging-partner-static-pages-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { cmsSlugToVisualPageKey } from '@/lib/partner-website/pages/partner-info-page-visual'
import { syncCmsIntoVisualInfoHtml } from '@/lib/partner-website/pages/sync-info-page-cms'

/** W3.4 — danh sách trang tĩnh admin + tạo mới. Gate: quyền `website`. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const rows = await fetchPartnerStaticPagesForAdminFromPg(pid)
  if (rows === null) return NextResponse.json({ error: 'Could not load pages' }, { status: 500 })
  return NextResponse.json({ pages: rows })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as Partial<UpsertStaticPageInput>
  if (!body.slug?.trim() || !body.title?.trim()) {
    return NextResponse.json({ error: 'slug, title required' }, { status: 400 })
  }
  const result = await insertPartnerStaticPageFromPg(pid, body as UpsertStaticPageInput)
  if (!result.ok) {
    const status = result.error === 'duplicate_slug' || result.error === 'invalid_slug' ? 409 : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  const visualPageKey = cmsSlugToVisualPageKey(result.row.slug)
  await syncCmsIntoVisualInfoHtml({
    partnerId: pid,
    slug: result.row.slug,
    title: result.row.title,
    content: result.row.content,
    seoTitle: result.row.seoTitle,
    seoDescription: result.row.seoDescription,
    visualPageKey,
  })
  return NextResponse.json({ success: true, page: result.row })
}
