import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMenuDishesFromBulkText } from './menu-dish-bulk-parse'

test('parseMenuDishesFromBulkText — dòng đơn và nối liền', () => {
  const sample = `
1. 🧆 Khai Vị
Tên MónĐơn Vị TínhGiá (VNĐ)
Lạc rang muối / Lạc luộcĐĩa20.000Đậu hũ lướt ván / Chiên giònĐĩa35.000
Phở bò tái · tô · 65000
Mẹt Nướng Tổng Hợp: 350.000 VNĐ / Mẹt(Gồm: Dải heo nướng, Lạc luộc)
`
  const result = parseMenuDishesFromBulkText(sample)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(result.dishes.length >= 4)
  const names = result.dishes.map((d) => d.name)
  assert.ok(names.some((n) => n.includes('Lạc rang')))
  assert.ok(names.some((n) => n.includes('Đậu hũ')))
  assert.ok(names.some((n) => n.includes('Phở bò')))
  assert.ok(names.some((n) => n.includes('Mẹt Nướng')))
  const lac = result.dishes.find((d) => d.name.includes('Lạc rang'))
  assert.equal(lac?.unit, 'Đĩa')
  assert.equal(lac?.priceVnd, '20000')
  const pho = result.dishes.find((d) => d.name.includes('Phở bò'))
  assert.equal(pho?.unit, 'tô')
  const met = result.dishes.find((d) => d.name.includes('Mẹt Nướng'))
  assert.equal(met?.unit, 'Mẹt')
  assert.equal(met?.priceVnd, '350000')
})

test('parseMenuDishesFromBulkText — nhiều món nối liền một dòng', () => {
  const line =
    'Lạc rang muối / Lạc luộcĐĩa20.000Đậu hũ lướt ván / Chiên giònĐĩa35.000Nem chua Thanh Hóa / Nem PhùngChục (10 cái)60.000'
  const result = parseMenuDishesFromBulkText(line)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.dishes.length, 3)
  assert.equal(result.dishes[1]?.name, 'Đậu hũ lướt ván / Chiên giòn')
  assert.equal(result.dishes[2]?.unit, 'Chục (10 cái)')
  assert.equal(result.dishes[2]?.priceVnd, '60000')
})

test('parseMenuDishesFromBulkText — dán liền tiêu đề nhóm + bảng Word', () => {
  const line =
    '1. 🧆 Khai Vị & Món Nhắm NhanhTên MónĐơn Vị TínhGiá (VNĐ)Lạc rang muối / Lạc luộcĐĩa20.000Đậu hũ lướt ván / Chiên giònĐĩa35.000Nem chua Thanh Hóa / Nem PhùngChục (10 cái)60.000'
  const result = parseMenuDishesFromBulkText(line)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.dishes.length, 3)
  assert.equal(result.dishes[0]?.priceVnd, '20000')
  assert.equal(result.dishes[2]?.name, 'Nem chua Thanh Hóa / Nem Phùng')
})

test('parseMenuDishesFromBulkText — rỗng', () => {
  assert.deepEqual(parseMenuDishesFromBulkText(''), { ok: false, error: 'EMPTY' })
  assert.deepEqual(parseMenuDishesFromBulkText('   \n  '), { ok: false, error: 'EMPTY' })
})

test('parseMenuDishesFromBulkText — không có giá hợp lệ', () => {
  assert.deepEqual(parseMenuDishesFromBulkText('Chỉ có tên món không giá'), {
    ok: false,
    error: 'NO_ITEMS',
  })
})
