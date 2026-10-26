import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWeddingPrompt } from './build-wedding-image-prompt'
import { WEDDING_STYLE_PRESETS } from './wedding-style-presets'

test('background plate prompt forbids a frame and keeps dense pattern on the sides', () => {
  const prompt = buildWeddingPrompt({
    type: 'master',
    style: 'vintage',
    palette: 'champagne gold',
    groomName: 'An',
    brideName: 'Lan',
    venue: 'Hanoi',
    extraPrompt: 'hoa sen',
    hasReference: true,
    hasCustomReference: true,
    applyStyle: false,
  })
  assert.match(prompt, /NO FRAME LINES/)
  assert.match(prompt, /SIDE PATTERN ONLY/)
  assert.match(prompt, /FAINT CENTER/)
  assert.match(prompt, /middle 42%/)
  assert.match(prompt, /no frame lines anywhere/)
  assert.match(prompt, /hoa sen/)
  assert.doesNotMatch(prompt, /engraved border feeling/)
  assert.doesNotMatch(prompt, /luxury outer frame/)
  assert.doesNotMatch(prompt, /centerpiece energy/)
  assert.match(prompt, /Do NOT paste the wreath/)
  assert.doesNotMatch(prompt, /Vintage heirloom/)
  assert.doesNotMatch(prompt, /Global style preset/)
})

test('background prompt keeps the chosen style when there is no reference image', () => {
  const prompt = buildWeddingPrompt({
    type: 'master',
    style: 'floral',
    palette: 'rose, cream',
    groomName: 'An',
    brideName: 'Lan',
    venue: '',
    extraPrompt: '',
    hasReference: false,
    applyStyle: true,
  })
  assert.match(prompt, /Refined complex floral wedding stationery/)
  assert.match(prompt, /peony/)
  assert.match(prompt, /rose, cream/)
  assert.match(prompt, /intricate refined florals/)
})

test('ethereal background uses a few artistic strokes and keeps minimal as its own style', () => {
  const prompt = buildWeddingPrompt({
    type: 'master',
    style: 'ethereal',
    palette: 'ivory paper',
    groomName: 'An',
    brideName: 'Lan',
    venue: '',
    extraPrompt: '',
    hasReference: false,
    applyStyle: true,
  })
  assert.match(prompt, /FEW STROKES ONLY/)
  assert.match(prompt, /very few strokes/)
  assert.match(prompt, /only a few artistic strokes/)
  assert.doesNotMatch(prompt, /dense pattern grows inward/)
  assert.equal(WEDDING_STYLE_PRESETS[1]?.id, 'minimal')
  assert.equal(WEDDING_STYLE_PRESETS.some((preset) => preset.id === 'ethereal'), true)
  assert.equal(WEDDING_STYLE_PRESETS.some((preset) => preset.id === 'floral'), true)
})
