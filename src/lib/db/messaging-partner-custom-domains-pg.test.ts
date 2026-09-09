import assert from 'node:assert/strict'
import test from 'node:test'
import { isHostnameUniqueViolation } from './messaging-partner-custom-domains-pg'

test('hostname unique violation is detected from postgres 23505', () => {
  assert.equal(
    isHostnameUniqueViolation({
      code: '23505',
      constraint: 'messaging_partner_custom_domains_hostname_unique',
    }),
    true
  )
  assert.equal(
    isHostnameUniqueViolation({
      code: '23505',
      constraint: 'messaging_partner_custom_domains_partner_unique',
    }),
    false
  )
  assert.equal(
    isHostnameUniqueViolation({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      detail: 'Key (hostname)=(shop.example.com) already exists.',
    }),
    true
  )
})
