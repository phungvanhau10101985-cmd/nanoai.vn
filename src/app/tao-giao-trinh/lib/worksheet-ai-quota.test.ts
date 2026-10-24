import assert from 'node:assert/strict'
import test from 'node:test'
import { quoteSgkExtract, quoteWorksheetQuestionBatch } from './worksheet-ai-quota'

test('5 câu đầu của giáo trình miễn phí, câu thứ 6 tính 0,5 credit', () => {
  const within = quoteWorksheetQuestionBatch({ requested: 5, curriculumCreated: 0, hasCurriculum: true })
  assert.deepEqual(within, { free: 5, paid: 0, credits: 0 })
  const sixth = quoteWorksheetQuestionBatch({ requested: 1, curriculumCreated: 5, hasCurriculum: true })
  assert.deepEqual(sixth, { free: 0, paid: 1, credits: 0.5 })
})

test('một lượt cắt ngang suất miễn phí của giáo trình', () => {
  const quote = quoteWorksheetQuestionBatch({ requested: 3, curriculumCreated: 4, hasCurriculum: true })
  assert.deepEqual(quote, { free: 1, paid: 2, credits: 1 })
})

test('chưa gắn giáo trình thì không có suất miễn phí', () => {
  const quote = quoteWorksheetQuestionBatch({ requested: 2, curriculumCreated: 0, hasCurriculum: false })
  assert.deepEqual(quote, { free: 0, paid: 2, credits: 1 })
})

test('tách SGK một lần miễn phí trên giáo trình, lần sau tính 1 credit', () => {
  assert.deepEqual(quoteSgkExtract({ curriculumExtracts: 0, hasCurriculum: true }), { waived: true, credits: 0 })
  assert.deepEqual(quoteSgkExtract({ curriculumExtracts: 1, hasCurriculum: true }), { waived: false, credits: 1 })
})

test('tách SGK khi chưa có giáo trình thì tính 1 credit', () => {
  assert.deepEqual(quoteSgkExtract({ curriculumExtracts: 0, hasCurriculum: false }), { waived: false, credits: 1 })
})
