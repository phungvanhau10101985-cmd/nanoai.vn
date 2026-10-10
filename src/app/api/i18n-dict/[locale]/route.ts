import { NextResponse } from 'next/server'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale } from '@/lib/i18n/config'
import { clientDictionaryScript } from '@/lib/i18n/client-dictionary-script'

export const runtime = 'nodejs'

export function GET(request: Request, { params }: { params: { locale: string } }) {
  const locale = normalizeWebLocale(params.locale)
  if (!locale || locale === DEFAULT_WEB_LOCALE) {
    return new NextResponse('/* bundled */', {
      status: locale ? 200 : 404,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    })
  }
  const { body, version } = clientDictionaryScript(locale)
  const pinned = new URL(request.url).searchParams.get('v') === version
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': pinned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    },
  })
}
