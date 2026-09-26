import { NextRequest, NextResponse } from 'next/server'
import {
  APP_LOGIN_NEXT_HEADER,
  APP_LOGIN_NEXT_HEADER_LEGACY,
  PARTNER_CUSTOM_DOMAIN_HEADER,
  PARTNER_SITE_SLUG_HEADER,
  PARTNER_VISUAL_DEVICE_HEADER,
  partnerSiteSlugFromPathname,
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
import {
  PARTNER_CUSTOM_DOMAIN_SLUG_COOKIE,
  PARTNER_CUSTOM_DOMAIN_SLUG_MAX_AGE_SEC,
  readSignedPartnerCustomDomainSlug,
  signPartnerCustomDomainSlugCookie,
  trustedPartnerSiteSlugFromEdgeHeaders,
} from '@/lib/messaging/partner-custom-domain-slug-cookie'

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

/** Query `?pw-device=` thắng. Cookie live không gắn header — phone/tablet UA phải thắng cookie cũ. */
function applyVisualDeviceHeader(headers: Headers, request: NextRequest) {
  const fromQuery = parseVisualDeviceToken(request.nextUrl.searchParams.get('pw-device') || '')
  if (fromQuery) {
    headers.set(PARTNER_VISUAL_DEVICE_HEADER, fromQuery)
    return
  }
  headers.delete(PARTNER_VISUAL_DEVICE_HEADER)
}

function applyPartnerSiteSlugHeader(headers: Headers, pathname: string, siteSlug?: string) {
  const slug = (siteSlug || partnerSiteSlugFromPathname(pathname)).trim()
  if (slug) headers.set(PARTNER_SITE_SLUG_HEADER, slug)
}

function partnerCustomDomainRewrite(
  request: NextRequest,
  rewriteUrl: URL,
  host: string,
  internalPath: string,
  siteSlug?: string
): NextResponse {
  const requestHeaders = new Headers(request.headers)
  applyVisualDeviceHeader(requestHeaders, request)
  requestHeaders.set(PARTNER_CUSTOM_DOMAIN_HEADER, host)
  requestHeaders.set(APP_LOGIN_NEXT_HEADER, internalPath)
  requestHeaders.set(APP_LOGIN_NEXT_HEADER_LEGACY, internalPath)
  applyPartnerSiteSlugHeader(requestHeaders, internalPath, siteSlug)
  const rewriteResponse = NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  })
  rewriteResponse.headers.set(PARTNER_CUSTOM_DOMAIN_HEADER, host)
  applyCommonResponseHeaders(rewriteResponse, request, host)
  const cookieLocale = localeFromRequestCookies(request)
  mirrorLocaleCookies(rewriteResponse, cookieLocale || DEFAULT_WEB_LOCALE)
  return rewriteResponse
}

async function attachCustomDomainSlugCookie(
  response: NextResponse,
  host: string,
  siteSlug: string
) {
  const value = await signPartnerCustomDomainSlugCookie(host, siteSlug)
  if (!value) return
  response.cookies.set(PARTNER_CUSTOM_DOMAIN_SLUG_COOKIE, value, {
    path: '/',
    maxAge: PARTNER_CUSTOM_DOMAIN_SLUG_MAX_AGE_SEC,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })
}

function applyCommonResponseHeaders(response: NextResponse, request: NextRequest, host?: string) {
  const hostname =
    host ||
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ||
    ''
  const path = request.nextUrl.pathname
  const shopDocument =
    path.startsWith('/site/') || Boolean(hostname && !isPlatformAppHostname(hostname))
  response.headers.set(
    'Cache-Control',
    shopDocument
      ? 'private, no-store'
      : 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  )
  const existingVary = response.headers.get('Vary') || ''
  const varyTokens = new Set(
    existingVary
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  )
  ;['RSC', 'Next-Router-State-Tree', 'Next-Router-Prefetch', 'Accept-Encoding'].forEach((token) =>
    varyTokens.add(token)
  )
  response.headers.set('Vary', Array.from(varyTokens).join(', '))
  // Do not send Accept-CH / Critical-CH. Chrome may restart the navigation to attach
  // viewport hints — that looks like a random F5 on deposit, Sửa nhanh, and every open tab.
  // Live machine selection uses UA + `pw-live-device` cookie written without reload.

  // Shop consultation surfaces are operational chat UIs, not public SEO pages.
  if (request.nextUrl.pathname.startsWith('/messaging/p/')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
}

/** `/robots.txt` stays on the host file, but still needs the shop host for Host/Sitemap. */
function nextOnCustomDomain(request: NextRequest, host: string, siteSlug: string): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(PARTNER_CUSTOM_DOMAIN_HEADER, host)
  applyPartnerSiteSlugHeader(requestHeaders, request.nextUrl.pathname, siteSlug)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  applyCommonResponseHeaders(response, request, host)
  const cookieLocale = localeFromRequestCookies(request)
  mirrorLocaleCookies(response, cookieLocale || DEFAULT_WEB_LOCALE)
  return response
}

function rewritePublishedCustomDomain(
  request: NextRequest,
  host: string,
  siteSlug: string
): NextResponse | null {
  const path = request.nextUrl.pathname
  const publicPath = mapPartnerInternalPathToPublic(siteSlug, path) ?? path
  if (publicPath !== path) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = publicPath
    return NextResponse.redirect(redirectUrl, 308)
  }
  const internalPath = mapPartnerCustomDomainPathToInternal(siteSlug, path)
  if (!internalPath) {
    if (path === '/robots.txt') return nextOnCustomDomain(request, host, siteSlug)
    return null
  }
  const rewriteUrl = request.nextUrl.clone()
  rewriteUrl.pathname = internalPath
  return partnerCustomDomainRewrite(request, rewriteUrl, host, internalPath, siteSlug)
}

export async function middleware(request: NextRequest) {
  const hostHeader =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.split(',')[0]?.trim() ||
    ''
  const host = hostHeader.split(':')[0]?.toLowerCase() ?? ''

  if (host && !isPlatformAppHostname(host)) {
    try {
      const headerSlug = trustedPartnerSiteSlugFromEdgeHeaders({
        getHeader: (name) => request.headers.get(name),
        host,
      })
      const cookieSlug = headerSlug
        ? ''
        : await readSignedPartnerCustomDomainSlug(
            host,
            request.cookies.get(PARTNER_CUSTOM_DOMAIN_SLUG_COOKIE)?.value
          )
      const fastSlug = headerSlug || cookieSlug
      if (fastSlug) {
        const fast = rewritePublishedCustomDomain(request, host, fastSlug)
        if (fast) {
          await attachCustomDomainSlugCookie(fast, host, fastSlug)
          return fast
        }
      }

      const resolveUrl = new URL('/api/messaging/resolve-host', `${getInternalBaseUrl()}/`)
      resolveUrl.searchParams.set('host', host)
      const res = await fetch(resolveUrl.toString(), {
        headers: {
          'x-forwarded-host': hostHeader,
          host: hostHeader,
          'x-forwarded-proto': request.headers.get('x-forwarded-proto') ?? 'https',
        },
        next: { revalidate: 60 },
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
            const published = rewritePublishedCustomDomain(request, host, siteSlug)
            if (published) {
              await attachCustomDomainSlugCookie(published, host, siteSlug)
              return published
            }
          } else if ((path === '/' || path === '') && data.rewriteRootPath) {
            const rewriteUrl = request.nextUrl.clone()
            rewriteUrl.pathname = data.rewriteRootPath
            const rewrite = partnerCustomDomainRewrite(
              request,
              rewriteUrl,
              host,
              data.rewriteRootPath,
              siteSlug
            )
            if (siteSlug) await attachCustomDomainSlugCookie(rewrite, host, siteSlug)
            return rewrite
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
  applyPartnerSiteSlugHeader(forwarded, request.nextUrl.pathname)
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
    applyCommonResponseHeaders(response, request, host)
    return response
  }

  const response = NextResponse.next({
    request: { headers: forwarded },
  })
  const cookieLocale = localeFromRequestCookies(request)
  const locale = cookieLocale || DEFAULT_WEB_LOCALE
  mirrorLocaleCookies(response, locale)
  applyCommonResponseHeaders(response, request, host)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|pw-shop-runtime/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
