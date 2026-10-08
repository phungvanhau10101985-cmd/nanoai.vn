import assert from 'node:assert/strict'
import test from 'node:test'

import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { resolveProductStudioGeminiImage } from '@/lib/partner-website/product-studio/product-studio-image-model'
import {
  composeLadipageDescription,
  shouldAdoptLadipageDescription,
  studioClassificationChineseName,
  studioQuestionGroupId,
} from '@/lib/partner-website/product-studio/product-studio-finalize'

test('studio image model: material stays Pro 2K, flash 2.5 omits size', () => {
  assert.deepEqual(resolveProductStudioGeminiImage('material', 'flash'), {
    model: GEMINI_3_PRO_IMAGE.model,
    imageSize: '2K',
  })
  assert.deepEqual(resolveProductStudioGeminiImage('gallery', 'flash'), {
    model: 'gemini-2.5-flash-image',
    imageSize: null,
  })
  assert.deepEqual(resolveProductStudioGeminiImage('color', 'flash3'), {
    model: 'gemini-3.1-flash-image',
    imageSize: '2K',
  })
  assert.deepEqual(resolveProductStudioGeminiImage('detail', 'pro'), {
    model: GEMINI_3_PRO_IMAGE.model,
    imageSize: '2K',
  })
})

test('question group follows gender, then the product name', () => {
  assert.equal(studioQuestionGroupId('Áo thun', 'male'), 100)
  assert.equal(studioQuestionGroupId('Áo thun', 'female'), 88)
  assert.equal(studioQuestionGroupId('Áo thun nam nữ', 'unisex'), 99)
  assert.equal(studioQuestionGroupId('Áo thun nam', ''), 100)
  assert.equal(studioQuestionGroupId('Váy nữ', ''), 88)
})

test('gender hint is only a classification suffix', () => {
  assert.equal(studioClassificationChineseName('Đầm hoa', 'female'), 'Đầm hoa 女士 女款')
  assert.equal(studioClassificationChineseName('Áo nam', 'male'), 'Áo nam 男士 男款')
  assert.equal(studioClassificationChineseName('Túi', 'unisex'), '')
  assert.equal(studioClassificationChineseName('  ', 'male'), '')
})

test('ladipage description replaces only a short catalog description', () => {
  const composed = composeLadipageDescription([
    { sectionType: 'hero', data: { headline: 'Đầm hoa midi', subheadline: 'Mỏng nhẹ cho ngày hè' } },
    { sectionType: 'highlights', data: { items: [{ title: 'Chất voan', desc: 'Thoáng, ít nhăn' }] } },
    { sectionType: 'material', data: { body: 'Voan chiffon mềm, đứng form khi mặc.' } },
    { sectionType: 'trust_cta', data: { body: 'Đổi size trong 7 ngày nếu còn tem.' } },
  ])
  assert.ok(composed.length >= 80)
  assert.equal(shouldAdoptLadipageDescription('Mô tả ngắn', composed), true)
  assert.equal(shouldAdoptLadipageDescription('x'.repeat(350), composed), false)
  assert.equal(shouldAdoptLadipageDescription('Mô tả ngắn', 'ngắn'), false)
  assert.equal(shouldAdoptLadipageDescription(composed, composed), false)
})
