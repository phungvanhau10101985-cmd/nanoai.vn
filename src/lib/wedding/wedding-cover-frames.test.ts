import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { WEDDING_COVER_PRESETS, findWeddingCoverPreset, getWeddingCoverPreset } from './wedding-cover-presets'
import { weddingShareLook } from './wedding-share-preview'

test('frame covers keep a transparent hole and the two original shells', async () => {
  assert.equal(getWeddingCoverPreset('dragon_phoenix').layout, 'glass')
  assert.equal(getWeddingCoverPreset('red_photo_arch').layout, 'red_arch')
  assert.equal(findWeddingCoverPreset('missing'), undefined)
  assert.equal(weddingShareLook('luxury', 'dragon_phoenix').styleId, 'luxury')
  assert.equal(weddingShareLook('luxury', 'red_photo_arch').styleId, 'traditional_vietnamese')
  assert.equal(weddingShareLook('floral', 'not-a-preset').styleId, 'floral')

  const frames = WEDDING_COVER_PRESETS.filter((preset) => preset.layout === 'frame')
  assert.ok(frames.length >= 1)
  assert.equal(frames.some((preset) => preset.id === 'pearl_rose'), true)
  assert.equal(frames.some((preset) => preset.id === 'classic_red'), false)
  for (const preset of frames) {
    const frame = preset.frame
    assert.ok(frame, preset.id)
    const hole = frame.hole
    assert.ok(hole.w > 20 && hole.h > 20, preset.id)
    assert.ok(hole.x >= 0 && hole.y >= 0 && hole.x + hole.w <= 100.2 && hole.y + hole.h <= 100.2, preset.id)
    const name = frame.src.split('/').pop()
    const onCdn = /^https:\/\/cdn\.nanoai\.vn\/wedding\/covers\//.test(frame.src)
    const onSite = frame.src.startsWith('/wedding/covers/')
    assert.ok(onCdn || onSite, frame.src)
    const file = path.join(process.cwd(), 'public', 'wedding', 'covers', name ?? '')
    assert.equal(existsSync(file), true, frame.src)
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (onCdn) {
      assert.equal(info.width, 900)
      assert.equal(info.height, 1200)
    }
    const px = Math.min(info.width - 1, Math.round(((hole.x + hole.w / 2) / 100) * (info.width - 1)))
    const py = Math.min(info.height - 1, Math.round(((hole.y + hole.h / 2) / 100) * (info.height - 1)))
    const alpha = data[(py * info.width + px) * 4 + 3]
    assert.equal(alpha, 0, `${preset.id} center alpha ${alpha}`)
  }
})
