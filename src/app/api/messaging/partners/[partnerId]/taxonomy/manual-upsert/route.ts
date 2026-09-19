import { NextRequest, NextResponse } from 'next/server'
import {
  executePartnerTaxonomySheetsFromPg,
  fetchPartnerCategoryByExternalIdFromPg,
  fetchPartnerSeoClusterByExternalIdFromPg,
} from '@/lib/db/messaging-partner-taxonomy-import-pg'
import {
  buildManualTaxonomySheets,
  type TaxonomyManualUpsertInput,
} from '@/lib/partner-website/category/partner-category-taxonomy-import'
import { jsonTaxonomyError, requireTaxonomyPartner } from '../_shared'

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireTaxonomyPartner(partnerId)
  if ('error' in gate) return gate.error

  const body = (await req.json().catch(() => ({}))) as TaxonomyManualUpsertInput
  const cat1Ext = String(body.cat1ExistingExternalId ?? '').trim()
  const cat2Ext = String(body.cat2ExistingExternalId ?? '').trim()
  const clusterExt = String(body.clusterExistingExternalId ?? '').trim()

  const existingCat1 = cat1Ext ? await fetchPartnerCategoryByExternalIdFromPg(gate.partnerId, cat1Ext) : null
  const existingCat2 = cat2Ext ? await fetchPartnerCategoryByExternalIdFromPg(gate.partnerId, cat2Ext) : null
  const existingCluster = clusterExt
    ? await fetchPartnerSeoClusterByExternalIdFromPg(gate.partnerId, clusterExt)
    : null

  let sheets
  try {
    sheets = buildManualTaxonomySheets({
      body,
      existingCat1: existingCat1
        ? {
            externalId: existingCat1.external_id || cat1Ext,
            name: existingCat1.name,
            slug: existingCat1.slug,
            level: existingCat1.depth,
          }
        : null,
      existingCat2: existingCat2
        ? {
            externalId: existingCat2.external_id || cat2Ext,
            name: existingCat2.name,
            slug: existingCat2.slug,
            level: existingCat2.depth,
            parentExternalId: existingCat2.parent_external_id || '',
          }
        : null,
      existingCluster: existingCluster
        ? { externalId: existingCluster.external_id, slug: existingCluster.slug, name: existingCluster.name }
        : null,
    }).sheets
  } catch (e) {
    return jsonTaxonomyError(e instanceof Error ? e.message : 'invalid_manual_form')
  }

  const result = await executePartnerTaxonomySheetsFromPg(gate.partnerId, sheets)
  if (!result.ok) return jsonTaxonomyError(result.error, 500)
  return NextResponse.json(result)
}
