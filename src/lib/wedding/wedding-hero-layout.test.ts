import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPreviewFrameChoice,
  mergeWeddingSectionConfig,
  parseWeddingSectionConfig,
  readHeroPhotoLayout,
  resolveShownHeroLayout,
  resolveStackFrameRotate,
  stringifyWeddingSectionConfig,
  weddingPreviewFrameSelectionKey,
} from './wedding-section-config'

test('hero layout stays single unless the card explicitly chooses the stacked pair', () => {
  assert.equal(readHeroPhotoLayout(undefined), 'single')
  assert.equal(readHeroPhotoLayout('stack'), 'stack')
  assert.equal(parseWeddingSectionConfig('{}').heroPhotoLayout, undefined)
  const stacked = stringifyWeddingSectionConfig({ heroPhotoLayout: 'stack', coverPresetId: 'classic_red' })
  assert.equal(parseWeddingSectionConfig(stacked).heroPhotoLayout, 'stack')
  assert.equal(parseWeddingSectionConfig(stacked).coverPresetId, 'classic_red')
  const back = mergeWeddingSectionConfig(stacked, { heroPhotoLayout: 'single' })
  assert.equal(parseWeddingSectionConfig(back).heroPhotoLayout, 'single')
  assert.equal(parseWeddingSectionConfig(back).coverPresetId, 'classic_red')
})

test('stacked frame rotate stays at the default until someone turns a frame', () => {
  assert.equal(resolveStackFrameRotate({}, 'groom'), -6)
  assert.equal(resolveStackFrameRotate({}, 'bride'), 3)
  const turned = stringifyWeddingSectionConfig({ stackGroomFrameRotate: -12, stackBrideFrameRotate: 3, heroPhotoLayout: 'stack' })
  const parsed = parseWeddingSectionConfig(turned)
  assert.equal(parsed.stackGroomFrameRotate, -12)
  assert.equal(parsed.stackBrideFrameRotate, undefined)
  assert.equal(parsed.heroPhotoLayout, 'stack')
  assert.equal(resolveStackFrameRotate(parsed, 'groom'), -12)
  assert.equal(resolveStackFrameRotate(parsed, 'bride'), 3)
  const restored = stringifyWeddingSectionConfig({ stackGroomFrameRotate: -6 })
  assert.equal(parseWeddingSectionConfig(restored).stackGroomFrameRotate, undefined)
})

test('shown hero layout keeps the card choice over the background fallback', () => {
  assert.equal(resolveShownHeroLayout({}, 'stack'), 'stack')
  assert.equal(resolveShownHeroLayout({ heroPhotoLayout: 'single' }, 'stack'), 'single')
  assert.equal(resolveShownHeroLayout({ heroPhotoLayout: 'stack' }, 'single'), 'stack')
})

test('preview frame choice writes cover and pair shells, kit clears them', () => {
  const picked = applyPreviewFrameChoice('{}', { kind: 'preset', id: 'classic_red' }, 'cover')
  const cover = parseWeddingSectionConfig(picked)
  assert.equal(cover.coverFrameChosen, true)
  assert.equal(cover.coverFrameMode, 'preset')
  assert.equal(cover.coverPresetId, 'classic_red')
  assert.equal(weddingPreviewFrameSelectionKey(cover, 'cover'), 'classic_red')
  const pairRaw = applyPreviewFrameChoice(picked, { kind: 'none' }, 'pair')
  const pair = parseWeddingSectionConfig(pairRaw)
  assert.equal(pair.groomPortraitFrameChosen, true)
  assert.equal(pair.groomPortraitShellMode, 'none')
  assert.equal(pair.bridePortraitShellMode, 'none')
  const kit = parseWeddingSectionConfig(applyPreviewFrameChoice(pairRaw, { kind: 'kit' }, 'cover'))
  assert.equal(kit.coverFrameChosen, undefined)
  assert.equal(weddingPreviewFrameSelectionKey(kit, 'cover'), 'kit')
})
