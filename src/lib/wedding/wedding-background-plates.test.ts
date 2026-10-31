import assert from 'node:assert/strict'
import test from 'node:test'
import { isWeddingButtonColorId } from './wedding-button-colors'
import { WEDDING_BACKGROUND_PRESETS, applyWeddingKitTheme, findWeddingBackgroundPreset, findWeddingFrameForBackground, resolveWeddingChromeKit, weddingAiBackgroundKit, weddingAiKitSectionPatch, weddingHeroPhotoLayout, weddingKitFramePatch, weddingPairedFrameSectionPatch, weddingReadingPlate, weddingReadyBackgroundSectionPatch, weddingUsesPairedAiFrame } from './wedding-background-presets'
import { findWeddingCoverPreset } from './wedding-cover-presets'
import { getOrnamentComposition } from './wedding-ornament-layouts'
import { weddingStyleIdFromPrompt } from './build-wedding-image-prompt'
import { getWeddingTheme } from './wedding-theme'
import { applyWeddingFrameChoice, clearWeddingFrameChoice, mergeWeddingSectionConfig, parseWeddingSectionConfig, resolveDeviceStackPlace, resolveDeviceStackRotate, resolvePortraitShell, resolveShownCoverFrame, resolveShownPortraitShell, withDeviceShell, withoutPrivateShell } from './wedding-section-config'
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
  assert.ok(preset.ornaments.length >= 1 && preset.ornaments.length <= 2)
  assert.ok(preset.ornaments.every((item) => item.src.endsWith('.png')))
  assert.equal(preset.coverPresetId, 'pearl_rose')
  assert.equal(findWeddingBackgroundPreset('long-phung-do')?.coverPresetId, 'plain_photo')
  assert.equal(findWeddingBackgroundPreset('sen-vang')?.coverPresetId, 'sen_vang')
  assert.equal(findWeddingBackgroundPreset('do-son')?.coverPresetId, 'plain_photo')
  assert.equal(findWeddingBackgroundPreset('do-son')?.look.ink, '#fff8ee')
  assert.equal(findWeddingBackgroundPreset('do-son')?.look.surface, 'dark')
  assert.ok(findWeddingBackgroundPreset('do-son')?.ornaments.every((item) => item.src.includes('/do-son-')))
  assert.equal(findWeddingBackgroundPreset('hong-ngoc-trai')?.coverPresetId, 'pearl_rose')
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

test('the warm minimal set is the botanical plate, dried sprigs, and the polaroid frame', () => {
  const preset = findWeddingBackgroundPreset('toi-gian-nau')
  assert.ok(preset)
  assert.deepEqual(preset.plates, ['/wedding/backgrounds/toi-gian-nau.jpg'])
  assert.ok(preset.ornaments.length >= 1)
  assert.ok(preset.ornaments.every((item) => item.src.endsWith('/dried-sprig.png')))
  assert.equal(preset.coverPresetId, 'linen_polaroid')
  assert.equal(findWeddingCoverPreset('linen_polaroid')?.layout, 'composed')
  const composition = getOrnamentComposition('linen_polaroid')
  assert.equal(composition?.layout.id, 'polaroid')
  assert.equal(composition?.kit.panel, '#f7f2ea')
  assert.deepEqual(
    composition?.layout.layers.map((layer) => layer.piece),
    ['polaroid'],
  )
  assert.equal(composition?.layout.photo.x, 13.6)
  assert.ok((composition?.layout.photo.w ?? 0) > 50)
  const shown = resolveShownCoverFrame({}, 'linen_polaroid')
  assert.equal(shown.mode, 'preset')
  assert.equal(shown.presetId, 'linen_polaroid')
})

test('the green wood-flower set keeps readable paper and photo sprigs', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'hoa-moc-xanh'), [
    '/wedding/backgrounds/hoa-moc-xanh-paper.jpg',
  ])
  const preset = findWeddingBackgroundPreset('hoa-moc-xanh')
  assert.ok(preset)
  assert.equal(preset.coverPresetId, 'moc_portrait')
  assert.equal(preset.look.buttonColorId, 'forest')
  assert.equal(preset.look.ink, '#1f3d2b')
  assert.ok(preset.ornaments.length >= 1 && preset.ornaments.length <= 2)
  assert.ok(preset.ornaments.every((item) => item.src.includes('/moc-')))
  const frame = getOrnamentComposition('moc_portrait')
  assert.equal(frame?.layout.photoChrome, 'mat')
  assert.equal(frame?.kit.panel, '#fbf8f3')
  assert.ok(frame?.layout.layers.every((layer) => layer.piece.startsWith('moc')))
  assert.equal(findWeddingCoverPreset('moc_portrait')?.layout, 'composed')
})

test('the sage calla set uses sage paper and a bare photo', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'to-duyen-xanh'), [
    '/wedding/backgrounds/to-duyen-xanh-paper.jpg',
  ])
  const preset = findWeddingBackgroundPreset('to-duyen-xanh')
  assert.ok(preset)
  assert.equal(preset.coverPresetId, 'to_duyen_xanh')
  assert.equal(preset.look.buttonColorId, 'olive')
  assert.equal(preset.look.ink, '#3e4f34')
  assert.ok(preset.ornaments.every((item) => item.src.endsWith('/mist-sprig.png')))
  const frame = findWeddingCoverPreset('to_duyen_xanh')
  assert.equal(frame?.layout, 'plain')
  assert.equal(frame?.frame, undefined)
  const patch = weddingKitFramePatch(preset)
  assert.equal(patch.coverFrameMode, 'preset')
  assert.equal(patch.groomPortraitShellMode, 'none')
  assert.equal(patch.bridePortraitShellMode, 'none')
})

test('the envelope set uses palace paper and a letter cover', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'phong-bi-thu'), [
    '/wedding/backgrounds/phong-bi-paper.jpg',
  ])
  const preset = findWeddingBackgroundPreset('phong-bi-thu')
  assert.ok(preset)
  assert.equal(preset.coverPresetId, 'phong_bi')
  assert.equal(preset.look.buttonColorId, 'burgundy')
  const frame = findWeddingCoverPreset('phong_bi')
  assert.equal(frame?.layout, 'envelope')
  const patch = weddingKitFramePatch(preset)
  assert.equal(patch.coverFrameMode, 'preset')
  assert.equal(patch.groomPortraitShellMode, 'none')
  assert.equal(patch.bridePortraitShellMode, 'none')
})

test('the deep burgundy set uses ivory paper, corner flowers, and a bare photo', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'do-dam'), [
    '/wedding/backgrounds/do-dam-paper.jpg',
  ])
  const preset = findWeddingBackgroundPreset('do-dam')
  assert.ok(preset)
  assert.equal(preset.coverPresetId, 'do_dam')
  assert.equal(preset.look.buttonColorId, 'burgundy')
  assert.equal(preset.look.ink, '#4a1e2c')
  assert.equal(preset.look.styleId, 'minimal')
  assert.ok(preset.ornaments.every((item) => item.src.includes('/do-dam-')))
  const frame = findWeddingCoverPreset('do_dam')
  assert.equal(frame?.layout, 'plain')
  assert.equal(frame?.frame, undefined)
  const patch = weddingKitFramePatch(preset)
  assert.equal(patch.coverFrameMode, 'preset')
  assert.equal(patch.groomPortraitShellMode, 'none')
  assert.equal(patch.bridePortraitShellMode, 'none')
})

test('the sky rose set uses the garden photo and a sky frame', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'vuon-hong-troi'), [
    '/wedding/backgrounds/vuon-hong-troi.jpg',
  ])
  const preset = findWeddingBackgroundPreset('vuon-hong-troi')
  assert.equal(preset?.coverPresetId, 'vuon_hong_troi')
  assert.equal(preset?.look.styleId, 'floral')
  const frame = findWeddingCoverPreset('vuon_hong_troi')
  assert.equal(frame?.layout, 'frame')
  assert.match(frame?.frame?.src ?? '', /vuon-hong-troi-frame/)
  assert.equal(findWeddingCoverPreset('do_son')?.frame?.src.endsWith('/do-son-frame.webp'), true)
  const lotusFrame = findWeddingCoverPreset('sen_vang')
  assert.equal(lotusFrame?.layout, 'plain')
  assert.equal(lotusFrame?.frame, undefined)
})

test('a one-image preset is still one plate', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('', [], 'do-son'), ['/wedding/backgrounds/do-son.jpg'])
})

test('an unknown preset falls back to the master plate', () => {
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/master.jpg', [], 'missing'), [
    'https://cdn.example/master.jpg',
  ])
})

test('a ready background replaces the old frame so both columns share the new look', () => {
  const preset = findWeddingBackgroundPreset('do-son')
  assert.ok(preset)
  const oldFrame = mergeWeddingSectionConfig('{}', {
    coverFrameChosen: true,
    coverFrameMode: 'library',
    coverPresetId: 'classic_red',
    coverAiFrameUrl: 'https://cdn.example/old-frame.png',
    coverAiFrameHole: { x: 20, y: 20, w: 60, h: 60 },
    coverAiFramePanel: '#fffaf2',
    groomPortraitFrameChosen: true,
    groomPortraitShellMode: 'preset',
    groomPortraitShellPresetId: 'classic_red',
    heroPhotoLayout: 'stack',
  })
  const cleared = clearWeddingFrameChoice(clearWeddingFrameChoice(oldFrame, 'cover'), 'pair')
  const next = parseWeddingSectionConfig(mergeWeddingSectionConfig(cleared, weddingReadyBackgroundSectionPatch(preset)))
  assert.equal(next.backgroundPresetId, 'do-son')
  assert.equal(next.coverFrameChosen, undefined)
  assert.equal(next.coverFrameMode, 'preset')
  assert.equal(next.coverPresetId, preset.coverPresetId)
  assert.equal(next.coverAiFrameUrl, undefined)
  assert.equal(next.buttonColorId, preset.look.buttonColorId)
  assert.equal(next.heroPhotoLayout, undefined)
  assert.equal(weddingHeroPhotoLayout(preset), 'single')
  const shown = resolveShownCoverFrame(next, preset.coverPresetId, null)
  assert.equal(shown.mode, 'preset')
  assert.equal(shown.presetId, preset.coverPresetId)
})

test('the preset id survives a section config save and clears when emptied', () => {
  const saved = mergeWeddingSectionConfig('{"coverPresetId":"classic_red"}', { backgroundPresetId: 'sen-vang' })
  assert.equal(parseWeddingSectionConfig(saved).backgroundPresetId, 'sen-vang')
  assert.equal(parseWeddingSectionConfig(saved).coverPresetId, 'classic_red')
  const cleared = mergeWeddingSectionConfig(saved, { backgroundPresetId: '' })
  assert.equal(parseWeddingSectionConfig(cleared).backgroundPresetId, undefined)
  assert.equal(parseWeddingSectionConfig('{"backgroundPresetId":"nope"}').backgroundPresetId, undefined)
})

test('theme flowers stay in the margins so the letter center stays clear', () => {
  for (const preset of WEDDING_BACKGROUND_PRESETS) {
    assert.equal(preset.ornaments.some((item) => item.anchor !== 'bottom'), true, preset.id)
    const hasFoot = preset.ornaments.some((item) => item.anchor === 'bottom' || item.y >= 70)
    assert.equal(hasFoot, true, preset.id)
    for (const item of preset.ornaments) {
      assert.ok(item.w <= 28, `${preset.id} ${item.src}`)
      const center = item.x + item.w / 2
      const onLeft = center < 50
      assert.equal(onLeft ? item.x + item.w <= 12 : item.x >= 86, true, `${preset.id} ${item.src} x${item.x} w${item.w}`)
    }
  }
})

test('every ready background is one synchronized kit', () => {
  assert.ok(WEDDING_BACKGROUND_PRESETS.length >= 4)
  for (const preset of WEDDING_BACKGROUND_PRESETS) {
    assert.ok(preset.plates.length >= 1, preset.id)
    assert.ok(preset.ornaments.length >= 1, preset.id)
    assert.ok(preset.ornaments.every((item) => /\.(png|svg)$/i.test(item.src)), preset.id)
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
  const bare = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', weddingKitFramePatch(lotus)))
  assert.equal(bare.coverPresetId, 'sen_vang')
  assert.equal(bare.groomPortraitShellMode, 'none')
  assert.equal(bare.bridePortraitShellMode, 'none')
  assert.equal(resolvePortraitShell(bare, 'groom'), null)
  assert.equal(resolvePortraitShell(bare, 'bride'), null)
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
  assert.equal(parsed.coverPresetId, 'plain_photo')
  assert.equal(parsed.groomPortraitShellMode, 'none')
  assert.equal(parsed.bridePortraitShellMode, 'none')
  assert.deepEqual(weddingBackgroundPlateUrls('https://cdn.example/ai.jpg', [], parsed.backgroundPresetId), ['https://cdn.example/ai.jpg'])
  const chrome = resolveWeddingChromeKit(parsed)
  assert.ok(chrome)
  assert.equal(chrome.plates.length, 0)
  assert.equal(chrome.coverPresetId, 'plain_photo')
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

test('a portrait frame stays with the background even when a position picked another', () => {
  const kit = findWeddingBackgroundPreset('hong-ngoc-trai')
  assert.ok(kit)
  const blank = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', { backgroundPresetId: 'hong-ngoc-trai' }))
  const followed = resolveShownPortraitShell(blank, 'groom', kit.coverPresetId)
  assert.equal(followed?.src, '/wedding/covers/pearl-rose-frame.webp')
  assert.equal(resolveShownCoverFrame(blank, kit.coverPresetId).presetId, 'pearl_rose')
  const picked = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', {
    backgroundPresetId: 'hong-ngoc-trai',
    coverFrameChosen: true,
    coverFrameMode: 'library',
    coverAiFrameUrl: 'https://cdn.example/own-cover.png',
    coverAiFrameHole: { x: 20, y: 20, w: 60, h: 50 },
    groomPortraitFrameChosen: true,
    groomPortraitShellMode: 'library',
    groomPortraitShellUrl: 'https://cdn.example/own-frame.png',
    groomPortraitShellHole: { x: 20, y: 20, w: 60, h: 50 },
    groomPortraitShellPanel: '#fffaf2',
  }))
  assert.equal(resolveShownPortraitShell(picked, 'groom', kit.coverPresetId)?.src, followed?.src)
  assert.equal(resolveShownPortraitShell(picked, 'bride', kit.coverPresetId)?.src, followed?.src)
  assert.equal(resolveShownCoverFrame(picked, kit.coverPresetId).mode, 'preset')
  assert.equal(resolveShownCoverFrame(picked, kit.coverPresetId).presetId, 'pearl_rose')
  const stored = applyWeddingFrameChoice('{"backgroundPresetId":"hong-ngoc-trai","buttonColorId":"rose"}', JSON.stringify(picked))
  const saved = parseWeddingSectionConfig(stored)
  assert.equal(saved.backgroundPresetId, 'hong-ngoc-trai')
  assert.equal(saved.buttonColorId, 'rose')
  assert.equal(saved.groomPortraitShellUrl, 'https://cdn.example/own-frame.png')
  assert.equal(saved.bridePortraitFrameChosen, undefined)
  assert.equal(resolveShownPortraitShell(saved, 'groom', kit.coverPresetId)?.src, followed?.src)
  const shared = { mode: 'library' as const, imageUrl: 'https://cdn.example/shared-frame.png', hole: { x: 20, y: 20, w: 60, h: 50 }, panel: '#fffaf2' }
  assert.equal(resolveShownPortraitShell(blank, 'bride', kit.coverPresetId, shared)?.src, followed?.src)
  assert.equal(resolveShownCoverFrame(blank, kit.coverPresetId, { mode: 'none' }).mode, 'preset')
  assert.equal(resolveShownCoverFrame(blank, kit.coverPresetId, { mode: 'none' }).presetId, 'pearl_rose')
})

test('the dragon and phoenix set uses gold ink, a bare photo, and cloud ornaments', () => {
  const preset = findWeddingBackgroundPreset('long-phung-do')
  assert.ok(preset)
  assert.equal(preset.coverPresetId, 'plain_photo')
  assert.equal(findWeddingCoverPreset('plain_photo')?.layout, 'plain')
  assert.equal(findWeddingCoverPreset('plain_photo')?.frame, undefined)
  assert.equal(preset.look.ink, '#f6e4b8')
  assert.equal(preset.look.muted, '#e4d0a0')
  assert.equal(preset.look.accent, '#f3d27a')
  assert.equal(preset.look.buttonColorId, 'cream')
  assert.equal(preset.look.surface, 'dark')
  assert.equal(preset.look.paper, '#5c1018')
  assert.ok(preset.ornaments.every((item) => item.src.endsWith('/long-phung-cloud.svg')))
  const theme = applyWeddingKitTheme(getWeddingTheme('traditional_vietnamese'), preset)
  assert.equal(theme.darkPaper, '#5c1018')
  assert.equal(theme.text, 'text-[#f6e4b8]')
  assert.equal(theme.mutedText, 'text-[#e4d0a0]')
  const saved = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', {
    groomPortraitShellMode: 'preset',
    groomPortraitShellPresetId: 'pearl_rose',
    bridePortraitShellMode: 'preset',
    bridePortraitShellPresetId: 'pearl_rose',
  }))
  assert.equal(resolveShownCoverFrame(saved, preset.coverPresetId).presetId, 'plain_photo')
  assert.equal(resolveShownPortraitShell(saved, 'groom', preset.coverPresetId), null)
  assert.equal(resolveShownPortraitShell(saved, 'bride', preset.coverPresetId), null)
})

test('song hy red is a gate card on lacquer paper with cream reading cards', () => {
  const preset = findWeddingBackgroundPreset('song-hy-do')
  assert.ok(preset)
  assert.equal(preset.plates[0], '/wedding/backgrounds/song-hy-do.svg')
  assert.equal(preset.coverPresetId, 'song_hy')
  assert.equal(findWeddingCoverPreset('song_hy')?.layout, 'song_hy')
  assert.equal(preset.look.contentCard, 'scallop')
  assert.equal(preset.look.buttonColorId, 'cream')
  assert.ok(preset.ornaments.every((item) => item.src.endsWith('/song-hy-seal.svg')))
  const theme = applyWeddingKitTheme(getWeddingTheme('traditional_vietnamese'), preset)
  assert.equal(theme.contentCard, 'scallop')
  assert.equal(theme.darkPaper, '#4e1018')
  assert.equal(theme.text, 'text-[#7a1c28]')
  assert.equal(theme.pageBg, 'bg-[#4e1018]')
  const saved = parseWeddingSectionConfig(mergeWeddingSectionConfig('{}', weddingReadyBackgroundSectionPatch(preset)))
  assert.equal(weddingReadingPlate(preset, '/wedding/backgrounds/song-hy-do.svg', false), undefined)
  assert.equal(weddingReadingPlate(findWeddingBackgroundPreset('do-son'), '/wedding/backgrounds/do-son.jpg', true), '#6e1820')
  assert.equal(weddingReadingPlate(undefined, 'https://cdn.example/master.png', false), '#fff8f2')
  assert.equal(weddingReadingPlate(findWeddingBackgroundPreset('sen-vang'), '/wedding/backgrounds/sen-vang.jpg', false), undefined)
  assert.equal(saved.backgroundPresetId, 'song-hy-do')
  assert.equal(saved.coverPresetId, 'song_hy')
  assert.equal(saved.buttonColorId, 'cream')
  assert.equal(resolveShownCoverFrame(saved, preset.coverPresetId).presetId, 'song_hy')
  assert.equal(resolveShownPortraitShell(saved, 'groom', preset.coverPresetId), null)
})
