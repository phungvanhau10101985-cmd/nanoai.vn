import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const FACEBOOK_OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000
const FACEBOOK_PENDING_PAGES_MAX_AGE_MS = 10 * 60 * 1000

type FacebookOAuthStatePayload = {
  partnerId: string
  userId: string
  nonce: string
  issuedAt: number
}

type FacebookPendingPage = {
  id: string
  name: string
  accessToken: string
}

type FacebookPendingPagesPayload = {
  partnerId: string
  userId: string
  issuedAt: number
  pages: FacebookPendingPage[]
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

export function createFacebookPendingPagesToken(input: {
  partnerId: string
  userId: string
  pages: FacebookPendingPage[]
  secret: string
}): string {
  const payload: FacebookPendingPagesPayload = {
    partnerId: input.partnerId,
    userId: input.userId,
    issuedAt: Date.now(),
    pages: input.pages.map((p) => ({
      id: p.id.trim(),
      name: p.name.trim(),
      accessToken: p.accessToken.trim(),
    })),
  }
  const rawPayload = JSON.stringify(payload)
  const encodedPayload = base64UrlEncode(rawPayload)
  const signature = signStatePayload(rawPayload, input.secret)
  return `${encodedPayload}.${signature}`
}

export function verifyFacebookPendingPagesToken(input: {
  token: string
  expectedUserId: string
  expectedPartnerId: string
  secret: string
}): { ok: true; pages: FacebookPendingPage[] } | { ok: false } {
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

  let payload: FacebookPendingPagesPayload | null = null
  try {
    payload = JSON.parse(rawPayload) as FacebookPendingPagesPayload
  } catch {
    return { ok: false }
  }
  if (!payload) return { ok: false }
  if (payload.userId !== input.expectedUserId || payload.partnerId !== input.expectedPartnerId) return { ok: false }
  if (!Number.isFinite(payload.issuedAt)) return { ok: false }
  if (Date.now() - payload.issuedAt > FACEBOOK_PENDING_PAGES_MAX_AGE_MS) return { ok: false }
  if (!Array.isArray(payload.pages) || payload.pages.length < 1) return { ok: false }

  const pages = payload.pages
    .map((p) => ({
      id: String(p.id || '').trim(),
      name: String(p.name || '').trim(),
      accessToken: String(p.accessToken || '').trim(),
    }))
    .filter((p) => p.id && p.accessToken)
  if (pages.length < 1) return { ok: false }
  return { ok: true, pages }
}

