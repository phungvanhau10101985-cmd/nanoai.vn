import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enforceFashionSizeRecommendation,
  fashionSizeRecommendationPrompt,
  finalizeFashionSizeCustomerMessage,
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
  assert.equal(result.source, 'product')
  assert.equal(result.recommendedSize, 'M')
})

const JACKET_MESSAGE =
  'Cao 1 m7, 87 kg. Kích thước thực tế của mình vòng ngực 112, bụng 105, ngang vai 51.5, tay 63'

test('missing product size chart uses the majority reference size', () => {
  const result = resolveFashionSizeRecommendation(JACKET_MESSAGE, [], {
    name: 'Áo khoác da B6127',
    categoryL1: 'Thời trang Nam',
  })
  assert.equal(result.source, 'reference')
  assert.equal(result.status, 'exact')
  assert.equal(result.heightCm, 170)
  assert.equal(result.weightKg, 87)
  assert.equal(result.recommendedSize, 'XXL')
  assert.match(fashionSizeRecommendationPrompt(result), /chuẩn tham khảo số đông/)
  assert.match(fashionSizeRecommendationPrompt(result), /hay mặc size gì/)
})

test('product measurement chart wins over the majority reference', () => {
  const result = resolveFashionSizeRecommendation(JACKET_MESSAGE, [], {
    name: 'Áo khoác da B6127',
    categoryL1: 'Thời trang Nam',
    productText: 'Size L ngực 96-102 vai 45-47. Size XL ngực 102-108 vai 47-49. Size XXL ngực 108-114 vai 49-51.',
  })
  assert.equal(result.source, 'product')
  assert.equal(result.recommendedSize, 'XXL')
})

test('reference size snaps to a size the product actually lists', () => {
  const result = resolveFashionSizeRecommendation('Cao 1 m7, 87 kg', ['S', 'M', 'L'], {
    name: 'Áo khoác nam',
    categoryL1: 'Thời trang Nam',
  })
  assert.equal(result.source, 'reference')
  assert.equal(result.referenceSize, 'XXL')
  assert.equal(result.recommendedSize, 'L')
})

test('refusal to guess size is replaced by the reference size and a usual-size question', () => {
  const result = resolveFashionSizeRecommendation(JACKET_MESSAGE, [], {
    name: 'Áo khoác da B6127',
    categoryL1: 'Thời trang Nam',
  })
  const out = finalizeFashionSizeCustomerMessage(
    'Dạ với số đo của anh thì mình chưa có bảng size khớp chắc chắn, nên em không dám chốt bừa size. Em sẽ kiểm tra lại bảng size thực tế của xưởng rồi báo anh.',
    result
  )
  assert.match(out, /size XXL/)
  assert.match(out, /hay mặc size gì/)
  assert.doesNotMatch(out, /không dám chốt|kiểm tra lại bảng size/)
})
