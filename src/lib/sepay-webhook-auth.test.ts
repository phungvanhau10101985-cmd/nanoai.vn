import assert from 'node:assert/strict'
import { createHmac } from 'crypto'
import { afterEach, describe, it } from 'node:test'
import {
  collectSePayWebhookIpCandidates,
  verifySePayWebhookAuth,
} from './sepay-webhook-auth'

const ENV_KEYS = [
  'SEPAY_SECRET_KEY',
  'SEPAY_WEBHOOK_SECRET',
  'SEPAY_REQUIRE_SIGNATURE',
  'SEPAY_WEBHOOK_API_KEY',
  'SEPAY_WEBHOOK_PUBLIC_URL',
  'SEPAY_WEBHOOK_TRUST_NO_AUTH_IP',
  'SEPAY_WEBHOOK_TRUST_PROXY_HEADERS',
  'SEPAY_WEBHOOK_IP_ALLOWLIST',
  'SEPAY_ALLOW_INSECURE_DEV',
] as const

const saved: Record<string, string | undefined> = {}
for (const key of ENV_KEYS) saved[key] = process.env[key]

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function headers(init: Record<string, string>): Headers {
  return new Headers(init)
}

function qs(init: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(init)
}

describe('sepay-webhook-auth', () => {
  it('accepts SePay IP when HMAC is missing (Không chứng thực)', () => {
    process.env.SEPAY_SECRET_KEY = 'spsk_live_testsecret'
    process.env.SEPAY_REQUIRE_SIGNATURE = 'true'
    process.env.SEPAY_WEBHOOK_TRUST_NO_AUTH_IP = 'true'
    delete process.env.SEPAY_WEBHOOK_API_KEY

    const result = verifySePayWebhookAuth({
      headers: headers({
        'x-forwarded-for': '172.236.138.20',
        'x-real-ip': '172.236.138.20',
      }),
      searchParams: qs(),
      rawBody: '{"transferAmount":30000}',
      remoteIp: '127.0.0.1',
    })
    assert.deepEqual(result, { ok: true, via: 'sepay_ip' })
  })

  it('rejects unknown IP when REQUIRE_SIGNATURE and no HMAC/API key', () => {
    process.env.SEPAY_SECRET_KEY = 'spsk_live_testsecret'
    process.env.SEPAY_REQUIRE_SIGNATURE = 'true'
    process.env.SEPAY_WEBHOOK_TRUST_NO_AUTH_IP = 'true'
    delete process.env.SEPAY_WEBHOOK_API_KEY

    const result = verifySePayWebhookAuth({
      headers: headers({ 'x-forwarded-for': '8.8.8.8' }),
      searchParams: qs(),
      rawBody: '{"transferAmount":30000}',
      remoteIp: '127.0.0.1',
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'missing_hmac_and_untrusted_ip')
  })

  it('accepts Authorization Apikey like 188', () => {
    process.env.SEPAY_WEBHOOK_API_KEY = 'shop-webhook-token-1'
    process.env.SEPAY_REQUIRE_SIGNATURE = 'true'
    process.env.SEPAY_WEBHOOK_TRUST_NO_AUTH_IP = 'false'
    delete process.env.SEPAY_SECRET_KEY

    const result = verifySePayWebhookAuth({
      headers: headers({ authorization: 'Apikey shop-webhook-token-1' }),
      searchParams: qs(),
      rawBody: '{}',
      remoteIp: '8.8.8.8',
    })
    assert.deepEqual(result, { ok: true, via: 'api_key' })
  })

  it('accepts official SePay HMAC sha256=timestamp.body', () => {
    const secret = 'whsec_test_official'
    const rawBody = '{"transferAmount":30000}'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const hex = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    process.env.SEPAY_WEBHOOK_SECRET = secret
    process.env.SEPAY_REQUIRE_SIGNATURE = 'true'
    process.env.SEPAY_WEBHOOK_TRUST_NO_AUTH_IP = 'false'
    delete process.env.SEPAY_SECRET_KEY
    delete process.env.SEPAY_WEBHOOK_API_KEY

    const result = verifySePayWebhookAuth({
      headers: headers({
        'x-sepay-signature': `sha256=${hex}`,
        'x-sepay-timestamp': timestamp,
      }),
      searchParams: qs(),
      rawBody,
      remoteIp: '8.8.8.8',
    })
    assert.deepEqual(result, { ok: true, via: 'hmac' })
  })

  it('rejects official HMAC when timestamp is older than 5 minutes', () => {
    const secret = 'whsec_test_official'
    const rawBody = '{"transferAmount":30000}'
    const timestamp = String(Math.floor(Date.now() / 1000) - 400)
    const hex = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    process.env.SEPAY_WEBHOOK_SECRET = secret
    process.env.SEPAY_WEBHOOK_TRUST_NO_AUTH_IP = 'true'
    delete process.env.SEPAY_SECRET_KEY

    const result = verifySePayWebhookAuth({
      headers: headers({
        'x-sepay-signature': `sha256=${hex}`,
        'x-sepay-timestamp': timestamp,
        'x-forwarded-for': '172.236.138.20',
      }),
      searchParams: qs(),
      rawBody,
      remoteIp: '127.0.0.1',
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'hmac_expired')
  })

  it('accepts valid HMAC when SePay sends x-sepay-signature', () => {
    const secret = 'spsk_live_hmacsecret'
    const rawBody = '{"transferAmount":6000}'
    process.env.SEPAY_SECRET_KEY = secret
    process.env.SEPAY_REQUIRE_SIGNATURE = 'true'
    process.env.SEPAY_WEBHOOK_TRUST_NO_AUTH_IP = 'false'
    delete process.env.SEPAY_WEBHOOK_API_KEY
    const sig = createHmac('sha256', secret).update(rawBody).digest('hex')

    const result = verifySePayWebhookAuth({
      headers: headers({ 'x-sepay-signature': sig }),
      searchParams: qs(),
      rawBody,
      remoteIp: '8.8.8.8',
    })
    assert.deepEqual(result, { ok: true, via: 'hmac' })
  })

  it('rejects invalid HMAC even from SePay IP', () => {
    process.env.SEPAY_SECRET_KEY = 'spsk_live_hmacsecret'
    process.env.SEPAY_WEBHOOK_TRUST_NO_AUTH_IP = 'true'
    delete process.env.SEPAY_WEBHOOK_API_KEY

    const result = verifySePayWebhookAuth({
      headers: headers({
        'x-sepay-signature': 'deadbeef',
        'x-forwarded-for': '172.236.138.20',
      }),
      searchParams: qs(),
      rawBody: '{"transferAmount":6000}',
      remoteIp: '127.0.0.1',
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_hmac')
  })

  it('reads X-Forwarded-For when peer is loopback', () => {
    const ips = collectSePayWebhookIpCandidates({
      headers: headers({ 'x-forwarded-for': '171.244.35.2, 10.0.0.1' }),
      remoteIp: '127.0.0.1',
    })
    assert.deepEqual(ips, ['171.244.35.2', '10.0.0.1'])
  })
})
