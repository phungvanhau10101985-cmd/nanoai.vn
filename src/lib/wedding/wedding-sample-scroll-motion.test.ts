import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEDDING_SAMPLE_SCROLL_MS,
  weddingSampleScrollDuration,
  weddingSampleScrollTravel,
} from './wedding-sample-scroll-motion'

test('travel is the part of the strip hidden below the frame', () => {
  assert.equal(weddingSampleScrollTravel(7000, 400), 6600)
  assert.equal(weddingSampleScrollTravel(300, 400), 0)
  assert.equal(weddingSampleScrollTravel(Number.NaN, 400), 0)
})

test('a full pass takes 42s and a halfway restart keeps the same speed', () => {
  assert.equal(weddingSampleScrollDuration(6600, 6600), WEDDING_SAMPLE_SCROLL_MS)
  assert.equal(weddingSampleScrollDuration(3300, 6600), WEDDING_SAMPLE_SCROLL_MS / 2)
  assert.equal(weddingSampleScrollDuration(0, 6600), 0)
})
