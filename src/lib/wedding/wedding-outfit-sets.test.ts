import assert from 'node:assert/strict'
import test from 'node:test'
import { WEDDING_BACKGROUND_PRESETS } from './wedding-background-presets'
import { WEDDING_SAMPLE_CARDS } from './wedding-sample-cards'
import {
  WEDDING_OUTFIT_SET_COUNT,
  WEDDING_SHARED_OUTFIT_COUNT,
  parseWeddingOutfitIndex,
  weddingOutfitChoices,
  weddingOutfitFamilyForCard,
  weddingOutfitFamilyId,
  weddingOutfitFamilyIds,
  weddingOutfitImagePaths,
  weddingOutfitPublicPath,
  weddingRestyleBackgroundChoices,
} from './wedding-outfit-sets'

test('each background preset has six outfit photographs', () => {
  const used = new Set<string>()
  for (const preset of WEDDING_BACKGROUND_PRESETS) {
    const family = weddingOutfitFamilyId(preset.id)
    assert.ok(family, preset.id)
    const paths = weddingOutfitImagePaths(family)
    assert.equal(paths.length, WEDDING_OUTFIT_SET_COUNT)
    assert.equal(paths[0], `/wedding/outfits/${family}/1.webp`)
    assert.equal(paths[5], `/wedding/outfits/${family}/6.webp`)
    used.add(family)
  }
  const extras = [
    'kho-hong-buom',
    'kho-sen-hong',
    'kho-hac-sen',
    'kho-hac-do',
    'kho-phung-do',
    'kho-mau-don',
    'kho-do-phap',
    'kho-hong-baby',
    'ai-luxury',
    'ai-minimal',
    'ai-truyen-thong',
    'ai-floral',
    'ai-ethereal',
    'ai-vintage',
    'ai-modern',
  ]
  assert.deepEqual(new Set(weddingOutfitFamilyIds()), new Set([...used, ...extras]))
})

test('library papers and ai styles have their own outfit sets', () => {
  for (const sample of WEDDING_SAMPLE_CARDS) {
    const family = weddingOutfitFamilyForCard({
      backgroundPresetId: sample.backgroundPresetId,
      backgroundKitStyleId: sample.libraryImageUrl ? '' : sample.aiStyleId,
      masterImageUrl: sample.libraryImageUrl || '',
    })
    assert.ok(family, sample.id)
    assert.equal(weddingOutfitImagePaths(family).length, WEDDING_OUTFIT_SET_COUNT)
  }
  assert.equal(weddingOutfitFamilyForCard({ backgroundKitStyleId: 'traditional_vietnamese' }), 'ai-truyen-thong')
  assert.equal(weddingOutfitFamilyForCard({ backgroundPresetId: 'sen-vang', backgroundKitStyleId: 'floral' }), 'sen-vang')
})

test('layout variants of one paper share the outfit set', () => {
  assert.equal(weddingOutfitFamilyId('sen-vang'), 'sen-vang')
  assert.equal(weddingOutfitFamilyId('re-quat-sen'), 'sen-vang')
  assert.equal(weddingOutfitFamilyId('vom-sen'), 'sen-vang')
  assert.equal(weddingOutfitFamilyId('song-hy-do'), 'song-hy-do')
  assert.equal(weddingOutfitFamilyId('re-quat'), 'song-hy-do')
  assert.deepEqual(weddingRestyleBackgroundChoices('long-phung-do'), [
    '/wedding/backgrounds/long-phung-do-1.jpg',
    '/wedding/backgrounds/long-phung-do-2.jpg',
  ])
  assert.deepEqual(weddingRestyleBackgroundChoices('song-hy-do'), [])
})

test('outfit index stays inside the six photographs and four shared sets', () => {
  assert.equal(parseWeddingOutfitIndex('1'), 1)
  assert.equal(parseWeddingOutfitIndex('6'), 6)
  assert.equal(parseWeddingOutfitIndex('10'), 10)
  assert.equal(parseWeddingOutfitIndex('0'), null)
  assert.equal(parseWeddingOutfitIndex('11'), null)
  assert.equal(weddingOutfitPublicPath('sen-vang', 3), '/wedding/outfits/sen-vang/3.webp')
  assert.equal(weddingOutfitPublicPath('sen-vang', 7), '/wedding/outfits/shared/1.webp')
  assert.equal(weddingOutfitPublicPath(null, 10), '/wedding/outfits/shared/4.webp')
  assert.equal(weddingOutfitPublicPath(null, 1), null)
  assert.equal(weddingOutfitPublicPath('../sen-vang', 1), null)
  assert.equal(weddingOutfitPublicPath('missing-theme', 1), null)
})

test('every theme can choose the four shared white gowns', () => {
  const sharedSrc = [1, 2, 3, 4].map((index) => `/wedding/outfits/shared/${index}.webp`)
  for (const preset of WEDDING_BACKGROUND_PRESETS) {
    const choices = weddingOutfitChoices(weddingOutfitFamilyId(preset.id))
    const shared = choices.filter((choice) => choice.shared)
    assert.equal(shared.length, WEDDING_SHARED_OUTFIT_COUNT)
    assert.deepEqual(shared.map((choice) => choice.src), sharedSrc)
    assert.deepEqual(shared.map((choice) => choice.index), [7, 8, 9, 10])
    assert.equal(choices.filter((choice) => !choice.shared).length, WEDDING_OUTFIT_SET_COUNT)
  }
  assert.equal(weddingOutfitChoices(null).length, WEDDING_SHARED_OUTFIT_COUNT)
  assert.equal(weddingOutfitChoices(null).every((choice) => choice.shared), true)
})
