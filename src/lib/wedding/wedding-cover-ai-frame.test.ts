import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { buildCoverFrameHoleMask, measureCoverFrameContentBox } from './cover-frame-hole-mask'
import { buildWeddingCoverFramePrompt } from './build-wedding-cover-frame-prompt'
import { measureCoverFrameHole } from './measure-cover-frame-hole'
import { mergeWeddingSectionConfig, parseWeddingSectionConfig, resolveCoverAiFrame, resolveCoverFrameMode, resolveCoverFrameOpen, resolveCoverPhotoOpen, resolvePortraitShell } from './wedding-section-config'

test('cover frame prompt keeps one flat canvas so the logo mask can open the center', () => {
  const prompt = buildWeddingCoverFramePrompt({
    styleLabel: 'Luxury',
    palette: 'champagne gold',
    extraPrompt: 'peonies',
  })
  assert.match(prompt, /#F4F1EA/)
  assert.match(prompt, /logo mark/)
  assert.match(prompt, /letter O/)
  assert.match(prompt, /vertical ellipse/)
  assert.match(prompt, /peonies/)
  const heart = buildWeddingCoverFramePrompt({
    styleLabel: 'Luxury',
    palette: 'rose',
    extraPrompt: '',
    openingShape: 'heart',
  })
  assert.match(heart, /classic heart/)
  assert.doesNotMatch(heart, /vertical ellipse/)
})

test('measureCoverFrameHole reads the transparent center after background removal', async () => {
  const width = 200
  const height = 260
  const border = 30
  const raw = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const inside = x >= border && x < width - border && y >= border && y < height - border
      raw[i] = 180
      raw[i + 1] = 40
      raw[i + 2] = 50
      raw[i + 3] = inside ? 0 : 255
    }
  }
  const png = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()
  const hole = await measureCoverFrameHole(png)
  assert.ok(hole)
  assert.ok(Math.abs(hole.x - 15) < 1.5, `x ${hole.x}`)
  assert.ok(Math.abs(hole.y - (30 / 260) * 100) < 1.5, `y ${hole.y}`)
  assert.ok(hole.w > 65 && hole.w < 75, `w ${hole.w}`)
  assert.ok(hole.h > 70 && hole.h < 82, `h ${hole.h}`)

  raw[(Math.floor(height / 2) * width + Math.floor(width / 2)) * 4 + 3] = 255
  const blocked = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()
  assert.equal(await measureCoverFrameHole(blocked), null)
})

test('hole mask follows a round opening and keeps a rectangular opening rectangular', () => {
  const width = 200
  const height = 260
  const cx = 100
  const cy = 130
  const inner = 58
  const round = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.hypot(dx, dy)
      const i = (y * width + x) * 4
      const ring = dist >= inner && dist <= 92
      round[i + 3] = ring ? 255 : 0
    }
  }
  const circle = buildCoverFrameHoleMask(round, width, height, { x: cx, y: cy })
  assert.ok(circle)
  const alphaAt = (mask: Uint8ClampedArray, x: number, y: number) => mask[(y * width + x) * 4 + 3]
  assert.equal(alphaAt(circle.rgba, cx, cy), 255)
  assert.equal(alphaAt(circle.rgba, 0, 0), 0)
  assert.equal(alphaAt(circle.rgba, cx + 40, cy), 255)
  assert.equal(alphaAt(circle.rgba, cx + inner, cy + inner), 0)
  const content = measureCoverFrameContentBox(round, width, height)
  assert.ok(content)
  assert.ok(content.y > 8, `content y ${content.y}`)
  assert.ok(content.w < 96 && content.h < 90, `content ${content.w}x${content.h}`)

  const border = 30
  const rect = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = x >= border && x < width - border && y >= border && y < height - border
      rect[(y * width + x) * 4 + 3] = inside ? 0 : 255
    }
  }
  const square = buildCoverFrameHoleMask(rect, width, height)
  assert.ok(square)
  assert.equal(alphaAt(square.rgba, cx, cy), 255)
  assert.equal(alphaAt(square.rgba, 5, 5), 0)
  assert.ok(square.box.w > 65 && square.box.w < 78, `w ${square.box.w}`)
  assert.ok(square.box.h > 72 && square.box.h < 84, `h ${square.box.h}`)
  assert.equal(measureCoverFrameContentBox(rect, width, height), null)
})

test('section config keeps an AI frame and drops it when the url is cleared', () => {
  const saved = mergeWeddingSectionConfig('{"coverPresetId":"classic_red"}', {
    coverAiFrameUrl: 'https://cdn.example/frame.png',
    coverAiFrameHole: { x: 14.44, y: 12.5, w: 71.11, h: 63.33 },
    coverAiFramePanel: '#fffaf2',
    coverAiFrameInk: 'dark',
  })
  const parsed = parseWeddingSectionConfig(saved)
  const frame = resolveCoverAiFrame(parsed)
  assert.equal(frame?.src, 'https://cdn.example/frame.png')
  assert.equal(frame?.hole.x, 14.44)
  assert.equal(frame?.hole.w, 71.11)
  assert.equal(parsed.coverPresetId, 'classic_red')
  assert.equal(resolveCoverFrameMode(parsed), 'ai')
  assert.equal(resolveCoverPhotoOpen(parsed), 'rise')
  assert.equal(resolveCoverFrameOpen(parsed), 'bloom')

  const withEffects = mergeWeddingSectionConfig(saved, {
    coverFrameMode: 'none',
    coverPhotoOpen: 'assemble',
    coverFrameOpen: 'bloom',
  })
  const effects = parseWeddingSectionConfig(withEffects)
  assert.equal(resolveCoverFrameMode(effects), 'none')
  assert.equal(resolveCoverPhotoOpen(effects), 'assemble')
  assert.equal(resolveCoverFrameOpen(effects), 'bloom')
  assert.equal(effects.coverPresetId, 'classic_red')

  const cleared = mergeWeddingSectionConfig(saved, { coverAiFrameUrl: '' })
  assert.equal(resolveCoverAiFrame(parseWeddingSectionConfig(cleared)), null)
  assert.equal(parseWeddingSectionConfig(cleared).coverPresetId, 'classic_red')
})

test('bride and groom portraits keep their own frame choice', () => {
  const saved = mergeWeddingSectionConfig('{}', {
    groomPortraitShellMode: 'preset',
    groomPortraitShellPresetId: 'classic_red',
    bridePortraitShellMode: 'library',
    bridePortraitShellUrl: 'https://cdn.example/heart.png',
    bridePortraitShellHole: { x: 20, y: 18, w: 60, h: 55 },
    bridePortraitShellPanel: '#fffaf2',
  })
  const parsed = parseWeddingSectionConfig(saved)
  assert.equal(resolvePortraitShell(parsed, 'groom')?.src, '/wedding/covers/classic-red.webp')
  assert.equal(resolvePortraitShell(parsed, 'bride')?.src, 'https://cdn.example/heart.png')
  const cleared = mergeWeddingSectionConfig(saved, { groomPortraitShellMode: undefined })
  assert.equal(resolvePortraitShell(parseWeddingSectionConfig(cleared), 'groom'), null)
  assert.equal(resolvePortraitShell(parseWeddingSectionConfig(cleared), 'bride')?.src, 'https://cdn.example/heart.png')
})
