import assert from 'node:assert/strict'
import test from 'node:test'
import {
  customerMessageHasFemaleDefaultProduct,
  extractCustomerGenderSearchIntent,
  resolveInventorySearchGenderIntent,
} from './partner-inventory-ai-search'

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

test('female-default product keywords skip profile gender', () => {
  assert.equal(customerMessageHasFemaleDefaultProduct('Váy hoa nhí có không bạn'), true)
  assert.equal(customerMessageHasFemaleDefaultProduct('đầm voan công sở'), true)
  assert.equal(customerMessageHasFemaleDefaultProduct('giày cao gót đen'), true)
  assert.equal(customerMessageHasFemaleDefaultProduct('Có áo khoác dày không shop'), false)
  assert.equal(resolveInventorySearchGenderIntent('Áo khoác dày nữ', 'male'), 'female')
  assert.equal(resolveInventorySearchGenderIntent('áo khoác nam dày', 'female'), 'male')
  assert.equal(resolveInventorySearchGenderIntent('Váy hoa nhí có không bạn', 'male'), null)
  assert.equal(resolveInventorySearchGenderIntent('Có áo khoác dày không shop', 'male'), 'male')
})
