import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluatePartnerCustomDomainDns } from './partner-custom-domain-dns'

test('www CNAME to nanoai.vn is ok even if another resolver has no A', () => {
  const result = evaluatePartnerCustomDomainDns({
    cnames: ['nanoai.vn'],
    addrs: [],
    cnameTarget: 'nanoai.vn',
    expectedIps: ['14.225.218.39'],
    timedOut: false,
  })
  assert.equal(result.ok, true)
  assert.match(result.detail, /CNAME/)
})

test('apex A matching VPS IP is ok when CNAME is missing', () => {
  const result = evaluatePartnerCustomDomainDns({
    cnames: [],
    addrs: ['14.225.218.39'],
    cnameTarget: 'nanoai.vn',
    expectedIps: ['14.225.218.39'],
    timedOut: false,
  })
  assert.equal(result.ok, true)
  assert.equal(result.detail, 'A → 14.225.218.39')
})

test('one resolver NXDOMAIN does not fail if another has the A record', () => {
  const result = evaluatePartnerCustomDomainDns({
    cnames: [],
    addrs: ['14.225.218.39'],
    cnameTarget: 'nanoai.vn',
    expectedIps: ['14.225.218.39'],
    timedOut: true,
  })
  assert.equal(result.ok, true)
})

test('all resolvers timeout without records is transient', () => {
  const result = evaluatePartnerCustomDomainDns({
    cnames: [],
    addrs: [],
    cnameTarget: 'nanoai.vn',
    expectedIps: ['14.225.218.39'],
    timedOut: true,
  })
  assert.equal(result.ok, false)
  assert.equal(result.transient, true)
})

test('NXDOMAIN everywhere is a real DNS miss, not transient', () => {
  const result = evaluatePartnerCustomDomainDns({
    cnames: [],
    addrs: [],
    cnameTarget: 'nanoai.vn',
    expectedIps: ['14.225.218.39'],
    timedOut: false,
    nxdomain: true,
  })
  assert.equal(result.ok, false)
  assert.equal(result.transient, false)
  assert.match(result.detail, /NXDOMAIN/)
})

test('wrong A record is a real fail', () => {
  const result = evaluatePartnerCustomDomainDns({
    cnames: [],
    addrs: ['1.2.3.4'],
    cnameTarget: 'nanoai.vn',
    expectedIps: ['14.225.218.39'],
    timedOut: false,
  })
  assert.equal(result.ok, false)
  assert.equal(result.transient, false)
  assert.match(result.detail, /1\.2\.3\.4/)
})
