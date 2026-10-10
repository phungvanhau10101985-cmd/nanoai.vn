import { NextRequest, NextResponse } from 'next/server'
import {
  parsePartnerShopRuntimeFileName,
  rebuildPartnerShopRuntimeJs,
} from '@/lib/partner-website/shop/pw-shop-hashed-runtime'
import { staticShopRuntimeForFile } from '@/lib/partner-website/shop/pw-shop-static-runtime'

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

function js(body: string, cacheControl: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  })
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ file: string }> }
) {
  const { file } = await context.params
  const parsed = parsePartnerShopRuntimeFileName(file)
  if (parsed) {
    const body = rebuildPartnerShopRuntimeJs(parsed.name, parsed.siteSlug, parsed.locale)
    return body ? js(body, IMMUTABLE_CACHE) : new NextResponse('Not found', { status: 404 })
  }
  const staticFile = staticShopRuntimeForFile(file)
  if (!staticFile) {
    return new NextResponse('Not found', { status: 404 })
  }
  return js(staticFile.body, staticFile.current ? IMMUTABLE_CACHE : 'public, max-age=300')
}
