import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enforceFashionSizeRecommendation,
  resolveFashionSizeRecommendation,
} from './fashion-size-recommendation'

const CF2717_SIZES = [
  '170/M (55-62.5kg)',
  '175/L (62.5-70kg)',
  '180/XL (70-77.5kg)',
  '185/2XL (77.5-85kg)',
]

test('Cf2717: 168 cm and 72 kg deterministically resolves to XL', () => {
  const result = resolveFashionSizeRecommendation('Mình cao 168cm, nặng 72kg mặc size gì?', CF2717_SIZES)
  assert.equal(result.status, 'exact')
  assert.equal(result.heightCm, 168)
  assert.equal(result.weightKg, 72)
  assert.equal(result.recommendedSize, 'XL')
})

test('shared range edge is reported as boundary instead of guessed', () => {
  const result = resolveFashionSizeRecommendation('70kg mặc size nào?', CF2717_SIZES)
  assert.equal(result.status, 'boundary')
  assert.deepEqual(result.candidateSizes, ['L', 'XL'])
  assert.equal(result.recommendedSize, null)
})

test('post-processing replaces a conflicting AI size with the authoritative result', () => {
  const result = resolveFashionSizeRecommendation('168cm 72kg', CF2717_SIZES)
  assert.equal(
    enforceFashionSizeRecommendation('Dạ chị mặc size L sẽ vừa ạ.', result),
    'Dạ chị mặc size XL sẽ vừa ạ.'
  )
})

test('Chinese jin ranges are converted before matching', () => {
  const result = resolveFashionSizeRecommendation('Em nặng 52kg', ['M (90-105)', 'L (105-120)'])
  assert.equal(result.status, 'exact')
  assert.equal(result.recommendedSize, 'M')
})
