import assert from 'node:assert/strict'
import test from 'node:test'
import { entryCodesMatch, isStudentLoginCode, studentEntryEmail } from './class-entry'

test('login code is six digits', () => {
  assert.equal(isStudentLoginCode('048213'), true)
  assert.equal(isStudentLoginCode('48213'), false)
  assert.equal(isStudentLoginCode('04821a'), false)
})

test('synthetic mailbox stays on the reserved invalid domain', () => {
  assert.equal(studentEntryEmail('HS0001'), 'hs.hs0001@hocsinh.invalid')
})

test('password compare accepts only the same six digits', () => {
  assert.equal(entryCodesMatch('048213', '048213'), true)
  assert.equal(entryCodesMatch('048213', '048214'), false)
  assert.equal(entryCodesMatch('', '048213'), false)
})
