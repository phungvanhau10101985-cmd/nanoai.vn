import assert from 'node:assert/strict'
import test from 'node:test'
import { isWeddingButtonColorId } from './wedding-button-colors'
import { WEDDING_BACKGROUND_PRESETS, findWeddingBackgroundPreset, findWeddingFrameForBackground, resolveWeddingChromeKit, weddingAiBackgroundKit, weddingAiKitSectionPatch, weddingKitFramePatch, weddingPairedFrameSectionPatch, weddingUsesPairedAiFrame } from './wedding-background-presets'
import { findWeddingCoverPreset } from './wedding-cover-presets'
import { weddingStyleIdFromPrompt } from './build-wedding-image-prompt'
import { getWeddingTheme } from './wedding-theme'
import { applyWeddingFrameChoice, mergeWeddingSectionConfig, parseWeddingSectionConfig, resolveDeviceStackPlace, resolveDeviceStackRotate, resolvePortraitShell, resolveShownCoverFrame, resolveShownPortraitShell, withDeviceShell, withoutPrivateShell } from './wedding-section-config'
import { weddingBackgroundPlateUrls } from './wedding-background-plates'

test('the selected background is the only plate, other faces stay out', () => {
  const urls = weddingBackgroundPlateUrls('https://cdn.example/master.jpg', [
    { type: 'thanks', imageUrl: 'https://cdn.example/thanks.jpg', createdAt: '2026-02-01T00:00:00.000Z' },
    { type: 'master', imageUrl: 'https://cdn.example/old-master.jpg', createdAt: '2026-01-01T00:00:00.000Z' },
    { type: 'cover', imageUrl: 'https://cdn.example/cover.jpg', createdAt: '2026-03-01T00:00:00.000Z' },
    { type: 'album', imageUrl: 'https://cdn.example/album.jpg', createdAt: '2026-05-01T00:00:00.000Z' },
    { type: 'event', imageUrl: 'https://cdn.example/event-new.jpg', createdAt: '2026-04-02T00:00:00.000Z' },
    { type: 'event', imageUrl: 'https://cdn.example/event-old.jpg', createdAt: '2026-04-01T00:00:00.000Z' },
  ])
  assert.deepEqual(urls, ['https://cdn.example/master.jpg'])
})

test('without a selected image, only the newest master is used', () => {
  assert.deepEqual(
    weddingBackgroundPlateUrls('', [
      { type: 'album', imageUrl: 'https://cdn.example/album.jpg', createdAt: '2026-06-01T00:00:00.000Z' },
      { type: 'master', imageUrl: 'https://cdn.example/older.jpg', createdAt: '2026-01-01T00:00:00.000Z' },
      { type: 'master', imageUrl: 'https://cdn.example/newer.jpg', createdAt: '2026-03-01T00:00:00.000Z' },
    ]),
    ['https://cdn.example/newer.jpg'],
  )
})

test('a card with only the master plate still returns that plate', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/master.jpg', []), [
    'https://cdn.example/master.jpg',
  ])
})

test('a ready set replaces the single master plate', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/master.jpg', [], 'long-phung-do'), [
    '/wedding/backgrounds/long-phung-do-1.jpg',
    '/wedding/backgrounds/long-phung-do-2.jpg',
  ])
})

test('the pink garden preset keeps one wash underneath and flowers above the text', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/master.jpg', [], 'vuon-kinh-hong'), [
    '/wedding/backgrounds/vuon-kinh-hong-wash.jpg',
  ])
  const preset = findWeddingBackgroundPreset('vuon-kinh-hong')
  assert.ok(preset)
  assert.ok(preset.ornaments.length >= 3)
  assert.ok(preset.ornaments.every((item) => item.src.endsWith('.png')))
  assert.equal(preset.coverPresetId, 'pearl_rose')
  assert.equal(findWeddingBackgroundPreset('long-phung-do')?.coverPresetId, 'pearl_rose')
  assert.equal(findWeddingBackgroundPreset('sen-vang')?.coverPresetId, 'pearl_rose')
})

test('desktop and mobile shells save apart and fall back to the shared place', () => {
  const shared = {
    stackGroomFrameX: 10, stackGroomFrameY: 12, stackBrideFrameX: 40, stackBrideFrameY: 48,
    stackGroomNameX: 8, stackGroomNameY: 70, stackBrideNameX: 55, stackBrideNameY: 74,
  }
  const base = mergeWeddingSectionConfig('{}', shared)
  const mobile = mergeWeddingSectionConfig(base, withDeviceShell(parseWeddingSectionConfig(base), 'mobile', {
    ...shared,
    stackGroomFrameX: 4,
    groomRotate: -12,
  }))
  const parsed = parseWeddingSectionConfig(mobile)
  assert.equal(resolveDeviceStackPlace(parsed, 'desktop')?.stackGroomFrameX, 10)
  assert.equal(resolveDeviceStackPlace(parsed, 'mobile')?.stackGroomFrameX, 4)
  assert.equal(parsed.deviceShell?.mobile?.groomRotate, -12)
  assert.equal(parsed.stackGroomFrameX, 10)
})

test('a card without its own shell uses the admin template, and a card that already placed frames keeps them', () => {
  const template = {
    stackGroomFrameX: 22, stackGroomFrameY: 12, stackBrideFrameX: 40, stackBrideFrameY: 48,
    stackGroomNameX: 8, stackGroomNameY: 70, stackBrideNameX: 55, stackBrideNameY: 74,
    groomRotate: -12,
  }
  const blank = parseWeddingSectionConfig('{}')
  assert.equal(resolveDeviceStackPlace(blank, 'desktop', template)?.stackGroomFrameX, 22)
  assert.equal(resolveDeviceStackRotate(blank, 'desktop', 'groom', template), -12)
  const owned = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', {
    stackGroomFrameX: 10, stackGroomFrameY: 12, stackBrideFrameX: 40, stackBrideFrameY: 48,
    stackGroomNameX: 8, stackGroomNameY: 70, stackBrideNameX: 55, stackBrideNameY: 74,
  }))
  assert.equal(resolveDeviceStackPlace(owned, 'desktop', template)?.stackGroomFrameX, 10)
  assert.equal(resolveDeviceStackPlace(withoutPrivateShell(owned), 'desktop', template)?.stackGroomFrameX, 22)
})

test('the pearl blush set stacks two pattern plates around a color wash', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'hong-ngoc-trai'), [
    '/wedding/backgrounds/hong-ngoc-trai-1.jpg',
    '/wedding/backgrounds/hong-ngoc-trai-wash.jpg',
    '/wedding/backgrounds/hong-ngoc-trai-2.jpg',
  ])
  const preset = findWeddingBackgroundPreset('hong-ngoc-trai')
  assert.equal(preset?.coverPresetId, 'pearl_rose')
  assert.equal(preset?.look.buttonColorId, 'rose')
  assert.ok(preset?.ornaments.every((item) => item.src.includes('/pearl-')))
})

test('the sky rose set uses the garden photo and the pearl frame', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'vuon-hong-troi'), [
    '/wedding/backgrounds/vuon-hong-troi.jpg',
  ])
  const preset = findWeddingBackgroundPreset('vuon-hong-troi')
  assert.equal(preset?.coverPresetId, 'pearl_rose')
  assert.equal(preset?.look.styleId, 'floral')
  const frame = findWeddingCoverPreset('pearl_rose')
  assert.equal(frame?.layout, 'frame')
  assert.match(frame?.frame?.src ?? '', /pearl-rose-frame/)
})

test('a one-image preset is still one plate', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'do-son'), ['/wedding/backgrounds/do-son.jpg'])
})

test('an unknown preset falls back to the master plate', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/master.jpg', [], 'missing'), [
    'https://cdn.example/master.jpg',
  ])
})

test('the preset id survives a section config save and clears when emptied', () => {
  const saved = mergeWeddingSectionConfig('{"coverPresetId":"classic_red"}', { backgroundPresetId: 'sen-vang' })
  assert.equal(parseWeddingSectionConfig(saved).backgroundPresetId, 'sen-vang')
  assert.equal(parseWeddingSectionConfig(saved).coverPresetId, 'classic_red')
  const cleared = mergeWeddingSectionConfig(saved, { backgroundPresetId: '' })
  assert.equal(parseWeddingSectionConfig(cleared).backgroundPresetId, undefined)
  assert.equal(parseWeddingSectionConfig('{"backgroundPresetId":"nope"}').backgroundPresetId, undefined)
})

test('every ready background is one synchronized kit', () => {
  assert.ok(WEDDING_BACKGROUND_PRESETS.length >= 4)
  for (const preset of WEDDING_BACKGROUND_PRESETS) {
    assert.ok(preset.plates.length >= 1, preset.id)
    assert.ok(preset.ornaments.length >= 1, preset.id)
    assert.ok(preset.ornaments.every((item) => item.src.endsWith('.png')), preset.id)
    assert.ok(preset.coverPresetId, preset.id)
    assert.equal(getWeddingTheme(preset.look.styleId).id, preset.look.styleId, preset.id)
    assert.equal(isWeddingButtonColorId(preset.look.buttonColorId), true, preset.id)
    assert.equal(isWeddingButtonColorId(preset.look.coverRsvpColorId), true, preset.id)
    assert.match(preset.look.ink, /^#[0-9a-f]{6}$/i, preset.id)
    assert.match(preset.look.textPlate, /^rgba\(/, preset.id)
    assert.match(preset.look.fontClass, /^wedding-font-/, preset.id)
    assert.equal(preset.look.textClass, `text-[${preset.look.ink}]`, preset.id)
    assert.match(preset.look.shareFont, /Georgia/, preset.id)
  }
  const lotus = findWeddingBackgroundPreset('sen-vang')
  assert.ok(lotus)
  const framed = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', weddingKitFramePatch(lotus)))
  assert.equal(framed.groomPortraitShellPresetId, 'pearl_rose')
  assert.equal(framed.bridePortraitShellPresetId, 'pearl_rose')
  assert.equal(resolvePortraitShell(framed, 'groom')?.src, resolvePortraitShell(framed, 'bride')?.src)
  assert.ok(resolvePortraitShell(framed, 'groom')?.src)
})

test('an AI background keeps its own plate and takes the matching kit', () => {
  const floral = weddingAiBackgroundKit('floral')
  assert.deepEqual(floral.plates, [])
  assert.equal(floral.coverPresetId, 'pearl_rose')
  assert.ok(floral.ornaments.length >= 1)
  assert.equal(weddingStyleIdFromPrompt('Global style preset (keep consistent tone): traditional_vietnamese.'), 'traditional_vietnamese')
  assert.equal(weddingStyleIdFromPrompt('no style here'), null)
  const saved = mergeWeddingSectionConfig('{"backgroundPresetId":"do-son","coverPresetId":"gold_luxury"}', weddingAiKitSectionPatch('traditional_vietnamese'))
  const parsed = parseWeddingSectionConfig(saved)
  assert.equal(parsed.backgroundPresetId, undefined)
  assert.equal(parsed.backgroundKitStyleId, 'traditional_vietnamese')
  assert.equal(parsed.coverPresetId, 'pearl_rose')
  assert.equal(parsed.groomPortraitShellPresetId, 'pearl_rose')
  assert.equal(parsed.bridePortraitShellPresetId, 'pearl_rose')
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/ai.jpg', [], parsed.backgroundPresetId), ['https://cdn.example/ai.jpg'])
  const chrome = resolveWeddingChromeKit(parsed)
  assert.ok(chrome)
  assert.equal(chrome.plates.length, 0)
  assert.equal(chrome.coverPresetId, 'pearl_rose')
  assert.equal(parseWeddingSectionConfig('{"backgroundKitStyleId":"nope"}').backgroundKitStyleId, undefined)
  const ready = parseWeddingSectionConfig(mergeWeddingSectionConfig(saved, { backgroundPresetId: 'sen-vang', backgroundKitStyleId: '' }))
  assert.equal(ready.backgroundPresetId, 'sen-vang')
  assert.equal(ready.backgroundKitStyleId, undefined)
})

test('an AI background uses the frame made for that plate', () => {
  const plate = 'https://cdn.example/plate.png'
  const frame = {
    imageUrl: 'https://cdn.example/frame.png',
    hole: { x: 20, y: 30, w: 60, h: 40 },
    panel: '#fffaf2',
    ink: 'dark' as const,
    referenceImageUrl: plate,
  }
  assert.equal(findWeddingFrameForBackground(plate, [], [frame])?.imageUrl, frame.imageUrl)
  assert.equal(
    findWeddingFrameForBackground(plate, [{ imageUrl: plate, referenceImageUrl: frame.imageUrl }], [{ ...frame, referenceImageUrl: '' }])?.imageUrl,
    frame.imageUrl,
  )
  const saved = mergeWeddingSectionConfig(
    mergeWeddingSectionConfig('{}', weddingAiKitSectionPatch('traditional_vietnamese')),
    weddingPairedFrameSectionPatch(frame),
  )
  const parsed = parseWeddingSectionConfig(saved)
  assert.equal(parsed.coverFrameMode, 'library')
  assert.equal(parsed.coverAiFrameUrl, frame.imageUrl)
  assert.equal(parsed.backgroundKitStyleId, 'traditional_vietnamese')
  assert.equal(weddingUsesPairedAiFrame(parsed), true)
  assert.equal(resolvePortraitShell(parsed, 'groom')?.src, frame.imageUrl)
  assert.equal(resolvePortraitShell(parsed, 'bride')?.src, frame.imageUrl)
})

test('a portrait frame follows the background until that position chooses its own', () => {
  const kit = findWeddingBackgroundPreset('hong-ngoc-trai')
  assert.ok(kit)
  const blank = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', { backgroundPresetId: 'hong-ngoc-trai' }))
  const followed = resolveShownPortraitShell(blank, 'groom', kit.coverPresetId)
  assert.equal(followed?.src, '/wedding/covers/pearl-rose-frame.webp')
  assert.equal(resolveShownCoverFrame(blank, kit.coverPresetId).presetId, 'pearl_rose')
  const picked = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', {
    backgroundPresetId: 'hong-ngoc-trai',
    groomPortraitFrameChosen: true,
    groomPortraitShellMode: 'library',
    groomPortraitShellUrl: 'https://cdn.example/own-frame.png',
    groomPortraitShellHole: { x: 20, y: 20, w: 60, h: 50 },
    groomPortraitShellPanel: '#fffaf2',
  }))
  assert.equal(resolveShownPortraitShell(picked, 'groom', kit.coverPresetId)?.src, 'https://cdn.example/own-frame.png')
  assert.equal(resolveShownPortraitShell(picked, 'bride', kit.coverPresetId)?.src, followed?.src)
  const stored = applyWeddingFrameChoice('{"backgroundPresetId":"hong-ngoc-trai","buttonColorId":"rose"}', JSON.stringify(picked))
  const saved = parseWeddingSectionConfig(stored)
  assert.equal(saved.backgroundPresetId, 'hong-ngoc-trai')
  assert.equal(saved.buttonColorId, 'rose')
  assert.equal(saved.groomPortraitShellUrl, 'https://cdn.example/own-frame.png')
  assert.equal(saved.bridePortraitFrameChosen, undefined)
  const shared = { mode: 'library' as const, imageUrl: 'https://cdn.example/shared-frame.png', hole: { x: 20, y: 20, w: 60, h: 50 }, panel: '#fffaf2' }
  assert.equal(resolveShownPortraitShell(blank, 'bride', kit.coverPresetId, shared)?.src, shared.imageUrl)
  assert.equal(resolveShownPortraitShell(picked, 'groom', kit.coverPresetId, shared)?.src, 'https://cdn.example/own-frame.png')
  assert.equal(resolveShownCoverFrame(blank, kit.coverPresetId, { mode: 'none' }).mode, 'none')
})
