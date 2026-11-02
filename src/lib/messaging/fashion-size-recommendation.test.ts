import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enforceFashionSizeRecommendation,
  fashionSizeRecommendationPrompt,
  finalizeFashionSizeCustomerMessage,
  resolveFashionSizeRecommendation,
  sizeSignalTextFromRecentInbound,
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

test('height-number sizes stay numeric and do not invent S', () => {
  const sizes = ['170', '175', '180', '185', '190', '195']
  const result = resolveFashionSizeRecommendation('Cao 155cm nặng 51kg', sizes, { name: 'Áo sơ mi lụa' })
  assert.equal(result.source, 'product')
  assert.equal(result.status, 'exact')
  assert.equal(result.recommendedSize, '170')
  assert.doesNotMatch(result.recommendedSize ?? '', /^[SMLX]/)
  assert.match(fashionSizeRecommendationPrompt(result), /không phải S\/M\/L/)
  assert.equal(enforceFashionSizeRecommendation('Dạ mặc size S sẽ vừa.', result), 'Dạ mặc size 170 sẽ vừa.')
})

test('dash weight bands do not fall through to a population size', () => {
  const sizes = ['M-90-120kg', 'L-120-140kg', 'XL-140-160kg', '2XL-160-180kg']
  const result = resolveFashionSizeRecommendation('1m75 nặng 83kg', sizes, { name: 'Áo thun' })
  assert.equal(result.source, 'product')
  assert.equal(result.status, 'unknown')
  assert.equal(result.recommendedSize, null)
  assert.equal(result.weightKg, 83)
  const inBand = resolveFashionSizeRecommendation('nặng 100kg', sizes, { name: 'Áo thun' })
  assert.equal(inBand.status, 'exact')
  assert.equal(inBand.recommendedSize, 'M')
})

test('shoe size outside the listed range is not converted from foot cm', () => {
  const sizes = ['37', '38', '39', '40', '41', '42', '43', '44']
  const result = resolveFashionSizeRecommendation('Chân 30cm, size 47 được không?', sizes, { name: 'Giày nam' })
  assert.equal(result.source, 'product')
  assert.equal(result.status, 'unknown')
  assert.equal(result.recommendedSize, null)
  assert.ok(result.candidateSizes.includes('37'))
  assert.ok(result.candidateSizes.includes('44'))
  assert.equal(result.candidateSizes.includes('47'), false)
  const out = finalizeFashionSizeCustomerMessage('Dạ size 47 sẽ vừa chân 30cm.', result)
  assert.match(out, /size 37–44/)
  assert.doesNotMatch(out, /size 47/)
})

test('170x80 is read as height and weight', () => {
  const result = resolveFashionSizeRecommendation('170x80', ['L', 'XL', 'XXL', '3XL'], { name: 'Áo khoác' })
  assert.equal(result.heightCm, 170)
  assert.equal(result.weightKg, 80)
})

test('a named listed size is not replaced when the product has no body chart', () => {
  const result = resolveFashionSizeRecommendation('Size 4XL có vừa 1m80 95kg không?', ['M', 'L', 'XL', 'XXL', '3XL', '4XL'], {
    name: 'Áo bomber',
  })
  assert.equal(result.source, 'product')
  assert.equal(result.recommendedSize, '4XL')
  assert.equal(result.status, 'unknown')
  assert.match(fashionSizeRecommendationPrompt(result), /không kết luận vừa/)
})

test('earlier height is kept when the latest line only has weight', () => {
  const text = sizeSignalTextFromRecentInbound('nặng 83kg', ['mình cao 1m75'])
  const result = resolveFashionSizeRecommendation(text, ['M-90-120kg', 'L-120-140kg'], { name: 'Áo' })
  assert.equal(result.heightCm, 175)
  assert.equal(result.weightKg, 83)
  assert.equal(sizeSignalTextFromRecentInbound('giá sao', ['nặng 83kg']), 'giá sao')
})
