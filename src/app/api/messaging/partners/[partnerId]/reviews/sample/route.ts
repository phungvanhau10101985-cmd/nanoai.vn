import { NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { buildReviewImportSampleXlsx } from '@/lib/partner-website/reviews/partner-reviews-qa-excel'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const buf = buildReviewImportSampleXlsx()
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="danh_gia_san_pham_mau.xlsx"',
    },
  })
}
