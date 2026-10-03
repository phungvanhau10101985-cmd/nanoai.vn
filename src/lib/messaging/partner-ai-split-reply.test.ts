import assert from 'node:assert/strict'
import test from 'node:test'
import { splitAutomatedReplyIntoChunks } from './partner-ai-split-reply'

test('short sales answer stays in one bubble', () => {
  assert.deepEqual(splitAutomatedReplyIntoChunks('Chất liệu polyester pha spandex, giữ form tốt ạ.'), [
    'Chất liệu polyester pha spandex, giữ form tốt ạ.',
  ])
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
