import { NextRequest, NextResponse } from 'next/server'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { buildNanoAiFacebookCatalogFeedCsv } from '@/lib/catalog/nanoai-facebook-catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Friendly CSV URL for Meta catalog import.
 * Example: https://your-domain.com/catalog/nanoai-facebook-feed.csv
 */
export async function GET(request: NextRequest) {
  const origin = getPublicAppUrlForServer(request)
  const buf = buildNanoAiFacebookCatalogFeedCsv(origin)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
