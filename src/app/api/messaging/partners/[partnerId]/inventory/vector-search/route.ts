import { NextResponse } from 'next/server'
import { fetchPartnerInventoryRowsByIdsInOrderFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import { geminiProductSearchFromImageBufferViaVectorDb } from '@/lib/messaging/partner-gemini-image-search'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'
import { fetchInventoryRowsBySemanticTextForPartnerAi } from '@/lib/messaging/partner-inventory-text-embedding'
import { getPartnerPublicInventorySearchDefaultLimit } from '@/lib/messaging/partner-public-search-limits'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function stripEmbeddingsForClient(r: MessagingPartnerInventoryRow): MessagingPartnerInventoryRow {
  return {
    ...r,
    image_embedding_json: null,
    text_embedding_json: null,
    image_embedding_vec: null,
    text_embedding_vec: null,
  }
}

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

  const mode = String(form.get('mode') ?? '').trim().toLowerCase()

  if (mode === 'text') {
    const q = String(form.get('q') ?? form.get('query') ?? '').trim()
    if (q.length < 2) {
      return NextResponse.json({ error: 'QUERY_SHORT' }, { status: 400 })
    }
    const rows = await fetchInventoryRowsBySemanticTextForPartnerAi(
      partnerId,
      q,
      getPartnerPublicInventorySearchDefaultLimit()
    )
    return NextResponse.json({
      ok: true,
      mode: 'text' as const,
      rows: rows.map(stripEmbeddingsForClient),
    })
  }

  if (mode === 'image') {
    const file = form.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const res = await geminiProductSearchFromImageBufferViaVectorDb(buf, partnerId, {
      maxResults: getPartnerPublicInventorySearchDefaultLimit(),
      userId: gate.userId,
    })
    if (res.error) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
    }
    const ids = (res.candidates ?? []).map((c) => c.inventoryId).filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, mode: 'image' as const, rows: [] })
    }
    const rows = await fetchPartnerInventoryRowsByIdsInOrderFromPg(partnerId, ids)
    const list = rows ?? []
    return NextResponse.json({
      ok: true,
      mode: 'image' as const,
      rows: list.map(stripEmbeddingsForClient),
    })
  }

  return NextResponse.json({ error: 'BAD_MODE' }, { status: 400 })
}
