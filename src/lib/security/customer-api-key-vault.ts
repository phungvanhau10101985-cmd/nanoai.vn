import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

export type EncryptedCustomerApiKey = {
  encryptedKey: string
  iv: string
  authTag: string
  keyHint: string
}

function getEncryptionKey(): Buffer {
  const raw = process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET?.trim()
  if (!raw) {
    throw new Error('CUSTOMER_API_KEY_ENCRYPTION_SECRET is not set')
  }
  if (raw.length < 32) {
    throw new Error('CUSTOMER_API_KEY_ENCRYPTION_SECRET must be at least 32 characters')
  }
  return createHash('sha256').update(raw, 'utf8').digest()
}

function buildKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 10) return '*'.repeat(Math.max(4, trimmed.length))
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}

export function encryptCustomerApiKey(apiKey: string): EncryptedCustomerApiKey {
  const plaintext = apiKey.trim()
  if (!plaintext) throw new Error('API key is empty')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_BYTES })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyHint: buildKeyHint(plaintext),
  }
}

export function decryptCustomerApiKey(input: {
  encryptedKey: string
  iv: string
  authTag: string
}): string {
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(input.iv, 'base64'), {
    authTagLength: AUTH_TAG_BYTES,
  })
  decipher.setAuthTag(Buffer.from(input.authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.encryptedKey, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export function customerApiKeyMatchesHint(apiKey: string, hint: string): boolean {
  const nextHint = Buffer.from(buildKeyHint(apiKey))
  const currentHint = Buffer.from(hint)
  if (nextHint.length !== currentHint.length) return false
  return timingSafeEqual(nextHint, currentHint)
}
