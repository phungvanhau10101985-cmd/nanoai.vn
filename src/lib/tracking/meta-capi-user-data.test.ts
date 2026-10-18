import assert from 'node:assert/strict'
import test from 'node:test'
import { hashMetaCapiEmail, hashMetaCapiPhone } from '@/lib/tracking/meta-capi-hash'
import { metaClickSubdomainIndex, normalizeMetaFbc } from '@/lib/tracking/meta-click-ids'
import { buildMetaCapiUserData } from '@/lib/tracking/meta-capi-user-data'

test('subdomain index follows the hostname Meta uses for _fbc', () => {
  assert.equal(metaClickSubdomainIndex('example.com'), 1)
  assert.equal(metaClickSubdomainIndex('www.example.com'), 2)
  assert.equal(metaClickSubdomainIndex('shop.example.co.uk'), 3)
})

test('normalizeMetaFbc keeps fb.2 click ids and drops junk', () => {
  const now = Date.now()
  const fbc = `fb.2.${now}.IwAR2F4dbP0l7Mn1`
  assert.equal(normalizeMetaFbc(fbc), fbc)
  assert.equal(normalizeMetaFbc('fb.1.123.click'), null)
  assert.equal(normalizeMetaFbc('not-a-click'), null)
})

test('CAPI user_data hashes email and phone and sends fbc plus raw external_id', () => {
  const now = Date.now()
  const fbc = `fb.2.${now}.IwAR2F4dbP0l7Mn1`
  const userData = buildMetaCapiUserData({
    clientIp: '1.2.3.4',
    userAgent: 'Mozilla/5.0',
    fbc,
    fbp: `fb.1.${now}.123456789`,
    customerEmail: 'Buyer@Example.com',
    customerPhone: '0912345678',
    externalId: '11111111-1111-4111-8111-111111111111',
  })
  assert.equal(userData.fbc, fbc)
  assert.deepEqual(userData.em, [hashMetaCapiEmail('buyer@example.com')])
  assert.deepEqual(userData.ph, [hashMetaCapiPhone('0912345678')])
  assert.deepEqual(userData.external_id, ['11111111-1111-4111-8111-111111111111'])
  assert.equal(userData.client_ip_address, '1.2.3.4')
})
