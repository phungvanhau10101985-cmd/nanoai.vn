import { NextRequest, NextResponse } from 'next/server'
import { executePartnerTaxonomySheetsFromPg } from '@/lib/db/messaging-partner-taxonomy-import-pg'
import { parseTaxonomyWorkbook } from '@/lib/partner-website/category/partner-category-taxonomy-import'
import { jsonTaxonomyError, requireTaxonomyPartner, taxonomyFileBuffer } from '../_shared'

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error

  const file = await taxonomyFileBuffer(req)
  if ('error' in file) return file.error

  const parsed = parseTaxonomyWorkbook(file.buffer)
  if (!parsed.ok) return jsonTaxonomyError(parsed.error)

  const result = await executePartnerTaxonomySheetsFromPg(gate.partnerId, parsed.sheets)
  if (!result.ok) return jsonTaxonomyError(result.error, 500)
  return NextResponse.json(result)
}
