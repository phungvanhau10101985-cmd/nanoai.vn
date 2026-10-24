import assert from 'node:assert/strict'
import test from 'node:test'
import { diffTextSpans } from './text-span-diff'

function changed(spans: { text: string; changed: boolean }[]): string {
  return spans.filter((span) => span.changed).map((span) => span.text).join('|')
}

test('chỗ giống nhau không đánh dấu', () => {
  const text = 'Vậy tọa độ điểm D là (2; 5; 2).'
  const diff = diffTextSpans(text, text)
  assert.equal(changed(diff.original), '')
  assert.equal(changed(diff.edited), '')
  assert.equal(diff.original.map((span) => span.text).join(''), text)
  assert.equal(diff.edited.map((span) => span.text).join(''), text)
})

test('Vectơ AB khác →AB thì chỉ tô phần lệch', () => {
  const diff = diffTextSpans('Vectơ AB = vectơ DC', '→AB = →DC')
  assert.match(changed(diff.original), /Vectơ/)
  assert.match(changed(diff.original), /vectơ/)
  assert.equal(diff.original.filter((span) => !span.changed).map((span) => span.text).join(''), 'AB = DC')
  assert.equal(changed(diff.edited), '→|→')
  assert.equal(diff.original.map((span) => span.text).join(''), 'Vectơ AB = vectơ DC')
  assert.equal(diff.edited.map((span) => span.text).join(''), '→AB = →DC')
})

test('bên sửa thêm mũi tên thì chỉ tô bên sửa', () => {
  const diff = diffTextSpans('hai vectơ AB và AC', 'hai vectơ →AB và →AC')
  assert.equal(changed(diff.original), '')
  assert.equal(changed(diff.edited), '→|→')
})

test('bên gốc có chữ mà bên sửa bỏ thì chỉ tô bên gốc', () => {
  const diff = diffTextSpans('Vectơ AB', 'AB')
  assert.equal(changed(diff.original), 'Vectơ ')
  assert.equal(changed(diff.edited), '')
})
