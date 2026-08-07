import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerCategoryFromPg,
  fetchPartnerCategoryByIdFromPg,
  fetchPartnerCategoryChildCountFromPg,
  movePartnerCategoryFromPg,
  updatePartnerCategoryFieldsFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

type Ctx = { params: Promise<{ partnerId: string; categoryId: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { partnerId, categoryId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const cid = categoryId.trim()
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
    seoBody?: string
    sizeGuideImageUrl?: string
    isActive?: boolean
  }

  const wantsMove = body.parentId !== undefined || body.slug !== undefined
  if (wantsMove) {
    const moveResult = await movePartnerCategoryFromPg(pid, cid, {
      newParentId: body.parentId === undefined ? undefined : body.parentId,
      newSlug: body.slug === undefined ? undefined : String(body.slug),
    })
    if (!moveResult.ok) {
      const status = moveResult.error === 'not_found' || moveResult.error === 'parent_not_found' ? 404 : 409
      return NextResponse.json({ error: moveResult.error }, { status })
    }
  }

  const hasFieldPatch =
    body.name !== undefined ||
    body.imageUrl !== undefined ||
    body.description !== undefined ||
    body.seoTitle !== undefined ||
    body.seoDescription !== undefined ||
    body.seoIndex !== undefined ||
    body.seoBody !== undefined ||
    body.sizeGuideImageUrl !== undefined ||
    body.isActive !== undefined

  if (hasFieldPatch) {
    const updated = await updatePartnerCategoryFieldsFromPg(pid, cid, {
      name: body.name,
      imageUrl: body.imageUrl,
      description: body.description,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      seoIndex: body.seoIndex,
      seoBody: body.seoBody,
      sizeGuideImageUrl: body.sizeGuideImageUrl,
      isActive: body.isActive,
    })
    if (!updated) return NextResponse.json({ error: 'db_error' }, { status: 500 })
    return NextResponse.json({ success: true, category: updated })
  }

  const row = await fetchPartnerCategoryByIdFromPg(pid, cid)
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ success: true, category: row })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { partnerId, categoryId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const cid = categoryId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const force = req.nextUrl.searchParams.get('force') === '1'
  if (!force) {
    const childCount = await fetchPartnerCategoryChildCountFromPg(pid, cid)
    if (childCount > 0) {
      return NextResponse.json({ error: 'has_children', childCount }, { status: 409 })
    }
  }

  const ok = await deletePartnerCategoryFromPg(pid, cid)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 404 })
  return NextResponse.json({ success: true })
}
