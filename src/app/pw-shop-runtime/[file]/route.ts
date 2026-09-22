import { NextRequest, NextResponse } from 'next/server'
import {
  parsePartnerShopRuntimeFileName,
  rebuildPartnerShopRuntimeJs,
} from '@/lib/partner-website/shop/pw-shop-hashed-runtime'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> }
) {
  const { file } = await context.params
  const parsed = parsePartnerShopRuntimeFileName(file)
  if (!parsed) {
    return new NextResponse('Not found', { status: 404 })
  }
  const body = rebuildPartnerShopRuntimeJs(parsed.name, parsed.siteSlug, parsed.locale)
  if (!body) {
    return new NextResponse('Not found', { status: 404 })
  }
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
