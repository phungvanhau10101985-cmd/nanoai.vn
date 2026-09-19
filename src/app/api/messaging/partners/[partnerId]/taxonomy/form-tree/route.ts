import { NextResponse } from 'next/server'
import { fetchPartnerTaxonomyFormTreeFromPg } from '@/lib/db/messaging-partner-taxonomy-import-pg'
import { requireTaxonomyPartner } from '../_shared'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error
  const tree = await fetchPartnerTaxonomyFormTreeFromPg(gate.partnerId)
  return NextResponse.json({ tree })
}
