import assert from 'node:assert/strict'
import test from 'node:test'
import {
  automatedReplyNextChunkDelayMs,
  splitAutomatedReplyIntoChunks,
} from './partner-ai-split-reply'

test('short sales answer stays in one bubble', () => {
  assert.deepEqual(splitAutomatedReplyIntoChunks('Chất liệu polyester pha spandex, giữ form tốt ạ.'), [
    'Chất liệu polyester pha spandex, giữ form tốt ạ.',
  ])
})

test('next bubble waits 80% of reading time at one word per second', () => {
  const oneHundredWords = Array.from({ length: 100 }, (_, index) => `word${index}`).join(' ')
  assert.equal(automatedReplyNextChunkDelayMs(oneHundredWords), 80_000)
  assert.equal(automatedReplyNextChunkDelayMs('một hai ba bốn năm sáu bảy tám chín mười'), 8_000)
  assert.equal(automatedReplyNextChunkDelayMs('   '), 0)
})

test('long answer is split at semantic boundaries into no more than three bubbles', () => {
  const body = Array.from(
    { length: 14 },
    (_, i) => `Ý ${i + 1}: thông tin hữu ích cho khách, trình bày rõ ràng và dễ đọc.`
  ).join('\n\n')
  const chunks = splitAutomatedReplyIntoChunks(body)
  assert.ok(chunks.length >= 2)
  assert.ok(chunks.length <= 3)
  assert.equal(chunks.join('\n\n'), body)
})
