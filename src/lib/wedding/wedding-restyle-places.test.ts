import assert from 'node:assert/strict'
import test from 'node:test'
import { findWeddingRestylePlace, WEDDING_RESTYLE_PLACES } from './wedding-restyle-places'

test('restyle places cover Vietnam and the world and reject unknown ids', () => {
  assert.ok(WEDDING_RESTYLE_PLACES.some((place) => place.region === 'vietnam'))
  assert.ok(WEDDING_RESTYLE_PLACES.some((place) => place.region === 'world'))
  const haLong = findWeddingRestylePlace('ha-long')
  assert.equal(haLong?.label.vi, 'Vịnh Hạ Long')
  assert.match(haLong?.scene || '', /Ha Long Bay/)
  assert.equal(findWeddingRestylePlace('../ha-long'), null)
  assert.equal(findWeddingRestylePlace('unknown-place'), null)
  const ids = WEDDING_RESTYLE_PLACES.map((place) => place.id)
  assert.equal(new Set(ids).size, ids.length)
})
