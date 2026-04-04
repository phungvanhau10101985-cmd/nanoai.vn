import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'
import { runVisionCatalogSync } from '@/lib/messaging/partner-vision-product-search'
import { kickVisionWarehouseReindexIfPending } from '@/lib/messaging/partner-vision-warehouse-runner'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 660

export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let resumeAfterId: string | null = null
  try {
    const body = (await req.json()) as { resumeAfterId?: unknown }
    if (typeof body?.resumeAfterId === 'string' && body.resumeAfterId.trim()) {
      resumeAfterId = body.resumeAfterId.trim()
    }
  } catch {
    /* empty body */
  }

  const db = createServiceRoleClient()
  const { data: settings, error } = await db
    .from('messaging_partner_ai_settings')
    .select('*')
    .eq('partner_id', partnerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!settings) {
    return NextResponse.json({ error: 'Save AI settings once before syncing the image catalog.' }, { status: 400 })
  }

  const r = await runVisionCatalogSync(db, partnerId, settings, { resumeAfterId })
  if ('error' in r) {
    return NextResponse.json({ error: r.error }, { status: 400 })
  }
  let reindexKick: Awaited<ReturnType<typeof kickVisionWarehouseReindexIfPending>> = { step: 'kick_exception' }
  try {
    reindexKick = await kickVisionWarehouseReindexIfPending(db, { errorScopePartnerId: partnerId })
  } catch (e) {
    console.error('[vision-catalog-sync] reindex kick', e)
    reindexKick = {
      step: 'kick_exception',
      detail: e instanceof Error ? e.message : String(e),
    }
  }
  revalidatePath('/dashboard/messaging')
  return NextResponse.json({ ...r, reindexKick })
}
