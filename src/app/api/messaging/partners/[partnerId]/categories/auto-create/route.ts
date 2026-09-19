import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerAllowAutoCreateCategoriesFromPg,
  updatePartnerAllowAutoCreateCategoriesFromPg,
} from '@/lib/db/messaging-partner-category-auto-create-pg'
import { jsonTaxonomyError, requireTaxonomyPartner } from '../../taxonomy/_shared'

/** Công tắc tự tạo L1/L2/L3 khi cào / đăng SP. Quyền `inventory`. */
export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error

  const allowAutoCreate = await fetchPartnerAllowAutoCreateCategoriesFromPg(gate.partnerId)
  return NextResponse.json({ allowAutoCreate })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error

  const body = (await req.json().catch(() => ({}))) as { allowAutoCreate?: unknown }
  if (typeof body.allowAutoCreate !== 'boolean') {
    return jsonTaxonomyError('allowAutoCreate required', 400)
  }

  const saved = await updatePartnerAllowAutoCreateCategoriesFromPg(gate.partnerId, body.allowAutoCreate)
  if (saved == null) return jsonTaxonomyError('Could not save auto-create setting', 500)
  return NextResponse.json({ success: true, allowAutoCreate: saved })
}
