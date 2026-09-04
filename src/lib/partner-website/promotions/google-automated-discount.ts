import { createHash, createPublicKey, verify } from 'node:crypto'

export const GOOGLE_AUTOMATED_DISCOUNT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAERUlUpxshr67EO66ZTX0Fpog0LEHc
nUnlSsIrOfroxTLu2XnigBK/lfYRxzQWq9K6nqsSjjYeea0T12r+y3nvqg==
-----END PUBLIC KEY-----`

export const GOOGLE_AUTOMATED_DISCOUNT_LOCK_HOURS = 48

export type GoogleAutomatedDiscountPayload = {
  price: number
  priorPrice: number | null
  currency: string
  offerId: string
  merchantId: string
  expiresAt: number
}

function jsonPart(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_token')
  return parsed as Record<string, unknown>
}

function normalized(value: unknown): string {
  return String(value ?? '').trim()
}

export function verifyGoogleAutomatedDiscountToken(input: {
  token: string
  expectedOfferId?: string | null
  expectedMerchantId?: string | null
  publicKeyPem?: string | null
  nowMs?: number
}): GoogleAutomatedDiscountPayload {
  const token = input.token.trim()
  const [encodedHeader, encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra) throw new Error('invalid_token')
  const header = jsonPart(encodedHeader)
  if (header.alg !== 'ES256' || header.typ !== 'JWT') throw new Error('invalid_header')
  const publicKey = createPublicKey(
    input.publicKeyPem?.trim() || GOOGLE_AUTOMATED_DISCOUNT_PUBLIC_KEY_PEM
  )
  const valid = verify(
    'sha256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(encodedSignature, 'base64url')
  )
  if (!valid) throw new Error('invalid_signature')
  const payload = jsonPart(encodedPayload)
  const expiresAt = Math.floor(Number(payload.exp))
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor((input.nowMs ?? Date.now()) / 1000)) {
    throw new Error('expired')
  }
  const offerId = normalized(payload.o)
  const merchantId = normalized(payload.m)
  const currency = normalized(payload.c || 'VND').toUpperCase()
  const price = Math.round(Number(payload.p))
  if (!Number.isFinite(price) || price <= 0 || currency !== 'VND') throw new Error('invalid_price')
  if (
    input.expectedOfferId &&
    offerId &&
    input.expectedOfferId.trim().toLowerCase() !== offerId.toLowerCase()
  ) {
    throw new Error('offer_mismatch')
  }
  if (
    input.expectedMerchantId &&
    merchantId &&
    input.expectedMerchantId.trim() !== merchantId
  ) {
    throw new Error('merchant_mismatch')
  }
  let priorPrice = Number(payload.pp)
  if (!Number.isFinite(priorPrice) || priorPrice <= 0) {
    const discountPercent = Number(payload.dp)
    priorPrice =
      Number.isFinite(discountPercent) && discountPercent > 0 && discountPercent < 100
        ? Math.round(price / (1 - discountPercent / 100))
        : 0
  }
  return {
    price,
    priorPrice: priorPrice > 0 ? Math.round(priorPrice) : null,
    currency,
    offerId,
    merchantId,
    expiresAt,
  }
}

export function googleDiscountLockExpiresAt(
  payloadExpiresAt: number,
  lockHours = GOOGLE_AUTOMATED_DISCOUNT_LOCK_HOURS,
  nowMs = Date.now()
): Date {
  return new Date(
    Math.min(payloadExpiresAt * 1000, nowMs + Math.max(1, lockHours) * 3_600_000)
  )
}

export function googleDiscountTokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
