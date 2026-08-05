import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { requireMessagingPartnerInventoryAccess } from '@/lib/messaging/partner-inventory-route-auth'
import {
  runPartnerExternalCatalogSyncJob,
  type ExternalCatalogSyncOutcome,
} from '@/lib/messaging/partner-inventory-external-catalog-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Đồng bộ kho lớn (~70 trang × 500 SP) + upsert Postgres — cần thời gian dài hơn Server Action mặc định. */
export const maxDuration = 600

function revalidateMessagingDashboard() {
  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
}

export async function POST(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerInventoryAccess(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const outcome: ExternalCatalogSyncOutcome = await runPartnerExternalCatalogSyncJob({
    partnerId,
    deferEmbeddings: true,
    reportLocale: getCurrentWebLocale(),
    reportSource: 'manual',
  })
  revalidateMessagingDashboard()
  return NextResponse.json({ ok: true, outcome })
}
