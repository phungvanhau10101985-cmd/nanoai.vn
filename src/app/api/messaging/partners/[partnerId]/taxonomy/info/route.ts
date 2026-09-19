import { NextResponse } from 'next/server'
import { fetchPartnerTaxonomyInfoFromPg } from '@/lib/db/messaging-partner-taxonomy-import-pg'
import { jsonTaxonomyError, requireTaxonomyPartner } from '../_shared'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error

  const info = await fetchPartnerTaxonomyInfoFromPg(gate.partnerId)
  if (!info) return jsonTaxonomyError('Could not load taxonomy info', 500)
  return NextResponse.json(info)
}
