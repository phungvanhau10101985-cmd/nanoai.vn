import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Niêm secret trước khi ghi Postgres.
 * Key nền tảng (OpenAI, Google, Bunny, SePay env) vẫn chỉ nằm ở biến môi trường.
 * Master: CUSTOMER_API_KEY_ENCRYPTION_SECRET (≥ 32 ký tự). Xoay key: ghi master cũ vào
 * CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS — bản ghi cũ vẫn mở được, bản ghi mới dùng master hiện tại.
 * Chuỗi không khớp định dạng nai1. được coi là plaintext cũ.
 */

const PREFIX = 'nai1.'
const SEALED_RE = /^nai1\.[a-z0-9-]{1,40}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/
const SALT = 'nanoai-secret-vault-v1'

export const SECRET_PURPOSES = [
  'customer-gemini',
  'sepay-shop-hmac',
  'sepay-shop-token',
  'sepay-platform-hmac',
  'gsheets-sa',
  'ad-google-dev-token',
  'ad-google-client-secret',
  'ad-google-refresh',
  'ad-google-sa',
  'ad-meta-token',
  'image-search',
  'shipping-lookup',
  'fb-page-token',
  'fb-verify',
  'zalo-access',
  'zalo-webhook',
  'outbound-webhook',
] as const

export type SecretPurpose = (typeof SECRET_PURPOSES)[number]

function masters(): string[] {
  const current = process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET?.trim() || ''
  const previous = process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS?.trim() || ''
  const out: string[] = []
  if (current.length >= 32) out.push(current)
  if (previous.length >= 32 && previous !== current) out.push(previous)
  return out
}

function deriveKey(master: string, purpose: SecretPurpose): Buffer {
  return Buffer.from(hkdfSync('sha256', master, SALT, purpose, 32))
}

export function vaultMasterConfigured(): boolean {
  return masters().length > 0
}

export function isSealedSecret(value: string | null | undefined): boolean {
  return SEALED_RE.test(String(value ?? '').trim())
}

export function sealStoredSecret(plaintext: string, purpose: SecretPurpose): string {
  const plain = plaintext ?? ''
  if (!plain) return ''
  if (isSealedSecret(plain)) {
    openStoredSecret(plain, purpose)
    return plain.trim()
  }
  const [master] = masters()
  if (!master) throw new Error('CUSTOMER_API_KEY_ENCRYPTION_SECRET is not set')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(master, purpose), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${purpose}.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function openStoredSecret(stored: string, purpose: SecretPurpose): string {
  const value = String(stored ?? '')
  if (!value) return ''
  const trimmed = value.trim()
  if (!isSealedSecret(trimmed)) return value
  const parts = trimmed.split('.')
  if (parts.length !== 5 || parts[0] !== 'nai1') throw new Error('Malformed vault ciphertext')
  if (parts[1] !== purpose) throw new Error('Vault purpose mismatch')
  const keys = masters()
  if (keys.length === 0) throw new Error('CUSTOMER_API_KEY_ENCRYPTION_SECRET is not set')
  const iv = Buffer.from(parts[2], 'base64url')
  const tag = Buffer.from(parts[3], 'base64url')
  const ciphertext = Buffer.from(parts[4], 'base64url')
  for (const master of keys) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', deriveKey(master, purpose), iv)
      decipher.setAuthTag(tag)
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
      return plain.toString('utf8')
    } catch {
      // thử master cũ
    }
  }
  throw new Error('Vault decrypt failed')
}

/** Mở bản ghi cũ (plaintext) hoặc bản đã niêm. Rỗng → null. */
export function openNullableSecret(value: unknown, purpose: SecretPurpose): string | null {
  if (value == null) return null
  const opened = openStoredSecret(String(value), purpose).trim()
  return opened || null
}

/**
 * Ghi DB: plaintext hoặc bản đã niêm đều ra một blob nai1.
 * maxLen áp lên plaintext, không cắt ciphertext.
 */
export function resealSecret(value: string | null | undefined, purpose: SecretPurpose, maxLen?: number): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  let plain = isSealedSecret(raw) ? openStoredSecret(raw, purpose).trim() : raw
  if (maxLen && maxLen > 0) plain = plain.slice(0, maxLen)
  if (!plain) return ''
  return sealStoredSecret(plain, purpose)
}

export function resealNullableSecret(
  value: string | null | undefined,
  purpose: SecretPurpose,
  maxLen?: number
): string | null {
  const sealed = resealSecret(value, purpose, maxLen)
  return sealed || null
}

export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    timingSafeEqual(left, left)
    return false
  }
  return timingSafeEqual(left, right)
}

export function isVaultError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /Vault decrypt failed|Vault purpose mismatch|Malformed vault ciphertext|CUSTOMER_API_KEY_ENCRYPTION_SECRET/.test(
    error.message
  )
}

export function rethrowVaultError(error: unknown): void {
  if (isVaultError(error)) throw error
}

export function redactApiKey(text: string, apiKey: string): string {
  const key = apiKey.trim()
  if (key.length < 8 || !text) return text
  return text.split(key).join('[redacted]')
}
