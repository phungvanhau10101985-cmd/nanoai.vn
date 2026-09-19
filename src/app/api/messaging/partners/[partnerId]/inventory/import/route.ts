import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { parseInventoryWorkbook } from '@/lib/messaging/partner-inventory-excel'
import { upsertPartnerInventoryBatch } from '@/lib/messaging/partner-inventory-upsert-batch'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'
import { syncPartnerInventoryTextEmbeddings } from '@/lib/messaging/partner-inventory-text-embedding'
import { requireMessagingPartnerInventoryAccess } from '@/lib/messaging/partner-inventory-route-auth'
import { fetchPartnerAllowAutoCreateCategoriesFromPg } from '@/lib/db/messaging-partner-category-auto-create-pg'
import {
  CATEGORY_AUTO_CREATE_DISABLED,
  CATEGORY_AUTO_CREATE_DISABLED_MESSAGE,
} from '@/lib/partner-website/category/partner-category-auto-create-copy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 600

const MAX_BYTES = 20 * 1024 * 1024

export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerInventoryAccess(partnerId)
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

  const hasWebCatalogRows = parsed.rows.some((r) => r.catalogFormat === '188' && !r.removeFromInventory)
  if (hasWebCatalogRows) {
    const allowCreate = await fetchPartnerAllowAutoCreateCategoriesFromPg(partnerId)
    if (!allowCreate) {
      return NextResponse.json(
        {
          ok: false,
          error: CATEGORY_AUTO_CREATE_DISABLED,
          detail: CATEGORY_AUTO_CREATE_DISABLED_MESSAGE,
        },
        { status: 409 }
      )
    }
  }

  const batch = await upsertPartnerInventoryBatch(partnerId, parsed.rows)
  if (!batch.ok) {
    if (batch.error === CATEGORY_AUTO_CREATE_DISABLED) {
      return NextResponse.json(
        {
          ok: false,
          error: CATEGORY_AUTO_CREATE_DISABLED,
          detail: CATEGORY_AUTO_CREATE_DISABLED_MESSAGE,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: batch.error }, { status: 500 })
  }

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
    void syncPartnerInventoryTextEmbeddings(partnerId, { force: false, limit: warmupLimit })
      .then((warmup) => {
        if (!warmup.ok) {
          console.warn('[inventory-import] text embedding warmup failed', { partnerId, error: warmup.error })
        }
      })
      .catch((e) => {
        console.warn('[inventory-import] text embedding warmup error', { partnerId, error: e })
      })
  }

  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
  revalidatePath('/dashboard/api-integration')

  const skippedCat = batch.categoryAutoCreateSkipped ?? []
  const warnings = [...(parsed.warnings ?? [])]
  for (const row of skippedCat) {
    warnings.push({
      row_number: 0,
      sku: row.sku,
      name: row.name,
      field: 'category',
      code: 'CATEGORY_AUTO_CREATE_DISABLED',
      raw_value: '',
      normalized_value: '',
      message: CATEGORY_AUTO_CREATE_DISABLED_MESSAGE,
    })
  }

  return NextResponse.json({
    ok: true,
    count: parsed.rows.length,
    inserted: batch.inserted,
    updated: batch.updated,
    deleted: batch.deleted,
    embeddings_deferred: batch.embeddingsDeferred,
    warnings,
    warnings_count: warnings.length,
    vision_bg_sync_queued: visionBgSyncQueued,
  })
}
