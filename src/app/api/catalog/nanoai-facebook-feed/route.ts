import { NextRequest, NextResponse } from 'next/server'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { buildNanoAiFacebookCatalogFeedCsv } from '@/lib/catalog/nanoai-facebook-catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public CSV feed for NanoAI digital products (credits packs).
 * Use this URL in Meta Commerce Manager as a scheduled data feed.
 */
export async function GET(request: NextRequest) {
  const origin = getPublicAppUrlForServer(request)
  const buf = buildNanoAiFacebookCatalogFeedCsv(origin)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
