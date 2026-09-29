import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const FACEBOOK_OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000
const FACEBOOK_OAUTH_SESSION_MAX_AGE_MS = 15 * 60 * 1000

export const FACEBOOK_OAUTH_SESSION_COOKIE = 'fb_messenger_oauth_session'

type FacebookOAuthStatePayload = {
  partnerId: string
  userId: string
  nonce: string
  issuedAt: number
}

type FacebookOAuthSessionPayload = {
  partnerId: string
  userId: string
  issuedAt: number
  userAccessToken: string
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
    const padLength = (4 - (normalized.length % 4)) % 4
    const padded = `${normalized}${'='.repeat(padLength)}`
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function signStatePayload(rawPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(rawPayload, 'utf8').digest('base64url')
}

export function createFacebookOAuthState(input: {
  partnerId: string
  userId: string
  secret: string
}): string {
  const payload: FacebookOAuthStatePayload = {
    partnerId: input.partnerId,
    userId: input.userId,
    nonce: randomBytes(12).toString('base64url'),
    issuedAt: Date.now(),
  }
  const rawPayload = JSON.stringify(payload)
  const encodedPayload = base64UrlEncode(rawPayload)
  const signature = signStatePayload(rawPayload, input.secret)
  return `${encodedPayload}.${signature}`
}

export function verifyFacebookOAuthState(input: {
  state: string
  expectedUserId: string
  secret: string
}): { ok: true; partnerId: string } | { ok: false } {
  const [encodedPayload, signature] = input.state.split('.')
  if (!encodedPayload || !signature) return { ok: false }

  const rawPayload = base64UrlDecode(encodedPayload)
  if (!rawPayload) return { ok: false }

  const expectedSignature = signStatePayload(rawPayload, input.secret)
  try {
    const a = Buffer.from(signature)
    const b = Buffer.from(expectedSignature)
    if (a.length !== b.length) return { ok: false }
    if (!timingSafeEqual(a, b)) return { ok: false }
  } catch {
    return { ok: false }
  }

  let payload: FacebookOAuthStatePayload | null = null
  try {
    payload = JSON.parse(rawPayload) as FacebookOAuthStatePayload
  } catch {
    return { ok: false }
  }
  if (!payload) return { ok: false }
  if (!payload.partnerId || !payload.userId || !payload.nonce) return { ok: false }
  if (payload.userId !== input.expectedUserId) return { ok: false }
  if (!Number.isFinite(payload.issuedAt)) return { ok: false }
  if (Date.now() - payload.issuedAt > FACEBOOK_OAUTH_STATE_MAX_AGE_MS) return { ok: false }

  return { ok: true, partnerId: payload.partnerId }
}

export function createFacebookOAuthSession(input: {
  partnerId: string
  userId: string
  userAccessToken: string
  secret: string
}): string {
  const payload: FacebookOAuthSessionPayload = {
    partnerId: input.partnerId,
    userId: input.userId,
    issuedAt: Date.now(),
    userAccessToken: input.userAccessToken.trim(),
  }
  const rawPayload = JSON.stringify(payload)
  const encodedPayload = base64UrlEncode(rawPayload)
  const signature = signStatePayload(rawPayload, input.secret)
  return `${encodedPayload}.${signature}`
}

export function verifyFacebookOAuthSession(input: {
  token: string
  expectedUserId: string
  expectedPartnerId: string
  secret: string
}): { ok: true; userAccessToken: string } | { ok: false } {
  const [encodedPayload, signature] = input.token.split('.')
  if (!encodedPayload || !signature) return { ok: false }

  const rawPayload = base64UrlDecode(encodedPayload)
  if (!rawPayload) return { ok: false }

  const expectedSignature = signStatePayload(rawPayload, input.secret)
  try {
    const a = Buffer.from(signature)
    const b = Buffer.from(expectedSignature)
    if (a.length !== b.length) return { ok: false }
    if (!timingSafeEqual(a, b)) return { ok: false }
  } catch {
    return { ok: false }
  }

  let payload: FacebookOAuthSessionPayload | null = null
  try {
    payload = JSON.parse(rawPayload) as FacebookOAuthSessionPayload
  } catch {
    return { ok: false }
  }
  if (!payload?.partnerId || !payload.userId || !payload.userAccessToken) return { ok: false }
  if (payload.userId !== input.expectedUserId || payload.partnerId !== input.expectedPartnerId) return { ok: false }
  if (!Number.isFinite(payload.issuedAt)) return { ok: false }
  if (Date.now() - payload.issuedAt > FACEBOOK_OAUTH_SESSION_MAX_AGE_MS) return { ok: false }
  return { ok: true, userAccessToken: payload.userAccessToken }
}

