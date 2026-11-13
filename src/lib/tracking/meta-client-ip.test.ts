import assert from 'node:assert/strict'
import test from 'node:test'
import { metaClientIpFromHeaders } from '@/lib/tracking/meta-client-ip'

function headers(map: Record<string, string>): { get(name: string): string | null } {
  return { get: (name) => map[name.toLowerCase()] ?? null }
}

test('meta client ip prefers a public IPv6 over the proxy IPv4', () => {
  const ip = metaClientIpFromHeaders(
    headers({
      'x-forwarded-for': '2001:db8:85a3::8a2e:370:7334, 172.16.0.4',
      'x-real-ip': '203.0.113.8',
    })
  )
  assert.equal(ip, '2001:db8:85a3::8a2e:370:7334')
})

test('meta client ip keeps a public IPv4 when no IPv6 is present', () => {
  const ip = metaClientIpFromHeaders(
    headers({
      'x-forwarded-for': '10.0.0.8, 203.0.113.9',
      'x-real-ip': '127.0.0.1',
    })
  )
  assert.equal(ip, '203.0.113.9')
})

test('meta client ip reads a public IPv6 from the Forwarded header', () => {
  const ip = metaClientIpFromHeaders(
    headers({
      forwarded: 'for=203.0.113.8, for="[2001:db8::44]";proto=https',
    })
  )
  assert.equal(ip, '2001:db8::44')
})

test('meta client ip drops link-local IPv6 and uses Cloudflare client IP', () => {
  const ip = metaClientIpFromHeaders(
    headers({
      'cf-connecting-ip': '2001:db8::10',
      'x-forwarded-for': 'fe80::1, 198.51.100.4',
    })
  )
  assert.equal(ip, '2001:db8::10')
})
