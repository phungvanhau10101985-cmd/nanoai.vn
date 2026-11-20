import assert from 'node:assert/strict'
import test from 'node:test'
import { calcCostVndSplit } from '@/lib/pricing/api-token-cost'
import { curriculumApiGroupedCostVnd } from './curriculum-api-cost'

test('ảnh Gemini tính theo số lần gọi, không gộp token ảnh thành một bức', () => {
  const one = calcCostVndSplit(100, 0, 'gemini-3-pro-image', '2K').totalVnd
  const two = curriculumApiGroupedCostVnd({
    model: 'gemini-3-pro-image',
    imageSize: '2K',
    calls: 2,
    promptTokens: 200,
    outputTokens: 99999,
  })
  const input = calcCostVndSplit(200, 0, 'gemini-3-pro-image', null, { pricingMode: 'aggregate_short' }).inputVnd
  const image = calcCostVndSplit(0, 0, 'gemini-3-pro-image', '2K').outputVnd
  assert.equal(two, input + image * 2)
  assert.ok(two > one)
})

test('lượt chữ cộng token rồi tính một lần', () => {
  const cost = curriculumApiGroupedCostVnd({
    model: 'gemini-2.5-flash',
    imageSize: null,
    calls: 3,
    promptTokens: 1000,
    outputTokens: 400,
  })
  assert.equal(
    cost,
    calcCostVndSplit(1000, 400, 'gemini-2.5-flash', null, { pricingMode: 'aggregate_short' }).totalVnd,
  )
})
