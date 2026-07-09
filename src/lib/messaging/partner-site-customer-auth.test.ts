import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPartnerSiteCustomerToken,
  parsePartnerSiteCustomerToken,
  verifyPartnerSiteCustomerToken,
} from './partner-site-customer-auth'

const EMBED_KEY = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

describe('partner-site-customer-auth token', () => {
  it('build → parse → verify round-trip', () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const raw = buildPartnerSiteCustomerToken({
      embedKey: EMBED_KEY,
      email: 'User@188.COM.VN',
      name: 'Nguyễn Văn A',
      phone: '0901234567',
      exp,
    })
    const parsed = parsePartnerSiteCustomerToken(raw)
    assert.ok(parsed)
    assert.equal(parsed.email, 'user@188.com.vn')
    assert.equal(parsed.name, 'Nguyễn Văn A')
    assert.equal(parsed.phone, '0901234567')
    assert.equal(parsed.exp, exp)

    const verified = verifyPartnerSiteCustomerToken(EMBED_KEY, raw)
    assert.equal(verified.ok, true)
    if (verified.ok) {
      assert.equal(verified.payload.email, 'user@188.com.vn')
    }
  })

  it('rejects wrong embed key', () => {
    const raw = buildPartnerSiteCustomerToken({
      embedKey: EMBED_KEY,
      email: 'a@b.com',
      exp: Math.floor(Date.now() / 1000) + 120,
    })
    const verified = verifyPartnerSiteCustomerToken('wrong-key', raw)
    assert.equal(verified.ok, false)
    if (!verified.ok) assert.equal(verified.error, 'INVALID_TOKEN')
  })

  it('rejects expired token', () => {
    const raw = buildPartnerSiteCustomerToken({
      embedKey: EMBED_KEY,
      email: 'a@b.com',
      exp: Math.floor(Date.now() / 1000) - 10,
    })
    const verified = verifyPartnerSiteCustomerToken(EMBED_KEY, raw)
    assert.equal(verified.ok, false)
    if (!verified.ok) assert.equal(verified.error, 'TOKEN_EXPIRED')
  })
})
