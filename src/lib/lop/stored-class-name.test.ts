import assert from 'node:assert/strict'
import test from 'node:test'
import { storedClassName, upperClassNameLetters } from './stored-class-name'

test('tên lớp lưu DB viết hoa mọi chữ cái', () => {
  assert.equal(storedClassName('12a6'), '12A6')
  assert.equal(storedClassName('  12a6 chuyên  '), '12A6 CHUYÊN')
  assert.equal(storedClassName('lớp đ'), 'LỚP Đ')
  assert.equal(storedClassName('12'), '12')
})

test('ô gõ hoa chữ cái nhưng giữ khoảng trắng đang gõ', () => {
  assert.equal(upperClassNameLetters('12a6 '), '12A6 ')
  assert.equal(upperClassNameLetters('chuyên'), 'CHUYÊN')
})
