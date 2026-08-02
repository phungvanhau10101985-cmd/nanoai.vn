import { NextResponse } from 'next/server'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { buildShopTemplateSampleHtml } from '@/lib/partner-website/template/build-shop-template-sample-html'

export const dynamic = 'force-dynamic'

/** Public HTML preview for template gallery (no auth / partner required). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const presetId = (url.searchParams.get('presetId') || 'fashion-orange').trim()
  const localeRaw = (url.searchParams.get('locale') || 'vi').trim()
  const locale: WebLocale = normalizeWebLocale(localeRaw) ?? 'vi'

  const built = buildShopTemplateSampleHtml({ presetId, locale })
  if (!built.ok) {
    return new NextResponse(built.error, { status: 404 })
  }

  return new NextResponse(built.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}
