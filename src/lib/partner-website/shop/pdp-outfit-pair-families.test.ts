import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inferOutfitPairFamily,
  listingQueriesForOutfitFamily,
  outfitPairFamilyCompatible,
} from '@/lib/partner-website/shop/pdp-outfit-pair-families'
import { scoreOutfitCandidate188 } from '@/lib/partner-website/shop/pdp-outfit-score'
import {
  filterStoredOutfitPayload,
  persistedOutfitIsFresh,
  OUTFIT_PICKS_ALGO_VERSION,
} from '@/lib/db/messaging-partner-outfit-picks-pg'

test('áo khoác gộp vest trên cat2 không thành formal_top', () => {
  assert.notEqual(
    inferOutfitPairFamily('Thời trang Nam', 'Áo khoác & vest Nam', 'áo khoác bomber nam thể thao, năng động', 'Áo khoác golf nam PGM'),
    'formal_top'
  )
})

test('infers giày tây and vest families', () => {
  assert.equal(inferOutfitPairFamily('Giày dép Nam', 'Giày tây nam', 'Giày oxford'), 'formal_shoe')
  assert.equal(inferOutfitPairFamily('Thời trang Nam', 'Áo vest nam', 'Áo vest'), 'formal_top')
  assert.equal(inferOutfitPairFamily('Thời trang Nam', 'Áo sơ mi nam', 'Áo sơ mi dài tay'), 'formal_top')
  assert.equal(inferOutfitPairFamily('Giày dép Nam', 'Sneaker nam', 'Giày chạy'), 'sport_shoe')
  assert.equal(inferOutfitPairFamily('Thời trang Nam', 'Áo hoodie nam', 'Hoodie'), 'casual_top')
})

test('sport shoe dress allows skirt; formal shoe rejects hoodie', () => {
  assert.equal(outfitPairFamilyCompatible('sport_shoe', 'skirt', 'dress'), true)
  assert.equal(outfitPairFamilyCompatible('casual_shoe', 'dress_casual', 'dress'), true)
  assert.equal(outfitPairFamilyCompatible('formal_shoe', 'formal_top', 'top'), true)
  assert.equal(outfitPairFamilyCompatible('formal_shoe', 'casual_top', 'top'), false)
  assert.equal(outfitPairFamilyCompatible('formal_shoe', 'formal_bottom', 'bottom'), true)
  assert.equal(outfitPairFamilyCompatible('formal_shoe', 'sport_bottom', 'bottom'), false)
})

test('unknown family does not block', () => {
  assert.equal(outfitPairFamilyCompatible(null, 'casual_top', 'top'), true)
  assert.equal(outfitPairFamilyCompatible('formal_shoe', null, 'top'), true)
})

test('listing queries include vest for tây', () => {
  const qs = listingQueriesForOutfitFamily('formal_shoe', 'top')
  assert.ok(qs.includes('áo vest'))
  assert.ok(qs.includes('áo sơ mi'))
  assert.ok(qs.includes('blazer'))
})

test('brown oxford allows white shirt and rejects hoodie', () => {
  const shoe = {
    name: 'Giày oxford nam da nâu',
    categoryL1: 'Giày dép Nam',
    categoryL2: 'Giày tây nam',
    categoryL3: 'Giày oxford',
    style: 'công sở',
    occasion: 'đi làm',
    colorSummary: 'nâu',
    material: 'da',
    priceAmount: 800000,
    purchasesCount: 10,
  }
  const shirt = {
    name: 'Áo sơ mi nam trắng',
    categoryL1: 'Thời trang Nam',
    categoryL2: 'Áo sơ mi nam',
    categoryL3: 'Áo sơ mi dài tay',
    style: 'công sở',
    occasion: 'đi làm',
    colorSummary: 'trắng',
    material: 'vải',
    priceAmount: 350000,
    purchasesCount: 4,
  }
  const hoodie = {
    name: 'Áo hoodie nam thể thao',
    categoryL1: 'Thời trang Nam',
    categoryL2: 'Áo hoodie nam',
    categoryL3: 'Hoodie',
    style: 'casual',
    occasion: 'dạo phố',
    colorSummary: 'đen',
    material: 'nỉ',
    priceAmount: 280000,
    purchasesCount: 900,
  }
  const ss = scoreOutfitCandidate188(shoe, shirt, 'top')
  const sh = scoreOutfitCandidate188(shoe, hoodie, 'top')
  assert.ok(ss.score >= 3)
  assert.ok(ss.reasons.some((x) => /vest|sơ mi|giày tây/i.test(x)))
  assert.equal(sh.score, 0)
})

test('persisted outfit freshness and filter', () => {
  const now = new Date()
  assert.equal(persistedOutfitIsFresh(OUTFIT_PICKS_ALGO_VERSION, now), true)
  assert.equal(persistedOutfitIsFresh('old', now), false)
  assert.equal(persistedOutfitIsFresh(OUTFIT_PICKS_ALGO_VERSION, new Date(now.getTime() - 8 * 24 * 3600 * 1000)), false)

  const payload = {
    applicable: true,
    reason: null,
    anchor: { id: '1', role: 'shoes' as const, gender: 'male' as const },
    slots: [
      { id: 'top' as const, listingPath: null, items: [{ id: '11', matchScore: 4, reasons: [] }, { id: '12', matchScore: 3, reasons: [] }, { id: '13', matchScore: 2, reasons: [] }] },
      { id: 'dress' as const, listingPath: null, items: [{ id: '21', matchScore: 2, reasons: [] }] },
    ],
  }
  const onlyTop = filterStoredOutfitPayload(payload, { onlySlot: 'top', limit: 2 })
  assert.deepEqual(onlyTop.slots.map((s) => s.id), ['top'])
  assert.deepEqual(onlyTop.slots[0].items.map((i) => i.id), ['11', '12'])
})
