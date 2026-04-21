import { NextResponse } from 'next/server'
import { deleteHospitalityRoomImagePg } from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ partnerId: string; imageId: string }> }
) {
  const { partnerId, imageId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const ok = await deleteHospitalityRoomImagePg(partnerId, imageId)
  if (!ok) return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
