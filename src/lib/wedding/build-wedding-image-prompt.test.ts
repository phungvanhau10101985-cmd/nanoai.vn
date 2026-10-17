import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWeddingPrompt } from './build-wedding-image-prompt'

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
})
