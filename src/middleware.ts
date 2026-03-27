import { createClient } from '@/lib/supabase/middleware'
import { NextRequest } from 'next/server'
import { DEFAULT_WEB_LOCALE, LOCALE_COOKIE_NAME, normalizeWebLocale } from '@/lib/i18n/config'

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'

export async function middleware(request: NextRequest) {
  const pathForLogin = request.nextUrl.pathname + (request.nextUrl.search || '')
  const forwarded = new Headers(request.headers)
  forwarded.set('x-nanoai-login-next', pathForLogin)
  const requestWithLoginNext = new NextRequest(request.url, { headers: forwarded })

  const { supabase, response } = createClient(requestWithLoginNext)
  const cookieLocale = normalizeWebLocale(request.cookies.get(LOCALE_COOKIE_NAME)?.value)

  const { data: { user } } = await supabase.auth.getUser() // Validate with Auth server (getSession reads from storage, insecure)
  const accountLocale = normalizeWebLocale((user?.user_metadata as { web_locale?: string } | undefined)?.web_locale)
  const locale = accountLocale || cookieLocale || DEFAULT_WEB_LOCALE
  response.cookies.set(LOCALE_COOKIE_NAME, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  if (user) {
    response.cookies.set(FORCE_REAL_LOGIN_COOKIE, '', { path: '/', maxAge: 0 })
  }
  // Prevent edge/browser caches from serving stale HTML/RSC after deploy.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  const existingVary = response.headers.get('Vary') || ''
  const varyTokens = new Set(
    existingVary
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  )
  ;['RSC', 'Next-Router-State-Tree', 'Next-Router-Prefetch', 'Accept-Encoding'].forEach((token) => varyTokens.add(token))
  response.headers.set('Vary', Array.from(varyTokens).join(', '))

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
