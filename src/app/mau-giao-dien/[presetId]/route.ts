import { NextResponse } from 'next/server'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { buildShopTemplateSampleHtml } from '@/lib/partner-website/template/build-shop-template-sample-html'

export const dynamic = 'force-dynamic'

/** Full sample website HTML for a gallery preset (viewable without applying). */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ presetId: string }> }
) {
  const { presetId } = await ctx.params
  const url = new URL(req.url)
  const locale: WebLocale = normalizeWebLocale(url.searchParams.get('locale')) ?? 'vi'
  const built = buildShopTemplateSampleHtml({
    presetId: decodeURIComponent(presetId || '').trim(),
    locale,
  })
  if (!built.ok) {
    return new NextResponse(built.error, { status: 404 })
  }
  return new NextResponse(built.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
