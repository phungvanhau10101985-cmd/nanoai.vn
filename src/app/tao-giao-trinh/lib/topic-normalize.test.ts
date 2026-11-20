import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTopicForSearch, topicsMatch } from './topic-normalize'

test('Chủ đề 6 và tên trần cùng một khóa', () => {
  const plain = normalizeTopicForSearch('Hải Phòng trong kỷ nguyên số')
  const labeled = normalizeTopicForSearch('Chủ đề 6: Hải Phòng trong kỷ nguyên số')
  assert.equal(plain, 'hai phong trong ky nguyen so')
  assert.equal(labeled, plain)
  assert.equal(topicsMatch('Hải Phòng trong kỷ nguyên số', 'Chủ đề 6: Hải Phòng trong kỷ nguyên số'), true)
})

test('bỏ nhãn Bài, Chương, Tiết', () => {
  assert.equal(normalizeTopicForSearch('Bài 1: Mệnh đề'), 'menh de')
  assert.equal(normalizeTopicForSearch('Chương 2: Hàm số'), 'ham so')
  assert.equal(normalizeTopicForSearch('Tiết 3 - Vectơ'), 'vecto')
})

test('không nuốt tên không có nhãn số', () => {
  assert.equal(normalizeTopicForSearch('Bài học về số'), 'bai hoc ve so')
})
