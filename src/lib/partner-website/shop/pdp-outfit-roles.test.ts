import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyOutfitAnchor,
  inferOutfitGender,
  inferOutfitRole,
  outfitSectionTitle,
  rowMatchesOutfitSlot,
  slotsForOutfitAnchor,
  targetOutfitCat1Names,
} from '@/lib/partner-website/shop/pdp-outfit-roles'

test('infers fashion roles from category and name', () => {
  assert.equal(inferOutfitRole('Thời trang Nam', 'Áo', 'Áo thun nam'), 'top')
  assert.equal(inferOutfitRole('Quần jean nam'), 'bottom')
  assert.equal(inferOutfitRole('Váy liền thân'), 'dress')
  assert.equal(inferOutfitRole('Chân váy chữ A'), 'bottom')
  assert.equal(inferOutfitRole('Giày dép Nữ', 'Sneaker'), 'shoes')
  assert.equal(inferOutfitRole('Túi xách', 'Túi đeo chéo'), 'bag')
  assert.equal(inferOutfitRole('Phụ kiện Nam', 'Thắt lưng'), 'accessory')
  assert.equal(inferOutfitRole('Phòng Deluxe King'), null)
})

test('infers gender from category labels', () => {
  assert.equal(inferOutfitGender('Thời trang Nam', 'Áo'), 'male')
  assert.equal(inferOutfitGender('Thời trang Nữ'), 'female')
  assert.equal(inferOutfitGender('Unisex tote'), 'unisex')
})

test('complementary slots exclude the anchor role', () => {
  assert.deepEqual(slotsForOutfitAnchor('shoes', 'male').slice(0, 2), ['top', 'bottom'])
  assert.ok(!slotsForOutfitAnchor('dress', 'female').includes('dress'))
  assert.ok(slotsForOutfitAnchor('top', 'female').includes('dress'))
})

test('targetOutfitCat1Names matches 188 complementary L1 names', () => {
  assert.deepEqual(targetOutfitCat1Names('shoes', 'female'), ['Giày dép Nữ'])
  assert.deepEqual(targetOutfitCat1Names('bag', 'female'), ['Túi xách Nữ'])
  assert.ok(rowMatchesOutfitSlot('shoes', 'Giày dép Nữ', 'Sneaker nữ'))
  assert.equal(rowMatchesOutfitSlot('dress', 'Thời trang Nữ', 'Áo thun'), false)
})

test('classifies title copy', () => {
  const shoes = classifyOutfitAnchor(['Giày dép Nam', 'Giày tây'])
  assert.equal(shoes.role, 'shoes')
  assert.equal(outfitSectionTitle(shoes.role, 'vi'), 'Phối với giày này')
  assert.equal(classifyOutfitAnchor(['Khách sạn', 'Phòng đôi']).reason, 'no_slots')
})
