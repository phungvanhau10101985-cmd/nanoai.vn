import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { parseInventoryWorkbook } from '@/lib/messaging/partner-inventory-excel'
import { upsertPartnerInventoryBatch } from '@/lib/messaging/partner-inventory-upsert-batch'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 2_000_000

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

  const { supabase } = gate
  const batch = await upsertPartnerInventoryBatch(supabase, partnerId, parsed.rows)
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: 500 })

  const visionBgSyncQueued = false

  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
  revalidatePath('/dashboard/api-integration')

  return NextResponse.json({
    ok: true,
    count: parsed.rows.length,
    inserted: batch.inserted,
    updated: batch.updated,
    deleted: batch.deleted,
    vision_bg_sync_queued: visionBgSyncQueued,
  })
}
