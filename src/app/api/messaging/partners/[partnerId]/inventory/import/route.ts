import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { parseInventoryWorkbook } from '@/lib/messaging/partner-inventory-excel'
import { upsertPartnerInventoryBatch } from '@/lib/messaging/partner-inventory-upsert-batch'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 600

const MAX_BYTES = 20 * 1024 * 1024

export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'BAD_FORM' }, { status: 400 })
  }
  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const parsed = parseInventoryWorkbook(buf)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const batch = await upsertPartnerInventoryBatch(partnerId, parsed.rows)
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: 500 })

  let visionBgSyncQueued = false
  if (parsed.rows.length > 0) {
    visionBgSyncQueued = true
    const warmupLimit = Math.max(
      20,
      Math.min(1200, parseInt(process.env.MESSAGING_INVENTORY_EMBED_IMPORT_WARMUP_LIMIT || '400', 10) || 400)
    )
    // Fire-and-forget: do not block import response and UI progress at 99%.
    void syncPartnerInventoryEmbeddings(partnerId, { force: false, limit: warmupLimit })
      .then((warmup) => {
        if (!warmup.ok) {
          console.warn('[inventory-import] embedding warmup failed', { partnerId, error: warmup.error })
        }
      })
      .catch((e) => {
        console.warn('[inventory-import] embedding warmup error', { partnerId, error: e })
      })
  }

  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
  revalidatePath('/dashboard/api-integration')

  return NextResponse.json({
    ok: true,
    count: parsed.rows.length,
    inserted: batch.inserted,
    updated: batch.updated,
    deleted: batch.deleted,
    warnings: parsed.warnings ?? [],
    warnings_count: Array.isArray(parsed.warnings) ? parsed.warnings.length : 0,
    vision_bg_sync_queued: visionBgSyncQueued,
  })
}
