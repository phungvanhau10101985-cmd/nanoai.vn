import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Token opt-out email marketing — ký HMAC, không cần lưu DB.
 * Payload: partnerId | recipientKey | emailNormalized, base64url + chữ ký.
 */

export type MarketingOptOutPayload = {
  partnerId: string
  recipientKey: string
  email: string
}

function optOutSecret(): string {
  return (
    process.env.MARKETING_OPT_OUT_SECRET?.trim() ||
    process.env.MESSAGING_PARTNER_AI_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'marketing-opt-out-fallback-secret'
  )
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function sign(data: string): string {
  return b64url(createHmac('sha256', optOutSecret()).update(data).digest())
}

export function buildMarketingOptOutToken(payload: MarketingOptOutPayload): string {
  const body = JSON.stringify({
    p: payload.partnerId,
    r: payload.recipientKey,
    e: payload.email.trim().toLowerCase(),
  })
  const data = b64url(body)
  return `${data}.${sign(data)}`
}

export function verifyMarketingOptOutToken(token: string): MarketingOptOutPayload | null {
  const t = String(token || '').trim()
  const dot = t.indexOf('.')
  if (dot <= 0) return null
  const data = t.slice(0, dot)
  const sig = t.slice(dot + 1)
  if (!data || !sig) return null

  const expected = sign(data)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  try {
    const parsed = JSON.parse(fromB64url(data).toString('utf8')) as {
      p?: unknown
      r?: unknown
      e?: unknown
    }
    const partnerId = String(parsed.p ?? '').trim()
    const recipientKey = String(parsed.r ?? '').trim()
    const email = String(parsed.e ?? '').trim().toLowerCase()
    if (!partnerId || !recipientKey) return null
    return { partnerId, recipientKey, email }
  } catch {
    return null
  }
}

export function buildMarketingOptOutUrl(input: {
  appOrigin: string
  slug: string
  payload: MarketingOptOutPayload
}): string {
  const origin = input.appOrigin.replace(/\/$/, '')
  const token = buildMarketingOptOutToken(input.payload)
  const u = new URL(`${origin}/api/messaging/guest/${encodeURIComponent(input.slug)}/marketing-opt-out`)
  u.searchParams.set('token', token)
  return u.toString()
}
