import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TUTOR_REPLY_FLOOR_MS,
  splitTutorProse,
  tutorNextBubbleDelayMs,
  tutorReplyBubbles,
  tutorReplyHoldMs,
} from '@/lib/ai-tutor/ai-tutor-pace'

test('a fast or cached reply still holds the teacher typing state', () => {
  assert.equal(tutorReplyHoldMs(1_000, 1_100), TUTOR_REPLY_FLOOR_MS - 100)
  assert.equal(tutorReplyHoldMs(1_000, 1_000), TUTOR_REPLY_FLOOR_MS)
})

test('a slow reply does not add another wait after the floor', () => {
  assert.equal(tutorReplyHoldMs(1_000, 1_000 + TUTOR_REPLY_FLOOR_MS), 0)
  assert.equal(tutorReplyHoldMs(1_000, 1_000 + TUTOR_REPLY_FLOOR_MS + 8_000), 0)
})

test('a short tutor section stays one bubble', () => {
  assert.deepEqual(splitTutorProse('Tam giác vuông có một góc 90 độ.'), ['Tam giác vuông có một góc 90 độ.'])
})

test('a long practice example is split on sentence boundaries', () => {
  const practice =
    'Một ví dụ thực tế là khi bạn dựa một chiếc thang vào tường. Cái thang, mặt đất và bức tường tạo thành một tam giác vuông. Nếu bạn biết chiều dài của cái thang và góc nghiêng của thang so với mặt đất, bạn có thể dùng sin để tính chiều cao thang với tới trên tường hoặc dùng cosin để tính khoảng cách an toàn từ chân thang đến tường.'
  const chunks = splitTutorProse(practice)
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].endsWith('tam giác vuông.'), true)
  assert.equal(chunks.join(' '), practice)
  assert.ok(tutorNextBubbleDelayMs(chunks[0]) > 0)
})

test('explanation and practice are separate bubbles in that order', () => {
  const bubbles = tutorReplyBubbles({
    explanation: 'Định lý Pytago: bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.',
    practice: 'Một ví dụ thực tế là khi bạn dựa một chiếc thang vào tường.',
  })
  assert.deepEqual(
    bubbles.map((bubble) => bubble.section),
    ['explain', 'practice']
  )
})
