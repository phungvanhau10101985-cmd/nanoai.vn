import assert from 'node:assert/strict'
import test from 'node:test'
import { readWeddingPreviewLook, weddingPreviewLookToken } from './wedding-preview-look'

const base = {
  sectionConfig: JSON.stringify({ backgroundPresetId: 'sen-vang', loveQuote: 'cũ' }),
  selectedStyleId: 'luxury',
  plateUrls: ['/wedding/backgrounds/sen-vang/01.webp'],
  ornamentKey: 'preset:sen-vang',
  sharedFrame: null,
}

test('look token follows the background and ignores other copy', () => {
  const first = weddingPreviewLookToken(base)
  const renamed = weddingPreviewLookToken({
    ...base,
    sectionConfig: JSON.stringify({ backgroundPresetId: 'sen-vang', loveQuote: 'mới' }),
  })
  const nextBackground = weddingPreviewLookToken({
    ...base,
    sectionConfig: JSON.stringify({ backgroundPresetId: 'do-son' }),
    plateUrls: ['/wedding/backgrounds/do-son/01.webp'],
    ornamentKey: 'preset:do-son',
  })
  assert.equal(first, renamed)
  assert.notEqual(first, nextBackground)
})

test('preview look message keeps a safe plate and drops a bad url', () => {
  const accepted = readWeddingPreviewLook({
    type: 'wedding-preview-look',
    ...base,
    ornaments: [{ src: '/wedding/backgrounds/ornaments/lotus-bloom.png', x: 8, y: 8, w: 28 }],
  })
  assert.ok(accepted)
  assert.equal(accepted?.plateUrls[0], '/wedding/backgrounds/sen-vang/01.webp')
  assert.equal(accepted?.ornaments.length, 1)
  const droppedPlate = readWeddingPreviewLook({
    type: 'wedding-preview-look',
    ...base,
    plateUrls: ['javascript:alert(1)', '/wedding/backgrounds/sen-vang.jpg'],
    ornamentKey: 'preset:khong-co',
    sharedFrame: { mode: 'preset', presetId: 'khong-co' },
  })
  assert.equal(droppedPlate?.plateUrls.length, 1)
  assert.equal(droppedPlate?.ornamentKey, '')
  assert.equal(droppedPlate?.sharedFrame, null)
  assert.equal(droppedPlate?.sectionConfig, base.sectionConfig)
})

test('a style id outside the preset alphabet does not drop the background', () => {
  const look = readWeddingPreviewLook({
    type: 'wedding-preview-look',
    ...base,
    selectedStyleId: 'Sang trọng',
  })
  assert.ok(look)
  assert.equal(look?.selectedStyleId, '')
  assert.equal(look?.plateUrls[0], base.plateUrls[0])
  assert.equal(look?.sectionConfig, base.sectionConfig)
})
