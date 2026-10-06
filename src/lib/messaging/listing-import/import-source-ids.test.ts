import assert from 'node:assert/strict'
import test from 'node:test'
import { claimExcelSourceProductId, listingSourceProductIdKey } from '@/lib/messaging/listing-import/import-source-ids'

test('listing source id is A/T digits, including legacy a188 suffix', () => {
  assert.equal(listingSourceProductIdKey('A953136552117'), 'A953136552117')
  assert.equal(listingSourceProductIdKey('t12345'), 'T12345')
  assert.equal(listingSourceProductIdKey('A953136552117a188old'), 'A953136552117')
  assert.equal(listingSourceProductIdKey('A746-DEMO-001'), null)
  assert.equal(listingSourceProductIdKey(''), null)
})

test('excel import skips a 1688/Tmall id already in stock or already claimed in the file', () => {
  const existing = new Set(['A100'])
  const claimed = new Set<string>()
  assert.equal(claimExcelSourceProductId('A100', existing, claimed), 'skip')
  assert.equal(claimExcelSourceProductId('A100a188x', existing, claimed), 'skip')
  assert.equal(claimExcelSourceProductId('T9', existing, claimed), 'new')
  assert.equal(claimExcelSourceProductId('t9', existing, claimed), 'skip')
  assert.equal(claimExcelSourceProductId('Qa0001', existing, claimed), 'other')
  assert.equal(claimed.has('T9'), true)
  assert.equal(claimed.has('A100'), false)
})
