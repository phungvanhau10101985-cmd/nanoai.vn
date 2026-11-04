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

test('a saved two-frame layout is dropped so the card keeps the theme frame', () => {
  assert.equal(readHeroPhotoLayout(undefined), 'single')
  assert.equal(readHeroPhotoLayout('stack'), 'single')
  assert.equal(parseWeddingSectionConfig('{}').heroPhotoLayout, undefined)
  const stacked = stringifyWeddingSectionConfig({ heroPhotoLayout: 'stack', coverPresetId: 'classic_red' })
  assert.equal(parseWeddingSectionConfig(stacked).heroPhotoLayout, undefined)
  assert.equal(parseWeddingSectionConfig(stacked).coverPresetId, 'classic_red')
  const back = mergeWeddingSectionConfig('{"heroPhotoLayout":"stack","coverPresetId":"classic_red"}', { heroPhotoLayout: 'single' })
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
  assert.equal(parsed.heroPhotoLayout, undefined)
  assert.equal(resolveStackFrameRotate(parsed, 'groom'), -12)
  assert.equal(resolveStackFrameRotate(parsed, 'bride'), 3)
  const restored = stringifyWeddingSectionConfig({ stackGroomFrameRotate: -6 })
  assert.equal(parseWeddingSectionConfig(restored).stackGroomFrameRotate, undefined)
})

test('cover and letter stay on the theme frame even when an old card stored two stacked frames', () => {
  assert.equal(resolveShownHeroLayout({}, 'stack'), 'single')
  assert.equal(resolveShownHeroLayout({ heroPhotoLayout: 'single' }, 'stack'), 'single')
  assert.equal(resolveShownHeroLayout({ heroPhotoLayout: 'stack' }, 'single'), 'single')
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
