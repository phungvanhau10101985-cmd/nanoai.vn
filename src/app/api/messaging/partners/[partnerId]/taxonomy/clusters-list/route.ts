import { NextResponse } from 'next/server'
import { fetchPartnerTaxonomyClustersFromPg } from '@/lib/db/messaging-partner-taxonomy-import-pg'
import { requireTaxonomyPartner } from '../_shared'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error
  const clusters = await fetchPartnerTaxonomyClustersFromPg(gate.partnerId)
  return NextResponse.json({ clusters })
}
