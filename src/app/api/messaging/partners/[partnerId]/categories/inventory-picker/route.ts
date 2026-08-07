import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** Danh sách sản phẩm rút gọn cho modal "Gán sản phẩm vào danh mục" (W4.5). */
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

  const page = Math.max(0, Number(req.nextUrl.searchParams.get('page') || 0) || 0)
  const pageSize = Math.min(100, Math.max(20, Number(req.nextUrl.searchParams.get('pageSize') || 60) || 60))
  const from = page * pageSize
  const inv = await fetchPartnerInventoryActivePageWithCountFromPg(pid, from, pageSize)
  if (!inv) return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })

  return NextResponse.json({
    rows: inv.rows.map((r) => ({
      id: r.id,
      name: r.name?.trim() || r.sku || 'Product',
      sku: r.sku,
      priceHint: r.price_hint?.trim() || '',
      imageUrl: r.image_url?.trim() || '',
    })),
    page,
    pageSize,
    totalCount: inv.count,
  })
}
