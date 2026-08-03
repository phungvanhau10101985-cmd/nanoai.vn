'use server'

import { randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  buildGoogleOAuthAuthorizeUrl,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthEnabled,
} from '@/lib/auth/google-oauth-config'
import { getGoogleOAuthStateCookieOptions } from '@/lib/auth/google-oauth-state-cookie'
import { getPublicOriginFromAppRouterHeaders } from '@/lib/auth/public-app-url'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

function nextQueryFromForm(formData: FormData): string {
  const raw = String(formData.get('next') ?? '').trim()
  if (!raw) return ''
  return `&next=${encodeURIComponent(sanitizeLoginNext(raw))}`
}

export async function login(formData: FormData) {
  const nq = formData && typeof formData.get === 'function' ? nextQueryFromForm(formData) : ''
  redirect(`/auth/login?error=${encodeURIComponent('Đăng nhập bằng email (OTP) trên trang đăng nhập.')}${nq}`)
}

export async function signup(formData: FormData) {
  const nq = formData && typeof formData.get === 'function' ? nextQueryFromForm(formData) : ''
  redirect(`/auth/login?error=${encodeURIComponent('Đăng ký qua email (OTP) trên trang đăng nhập.')}${nq}`)
}

export async function signInWithGoogle(formData: FormData) {
  const nq = formData && typeof formData.get === 'function' ? nextQueryFromForm(formData) : ''
  if (!isGoogleOAuthEnabled()) {
    redirect(`/auth/login?error=google_auth_disabled${nq}`)
  }

  const next = sanitizeLoginNext(String(formData?.get('next') ?? ''))
  const state = randomBytes(24).toString('hex')
  const origin = getPublicOriginFromAppRouterHeaders(headers())
  const redirectUri = `${origin.replace(/\/$/, '')}/auth/callback`
  const authUrl = buildGoogleOAuthAuthorizeUrl({ redirectUri, state })

  cookies().set(
    GOOGLE_OAUTH_STATE_COOKIE,
    JSON.stringify({ state, next, redirectUri }),
    getGoogleOAuthStateCookieOptions()
  )
  redirect(authUrl)
}
