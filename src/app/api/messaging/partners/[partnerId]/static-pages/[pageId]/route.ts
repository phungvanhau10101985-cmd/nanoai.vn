import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerStaticPageFromPg,
  updatePartnerStaticPageFromPg,
  type UpsertStaticPageInput,
} from '@/lib/db/messaging-partner-static-pages-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { cmsSlugToVisualPageKey } from '@/lib/partner-website/pages/partner-info-page-visual'
import { syncCmsIntoVisualInfoHtml } from '@/lib/partner-website/pages/sync-info-page-cms'

/** W3.4 — sửa/xoá 1 trang tĩnh. Gate: quyền `website`. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ partnerId: string; pageId: string }> }) {
  const { partnerId, pageId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as Partial<UpsertStaticPageInput>
  const result = await updatePartnerStaticPageFromPg(pid, pageId, body)
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ partnerId: string; pageId: string }> }) {
  const { partnerId, pageId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ok = await deletePartnerStaticPageFromPg(pid, pageId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
