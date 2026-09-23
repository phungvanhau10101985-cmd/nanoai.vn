import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyOutfitAnchor,
  inferOutfitGender,
  inferOutfitRole,
  outfitSectionTitle,
  outfitSlotNeedsNameTokens,
  outfitSlotSearchPatterns,
  rowMatchesOutfitSlot,
  slotsForOutfitAnchor,
  targetOutfitCat1Names,
  pickOutfitListingCategory,
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

test('outfit L1 slots skip name tokens; clothing slots keep ILIKE patterns off description', () => {
  assert.equal(outfitSlotNeedsNameTokens('shoes'), false)
  assert.equal(outfitSlotNeedsNameTokens('bag'), false)
  assert.equal(outfitSlotNeedsNameTokens('accessory'), false)
  assert.deepEqual(outfitSlotSearchPatterns('shoes'), [])
  assert.ok(outfitSlotNeedsNameTokens('top'))
  assert.ok(outfitSlotSearchPatterns('top').some((p) => p.includes('áo')))
  assert.equal(
    outfitSlotSearchPatterns('top').some((p) => p.includes('%')),
    true
  )
})

test('classifies title copy', () => {
  const shoes = classifyOutfitAnchor(['Giày dép Nam', 'Giày tây'])
  assert.equal(shoes.role, 'shoes')
  assert.equal(outfitSectionTitle(shoes.role, 'vi'), 'Phối với giày này')
  assert.equal(classifyOutfitAnchor(['Khách sạn', 'Phòng đôi']).reason, 'no_slots')
})

test('thể thao is not an áo group', () => {
  assert.equal(inferOutfitRole('Thể thao dã ngoại'), null)
  assert.equal(inferOutfitRole('Áo thể thao'), 'top')
  assert.equal(inferOutfitRole('Giày thể thao'), 'shoes')
  assert.equal(inferOutfitRole('ao thun nam'), 'top')
})

test('see-all listing follows the active outfit group', () => {
  const cats = [
    { id: 'sport', parentId: null, name: 'Thể thao dã ngoại', path: 'the-thao-da-ngoai', depth: 1 },
    { id: 'sport-ao', parentId: 'sport', name: 'Áo khoác thể thao', path: 'the-thao-da-ngoai/ao-khoac', depth: 2 },
    { id: 'nu', parentId: null, name: 'Thời trang Nữ', path: 'thoi-trang-nu', depth: 1 },
    { id: 'ao', parentId: 'nu', name: 'Áo', path: 'thoi-trang-nu/ao', depth: 2 },
    { id: 'vay', parentId: 'nu', name: 'Váy', path: 'thoi-trang-nu/vay', depth: 2 },
    { id: 'quan', parentId: 'nu', name: 'Quần', path: 'thoi-trang-nu/quan', depth: 2 },
    { id: 'nam', parentId: null, name: 'Thời trang Nam', path: 'thoi-trang-nam', depth: 1 },
    { id: 'ao-nam', parentId: 'nam', name: 'Áo nam', path: 'thoi-trang-nam/ao-nam', depth: 2 },
    { id: 'tui', parentId: null, name: 'Túi xách Nữ', path: 'tui-xach-nu', depth: 1 },
    { id: 'pk', parentId: null, name: 'Phụ kiện Nữ', path: 'phu-kien-nu', depth: 1 },
  ]
  assert.equal(pickOutfitListingCategory(cats, 'top', 'female')?.path, 'thoi-trang-nu/ao')
  assert.equal(pickOutfitListingCategory(cats, 'dress', 'female')?.path, 'thoi-trang-nu/vay')
  assert.equal(pickOutfitListingCategory(cats, 'bottom', 'female')?.path, 'thoi-trang-nu/quan')
  assert.equal(pickOutfitListingCategory(cats, 'bag', 'female')?.path, 'tui-xach-nu')
  assert.equal(pickOutfitListingCategory(cats, 'accessory', 'female')?.path, 'phu-kien-nu')
  assert.equal(pickOutfitListingCategory(cats, 'top', 'male')?.path, 'thoi-trang-nam/ao-nam')
})
