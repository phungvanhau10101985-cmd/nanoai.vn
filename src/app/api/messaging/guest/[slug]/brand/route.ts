import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'

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
  const partner = await resolveActiveMessagingPartnerBySlug(decodeURIComponent(slug))
  if (!partner) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: CORS })
  }
  const displayName = partner.display_name?.trim() ?? ''
  return NextResponse.json(
    { displayName },
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
