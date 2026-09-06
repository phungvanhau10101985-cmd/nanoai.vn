import { NextRequest, NextResponse } from 'next/server'
import {
  APP_LOGIN_NEXT_HEADER,
  APP_LOGIN_NEXT_HEADER_LEGACY,
  PARTNER_CUSTOM_DOMAIN_HEADER,
  PARTNER_LIVE_DEVICE_COOKIE,
  PARTNER_VISUAL_DEVICE_HEADER,
} from '@/lib/auth/app-request-headers'
import { getJwtUserFromRequest } from '@/lib/auth/email-jwt-middleware'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import {
  DEFAULT_WEB_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_NAME_LEGACY,
  normalizeWebLocale,
} from '@/lib/i18n/config'
import { isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'
import {
  mapPartnerCustomDomainPathToInternal,
  mapPartnerInternalPathToPublic,
} from '@/lib/messaging/partner-custom-domain-site-path'
import { getInternalBaseUrl } from '@/lib/internal-url'

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

function parseVisualDeviceToken(raw: string): string {
  const value = raw.trim().toLowerCase()
  return value === 'mobile' || value === 'tablet' || value === 'laptop' || value === 'desktop'
    ? value
    : ''
}

/** Query `?pw-device=` thắng. Cookie live (viewport đổi máy) chỉ khi không có query. Xóa header client tự gắn. */
function applyVisualDeviceHeader(headers: Headers, request: NextRequest) {
  const fromQuery = parseVisualDeviceToken(request.nextUrl.searchParams.get('pw-device') || '')
  if (fromQuery) {
    headers.set(PARTNER_VISUAL_DEVICE_HEADER, fromQuery)
    return
  }
  const fromCookie = parseVisualDeviceToken(request.cookies.get(PARTNER_LIVE_DEVICE_COOKIE)?.value || '')
  if (fromCookie) {
    headers.set(PARTNER_VISUAL_DEVICE_HEADER, fromCookie)
    return
  }
  headers.delete(PARTNER_VISUAL_DEVICE_HEADER)
}

function partnerCustomDomainRewrite(
  request: NextRequest,
  rewriteUrl: URL,
  host: string,
  internalPath: string
): NextResponse {
  const requestHeaders = new Headers(request.headers)
  applyVisualDeviceHeader(requestHeaders, request)
  requestHeaders.set(PARTNER_CUSTOM_DOMAIN_HEADER, host)
  requestHeaders.set(APP_LOGIN_NEXT_HEADER, internalPath)
  requestHeaders.set(APP_LOGIN_NEXT_HEADER_LEGACY, internalPath)
  const rewriteResponse = NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  })
  rewriteResponse.headers.set(PARTNER_CUSTOM_DOMAIN_HEADER, host)
  applyCommonResponseHeaders(rewriteResponse, request)
  const cookieLocale = localeFromRequestCookies(request)
  mirrorLocaleCookies(rewriteResponse, cookieLocale || DEFAULT_WEB_LOCALE)
  return rewriteResponse
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
  ;['RSC', 'Next-Router-State-Tree', 'Next-Router-Prefetch', 'Accept-Encoding', 'Sec-CH-Viewport-Width'].forEach(
    (token) => varyTokens.add(token)
  )
  response.headers.set('Vary', Array.from(varyTokens).join(', '))
  response.headers.append('Accept-CH', 'Sec-CH-Viewport-Width, Sec-CH-DPR')

  // Shop consultation surfaces are operational chat UIs, not public SEO pages.
  if (request.nextUrl.pathname.startsWith('/messaging/p/')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
}

export async function middleware(request: NextRequest) {
  const hostHeader =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.split(',')[0]?.trim() ||
    ''
  const host = hostHeader.split(':')[0]?.toLowerCase() ?? ''

  if (host && !isPlatformAppHostname(host)) {
    try {
      const resolveUrl = new URL('/api/messaging/resolve-host', `${getInternalBaseUrl()}/`)
      resolveUrl.searchParams.set('host', host)
      const res = await fetch(resolveUrl.toString(), {
        headers: {
          'x-forwarded-host': hostHeader,
          host: hostHeader,
          'x-forwarded-proto': request.headers.get('x-forwarded-proto') ?? 'https',
        },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as {
          found?: boolean
          rewriteRootPath?: string
          siteSlug?: string | null
          useForSite?: boolean
          sitePublished?: boolean
          canonicalHostname?: string | null
        }
        if (data.found) {
          const path = request.nextUrl.pathname
          const siteSlug = data.siteSlug?.trim() || ''
          const sitePublished = data.useForSite !== false && data.sitePublished && siteSlug
          const canonicalHost = data.canonicalHostname?.trim().toLowerCase() || ''
          const publicPath =
            sitePublished ? mapPartnerInternalPathToPublic(siteSlug, path) ?? path : path

          if (canonicalHost && canonicalHost !== host && !path.startsWith('/.well-known/')) {
            const dest = new URL(`https://${canonicalHost}${publicPath}`)
            dest.search = request.nextUrl.search
            return NextResponse.redirect(dest, 301)
          }

          if (sitePublished) {
            if (publicPath !== path) {
              const redirectUrl = request.nextUrl.clone()
              redirectUrl.pathname = publicPath
              return NextResponse.redirect(redirectUrl, 308)
            }

            const internalPath = mapPartnerCustomDomainPathToInternal(siteSlug, path)
            if (internalPath) {
              const rewriteUrl = request.nextUrl.clone()
              rewriteUrl.pathname = internalPath
              return partnerCustomDomainRewrite(request, rewriteUrl, host, internalPath)
            }
          } else if ((path === '/' || path === '') && data.rewriteRootPath) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = data.rewriteRootPath
            return partnerCustomDomainRewrite(request, rewriteUrl, host, data.rewriteRootPath)
          }
        }
      }
    } catch {
      /* fall through to normal routing */
    }
  }

  const pathForLogin = request.nextUrl.pathname + (request.nextUrl.search || '')
  const forwarded = new Headers(request.headers)
  applyVisualDeviceHeader(forwarded, request)
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
    '/((?!_next/static|_next/image|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
