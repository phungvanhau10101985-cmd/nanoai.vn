import assert from 'node:assert/strict'
import test from 'node:test'
import { slideImageGradeStylePrompt } from './slide-image-grade-style'

test('ảnh slide lớp 6 ghi khối THCS và phong cách 11–15 tuổi', () => {
  const prompt = slideImageGradeStylePrompt('lop-6')
  assert.match(prompt, /Lớp 6/)
  assert.match(prompt, /THCS/)
  assert.match(prompt, /11–15/)
  assert.doesNotMatch(prompt, /15–18/)
})

test('ảnh slide lớp 1 khác lớp 12', () => {
  const primary = slideImageGradeStylePrompt('lop-1')
  const high = slideImageGradeStylePrompt('lop-12')
  assert.match(primary, /Lớp 1/)
  assert.match(primary, /Tiểu học/)
  assert.match(primary, /6–8/)
  assert.match(high, /Lớp 12/)
  assert.match(high, /THPT/)
  assert.match(high, /15–18/)
  assert.doesNotMatch(primary, /15–18/)
})

test('mẫu giáo và mã trống không bịa lớp', () => {
  assert.match(slideImageGradeStylePrompt('mau-giao-5-6-tuoi'), /Mẫu giáo 5–6/)
  assert.equal(slideImageGradeStylePrompt(''), '')
  assert.equal(slideImageGradeStylePrompt('khac'), '')
})
