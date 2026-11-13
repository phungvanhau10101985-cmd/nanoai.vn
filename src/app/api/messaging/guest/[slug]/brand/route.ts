import { NextRequest, NextResponse } from 'next/server'
import { pgQueryOne } from '@/lib/db/pg-query'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'

function httpsUrlOrNull(raw: unknown): string | null {
  const t = String(raw || '').trim()
  return /^https:\/\//i.test(t) ? t : null
}

/** Tên hiển thị shop cho widget nhúng (script trên domain khác cần CORS). */
export const dynamic = 'force-dynamic'

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveFashionMessagingPartnerBySlug(decodeURIComponent(slug))
  if (!partner) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: CORS })
  }
  const displayName = partner.display_name?.trim() ?? ''
  let chatIconLogoUrl: string | null = null
  try {
    const row = await pgQueryOne<{ chat_icon_url: string | null }>(
      `select nullif(btrim(w.theme_json->>'chatIconLogoUrl'), '') as chat_icon_url
         from public.messaging_partner_websites w
        where w.partner_id = $1::uuid
        limit 1`,
      [partner.id]
    )
    chatIconLogoUrl = httpsUrlOrNull(row?.chat_icon_url)
  } catch {
    chatIconLogoUrl = null
  }
  return NextResponse.json(
    { displayName, ...(chatIconLogoUrl ? { chatIconLogoUrl } : {}) },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    }
  )
}
