import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeDialogueMeaningKey } from './dialogue-meaning-key'

test('nghĩa cùng chữ khác dấu câu là một khóa', () => {
  const a = normalizeDialogueMeaningKey('Tôi rất thích sách ở đây, có sách gì hay?')
  const b = normalizeDialogueMeaningKey('Tôi rất thích sách ở đây có sách gì hay?')
  assert.equal(a, b)
  assert.equal(a.length > 0, true)
})

test('nghĩa khác chữ không cùng khóa', () => {
  const a = normalizeDialogueMeaningKey('Tôi rất thích sách ở đây có sách gì hay?')
  const b = normalizeDialogueMeaningKey('Em thích sách ở đây, có quyển nào hay?')
  assert.notEqual(a, b)
})
