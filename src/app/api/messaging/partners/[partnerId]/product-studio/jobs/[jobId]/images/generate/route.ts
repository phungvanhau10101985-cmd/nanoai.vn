import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { generateProductStudioSlot } from '@/lib/partner-website/product-studio/product-studio-slot-pipeline'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { PRODUCT_STUDIO_SLOT_KINDS, type ProductStudioSlotKind } from '@/lib/partner-website/product-studio/product-studio-types'

/** PS.5 — tạo 1 ảnh theo mốc merchant chọn (color/gallery/detail/material), giống 188. */
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

  const body = (await req.json().catch(() => ({}))) as {
    kind?: string
    name?: string
    prompt?: string
    customPrompt?: string
    refUrls?: string[]
    attachUrl?: string
    aspectRatio?: string
  }
  const kind = String(body.kind || '').trim()
  if (!PRODUCT_STUDIO_SLOT_KINDS.includes(kind as ProductStudioSlotKind)) {
    return NextResponse.json({ error: 'kind_required' }, { status: 400 })
  }

  const result = await generateProductStudioSlot(pid, jobId.trim(), {
    kind: kind as ProductStudioSlotKind,
    name: body.name,
    customPrompt: body.customPrompt || body.prompt,
    refUrls: Array.isArray(body.refUrls) ? body.refUrls : undefined,
    attachUrl: body.attachUrl,
    aspectRatio: body.aspectRatio,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job })
}
