import { createClient } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'
import { DEFAULT_WEB_LOCALE, LOCALE_COOKIE_NAME, normalizeWebLocale } from '@/lib/i18n/config'

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)
  const cookieLocale = normalizeWebLocale(request.cookies.get(LOCALE_COOKIE_NAME)?.value)

  const { data: { session } } = await supabase.auth.getSession() // Refresh session for Server Components
  const accountLocale = normalizeWebLocale((session?.user?.user_metadata as { web_locale?: string } | undefined)?.web_locale)
  const locale = accountLocale || cookieLocale || DEFAULT_WEB_LOCALE
  response.cookies.set(LOCALE_COOKIE_NAME, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  if (session) {
    response.cookies.set(FORCE_REAL_LOGIN_COOKIE, '', { path: '/', maxAge: 0 })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico, images
     * - /api/* (API routes, webhook - không cần auth session)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
