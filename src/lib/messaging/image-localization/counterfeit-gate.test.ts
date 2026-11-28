import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { brandsFromFlag, parseBrandJson } from './counterfeit-gate'

describe('counterfeit gemini json', () => {
  it('reads brand names and an empty list', () => {
    assert.deepEqual(parseBrandJson('{"brands":["Nike"]}'), ['Nike'])
    assert.deepEqual(parseBrandJson('{"brands":[]}'), [])
    assert.equal(parseBrandJson('không phải json'), null)
    assert.deepEqual(brandsFromFlag({ risk: true, brands: ['Nike'] }), ['Nike'])
    assert.deepEqual(brandsFromFlag({ risk: false, brands: ['Nike'] }), [])
  })
})
