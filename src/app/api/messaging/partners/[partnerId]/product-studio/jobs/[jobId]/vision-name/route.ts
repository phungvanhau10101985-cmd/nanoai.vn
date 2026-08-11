import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchProductStudioJobByIdPg,
  updateProductStudioJobPg,
} from '@/lib/db/messaging-partner-product-studio-jobs-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { nameProductFromReferenceImage } from '@/lib/partner-website/product-studio/product-studio-vision-naming'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** PS.6 — Gemini Vision đọc ảnh màu chính đã duyệt, đề xuất tên SEO khi mode AI để trống tên. */
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

  const job = await fetchProductStudioJobByIdPg(pid, jobId.trim())
  if (!job) return NextResponse.json({ error: 'job_not_found' }, { status: 404 })

  const refImage =
    job.studio.mainImage || job.studio.colors[0]?.img || job.payload.refImageUrls?.[0] || ''
  if (!refImage) return NextResponse.json({ error: 'no_image_available' }, { status: 400 })

  const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
  const naming = await nameProductFromReferenceImage(job.createdBy, refImage, job.payload, website?.locale ?? 'vi')
  if (!naming) return NextResponse.json({ error: 'vision_naming_failed' }, { status: 502 })

  await updateProductStudioJobPg({
    partnerId: pid,
    jobId: jobId.trim(),
    visionProductName: naming.name,
    visionAnalysis: naming.analysis,
    visionColors: naming.colors,
  })

  return NextResponse.json({ name: naming.name, analysis: naming.analysis, colors: naming.colors })
}
