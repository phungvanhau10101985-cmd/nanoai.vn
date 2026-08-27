import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchPartnerProductQuestionsForAdminFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M1.3 — danh sách Q&A admin (phân trang 10/dòng, gồm inactive + câu trả lời). Gate: `inventory`. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const url = req.nextUrl
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') ?? 10) || 10))
  const inventoryId = url.searchParams.get('inventoryId') || undefined
  const groupRaw = url.searchParams.get('importGroup')
  const importGroup =
    groupRaw != null && groupRaw.trim() !== '' && Number.isFinite(Number(groupRaw))
      ? Number(groupRaw)
      : undefined
  const sourceRaw = url.searchParams.get('source')
  const source =
    sourceRaw === 'real' || sourceRaw === 'imported' || sourceRaw === 'all' ? sourceRaw : undefined

  const result = await fetchPartnerProductQuestionsForAdminFromPg({
    partnerId: pid,
    page,
    pageSize,
    inventoryId,
    importGroup,
    source,
  })
  if (result === null) return NextResponse.json({ error: 'Could not load questions' }, { status: 500 })
  return NextResponse.json({ questions: result.rows, total: result.total, page, pageSize })
}
