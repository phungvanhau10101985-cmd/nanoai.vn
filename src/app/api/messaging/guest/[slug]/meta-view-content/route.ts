import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowByProductUrlNormKeyFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { runMetaViewContentForConsultInventoryPage } from '@/lib/tracking/meta-view-content-consult-server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

/**
 * Khách bấm «Tư vấn» — ViewContent (CAPI + payload Pixel), dedupe qua event_id.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  let body: { inventoryId?: string; productUrl?: string; eventSourcePath?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const inventoryId = String(body.inventoryId ?? '').trim()
  const productUrl = String(body.productUrl ?? '').trim()
  let eventSourcePath = String(body.eventSourcePath ?? '').trim().slice(0, 2000)
  if (!eventSourcePath.startsWith('/')) {
    eventSourcePath = `/${eventSourcePath.replace(/^\/+/, '')}`
  }
  if (!eventSourcePath) eventSourcePath = '/'

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let row = null as Awaited<ReturnType<typeof fetchPartnerInventoryRowByIdForPartnerFromPg>>
  if (UUID_RE.test(inventoryId)) {
    row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partner.id, inventoryId)
  } else if (productUrl && /^https?:\/\//i.test(productUrl)) {
    row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partner.id, productUrl)
  }

  if (!row) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'no_inventory' }, { status: 200 })
  }

  const meta = await runMetaViewContentForConsultInventoryPage({
    partnerId: partner.id,
    inventoryRow: row,
    eventSourcePath,
  })

  if (!meta) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'no_pixel' }, { status: 200 })
  }

  return NextResponse.json({ ok: true, meta })
}
