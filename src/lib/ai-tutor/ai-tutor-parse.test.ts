import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseStoredTutorAnswer,
  parseTutorCheck,
  parseTutorClassify,
  parseTutorDraft,
  tutorTopicKey,
} from '@/lib/ai-tutor/ai-tutor-parse'

test('tutor topic key is stable ascii', () => {
  assert.equal(tutorTopicKey('Quang hợp'), 'quang-hop')
  assert.equal(tutorTopicKey('  Light Reaction!! '), 'light-reaction')
  assert.equal(tutorTopicKey('ab'), '')
})

test('classify keeps a reusable topic', () => {
  const row = parseTutorClassify({ topicKey: 'photosynthesis', title: 'Quang hợp', reuse: true })
  assert.deepEqual(row, { topicKey: 'photosynthesis', title: 'Quang hợp', reuse: true })
})

test('draft needs a practical note and at least two labels', () => {
  assert.equal(
    parseTutorDraft({
      explanation: 'Cây lấy năng lượng từ ánh sáng.',
      practice: '',
      labels: [{ key: 'chlorophyll', title: 'Diệp lục' }],
    }),
    null
  )
  const draft = parseTutorDraft({
    explanation: 'Cây lấy năng lượng từ ánh sáng.',
    practice: 'Để chậu gần cửa sổ, lá quay về phía sáng.',
    labels: [
      { key: 'chlorophyll', title: 'Diệp lục' },
      { key: 'light-reaction', title: 'Pha sáng' },
      { key: 'chlorophyll', title: 'Trùng' },
      { key: 'glucose', title: 'Đường' },
    ],
  })
  assert.equal(draft?.labels.length, 3)
  assert.equal(draft?.labels[0]?.key, 'chlorophyll')
  assert.equal(draft?.labels[2]?.key, 'glucose')
})

test('cross-check drops a wrong label and keeps two', () => {
  const checked = parseTutorCheck({
    ok: true,
    explanation: 'Quang hợp tạo đường từ ánh sáng, nước và khí cacbonic.',
    practice: 'Cây trong phòng thiếu cửa sổ sẽ vươn dài và nhạt màu.',
    labels: [
      { key: 'chlorophyll', title: 'Diệp lục', ok: true },
      { key: 'wrong', title: 'Sai', ok: false },
      { key: 'stomata', title: 'Khí khổng', ok: true },
    ],
  })
  assert.equal(checked?.ok, true)
  assert.deepEqual(
    checked?.labels.map((label) => label.key),
    ['chlorophyll', 'stomata']
  )
})

test('failed cross-check is not saved as shared content', () => {
  const checked = parseTutorCheck({
    ok: false,
    explanation: 'Sai.',
    practice: 'Sai.',
    labels: [],
  })
  assert.equal(checked?.ok, false)
  assert.equal(checked?.explanation, '')
})

test('stored chat payload keeps the share state', () => {
  const answer = parseStoredTutorAnswer(
    {
      topicKey: 'photosynthesis',
      title: 'Quang hợp',
      explanation: 'Cây dùng ánh sáng để tạo đường.',
      practice: 'Xoay chậu mỗi tuần.',
      labels: [
        { key: 'chlorophyll', title: 'Diệp lục' },
        { key: 'stomata', title: 'Khí khổng' },
      ],
      share: 'reused',
    },
    'photosynthesis'
  )
  assert.equal(answer?.share, 'reused')
  assert.equal(answer?.labels.length, 2)
})
