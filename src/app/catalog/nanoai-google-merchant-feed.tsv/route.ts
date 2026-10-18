import { NextRequest, NextResponse } from 'next/server'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { buildNanoAiGoogleMerchantFeedTsv } from '@/lib/catalog/nanoai-platform-catalog-feeds'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Scheduled fetch URL for Google Merchant Center (Shopping ads). */
export async function GET(request: NextRequest) {
  const origin = getPublicAppUrlForServer(request)
  const buf = buildNanoAiGoogleMerchantFeedTsv(origin)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'text/tab-separated-values; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
