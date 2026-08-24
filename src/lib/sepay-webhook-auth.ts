import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Xác thực webhook SePay — cùng nguyên lý 188.com.vn:
 * 1) Authorization Apikey / ?token= (SEPAY_WEBHOOK_API_KEY)
 * 2) HMAC: chuẩn mới `sha256=` + `{timestamp}.{body}` (SEPAY_WEBHOOK_SECRET / whsec_)
 *    hoặc HMAC cũ (chỉ raw body + SEPAY_SECRET_KEY)
 * 3) IP allowlist khi webhook để «Không xác thực» (mặc định bật)
 */

export const SEPAY_DEFAULT_WEBHOOK_IPS = [
  '172.236.138.20',
  '172.233.83.68',
  '171.244.35.2',
  '151.158.108.68',
  '151.158.109.79',
  '103.255.238.139',
] as const

export type SePayWebhookAuthVia = 'api_key' | 'hmac' | 'sepay_ip' | 'insecure_dev'

export type SePayWebhookAuthResult =
  | { ok: true; via: SePayWebhookAuthVia }
  | { ok: false; reason: string }

type HeaderLike = { get(name: string): string | null }
type SearchLike = { get(name: string): string | null }

export type SePayWebhookAuthInput = {
  headers: HeaderLike
  searchParams: SearchLike
  rawBody: string
  /** Peer TCP (nếu có). Loopback/private → được đọc X-Forwarded-For. */
  remoteIp?: string | null
  extraHmacSecrets?: string[]
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (!raw) return defaultValue
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return defaultValue
}

function normalizeClientIp(s: string): string {
  let t = (s || '').trim()
  if (t.toLowerCase().startsWith('::ffff:')) t = t.slice(7)
  if (t.includes('%')) t = t.split('%', 1)[0] || t
  return t
}

function isPrivateOrLoopback(host: string): boolean {
  const ip = normalizeClientIp(host)
  if (!ip) return false
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  const m = /^172\.(\d+)\./.exec(ip)
  if (m) {
    const n = Number(m[1])
    if (n >= 16 && n <= 31) return true
  }
  return false
}

function header(headers: HeaderLike, name: string): string {
  return (headers.get(name) || headers.get(name.toLowerCase()) || '').trim()
}

export function sepayWebhookIpAllowlist(): string[] {
  const raw = process.env.SEPAY_WEBHOOK_IP_ALLOWLIST?.trim()
  if (raw) {
    return raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  }
  return [...SEPAY_DEFAULT_WEBHOOK_IPS]
}

export function collectSePayWebhookIpCandidates(input: {
  headers: HeaderLike
  remoteIp?: string | null
  trustProxyHeaders?: boolean
}): string[] {
  const direct = normalizeClientIp(input.remoteIp || '')
  const xffRaw = header(input.headers, 'x-forwarded-for')
  const parts = xffRaw
    .split(',')
    .map((p) => normalizeClientIp(p))
    .filter(Boolean)
  const real = normalizeClientIp(header(input.headers, 'x-real-ip'))
  const trustFwd =
    Boolean(input.trustProxyHeaders) || !direct || isPrivateOrLoopback(direct)

  if (trustFwd) {
    const out: string[] = []
    const seen = new Set<string>()
    for (const p of parts) {
      if (!seen.has(p)) {
        seen.add(p)
        out.push(p)
      }
    }
    if (real && !seen.has(real)) out.push(real)
    if (out.length) return out
    return direct ? [direct] : []
  }
  if (direct) return [direct]
  if (parts.length) return parts.slice(0, 1)
  return real ? [real] : []
}

function secretsEqual(left: string, right: string): boolean {
  const a = left.trim()
  const b = right.trim()
  if (!a || !b) return false
  const leftBuf = Buffer.from(a)
  const rightBuf = Buffer.from(b)
  if (leftBuf.length !== rightBuf.length) return false
  return timingSafeEqual(leftBuf, rightBuf)
}

/** HMAC cũ: chỉ ký raw body (188 / SePay cũ). */
export function verifySePayHmacSignature(rawBody: string, secretKey: string, signature: string): boolean {
  const expectedHex = createHmac('sha256', secretKey).update(rawBody).digest('hex')
  const expectedBase64 = createHmac('sha256', secretKey).update(rawBody).digest('base64')
  const normalized = signature.trim()
  return secretsEqual(normalized.toLowerCase(), expectedHex.toLowerCase()) || secretsEqual(normalized, expectedBase64)
}

const HMAC_MAX_SKEW_SEC = 300

/**
 * HMAC mới của dashboard SePay (Khuyến nghị):
 * header `X-SePay-Signature: sha256={hex}` + `X-SePay-Timestamp`
 * signed string = `{timestamp}.{raw_body}`
 * secret = `SEPAY_WEBHOOK_SECRET` (`whsec_...`), không phải merchant `spsk_`.
 */
export function verifySePayOfficialHmac(input: {
  rawBody: string
  secretKey: string
  signature: string
  timestamp: string
  nowSec?: number
}): { ok: true } | { ok: false; reason: 'expired' | 'mismatch' } {
  const ts = Number(input.timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return { ok: false, reason: 'mismatch' }
  const now = input.nowSec ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > HMAC_MAX_SKEW_SEC) return { ok: false, reason: 'expired' }
  const expected = `sha256=${createHmac('sha256', input.secretKey).update(`${ts}.${input.rawBody}`).digest('hex')}`
  const got = input.signature.trim()
  if (secretsEqual(got, expected) || secretsEqual(got.toLowerCase(), expected.toLowerCase())) {
    return { ok: true }
  }
  const hexOnly = createHmac('sha256', input.secretKey).update(`${ts}.${input.rawBody}`).digest('hex')
  if (secretsEqual(got.toLowerCase(), hexOnly.toLowerCase())) return { ok: true }
  return { ok: false, reason: 'mismatch' }
}

export function webhookHmacSecrets(extra?: string[]): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const raw of [...(extra ?? []), process.env.SEPAY_WEBHOOK_SECRET, process.env.SEPAY_SECRET_KEY]) {
    const v = (raw || '').trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    keys.push(v)
  }
  return keys
}

function configuredWebhookApiKeys(): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const add = (raw?: string) => {
    const v = (raw || '').trim()
    if (!v || seen.has(v)) return
    seen.add(v)
    keys.push(v)
  }
  add(process.env.SEPAY_WEBHOOK_API_KEY)
  const pub = process.env.SEPAY_WEBHOOK_PUBLIC_URL?.trim() || ''
  if (pub.includes('?')) {
    try {
      const q = new URL(pub).searchParams
      add(q.get('token') || '')
      add(q.get('api_key') || '')
      add(q.get('apikey') || '')
    } catch {
      /* ignore malformed public URL */
    }
  }
  return keys
}

export function verifySePayWebhookAuth(input: SePayWebhookAuthInput): SePayWebhookAuthResult {
  const apiKeys = configuredWebhookApiKeys()
  const authRaw = header(input.headers, 'authorization')
  const auth = authRaw.replace(/\s+/g, ' ').trim()
  const headerKey =
    header(input.headers, 'x-api-key') || header(input.headers, 'x-sepay-api-key')
  const queryKey =
    (input.searchParams.get('token') ||
      input.searchParams.get('api_key') ||
      input.searchParams.get('apikey') ||
      '').trim()

  for (const apiKey of apiKeys) {
    const expected = `Apikey ${apiKey}`
    const bearer = `Bearer ${apiKey}`
    if (
      secretsEqual(auth, expected) ||
      secretsEqual(auth, bearer) ||
      secretsEqual(auth, apiKey) ||
      secretsEqual(headerKey, apiKey) ||
      secretsEqual(queryKey, apiKey)
    ) {
      return { ok: true, via: 'api_key' }
    }
  }

  const signature =
    header(input.headers, 'x-sepay-signature') ||
    header(input.headers, 'signature')
  const timestamp = header(input.headers, 'x-sepay-timestamp')
  const hmacSecrets = webhookHmacSecrets(input.extraHmacSecrets)
  if (signature && input.rawBody && hmacSecrets.length) {
    let expired = false
    for (const secret of hmacSecrets) {
      const official = verifySePayOfficialHmac({
        rawBody: input.rawBody,
        secretKey: secret,
        signature,
        timestamp,
      })
      if (official.ok) return { ok: true, via: 'hmac' }
      if (official.reason === 'expired') expired = true
      if (verifySePayHmacSignature(input.rawBody, secret, signature)) {
        return { ok: true, via: 'hmac' }
      }
    }
    if (expired) return { ok: false, reason: 'hmac_expired' }
    return { ok: false, reason: 'invalid_hmac' }
  }

  if (envFlag('SEPAY_ALLOW_INSECURE_DEV', false)) {
    return { ok: true, via: 'insecure_dev' }
  }

  const trustIp = envFlag('SEPAY_WEBHOOK_TRUST_NO_AUTH_IP', true)
  if (trustIp) {
    const allow = new Set(sepayWebhookIpAllowlist())
    const candidates = collectSePayWebhookIpCandidates({
      headers: input.headers,
      remoteIp: input.remoteIp,
      trustProxyHeaders: envFlag('SEPAY_WEBHOOK_TRUST_PROXY_HEADERS', false),
    })
    if (candidates.some((ip) => allow.has(ip))) {
      return { ok: true, via: 'sepay_ip' }
    }
  }

  if (envFlag('SEPAY_REQUIRE_SIGNATURE', false) && apiKeys.length === 0) {
    return { ok: false, reason: 'missing_hmac_and_untrusted_ip' }
  }
  if (apiKeys.length > 0) {
    return { ok: false, reason: 'api_key_mismatch' }
  }
  return { ok: false, reason: 'unauthorized' }
}
