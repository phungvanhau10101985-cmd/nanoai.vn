import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { isPgConfigured } from '@/lib/db/pool'
import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import { readGuestAccountIdFromRequest } from '@/lib/messaging/guest-account-session'
import { readGuestSessionIdFromRequest } from '@/lib/messaging/guest-auth-session'
import { geminiProductSearchFromImageBufferViaVectorDb } from '@/lib/messaging/partner-gemini-image-search'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { fetchInventoryRowsBySemanticTextForPartnerAi } from '@/lib/messaging/partner-inventory-text-embedding'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'X-Embed-Key, X-Session-Id, X-Guest-Session-Id')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

function inventoryRowToProductCard(row: MessagingPartnerInventoryRow): PartnerAiProductCard | null {
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
  const pv = (row.product_video_url ?? '').trim()
  if (pv && /^https?:\/\//i.test(pv)) out.product_video_url = pv
  return out
}

async function authorizeGuestChatForPartner(request: NextRequest, partnerEmbedKey: string) {
  const headerEmbedKey = request.headers.get('x-embed-key')?.trim() || ''
  const sessionId = request.headers.get('x-session-id')?.trim() || ''
  const isEmbed = Boolean(headerEmbedKey && isValidMessagingGuestSessionId(sessionId))

  if (isEmbed) {
    if (!partnerEmbedKey || partnerEmbedKey !== headerEmbedKey) {
      return { ok: false as const, status: 401 as const, error: 'Unauthorized' }
    }
    return { ok: true as const, userId: null as string | null, isEmbed: true as const }
  }

  const user = await getEmailSessionUser()
  if (user?.id) {
    return { ok: true as const, userId: user.id, isEmbed: false as const }
  }
  const accountIdFromCookie = readGuestAccountIdFromRequest(request)
  if (accountIdFromCookie) {
    return { ok: true as const, userId: null as string | null, isEmbed: false as const }
  }
  const sessionFromCookie = readGuestSessionIdFromRequest(request)
  if (!sessionFromCookie) {
    return { ok: false as const, status: 401 as const, error: 'Unauthorized' }
  }
  return { ok: true as const, userId: null as string | null, isEmbed: false as const }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    const res = NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
    return request.headers.get('x-embed-key') ? cors(res) : res
  }
  const partner = await resolveFashionMessagingPartnerBySlug(slug)
  if (!partner) {
    const res = NextResponse.json({ error: 'Not found' }, { status: 404 })
    return request.headers.get('x-embed-key') ? cors(res) : res
  }

  const gate = await authorizeGuestChatForPartner(request, partner.embed_key)
  if (!gate.ok) {
    const res = NextResponse.json({ error: gate.error }, { status: gate.status })
    return gate.status === 401 && request.headers.get('x-embed-key') ? cors(res) : res
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    const res = NextResponse.json({ error: 'BAD_FORM' }, { status: 400 })
    return gate.isEmbed ? cors(res) : res
  }

  const mode = String(form.get('mode') ?? '').trim().toLowerCase()
  const userIdForUsage = gate.userId

  const json = (body: Record<string, unknown>, status = 200) => {
    const res = NextResponse.json(body, { status })
    return gate.isEmbed ? cors(res) : res
  }

  if (mode === 'text') {
    const q = String(form.get('q') ?? form.get('query') ?? '').trim()
    if (q.length < 2) {
      return json({ error: 'QUERY_SHORT' }, 400)
    }
    const rows = await fetchInventoryRowsBySemanticTextForPartnerAi(partner.id, q, 48)
    const cards: PartnerAiProductCard[] = []
    for (const row of rows) {
      const c = inventoryRowToProductCard(row)
      if (c) cards.push(c)
    }
    return json({ ok: true, mode: 'text', cards })
  }

  if (mode === 'image') {
    const file = form.get('file')
    if (!file || !(file instanceof Blob)) {
      return json({ error: 'NO_FILE' }, 400)
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return json({ error: 'FILE_TOO_LARGE' }, 400)
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const res = await geminiProductSearchFromImageBufferViaVectorDb(buf, partner.id, {
      maxResults: 48,
      userId: userIdForUsage,
    })
    if (res.error) {
      return json({ ok: false, error: res.error }, 500)
    }
    const cards: PartnerAiProductCard[] = []
    for (const c of res.candidates ?? []) {
      const image_url = (c.image_url ?? '').trim()
      const product_url = (c.product_url ?? '').trim()
      if (!/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) continue
      const base: PartnerAiProductCard = {
        name: (c.name ?? '').trim() || 'Sản phẩm',
        image_url,
        product_url,
        inventory_id: c.inventoryId,
      }
      if (c.price_hint?.trim()) base.price_hint = c.price_hint.trim()
      if (c.sku?.trim()) base.sku = c.sku.trim().slice(0, 128)
      cards.push(base)
    }
    return json({ ok: true, mode: 'image', cards })
  }

  return json({ error: 'BAD_MODE' }, 400)
}
