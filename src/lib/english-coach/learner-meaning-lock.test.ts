import assert from 'node:assert/strict'
import test from 'node:test'
import { applyLearnerMeaningNames } from './learner-meaning-lock'

test('câu sửa đổi tên máy nghe nhầm sang tên trong nghĩa học sinh gửi', () => {
  const fixed = applyLearnerMeaningNames(
    'My name is Xuân Văn Hậu.',
    'Tên tôi là Phùng Văn Hậu',
  )
  assert.equal(fixed, 'My name is Phùng Văn Hậu.')
})

test('ý 1 và câu sửa đang mỗi câu một tên thì cả hai lấy tên trong nghĩa', () => {
  const meaning = 'Tên tôi là Lê Văn Nam'
  assert.equal(
    applyLearnerMeaningNames('Em nói tên là Phùng Văn Hậu.', meaning),
    'Em nói tên là Lê Văn Nam.',
  )
  assert.equal(
    applyLearnerMeaningNames('My name is Xuân Văn Hậu.', meaning),
    'My name is Lê Văn Nam.',
  )
})

test('một đoạn có cả hai tên sai thì thay mỗi cụm tên', () => {
  const fixed = applyLearnerMeaningNames(
    'Máy nghe thành Xuân Văn Hậu, không phải Phùng Văn Hậu.',
    'Tên tôi là Mai Văn Hậu',
  )
  assert.equal(fixed, 'Máy nghe thành Mai Văn Hậu, không phải Mai Văn Hậu.')
})

test('nghĩa viết thường vẫn khóa tên riêng', () => {
  const fixed = applyLearnerMeaningNames(
    'My name is Xuan Van Hau.',
    'tên tôi là phùng văn hậu',
  )
  assert.equal(fixed, 'My name is phùng văn hậu.')
})

test('câu không có tên riêng giữ nguyên khi nghĩa là câu thường', () => {
  const sentence = 'I want coffee.'
  assert.equal(applyLearnerMeaningNames(sentence, 'Tôi muốn cà phê'), sentence)
  assert.equal(applyLearnerMeaningNames('Great, let us continue.', 'Tôi muốn cà phê'), 'Great, let us continue.')
})

test('không có nghĩa thì không đổi câu', () => {
  assert.equal(applyLearnerMeaningNames('My name is Xuân Văn Hậu.', ''), 'My name is Xuân Văn Hậu.')
})
