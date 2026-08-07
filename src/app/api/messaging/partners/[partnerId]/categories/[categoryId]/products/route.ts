import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchInventoryIdsForCategoryFromPg,
  setCategoryProductsFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

type Ctx = { params: Promise<{ partnerId: string; categoryId: string }> }

/** W4.5 — sản phẩm gán trực tiếp vào 1 danh mục (id list, để prefill picker). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { partnerId, categoryId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ids = await fetchInventoryIdsForCategoryFromPg(categoryId.trim())
  if (ids === null) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ inventoryIds: ids })
}

/** Thay toàn bộ danh sách sản phẩm gán vào danh mục (gán hàng loạt). */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { partnerId, categoryId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as { inventoryIds?: unknown }
  const inventoryIds = Array.isArray(body.inventoryIds)
    ? body.inventoryIds.map((x) => String(x ?? '').trim()).filter(Boolean)
    : []

  const ok = await setCategoryProductsFromPg(pid, categoryId.trim(), inventoryIds)
  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ success: true, inventoryIds })
}
