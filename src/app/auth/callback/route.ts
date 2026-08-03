import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY, isEmailAuthEnabled } from '@/lib/auth/email-auth-config'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import { exchangeGoogleOAuthCode, GOOGLE_OAUTH_STATE_COOKIE, isGoogleOAuthEnabled } from '@/lib/auth/google-oauth-config'
import {
  clearGoogleOAuthStateCookie,
  parseGoogleOAuthStateCookie,
} from '@/lib/auth/google-oauth-state-cookie'
import { mergeGuestTrialUserDataAfterLogin } from '@/lib/auth/merge-guest-trial-user-data'
import { getAuthFlowOrigin } from '@/lib/auth/public-app-url'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { readGuestSessionIdFromRequestStrictOrLoose } from '@/lib/messaging/guest-auth-session'
import { syncBrowserGuestSessionToUser } from '@/lib/messaging/sync-browser-guest-session-to-user'

export const dynamic = 'force-dynamic'

function normalizeEmail(e: string) {
  return e.trim().toLowerCase()
}

function appendQueryFlag(pathAndQuery: string, key: string, value: string): string {
  const raw = String(pathAndQuery || '/').trim() || '/'
  const [pathPart, hashPart = ''] = raw.split('#', 2)
  const [pathname = '/', query = ''] = pathPart.split('?', 2)
  const search = new URLSearchParams(query)
  search.set(key, value)
  const nextPath = `${pathname || '/'}${search.toString() ? `?${search.toString()}` : ''}`
  return hashPart ? `${nextPath}#${hashPart}` : nextPath
}

function absoluteRedirect(req: Request, pathAndQuery: string): NextResponse {
  const base = getAuthFlowOrigin(req).replace(/\/$/, '')
  const p = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  return NextResponse.redirect(`${base}${p}`)
}

function loginErrorRedirect(req: Request, code: string, next?: string): NextResponse {
  const q = new URLSearchParams()
  q.set('error', code)
  const safeNext = sanitizeLoginNext(next)
  if (safeNext && safeNext !== '/') q.set('next', safeNext)
  return absoluteRedirect(req, `/auth/login?${q.toString()}`)
}

export async function GET(req: NextRequest) {
  try {
    if (!isEmailAuthEnabled() || !isGoogleOAuthEnabled()) {
      return loginErrorRedirect(req, 'google_auth_disabled')
    }
    if (!isPgConfigured()) {
      return loginErrorRedirect(req, 'database')
    }

    const url = new URL(req.url)
    const oauthError = url.searchParams.get('error')?.trim()
    if (oauthError) {
      const nextFromState = parseGoogleOAuthStateCookie(req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value)?.next
      const code = oauthError === 'access_denied' ? 'google_oauth_denied' : 'google_oauth_failed'
      const res = loginErrorRedirect(req, code, nextFromState)
      clearGoogleOAuthStateCookie(res)
      return res
    }

    const code = url.searchParams.get('code')?.trim() ?? ''
    const state = url.searchParams.get('state')?.trim() ?? ''
    const saved = parseGoogleOAuthStateCookie(req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value)
    if (!code || !state || !saved || saved.state !== state) {
      const res = loginErrorRedirect(req, 'google_oauth_failed', saved?.next)
      clearGoogleOAuthStateCookie(res)
      return res
    }

    const next = sanitizeLoginNext(saved.next)
    const redirectUri =
      saved.redirectUri ||
      `${getAuthFlowOrigin(req).replace(/\/$/, '')}/auth/callback`
    const { userInfo } = await exchangeGoogleOAuthCode({ code, redirectUri })

    const email = normalizeEmail(String(userInfo.email || ''))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const res = loginErrorRedirect(req, 'google_oauth_failed', next)
      clearGoogleOAuthStateCookie(res)
      return res
    }
    if (userInfo.email_verified === false) {
      const res = loginErrorRedirect(req, 'google_email_unverified', next)
      clearGoogleOAuthStateCookie(res)
      return res
    }

    const existingUser = await pgQueryOne<{ id: string }>(
      `select u.id::text as id
       from auth.users u
       where lower(coalesce(u.email, '')) = $1
       limit 1`,
      [email]
    )
    const isNewUser = !existingUser?.id

    const uidRow = await pgQueryOne<{ id: string }>(
      'select (public.nanoai_ensure_user_by_email($1::text))::text as id',
      [email]
    )
    if (!uidRow?.id) {
      const res = loginErrorRedirect(req, 'user', next)
      clearGoogleOAuthStateCookie(res)
      return res
    }

    const jwt = await createEmailSessionTokenString(uidRow.id, email)
    if (!jwt) {
      const res = loginErrorRedirect(req, 'jwt', next)
      clearGoogleOAuthStateCookie(res)
      return res
    }

    const redirectPath = isNewUser ? appendQueryFlag(next, 'meta_complete_registration', '1') : next
    const res = absoluteRedirect(req, redirectPath)
    clearGoogleOAuthStateCookie(res)
    const opts = getEmailSessionCookieOptions()
    res.cookies.set(EMAIL_SESSION_COOKIE, jwt, opts)
    res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, jwt, opts)
    await mergeGuestTrialUserDataAfterLogin({
      guestTrialUserId: req.cookies.get('nano_guest_trial_user_id')?.value ?? null,
      realUserId: uidRow.id,
      response: res,
    })
    await syncBrowserGuestSessionToUser({
      guestSessionId: readGuestSessionIdFromRequestStrictOrLoose(req),
      userId: uidRow.id,
      email,
    })
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('auth.instances_empty')) {
      return loginErrorRedirect(req, 'auth_instances')
    }
    console.error('[auth/callback/google]', msg)
    return loginErrorRedirect(req, 'google_oauth_failed')
  }
}
