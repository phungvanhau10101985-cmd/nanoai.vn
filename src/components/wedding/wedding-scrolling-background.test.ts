import assert from 'node:assert/strict'
import test from 'node:test'
import { weddingBackgroundRepeatCount } from './wedding-scrolling-background'

test('background repeats only enough to cover the copy, never an extra tail', () => {
  assert.equal(weddingBackgroundRepeatCount(0, 800), 1)
  assert.equal(weddingBackgroundRepeatCount(400, 0), 1)
  assert.equal(weddingBackgroundRepeatCount(400, 1200), 1)
  assert.equal(weddingBackgroundRepeatCount(1200, 1200), 1)
  assert.equal(weddingBackgroundRepeatCount(1201, 1200), 2)
  assert.equal(weddingBackgroundRepeatCount(2401, 800), 4)
})
