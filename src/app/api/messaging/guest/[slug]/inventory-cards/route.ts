import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

function rowToCard(row: NonNullable<Awaited<ReturnType<typeof fetchPartnerInventoryRowByIdForPartnerFromPg>>>): PartnerAiProductCard | null {
  const name = (row.name ?? '').trim() || 'Sản phẩm'
  const image_url = (row.image_url ?? '').trim()
  const product_url = (row.product_url ?? '').trim()
  if (!/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  const out: PartnerAiProductCard = {
    name,
    image_url,
    product_url,
    inventory_id: row.id,
  }
  const ph = (row.price_hint ?? '').trim()
  if (ph) out.price_hint = ph
  const sku = (row.sku ?? '').trim()
  if (sku) out.sku = sku.slice(0, 128)
  return out
}

/**
 * GET ?ids=uuid,uuid — thẻ SP công khai theo kho (email CMSN / deep link).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }
  const partner = await resolveFashionMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  const raw = request.nextUrl.searchParams.get('ids') ?? ''
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const ids = parts.filter((id) => UUID_RE.test(id)).slice(0, 15)
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, cards: [] as PartnerAiProductCard[] })
  }
  const cards: PartnerAiProductCard[] = []
  for (const id of ids) {
    const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partner.id, id)
    if (!row) continue
    const c = rowToCard(row)
    if (c) cards.push(c)
  }
  return NextResponse.json({ ok: true, cards })
}
