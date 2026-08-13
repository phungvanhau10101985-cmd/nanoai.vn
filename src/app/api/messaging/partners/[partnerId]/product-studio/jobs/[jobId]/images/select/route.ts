import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { selectProductStudioImages } from '@/lib/partner-website/product-studio/product-studio-slot-pipeline'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** PS.5 — chọn lại ảnh gallery / chi tiết từ ảnh đã tạo trong Studio trước khi đăng (giống 188). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; jobId: string }> }
) {
  const { partnerId, jobId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as { kind?: string; urls?: string[] }
  const kind = body.kind === 'detail' ? 'detail' : body.kind === 'gallery' ? 'gallery' : null
  if (!kind) return NextResponse.json({ error: 'kind_must_be_gallery_or_detail' }, { status: 400 })

  const result = await selectProductStudioImages(pid, jobId.trim(), kind, Array.isArray(body.urls) ? body.urls : [])
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job })
}
