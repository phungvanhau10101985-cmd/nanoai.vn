import assert from 'node:assert/strict'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { decryptCustomerApiKey, encryptCustomerApiKey } from '@/lib/security/customer-api-key-vault'
import {
  isSealedSecret,
  openStoredSecret,
  redactApiKey,
  resealSecret,
  sealStoredSecret,
  secretsEqual,
} from '@/lib/security/secret-vault'

const MASTER = 'a'.repeat(48)
const PREVIOUS = 'b'.repeat(48)

const previousEnv = {
  current: process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET,
  previous: process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS,
}

beforeEach(() => {
  process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET = MASTER
  delete process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS
})

afterEach(() => {
  if (previousEnv.current == null) delete process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET
  else process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET = previousEnv.current
  if (previousEnv.previous == null) delete process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS
  else process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS = previousEnv.previous
})

describe('secret vault', () => {
  it('seals and opens a shop secret', () => {
    const sealed = sealStoredSecret('whsec_shop_test_value', 'sepay-shop-hmac')
    assert.equal(isSealedSecret(sealed), true)
    assert.equal(sealed.includes('whsec_shop_test_value'), false)
    assert.equal(openStoredSecret(sealed, 'sepay-shop-hmac'), 'whsec_shop_test_value')
  })

  it('keeps legacy plaintext readable', () => {
    assert.equal(openStoredSecret('whsec_legacy', 'sepay-shop-hmac'), 'whsec_legacy')
    assert.equal(isSealedSecret('whsec_legacy'), false)
  })

  it('refuses the wrong purpose', () => {
    const sealed = sealStoredSecret('super-secret', 'image-search')
    assert.throws(() => openStoredSecret(sealed, 'shipping-lookup'), /purpose mismatch/)
  })

  it('opens with the previous master after rotation', () => {
    const sealed = sealStoredSecret('rotate-me', 'outbound-webhook')
    process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET = PREVIOUS
    process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS = MASTER
    assert.equal(openStoredSecret(sealed, 'outbound-webhook'), 'rotate-me')
    const rotated = resealSecret(sealed, 'outbound-webhook')
    delete process.env.CUSTOMER_API_KEY_ENCRYPTION_SECRET_PREVIOUS
    assert.equal(openStoredSecret(rotated, 'outbound-webhook'), 'rotate-me')
  })

  it('reseal is idempotent and limits plaintext not ciphertext', () => {
    const once = resealSecret('spsk_live_example_secret', 'sepay-platform-hmac', 256)
    const twice = resealSecret(once, 'sepay-platform-hmac', 256)
    assert.equal(openStoredSecret(twice, 'sepay-platform-hmac'), 'spsk_live_example_secret')
    assert.equal(isSealedSecret(once), true)
    assert.equal(once.includes('spsk_live_example_secret'), false)
  })

  it('compares secrets without throwing on different lengths', () => {
    assert.equal(secretsEqual('abc', 'abc'), true)
    assert.equal(secretsEqual('abc', 'abcd'), false)
  })

  it('redacts a key out of an error body', () => {
    assert.equal(redactApiKey('bad key sk-test-12345678 in url', 'sk-test-12345678'), 'bad key [redacted] in url')
  })
})

describe('customer api key vault', () => {
  it('round-trips a new customer key through the sealed format', () => {
    const encrypted = encryptCustomerApiKey('AIza-customer-key-0123456789')
    assert.equal(isSealedSecret(encrypted.encryptedKey), true)
    assert.equal(
      decryptCustomerApiKey({
        encryptedKey: encrypted.encryptedKey,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      }),
      'AIza-customer-key-0123456789'
    )
  })

  it('still decrypts the legacy sha256 ciphertext', () => {
    const key = createHash('sha256').update(MASTER, 'utf8').digest()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update('legacy-customer-key-012345', 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    assert.equal(
      decryptCustomerApiKey({
        encryptedKey: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      }),
      'legacy-customer-key-012345'
    )
  })
})
