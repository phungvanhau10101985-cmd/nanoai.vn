import { NextRequest, NextResponse } from 'next/server'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { buildNanoAiTikTokCatalogFeedCsv } from '@/lib/catalog/nanoai-platform-catalog-feeds'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Scheduled fetch URL for TikTok Ads catalog. sku_id matches remarketing content id. */
export async function GET(request: NextRequest) {
  const origin = getPublicAppUrlForServer(request)
  const buf = buildNanoAiTikTokCatalogFeedCsv(origin)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
