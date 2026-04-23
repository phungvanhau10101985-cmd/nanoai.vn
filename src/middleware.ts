import { NextRequest, NextResponse } from 'next/server'
import { APP_LOGIN_NEXT_HEADER, APP_LOGIN_NEXT_HEADER_LEGACY } from '@/lib/auth/app-request-headers'
import { getJwtUserFromRequest } from '@/lib/auth/email-jwt-middleware'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import {
  DEFAULT_WEB_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_NAME_LEGACY,
  normalizeWebLocale,
} from '@/lib/i18n/config'

const LOCALE_COOKIE_OPTS = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const }

function localeFromRequestCookies(request: NextRequest) {
  return (
    normalizeWebLocale(request.cookies.get(LOCALE_COOKIE_NAME)?.value)
    ?? normalizeWebLocale(request.cookies.get(LOCALE_COOKIE_NAME_LEGACY)?.value)
  )
}

function mirrorLocaleCookies(response: NextResponse, locale: string) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, LOCALE_COOKIE_OPTS)
  response.cookies.set(LOCALE_COOKIE_NAME_LEGACY, locale, LOCALE_COOKIE_OPTS)
}

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'

function resolveEmailSessionMaxAgeSec(): number {
  const raw = process.env.EMAIL_SESSION_MAX_AGE_DAYS?.trim()
  const days = raw ? parseInt(raw, 10) : 3650
  const d = Number.isFinite(days) ? Math.min(3650, Math.max(30, days)) : 3650
  return 60 * 60 * 24 * d
}

function refreshEmailSessionCookies(response: NextResponse, request: NextRequest) {
  const token =
    request.cookies.get(EMAIL_SESSION_COOKIE)?.value
    ?? request.cookies.get(EMAIL_SESSION_COOKIE_LEGACY)?.value
  if (!token) return
  const isProd = process.env.NODE_ENV === 'production'
  const maxAge = resolveEmailSessionMaxAgeSec()
  const opts = {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge,
  }
  response.cookies.set(EMAIL_SESSION_COOKIE, token, opts)
  response.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, token, opts)
}

function applyCommonResponseHeaders(response: NextResponse, request: NextRequest) {
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

  // Shop consultation surfaces are operational chat UIs, not public SEO pages.
  if (request.nextUrl.pathname.startsWith('/messaging/p/')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
}

export async function middleware(request: NextRequest) {
  const pathForLogin = request.nextUrl.pathname + (request.nextUrl.search || '')
  const forwarded = new Headers(request.headers)
  forwarded.set(APP_LOGIN_NEXT_HEADER, pathForLogin)
  forwarded.set(APP_LOGIN_NEXT_HEADER_LEGACY, pathForLogin)
  const requestWithLoginNext = new NextRequest(request.url, { headers: forwarded })

  const jwtEarly = await getJwtUserFromRequest(requestWithLoginNext)
  if (jwtEarly) {
    const response = NextResponse.next({
      request: { headers: forwarded },
    })
    const cookieLocale = localeFromRequestCookies(request)
    const locale = cookieLocale || DEFAULT_WEB_LOCALE
    mirrorLocaleCookies(response, locale)
    refreshEmailSessionCookies(response, request)
    response.cookies.set(FORCE_REAL_LOGIN_COOKIE, '', { path: '/', maxAge: 0 })
    applyCommonResponseHeaders(response, request)
    return response
  }

  const response = NextResponse.next({
    request: { headers: forwarded },
  })
  const cookieLocale = localeFromRequestCookies(request)
  const locale = cookieLocale || DEFAULT_WEB_LOCALE
  mirrorLocaleCookies(response, locale)
  applyCommonResponseHeaders(response, request)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
