import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  allocatePartnerInternalSku,
  assignShopSkuPrefixLetter,
  canonicalPartnerInternalSku,
  internalSkuIsValidFormat,
  resolvePartnerImportSku,
} from './partner-inventory-internal-sku'

describe('partner internal sku', () => {
  it('uses a fixed shop letter + random lowercase + four digits, not the 188 shape', () => {
    assert.equal(internalSkuIsValidFormat('Qa0001'), true)
    assert.equal(canonicalPartnerInternalSku('qa0001'), 'Qa0001')
    assert.equal(internalSkuIsValidFormat('Qa0000'), false)
    assert.equal(internalSkuIsValidFormat('K0842'), false)
    assert.equal(internalSkuIsValidFormat('DEMO-188-1'), false)
  })

  it('picks a random letter that no other shop already has', () => {
    const used = new Set(['G', 'H'])
    for (let i = 0; i < 20; i++) {
      const letter = assignShopSkuPrefixLetter(used)
      assert.equal(used.has(letter), false)
      assert.match(letter, /^[A-Z]$/)
    }
  })

  it('keeps a merchant sku and an existing sku when the import cell is empty', () => {
    const blocked = new Set<string>()
    assert.equal(
      resolvePartnerImportSku({
        proposed: 'DEMO-188-1',
        existingSku: null,
        assignIfEmpty: true,
        shopPrefix: 'G',
        blocked,
      }),
      'DEMO-188-1'
    )
    assert.equal(
      resolvePartnerImportSku({
        proposed: '',
        existingSku: 'K0842',
        assignIfEmpty: true,
        shopPrefix: 'G',
        blocked,
      }),
      'K0842'
    )
  })

  it('keeps a free shop sku and allocates another when that code is taken', () => {
    const blocked = new Set<string>(['GA0001'])
    assert.equal(
      resolvePartnerImportSku({
        proposed: 'ga0002',
        existingSku: null,
        assignIfEmpty: true,
        shopPrefix: 'G',
        blocked,
      }),
      'Ga0002'
    )
    const fresh = resolvePartnerImportSku({
      proposed: 'Ga0001',
      existingSku: '',
      assignIfEmpty: true,
      shopPrefix: 'G',
      blocked,
    })
    assert.ok(fresh)
    assert.notEqual(fresh, 'Ga0001')
    assert.match(fresh!, /^G[a-z][0-9]{4}$/)
    assert.equal(fresh!.endsWith('0000'), false)
    assert.equal(blocked.has(fresh!.toUpperCase()), true)
  })

  it('does not allocate for a 12-column import with an empty sku', () => {
    assert.equal(
      resolvePartnerImportSku({
        proposed: null,
        existingSku: null,
        assignIfEmpty: false,
        shopPrefix: 'G',
        blocked: new Set(),
      }),
      null
    )
  })

  it('allocates distinct gudo-style codes that share the fixed shop letter', () => {
    const blocked = new Set<string>()
    const a = resolvePartnerImportSku({
      proposed: '',
      existingSku: null,
      assignIfEmpty: true,
      shopPrefix: 'G',
      blocked,
    })
    const b = resolvePartnerImportSku({
      proposed: '',
      existingSku: null,
      assignIfEmpty: true,
      shopPrefix: 'G',
      blocked,
    })
    assert.match(a!, /^G[a-z](?!0000)[0-9]{4}$/)
    assert.match(b!, /^G[a-z][0-9]{4}$/)
    assert.notEqual(a, b)
    assert.equal(a![0], 'G')
    assert.equal(b![0], 'G')
  })

  it('skips codes already in the shop', () => {
    const blocked = new Set<string>(['GA0001'])
    const sku = allocatePartnerInternalSku('G', blocked)
    assert.notEqual(sku, 'Ga0001')
    assert.match(sku, /^G[a-z][0-9]{4}$/)
    assert.equal(sku.endsWith('0000'), false)
  })
})
