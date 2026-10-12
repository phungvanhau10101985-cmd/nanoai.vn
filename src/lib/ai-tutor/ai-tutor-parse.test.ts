import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindLabelsToSaved,
  pickSavedTopicByTag,
  pickSavedTopicFromClassified,
  pickSavedTopicFromQuestion,
} from '@/lib/ai-tutor/ai-tutor-match'
import {
  parseStoredTutorAnswer,
  parseTutorCheck,
  parseTutorClassify,
  parseTutorDraft,
  tutorTopicKey,
} from '@/lib/ai-tutor/ai-tutor-parse'

const SAVED = [
  { topicKey: 'right-triangles', title: 'Tam giác vuông' },
  { topicKey: 'dinh-ly-pytago', title: 'Định lý Pytago' },
  { topicKey: 'pythagorean-theorem', title: 'Định lý Pytago' },
  { topicKey: 'distance-formula', title: 'Công thức tính khoảng cách' },
]

test('a question that names one saved lesson reuses that lesson', () => {
  assert.equal(pickSavedTopicFromQuestion('Học về tam giác vuông', SAVED)?.topicKey, 'right-triangles')
  assert.equal(pickSavedTopicFromQuestion('nói về định lý pytago', SAVED)?.topicKey, 'dinh-ly-pytago')
  assert.equal(pickSavedTopicFromQuestion('so sánh tam giác vuông và định lý pytago', SAVED), null)
})

test('a tag click matches the saved name even when the key differs', () => {
  const hit = pickSavedTopicByTag({ key: 'pythagorean-theorem', title: 'Định lý Pytago' }, SAVED)
  assert.equal(hit?.topicKey, 'dinh-ly-pytago')
})

test('classified lesson reuses the saved title before the new key', () => {
  const hit = pickSavedTopicFromClassified(
    { topicKey: 'right-triangle', title: 'Tam giác vuông' },
    SAVED
  )
  assert.equal(hit?.topicKey, 'right-triangles')
})

test('new tags attach to a saved name and a topic does not tag itself', () => {
  const labels = bindLabelsToSaved(
    [
      { key: 'pythagorean-theorem', title: 'Định lý Pytago' },
      { key: 'right-triangles', title: 'Tam giác vuông' },
      { key: 'trig-ratios', title: 'Tỉ số lượng giác' },
    ],
    SAVED,
    'Tam giác vuông'
  )
  assert.deepEqual(labels, [
    { key: 'dinh-ly-pytago', title: 'Định lý Pytago' },
    { key: 'trig-ratios', title: 'Tỉ số lượng giác' },
  ])
})

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
