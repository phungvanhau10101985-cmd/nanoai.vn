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

test('next bubble waits 80% of a 160-word-per-minute reading pace', () => {
  const oneHundredWords = Array.from({ length: 100 }, (_, index) => `word${index}`).join(' ')
  assert.equal(automatedReplyNextChunkDelayMs(oneHundredWords), 30_000)
  assert.equal(automatedReplyNextChunkDelayMs('một hai ba bốn năm sáu bảy tám chín mười'), 3_000)
  assert.equal(automatedReplyNextChunkDelayMs('   '), 0)
})

test('B2618-length message waits about ten seconds before the next bubble', () => {
  const message =
    'Dạ mẫu B2618 này là giày tây buộc dây nam da bò, đế cao khoảng 3cm, đế cao su tổng hợp chống trơn trượt — dáng lịch lãm, dễ phối với đồ công sở.'
  assert.equal(automatedReplyNextChunkDelayMs(message), 10_200)
})

test('reply is split by semantic sections even when total text is under 400 characters', () => {
  const overview =
    'Dạ anh, mẫu Cr3667 này là quần jean nam ống đứng cạp vừa, dáng rộng thoáng, chất liệu denim cotton co giãn nhẹ nên mặc dễ chịu, vận động không gò bó.'
  const variants =
    'Quần có 3 màu: xanh lam đậm, đen, xanh lam nhạt; vải xử lý không cần ủi, giữ phom gọn gàng, phù hợp đi làm, đi chơi hay dạo phố.'
  const fitQuestion =
    'Anh cho em xin chiều cao và cân nặng (kg) để em chốt size chuẩn nhất nhé.'
  assert.deepEqual(splitAutomatedReplyIntoChunks(`${overview} ${variants}\n\n${fitQuestion}`), [
    overview,
    variants,
    fitQuestion,
  ])
})

test('one long semantic section is not cut by character length', () => {
  const body = Array.from(
    { length: 20 },
    (_, i) => `Câu ${i + 1} vẫn thuộc cùng một phần nội dung sản phẩm.`
  ).join(' ')
  assert.deepEqual(splitAutomatedReplyIntoChunks(body), [body])
})

test('more than three semantic sections keep their order without losing content', () => {
  const body = ['Phần một.', 'Phần hai.', 'Phần ba.', 'Phần bốn.'].join('\n\n')
  const chunks = splitAutomatedReplyIntoChunks(body)
  assert.equal(chunks.length, 3)
  assert.equal(chunks.join('\n\n'), body)
})
