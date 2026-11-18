import assert from 'node:assert/strict'
import test from 'node:test'

import { boxFaceImageRoute, boxSizeStandardChoices, coerceBoxFaceEngine } from '@/lib/packaging/box-face-engine'

test('near standard ratios keep Gemini and GPT and hide Flux', () => {
  const square = boxFaceImageRoute(100, 100)
  assert.deepEqual(square.engines, ['gemini', 'gpt'])
  assert.equal(square.preferred, 'gemini')
  assert.equal(square.geminiAspect, '1:1')
  assert.equal(square.gptAspect, '1:1')

  const threeTwo = boxFaceImageRoute(150, 100)
  assert.deepEqual(threeTwo.engines, ['gemini', 'gpt'])
  assert.equal(threeTwo.geminiAspect, '3:2')
  assert.equal(threeTwo.gptAspect, '3:2')

  const fourThree = boxFaceImageRoute(200, 150)
  assert.deepEqual(fourThree.engines, ['gemini'])
  assert.equal(fourThree.geminiAspect, '4:3')
  assert.equal(coerceBoxFaceEngine('flux', fourThree), 'gemini')
  assert.equal(coerceBoxFaceEngine('gpt', fourThree), 'gemini')
})

test('a face far from Gemini and GPT shows only Flux', () => {
  const tall = boxFaceImageRoute(50, 130)
  assert.deepEqual(tall.engines, ['flux'])
  assert.equal(tall.preferred, 'flux')
  assert.equal(coerceBoxFaceEngine('gemini', tall), 'flux')
  assert.equal(coerceBoxFaceEngine(null, tall), 'flux')

  const twoToOne = boxFaceImageRoute(200, 100)
  assert.deepEqual(twoToOne.engines, ['flux'])
})

test('155×105 snaps only to the larger 3:2 and keeps the length', () => {
  const choices = boxSizeStandardChoices({ length: 155, width: 105, height: 80 })
  assert.equal(choices.smaller, null)
  assert.equal(choices.larger?.dimensions.length, 155)
  assert.equal(choices.larger?.dimensions.width, 103.33)
  assert.equal(choices.larger?.dimensions.height, 80)
  assert.deepEqual(choices.larger?.aspects, ['3:2'])
})

test('a size between two close ratios offers the larger and the smaller', () => {
  const choices = boxSizeStandardChoices({ length: 140, width: 110, height: 80 })
  assert.equal(choices.larger?.dimensions.width, 105)
  assert.equal(choices.larger?.dimensions.height, 78.75)
  assert.deepEqual(choices.larger?.aspects, ['4:3', '16:9'])
  assert.equal(choices.smaller?.dimensions.width, 112)
  assert.equal(choices.smaller?.dimensions.height, 80)
  assert.deepEqual(choices.smaller?.aspects, ['5:4'])
})

test('a face far from every standard ratio is not resized', () => {
  const choices = boxSizeStandardChoices({ length: 50, width: 50, height: 130 })
  assert.equal(choices.larger, null)
  assert.equal(choices.smaller, null)
})

test('a ratio within 8 percent snaps to that model only', () => {
  const nearWide = boxFaceImageRoute(170, 100)
  assert.deepEqual(nearWide.engines, ['gemini'])
  assert.equal(nearWide.geminiAspect, '16:9')
  assert.equal(coerceBoxFaceEngine('gpt', nearWide), 'gemini')
  assert.equal(coerceBoxFaceEngine('flux', nearWide), 'gemini')
})
