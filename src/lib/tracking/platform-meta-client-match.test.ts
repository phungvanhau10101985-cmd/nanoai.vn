import assert from 'node:assert/strict'
import test from 'node:test'
import { mergePlatformMetaClientMatch } from '@/lib/tracking/platform-meta-client-match'

const FBC = 'fb.1.1710000000000.AbCdEfGhIj'
const FBP = 'fb.1.1710000000000.1234567890'

test('later visit keeps the ad click id and a stored IPv6', () => {
  const merged = mergePlatformMetaClientMatch(
    { fbc: FBC, fbp: FBP, clientIp: '2001:db8::10', userAgent: 'Mozilla/5.0' },
    { fbc: '', fbp: '', clientIp: '203.0.113.9', userAgent: '' }
  )
  assert.equal(merged.fbc, FBC)
  assert.equal(merged.fbp, FBP)
  assert.equal(merged.clientIp, '2001:db8::10')
  assert.equal(merged.userAgent, 'Mozilla/5.0')
})

test('a new click id and a public IPv6 replace the older IPv4', () => {
  const merged = mergePlatformMetaClientMatch(
    { fbc: FBC, fbp: FBP, clientIp: '203.0.113.9', userAgent: 'old' },
    { fbc: 'fb.2.1710000000001.NewClickId', fbp: FBP, clientIp: '2001:db8::20', userAgent: 'new' }
  )
  assert.equal(merged.fbc, 'fb.2.1710000000001.NewClickId')
  assert.equal(merged.clientIp, '2001:db8::20')
  assert.equal(merged.userAgent, 'new')
})
