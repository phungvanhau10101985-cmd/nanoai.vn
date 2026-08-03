import {
  getPrimaryAuthJwtSecretBytes,
  isEmailAuthEnabled,
} from '@/lib/auth/email-auth-config'

export const GOOGLE_OAUTH_STATE_COOKIE = 'nanoai_google_oauth_state'

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_OAUTH_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export function isGoogleOAuthEnabled(): boolean {
  const force = process.env.GOOGLE_OAUTH_ENABLED?.trim().toLowerCase()
  if (force === '0' || force === 'false' || force === 'no') return false
  if (!isEmailAuthEnabled()) return false
  if (!getPrimaryAuthJwtSecretBytes()) return false
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  return Boolean(clientId && clientSecret)
}

export function getGoogleOAuthClientId(): string | null {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  return id || null
}

export function getGoogleOAuthClientSecret(): string | null {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  return secret || null
}

export function buildGoogleOAuthAuthorizeUrl(input: { redirectUri: string; state: string }): string {
  const clientId = getGoogleOAuthClientId()
  if (!clientId) throw new Error('google_oauth_not_configured')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: input.state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`
}

type GoogleTokenResponse = {
  access_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type GoogleUserInfo = {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export async function exchangeGoogleOAuthCode(input: {
  code: string
  redirectUri: string
}): Promise<{ accessToken: string; userInfo: GoogleUserInfo }> {
  const clientId = getGoogleOAuthClientId()
  const clientSecret = getGoogleOAuthClientSecret()
  if (!clientId || !clientSecret) throw new Error('google_oauth_not_configured')

  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  })

  const tokenRes = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as GoogleTokenResponse
  if (!tokenRes.ok || !tokenJson.access_token) {
    const detail = tokenJson.error_description || tokenJson.error || `http_${tokenRes.status}`
    throw new Error(`google_token_exchange_failed:${detail}`)
  }

  const userRes = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  })
  const userInfo = (await userRes.json().catch(() => ({}))) as GoogleUserInfo
  if (!userRes.ok || !userInfo.email) {
    throw new Error('google_userinfo_failed')
  }

  return { accessToken: tokenJson.access_token, userInfo }
}
