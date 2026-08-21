import assert from 'node:assert/strict'
import test from 'node:test'
import { extractCustomerGenderSearchIntent } from './partner-inventory-ai-search'

test('extractCustomerGenderSearchIntent reads nữ at end of short query', () => {
  assert.equal(extractCustomerGenderSearchIntent('Áo khoác dày nữ'), 'female')
  assert.equal(extractCustomerGenderSearchIntent('Mình hỏi tìm áo khoác nữ dày'), 'female')
  assert.equal(extractCustomerGenderSearchIntent('Áo khoác nữ mà bạn'), 'female')
})

test('extractCustomerGenderSearchIntent reads nam and ignores profile-only phrases', () => {
  assert.equal(extractCustomerGenderSearchIntent('Có áo khoác dày không shop'), null)
  assert.equal(extractCustomerGenderSearchIntent('áo khoác nam dày'), 'male')
  assert.equal(extractCustomerGenderSearchIntent('áo khoác nam nữ'), null)
})
