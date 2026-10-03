import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inventoryRowLooksLikeShoes,
  rewriteShoeHeightWeightFitQuestion,
} from './partner-ai-fit-question'

const shoe = { name: 'Giày tây nam B2902', category_l1: 'Giày dép nam' }
const jacket = { name: 'Áo khoác da nam A5104', category_l1: 'Thời trang nam' }
const dress = { name: 'Đầm ôm body B0217', category_l1: 'Thời trang nữ' }

test('shoe consult asking height and weight becomes usual shoe size', () => {
  const cases = [
    'Anh để lại chiều cao và cân nặng (kg) giúp em để em tư vấn size chuẩn cho anh ạ.',
    'Anh cho em xin chiều cao và cân nặng (kg) để em chốt size chuẩn cho anh nhé.',
    'Anh cho em chiều cao và cân nặng (kg) để em tư vấn size chuẩn nhé.',
    'Anh cho em xin chiều cao và cân nặng để em tư vấn size chuẩn nhất nhé.',
  ]
  for (const body of cases) {
    assert.equal(
      rewriteShoeHeightWeightFitQuestion(body, shoe),
      'Anh thường đi size bao nhiêu để em tư vấn tiếp nhé?'
    )
  }
})

test('heel height in the product sentence stays; only the fit question changes', () => {
  const body =
    'Dạ mẫu B2633 này là giày tây buộc dây nam, đế cao khoảng 3cm. Anh cho em xin chiều cao và cân nặng (kg) để em chốt size chuẩn cho anh nhé.'
  assert.equal(
    rewriteShoeHeightWeightFitQuestion(body, shoe),
    'Dạ mẫu B2633 này là giày tây buộc dây nam, đế cao khoảng 3cm. Anh thường đi size bao nhiêu để em tư vấn tiếp nhé?'
  )
})

test('clothing still asks height and weight', () => {
  const body = 'Anh cho em xin chiều cao và cân nặng để em tư vấn size chuẩn nhất nhé.'
  assert.equal(rewriteShoeHeightWeightFitQuestion(body, jacket), body)
  assert.equal(rewriteShoeHeightWeightFitQuestion(body, dress), body)
})

test('a dress that mentions shoes in the name is not treated as shoes when the name is apparel', () => {
  assert.equal(
    inventoryRowLooksLikeShoes({ name: 'Đầm phối giày cao gót', category_l1: 'Thời trang nữ' }),
    false
  )
})

test('sku-only name uses shoe category', () => {
  assert.equal(inventoryRowLooksLikeShoes({ name: 'B2633', category_l1: 'Giày dép nam' }), true)
  assert.equal(
    rewriteShoeHeightWeightFitQuestion('Chị cho em xin chiều cao và cân nặng (kg) để em chốt size nhé.', {
      name: 'B2633',
      category_l1: 'Giày dép nam',
    }),
    'Chị thường đi size bao nhiêu để em tư vấn tiếp nhé?'
  )
})

test('shoe reply that already asks shoe size is unchanged', () => {
  const body = 'Anh thường đi size bao nhiêu để em tư vấn cho chuẩn ạ?'
  assert.equal(rewriteShoeHeightWeightFitQuestion(body, shoe), body)
})
